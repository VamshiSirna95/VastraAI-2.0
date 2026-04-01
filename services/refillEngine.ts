import { getDb } from '../db/database';

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

export async function getRefillSuggestions(): Promise<RefillSuggestion[]> {
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
    const avgDailySales = Math.max(1, Math.round(totalStock / 30));
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
