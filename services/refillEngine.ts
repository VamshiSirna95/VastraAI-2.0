import { getDb, getAvgDailySalesFromData, createPO, addPOItem } from '../db/database';

export interface RefillSuggestion {
  productId: string;
  productName: string;
  garmentType: string;
  currentStock: number;
  stockCoverDays: number;
  suggestedQty: number;
  urgency: 'critical' | 'soon' | 'plan';
  bestVendor: { id: string; name: string; rank: string } | null;
  estimatedValue: number;
}

function rankFromScore(score: number): string {
  if (score >= 95) return 'S+';
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}

let refillCache: { data: RefillSuggestion[]; timestamp: number } | null = null;
const REFILL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function invalidateRefillCache(): void {
  refillCache = null;
}

export async function getRefillSuggestions(): Promise<RefillSuggestion[]> {
  if (refillCache && Date.now() - refillCache.timestamp < REFILL_CACHE_TTL) {
    return refillCache.data;
  }
  const data = await _computeRefillSuggestions();
  refillCache = { data, timestamp: Date.now() };
  return data;
}

async function _computeRefillSuggestions(): Promise<RefillSuggestion[]> {
  const db = getDb();

  const products = await db.getAllAsync<{
    id: string;
    design_name: string | null;
    garment_type: string | null;
    purchase_price: number | null;
    total_stock: number;
  }>(
    `SELECT p.id, p.design_name, p.garment_type, p.purchase_price,
       COALESCE(SUM(ss.total_qty), 0) as total_stock
     FROM products p
     LEFT JOIN store_stock ss ON ss.product_id = p.id
     GROUP BY p.id
     HAVING total_stock < 20
     ORDER BY total_stock ASC
     LIMIT 50`
  );

  const suggestions: RefillSuggestion[] = [];

  for (const p of products) {
    const totalStock = p.total_stock;
    const salesAvg = await getAvgDailySalesFromData(p.id);
    const avgDailySales = salesAvg > 0 ? salesAvg : Math.max(1, Math.round(totalStock / 30));
    const stockCover = totalStock > 0 ? Math.round(totalStock / avgDailySales) : 0;
    const urgency: RefillSuggestion['urgency'] = stockCover < 7 ? 'critical' : stockCover < 14 ? 'soon' : 'plan';
    const suggestedQty = Math.max(10, (30 - stockCover) * avgDailySales);

    const lastVendor = await db.getFirstAsync<{ id: string; name: string; rating: number | null }>(
      `SELECT v.id, v.name, v.rating FROM vendors v
       JOIN purchase_orders po ON po.vendor_id = v.id
       JOIN po_items pi ON pi.po_id = po.id
       WHERE pi.product_id = ? AND (v.is_active = 1 OR v.is_active IS NULL)
       ORDER BY po.created_at DESC LIMIT 1`,
      [p.id]
    );

    suggestions.push({
      productId: p.id,
      productName: p.design_name ?? 'Unnamed Product',
      garmentType: p.garment_type ?? '',
      currentStock: totalStock,
      stockCoverDays: stockCover,
      suggestedQty,
      urgency,
      bestVendor: lastVendor
        ? { id: lastVendor.id, name: lastVendor.name, rank: rankFromScore(lastVendor.rating ?? 0) }
        : null,
      estimatedValue: suggestedQty * (p.purchase_price ?? 0),
    });
  }

  return suggestions.sort((a, b) => a.stockCoverDays - b.stockCoverDays);
}

async function getHistoricalSizeRatio(productId: string, totalQty: number): Promise<{
  size_s: number; size_m: number; size_l: number; size_xl: number; size_xxl: number; size_free: number;
}> {
  const db = getDb();
  const last = await db.getFirstAsync<{
    size_s: number; size_m: number; size_l: number;
    size_xl: number; size_xxl: number; size_free: number; total_qty: number;
  }>(
    `SELECT size_s, size_m, size_l, size_xl, size_xxl, size_free, total_qty
     FROM po_items WHERE product_id = ? AND total_qty > 0
     ORDER BY created_at DESC LIMIT 1`,
    [productId]
  );

  if (last && last.total_qty > 0) {
    const t = last.total_qty;
    return {
      size_s:   Math.round((last.size_s / t) * totalQty),
      size_m:   Math.round((last.size_m / t) * totalQty),
      size_l:   Math.round((last.size_l / t) * totalQty),
      size_xl:  Math.round((last.size_xl / t) * totalQty),
      size_xxl: Math.round((last.size_xxl / t) * totalQty),
      size_free: Math.round((last.size_free / t) * totalQty),
    };
  }
  // Default: equal split across S/M/L/XL
  const each = Math.floor(totalQty / 4);
  const rem = totalQty - each * 4;
  return { size_s: each, size_m: each + rem, size_l: each, size_xl: each, size_xxl: 0, size_free: 0 };
}

export async function generateRefillPO(suggestions: RefillSuggestion[]): Promise<number> {
  const byVendor: Record<string, RefillSuggestion[]> = {};
  for (const s of suggestions) {
    if (s.bestVendor) {
      const vid = s.bestVendor.id;
      if (!byVendor[vid]) byVendor[vid] = [];
      byVendor[vid].push(s);
    }
  }

  let poCount = 0;
  for (const [vendorId, items] of Object.entries(byVendor)) {
    const poId = await createPO({
      vendor_id: vendorId,
      status: 'draft',
      notes: `Auto-generated refill PO for ${items.length} item${items.length > 1 ? 's' : ''}`,
    });

    for (const item of items) {
      const sizes = await getHistoricalSizeRatio(item.productId, Math.round(item.suggestedQty));
      const unitPrice = item.suggestedQty > 0 ? item.estimatedValue / item.suggestedQty : 0;
      await addPOItem({
        po_id: poId,
        product_id: item.productId,
        ...sizes,
        unit_price: unitPrice,
      });
    }

    poCount++;
  }

  return poCount;
}

export async function generatePlanPOs(
  items: Array<{ category: string; target_qty?: number | null; target_value?: number | null; vendor_ids?: string | null }>,
  planName: string
): Promise<number> {
  // Group by first selected vendor, or create one PO without vendor
  const byVendor: Record<string, typeof items> = {};
  for (const item of items) {
    let vendorIds: string[] = [];
    try { vendorIds = JSON.parse(item.vendor_ids ?? '[]') as string[]; } catch { vendorIds = []; }
    const vid = vendorIds[0] ?? '__none__';
    if (!byVendor[vid]) byVendor[vid] = [];
    byVendor[vid].push(item);
  }

  let poCount = 0;
  for (const [vendorId, planItems] of Object.entries(byVendor)) {
    const totalQty = planItems.reduce((s, i) => s + (i.target_qty ?? 0), 0);
    const totalValue = planItems.reduce((s, i) => s + (i.target_value ?? 0), 0);
    const categories = planItems.map((i) => i.category).join(', ');
    await createPO({
      vendor_id: vendorId === '__none__' ? '' : vendorId,
      status: 'draft',
      notes: `${planName} plan — ${categories} — ${totalQty} pcs target · ₹${totalValue.toLocaleString('en-IN')}`,
    });
    poCount++;
  }

  return poCount;
}
