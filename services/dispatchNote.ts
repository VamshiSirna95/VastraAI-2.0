import * as Print from 'expo-print';
import { getDb, getDispatchNotes, createDispatchNote, getNextDispatchSeq } from '../db/database';
import type { DispatchNoteItem } from '../db/types';

// ── Dispatch number generation ────────────────────────────────────────────────

function getYYMM(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
}

async function generateDispatchNumber(): Promise<string> {
  const yyyymm = getYYMM();
  const seq = await getNextDispatchSeq(yyyymm);
  return `KMF/DN/${yyyymm}/${String(seq).padStart(3, '0')}`;
}

// ── Generate dispatch notes after allocation ──────────────────────────────────

export async function generateDispatchNotes(grnId: string): Promise<number> {
  const db = getDb();

  // Get all allocations for this GRN grouped by store
  const allocations = await db.getAllAsync<{
    store_id: number;
    store_name: string;
    product_id: string;
    product_name: string;
    size_allocations_json: string;
    total_allocated: number;
  }>(
    `SELECT sa.store_id, s.name as store_name, sa.product_id,
       p.design_name as product_name,
       sa.size_allocations_json, sa.total_allocated
     FROM stock_allocations sa
     LEFT JOIN stores s ON s.id = sa.store_id
     LEFT JOIN products p ON p.id = sa.product_id
     WHERE sa.grn_id = ? AND sa.total_allocated > 0`,
    [grnId]
  );

  if (allocations.length === 0) return 0;

  // Group by store
  const byStore = new Map<number, { storeName: string; items: DispatchNoteItem[] }>();
  for (const alloc of allocations) {
    if (!byStore.has(alloc.store_id)) {
      byStore.set(alloc.store_id, { storeName: alloc.store_name, items: [] });
    }
    const sizeAllocations = alloc.size_allocations_json
      ? (JSON.parse(alloc.size_allocations_json) as Record<string, number>)
      : {};
    byStore.get(alloc.store_id)!.items.push({
      productId: alloc.product_id,
      productName: alloc.product_name ?? 'Unknown',
      sizeAllocations,
      totalQty: alloc.total_allocated,
    });
  }

  // Delete existing dispatch notes for this GRN before regenerating
  await db.runAsync(`DELETE FROM dispatch_notes WHERE grn_id = ?`, [grnId]);

  let created = 0;
  for (const [storeId, { items }] of byStore.entries()) {
    const dispatchNumber = await generateDispatchNumber();
    const totalQty = items.reduce((s, i) => s + i.totalQty, 0);
    await createDispatchNote({
      grn_id: grnId,
      store_id: storeId,
      dispatch_number: dispatchNumber,
      items_json: JSON.stringify(items),
      total_items: items.length,
      total_qty: totalQty,
      status: 'generated',
    });
    created++;
  }
  return created;
}

// ── PDF generation ────────────────────────────────────────────────────────────

function formatDate(iso?: string): string {
  if (!iso) return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function buildDispatchHtml(
  dispatchNumber: string,
  storeName: string,
  items: DispatchNoteItem[],
  createdAt: string,
): string {
  const dateStr = formatDate(createdAt);

  const itemRows = items.map((item) => {
    const sizeEntries = Object.entries(item.sizeAllocations).filter(([, qty]) => qty > 0);
    const sizeHeaderCells = sizeEntries.map(([sz]) => `<th>${sz}</th>`).join('');
    const sizeQtyCells = sizeEntries.map(([, qty]) => `<td>${qty}</td>`).join('');
    return `
      <tr>
        <td colspan="100%" style="padding: 6px 8px; font-weight: bold; border-bottom: 1px solid #ddd;">
          ${item.productName}
        </td>
      </tr>
      <tr style="background: #f9f9f9;">
        <th style="padding: 4px 8px; text-align: left;">Size</th>
        ${sizeHeaderCells}
        <th style="padding: 4px 8px;">Total</th>
      </tr>
      <tr>
        <td style="padding: 4px 8px;">Qty</td>
        ${sizeQtyCells}
        <td style="padding: 4px 8px; font-weight: bold;">${item.totalQty}</td>
      </tr>`;
  }).join('');

  const totalQty = items.reduce((s, i) => s + i.totalQty, 0);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; margin: 24px; color: #222; }
  h1 { font-size: 22px; letter-spacing: 2px; color: #1a1a1a; }
  .meta { margin-bottom: 16px; color: #444; font-size: 13px; }
  .meta td { padding: 2px 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: center; font-size: 12px; }
  th { background: #e8e8e8; }
  .footer { margin-top: 40px; display: flex; justify-content: space-between; }
  .sig-line { border-top: 1px solid #222; padding-top: 4px; min-width: 160px; font-size: 12px; color: #555; }
</style>
</head>
<body>
  <h1>DISPATCH NOTE</h1>
  <table class="meta" style="border:none; margin-bottom:16px;">
    <tr><td><b>Dispatch No.</b></td><td>${dispatchNumber}</td><td><b>Date</b></td><td>${dateStr}</td></tr>
    <tr><td><b>From</b></td><td>KMF Warehouse</td><td><b>To</b></td><td>${storeName}</td></tr>
    <tr><td><b>Total Items</b></td><td>${items.length}</td><td><b>Total Qty</b></td><td>${totalQty}</td></tr>
  </table>

  <table>
    ${itemRows}
  </table>

  <div class="footer">
    <div class="sig-line">Dispatched by: _____________________</div>
    <div class="sig-line">Received by: _____________________</div>
  </div>
</body>
</html>`;
}

export async function generateDispatchPDF(dispatchNoteId: number): Promise<string> {
  const { getDispatchNote } = await import('../db/database');
  const note = await getDispatchNote(dispatchNoteId);
  if (!note) throw new Error('Dispatch note not found');

  const items: DispatchNoteItem[] = note.items_json ? (JSON.parse(note.items_json) as DispatchNoteItem[]) : [];
  const html = buildDispatchHtml(
    note.dispatch_number,
    note.store_name ?? 'Store',
    items,
    note.created_at,
  );

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}
