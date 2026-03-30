import * as Print from 'expo-print';
import type { PurchaseOrder, POItem, Vendor, PurchaseTrip } from '../db/types';

// ── helpers ───────────────────────────────────────────────────────────────────

function formatINR(val: number): string {
  return '₹' + val.toLocaleString('en-IN');
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

// Size label → POItem column map
const SIZE_LABELS = ['S', 'M', 'L', 'XL', 'XXL', 'Free'] as const;
const SIZE_COLS: (keyof POItem)[] = ['size_s', 'size_m', 'size_l', 'size_xl', 'size_xxl', 'size_free'];

function getItemSizes(item: POItem): { label: string; qty: number }[] {
  return SIZE_COLS.map((col, i) => ({ label: SIZE_LABELS[i], qty: (item[col] as number) ?? 0 }))
    .filter((s) => s.qty > 0);
}

// ── HTML template ─────────────────────────────────────────────────────────────

function buildHtml(
  po: PurchaseOrder,
  poItems: (POItem & { design_name?: string; garment_type?: string; fabric?: string })[],
  vendor: Vendor | null | undefined,
  trip?: PurchaseTrip | null,
): string {
  const dateStr = formatDate(po.created_at);
  const deliveryStr = po.delivery_date ? formatDate(po.delivery_date) : '—';

  const articlesHtml = poItems.map((item, idx) => {
    const sizes = getItemSizes(item);
    const sizeHeaderCells = sizes.map((s) => `<th>${s.label}</th>`).join('');
    const sizeQtyCells = sizes.map((s) => `<td>${s.qty}</td>`).join('');
    const sizeValCells = sizes.map((s) => `<td>${formatINR(s.qty * item.unit_price)}</td>`).join('');
    const name = item.design_name ?? `Article ${idx + 1}`;
    const type = item.garment_type ?? '';
    const fabric = (item as { fabric?: string }).fabric ?? '';
    const attrs = [type, fabric].filter(Boolean).join(' · ');

    return `
      <div class="article">
        <div class="article-header">ARTICLE ${idx + 1}: ${name}</div>
        ${attrs ? `<div class="article-sub">${attrs}</div>` : ''}
        <div class="article-price">Unit Price: ${formatINR(item.unit_price)}</div>
        <table class="size-table">
          <thead>
            <tr>
              <th>SIZE</th>
              ${sizeHeaderCells}
              <th>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>QTY</strong></td>
              ${sizeQtyCells}
              <td><strong>${item.total_qty}</strong></td>
            </tr>
            <tr>
              <td><strong>VALUE</strong></td>
              ${sizeValCells}
              <td><strong>${formatINR(item.total_price)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>`;
  }).join('');

  const vendorName = vendor?.name ?? po.vendor_id;
  const vendorLines: string[] = [];
  if (vendor?.contact_person) vendorLines.push(vendor.contact_person);
  if (vendor?.address_line1) vendorLines.push(vendor.address_line1);
  if (vendor?.address_line2) vendorLines.push(vendor.address_line2);
  const cityLine = [vendor?.city, vendor?.state, vendor?.pincode].filter(Boolean).join(', ');
  if (cityLine) vendorLines.push(cityLine);
  else if (vendor?.area) vendorLines.push(vendor.area);
  if (vendor?.phone) vendorLines.push(`Ph: ${vendor.phone}`);
  if (vendor?.gstin) vendorLines.push(`GSTIN: ${vendor.gstin}`);
  const vendorDetail = vendorLines.join('<br/>');
  const tripMeta = trip ? `<div class="meta-row"><span class="meta-label">Trip</span><span class="meta-value">${trip.name}</span></div>` : '';
  const notesHtml = po.notes
    ? `<div class="notes-section"><strong>Notes:</strong><br/>${po.notes}</div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, Helvetica, Arial, sans-serif;
    font-size: 12px;
    color: #111;
    background: #fff;
    padding: 32px;
  }
  .doc-header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #111; padding-bottom: 12px; }
  .doc-title { font-size: 22px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; }
  .doc-subtitle { font-size: 11px; color: #555; margin-top: 4px; }
  .meta-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
  .meta-label { color: #555; }
  .meta-value { font-weight: 600; }
  .divider { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
  .parties { display: flex; justify-content: space-between; margin: 16px 0; gap: 20px; }
  .party { flex: 1; }
  .party-title { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #888; margin-bottom: 6px; }
  .party-name { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
  .party-detail { font-size: 11px; color: #555; line-height: 1.5; }
  .articles-section { margin-top: 8px; }
  .article { margin-bottom: 20px; border: 1px solid #e0e0e0; border-radius: 4px; overflow: hidden; }
  .article-header { background: #f5f5f5; padding: 8px 12px; font-weight: 700; font-size: 13px; }
  .article-sub { padding: 4px 12px; font-size: 11px; color: #666; border-bottom: 1px solid #eee; }
  .article-price { padding: 4px 12px 8px; font-size: 12px; font-weight: 600; color: #333; }
  .size-table { width: 100%; border-collapse: collapse; }
  .size-table th, .size-table td { border: 1px solid #e0e0e0; padding: 6px 10px; text-align: center; font-size: 11px; }
  .size-table th { background: #fafafa; font-weight: 700; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }
  .summary-section { margin-top: 16px; background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 4px; padding: 14px; }
  .summary-title { font-weight: 800; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 10px; }
  .summary-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; }
  .summary-total { font-weight: 700; font-size: 14px; border-top: 1px solid #ccc; padding-top: 8px; margin-top: 6px; display: flex; justify-content: space-between; }
  .terms-section { margin-top: 16px; }
  .terms-title { font-weight: 700; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #888; margin-bottom: 8px; }
  .terms-list { font-size: 11px; color: #555; line-height: 2; list-style: none; padding: 0; }
  .terms-list li::before { content: "• "; }
  .notes-section { margin-top: 12px; font-size: 11px; color: #555; border-top: 1px solid #eee; padding-top: 10px; }
  .footer { margin-top: 32px; border-top: 1px solid #ddd; padding-top: 12px; font-size: 10px; color: #aaa; text-align: center; }
</style>
</head>
<body>

<div class="doc-header">
  <div class="doc-title">Purchase Order</div>
  <div class="doc-subtitle">K.M. Fashions · Hyderabad, Telangana</div>
</div>

<div class="meta-row"><span class="meta-label">PO Number</span><span class="meta-value">${po.po_number}</span></div>
<div class="meta-row"><span class="meta-label">Date</span><span class="meta-value">${dateStr}</span></div>
${tripMeta}

<hr class="divider"/>

<div class="parties">
  <div class="party">
    <div class="party-title">From</div>
    <div class="party-name">K.M. Fashions</div>
    <div class="party-detail">Hyderabad, Telangana<br/>India</div>
  </div>
  <div class="party">
    <div class="party-title">To (Vendor)</div>
    <div class="party-name">${vendorName}</div>
    <div class="party-detail">${vendorDetail}</div>
  </div>
</div>

<hr class="divider"/>

<div class="articles-section">
  ${articlesHtml}
</div>

<div class="summary-section">
  <div class="summary-title">Summary</div>
  <div class="summary-row"><span>Total Articles</span><span>${poItems.length}</span></div>
  <div class="summary-row"><span>Requested Delivery</span><span>${deliveryStr}</span></div>
  <div class="summary-total"><span>Total Quantity</span><span>${po.total_qty} pcs</span></div>
  <div class="summary-total"><span>Total Value</span><span>${formatINR(po.total_value)}</span></div>
</div>

${notesHtml}

<div class="terms-section">
  <div class="terms-title">Terms</div>
  <ul class="terms-list">
    <li>Quality must match approved samples</li>
    <li>Short delivery subject to debit note</li>
    <li>GST as applicable</li>
  </ul>
</div>

<div class="footer">
  Generated by VastraAI · ${dateStr}
</div>

</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generatePODocument(
  po: PurchaseOrder,
  poItems: (POItem & { design_name?: string; garment_type?: string; fabric?: string })[],
  vendor: Vendor | null | undefined,
  trip?: PurchaseTrip | null,
): Promise<string> {
  const html = buildHtml(po, poItems, vendor, trip);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}
