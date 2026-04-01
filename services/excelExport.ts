import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { POSummaryReport, GRNSummaryReport, TripBudgetReport } from '../db/database';
import { getDb } from '../db/database';

// ── Helpers ────────────────────────────────────────────────────────────────────

async function writeAndShare(wb: XLSX.WorkBook, filename: string): Promise<void> {
  const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, wbout, { encoding: FileSystem.EncodingType.Base64 });
  const available = await Sharing.isAvailableAsync();
  if (available) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: filename,
      UTI: 'com.microsoft.excel.xlsx',
    });
  }
}

// ── PO Summary Export ─────────────────────────────────────────────────────────

export async function exportPOSummaryExcel(report: POSummaryReport): Promise<void> {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Overview
  const overview = [
    ['PO Summary Report', ''],
    ['Generated', new Date().toLocaleDateString('en-IN')],
    ['', ''],
    ['Total POs', report.total],
    ['Total Value (₹)', report.totalValue],
  ];
  const wsOverview = XLSX.utils.aoa_to_sheet(overview);
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Overview');

  // Sheet 2: By Status
  const statusData = [
    ['Status', 'Count', 'Value (₹)'],
    ...report.byStatus.map((r) => [r.status, r.count, r.value]),
  ];
  const wsStatus = XLSX.utils.aoa_to_sheet(statusData);
  XLSX.utils.book_append_sheet(wb, wsStatus, 'By Status');

  // Sheet 3: Top Vendors
  const vendorData = [
    ['Vendor', 'PO Count', 'Total Value (₹)'],
    ...report.topVendors.map((r) => [r.vendor_name ?? 'Unknown', r.count, r.value]),
  ];
  const wsVendors = XLSX.utils.aoa_to_sheet(vendorData);
  XLSX.utils.book_append_sheet(wb, wsVendors, 'Top Vendors');

  await writeAndShare(wb, 'PO_Summary_Report.xlsx');
}

// ── GRN Summary Export ────────────────────────────────────────────────────────

export async function exportGRNSummaryExcel(report: GRNSummaryReport): Promise<void> {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Overview
  const overview = [
    ['GRN Summary Report', ''],
    ['Generated', new Date().toLocaleDateString('en-IN')],
    ['', ''],
    ['Total GRNs', report.totalGRNs],
    ['Total Ordered', report.totalOrdered],
    ['Total Received', report.totalReceived],
    ['Total Accepted', report.totalAccepted],
    ['Total Rejected', report.totalRejected],
    ['Acceptance Rate (%)', report.acceptanceRate],
  ];
  const wsOverview = XLSX.utils.aoa_to_sheet(overview);
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Overview');

  // Sheet 2: By Vendor
  const vendorData = [
    ['Vendor', 'Ordered', 'Accepted', 'Acceptance Rate (%)'],
    ...report.byVendor.map((r) => [r.vendor_name ?? 'Unknown', r.ordered, r.accepted, r.acceptance_rate]),
  ];
  const wsVendors = XLSX.utils.aoa_to_sheet(vendorData);
  XLSX.utils.book_append_sheet(wb, wsVendors, 'By Vendor');

  await writeAndShare(wb, 'GRN_Summary_Report.xlsx');
}

// ── Trip Budget Export ────────────────────────────────────────────────────────

export async function exportTripBudgetExcel(report: TripBudgetReport): Promise<void> {
  const wb = XLSX.utils.book_new();

  const tripData = [
    ['Trip Name', 'Budget (₹)', 'Spent (₹)', 'Remaining (₹)', 'Utilisation (%)', 'PO Count'],
    ...report.trips.map((t) => [
      t.name,
      t.budget,
      t.spent,
      Math.max(0, t.budget - t.spent),
      t.utilization,
      t.po_count,
    ]),
  ];
  const wsTrips = XLSX.utils.aoa_to_sheet(tripData);
  XLSX.utils.book_append_sheet(wb, wsTrips, 'Trip Budget');

  await writeAndShare(wb, 'Trip_Budget_Report.xlsx');
}

// ── Product Catalog Export ────────────────────────────────────────────────────

export async function exportProductCatalog(): Promise<void> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    design_name: string; garment_type: string; primary_color: string;
    pattern: string; fabric: string; purchase_price: number;
    selling_price: number; mrp: number; vendor_name: string; status: string;
  }>(
    `SELECT p.design_name, p.garment_type, p.primary_color, p.pattern, p.fabric,
            p.purchase_price, p.selling_price, p.mrp, p.status,
            v.name as vendor_name
     FROM products p
     LEFT JOIN vendors v ON p.vendor_id = v.id
     ORDER BY p.updated_at DESC`
  );

  const stockRows = await db.getAllAsync<{ product_id: string; total_qty: number }>(
    'SELECT product_id, SUM(total_qty) as total_qty FROM store_stock GROUP BY product_id'
  );
  const stockMap: Record<string, number> = {};
  for (const r of stockRows) { stockMap[r.product_id] = r.total_qty; }

  const data = [
    ['Name', 'Garment Type', 'Color', 'Pattern', 'Fabric', 'Purchase Price', 'Selling Price', 'MRP', 'Total Stock', 'Vendor', 'Status'],
    ...rows.map((r) => [
      r.design_name ?? '', r.garment_type ?? '', r.primary_color ?? '',
      r.pattern ?? '', r.fabric ?? '',
      r.purchase_price ?? '', r.selling_price ?? '', r.mrp ?? '',
      stockMap[r.status] ?? 0,
      r.vendor_name ?? '', r.status ?? '',
    ]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Products');
  await writeAndShare(wb, 'Product_Catalog.xlsx');
}

// ── Purchase Orders Export ────────────────────────────────────────────────────

export async function exportPurchaseOrders(from?: string, to?: string): Promise<void> {
  const db = getDb();
  const params: string[] = [];
  let dateFilter = '';
  if (from) { dateFilter += ' AND DATE(po.created_at) >= ?'; params.push(from); }
  if (to) { dateFilter += ' AND DATE(po.created_at) <= ?'; params.push(to); }

  const rows = await db.getAllAsync<{
    po_number: string; created_at: string; vendor_name: string; status: string;
    total_qty: number; total_value: number; delivery_date: string;
  }>(
    `SELECT po.po_number, po.created_at, po.status, po.total_qty, po.total_value,
            po.delivery_date, v.name as vendor_name
     FROM purchase_orders po
     LEFT JOIN vendors v ON po.vendor_id = v.id
     WHERE (po.is_deleted = 0 OR po.is_deleted IS NULL)${dateFilter}
     ORDER BY po.created_at DESC`,
    params
  );

  const data = [
    ['PO Number', 'Date', 'Vendor', 'Status', 'Total Qty', 'Total Value (₹)', 'Delivery Date'],
    ...rows.map((r) => [
      r.po_number, (r.created_at ?? '').slice(0, 10), r.vendor_name ?? '',
      r.status, r.total_qty, r.total_value, r.delivery_date ?? '',
    ]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Purchase Orders');
  await writeAndShare(wb, 'Purchase_Orders.xlsx');
}

// ── GRN Report Export ─────────────────────────────────────────────────────────

export async function exportGRNReport(from?: string, to?: string): Promise<void> {
  const db = getDb();
  const params: string[] = [];
  let dateFilter = '';
  if (from) { dateFilter += ' AND DATE(gr.created_at) >= ?'; params.push(from); }
  if (to) { dateFilter += ' AND DATE(gr.created_at) <= ?'; params.push(to); }

  const rows = await db.getAllAsync<{
    grn_number: string; po_number: string; vendor_name: string;
    total_ordered_qty: number; total_received_qty: number;
    total_accepted_qty: number; total_rejected_qty: number; created_at: string;
  }>(
    `SELECT gr.grn_number, gr.created_at,
            gr.total_ordered_qty, gr.total_received_qty, gr.total_accepted_qty, gr.total_rejected_qty,
            po.po_number, v.name as vendor_name
     FROM grn_records gr
     LEFT JOIN purchase_orders po ON gr.po_id = po.id
     LEFT JOIN vendors v ON po.vendor_id = v.id
     WHERE 1=1${dateFilter}
     ORDER BY gr.created_at DESC`,
    params
  );

  const data = [
    ['GRN Number', 'Date', 'PO Number', 'Vendor', 'Ordered', 'Received', 'Accepted', 'Rejected', 'Accept Rate (%)'],
    ...rows.map((r) => {
      const ordered = r.total_ordered_qty || 0;
      const accepted = r.total_accepted_qty || 0;
      const rate = ordered > 0 ? Math.round((accepted / ordered) * 100) : 0;
      return [
        r.grn_number, (r.created_at ?? '').slice(0, 10), r.po_number ?? '',
        r.vendor_name ?? '', ordered, r.total_received_qty || 0,
        accepted, r.total_rejected_qty || 0, rate,
      ];
    }),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'GRN Report');
  await writeAndShare(wb, 'GRN_Report.xlsx');
}

// ── Vendor Report Export ──────────────────────────────────────────────────────

export async function exportVendorReport(): Promise<void> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    name: string; city: string; gstin: string; phone: string;
    rank: string; rating: number; total_orders: number;
    total_value: number;
  }>(
    `SELECT name, city, gstin, phone, rank, rating, total_orders, total_value
     FROM vendors
     WHERE is_active = 1 OR is_active IS NULL
     ORDER BY rank ASC, rating DESC`
  );

  const data = [
    ['Name', 'City', 'GSTIN', 'Phone', 'Rank', 'Rating', 'Total Orders', 'Total Value (₹)'],
    ...rows.map((r) => [
      r.name, r.city ?? '', r.gstin ?? '', r.phone ?? '',
      r.rank, r.rating ?? 0, r.total_orders ?? 0, r.total_value ?? 0,
    ]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Vendors');
  await writeAndShare(wb, 'Vendor_Report.xlsx');
}

// ── Stock Report Export ───────────────────────────────────────────────────────

export async function exportStockReport(): Promise<void> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    design_name: string; garment_type: string; store_name: string;
    size_stock_json: string; total_qty: number;
  }>(
    `SELECT p.design_name, p.garment_type, s.name as store_name,
            ss.size_stock_json, ss.total_qty
     FROM store_stock ss
     LEFT JOIN stores s ON ss.store_id = s.id
     LEFT JOIN products p ON ss.product_id = p.id
     ORDER BY s.name ASC, p.design_name ASC`
  );

  const data = [
    ['Product', 'Garment Type', 'Store', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size', 'Total Qty'],
    ...rows.map((r) => {
      let sizeMap: Record<string, number> = {};
      try { sizeMap = JSON.parse(r.size_stock_json || '{}') as Record<string, number>; } catch { /* ignore */ }
      return [
        r.design_name ?? '', r.garment_type ?? '', r.store_name ?? '',
        sizeMap['S'] ?? 0, sizeMap['M'] ?? 0, sizeMap['L'] ?? 0,
        sizeMap['XL'] ?? 0, sizeMap['XXL'] ?? 0, sizeMap['Free'] ?? 0,
        r.total_qty,
      ];
    }),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Stock');
  await writeAndShare(wb, 'Stock_Report.xlsx');
}

// ── Customer Demands Export ───────────────────────────────────────────────────

export async function exportCustomerDemands(): Promise<void> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    customer_name: string; customer_phone: string; description: string;
    garment_type: string; price_range_min: number; price_range_max: number;
    store_name: string; status: string; created_at: string;
  }>(
    `SELECT cd.customer_name, cd.customer_phone, cd.description,
            cd.garment_type, cd.price_range_min, cd.price_range_max,
            cd.status, cd.created_at, s.name as store_name
     FROM customer_demands cd
     LEFT JOIN stores s ON cd.store_id = s.id
     ORDER BY cd.created_at DESC`
  );

  const data = [
    ['Customer', 'Phone', 'Description', 'Garment Type', 'Min Price', 'Max Price', 'Store', 'Status', 'Date'],
    ...rows.map((r) => [
      r.customer_name ?? '', r.customer_phone ?? '', r.description ?? '',
      r.garment_type ?? '', r.price_range_min ?? '', r.price_range_max ?? '',
      r.store_name ?? '', r.status, (r.created_at ?? '').slice(0, 10),
    ]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Customer Demands');
  await writeAndShare(wb, 'Customer_Demands.xlsx');
}

// ── Full Backup Export ────────────────────────────────────────────────────────

export async function exportFullBackup(): Promise<void> {
  const db = getDb();
  const wb = XLSX.utils.book_new();

  // Products sheet
  const products = await db.getAllAsync<{
    design_name: string; garment_type: string; primary_color: string;
    pattern: string; fabric: string; purchase_price: number;
    selling_price: number; mrp: number; status: string; vendor_name: string;
  }>(
    `SELECT p.design_name, p.garment_type, p.primary_color, p.pattern, p.fabric,
            p.purchase_price, p.selling_price, p.mrp, p.status, v.name as vendor_name
     FROM products p LEFT JOIN vendors v ON p.vendor_id = v.id ORDER BY p.updated_at DESC`
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Name', 'Garment Type', 'Color', 'Pattern', 'Fabric', 'Purchase', 'Selling', 'MRP', 'Status', 'Vendor'],
    ...products.map((r) => [r.design_name ?? '', r.garment_type ?? '', r.primary_color ?? '', r.pattern ?? '', r.fabric ?? '', r.purchase_price ?? '', r.selling_price ?? '', r.mrp ?? '', r.status, r.vendor_name ?? '']),
  ]), 'Products');

  // POs sheet
  const pos = await db.getAllAsync<{
    po_number: string; created_at: string; vendor_name: string;
    status: string; total_qty: number; total_value: number;
  }>(
    `SELECT po.po_number, po.created_at, po.status, po.total_qty, po.total_value, v.name as vendor_name
     FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id
     WHERE (po.is_deleted = 0 OR po.is_deleted IS NULL) ORDER BY po.created_at DESC`
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['PO Number', 'Date', 'Vendor', 'Status', 'Qty', 'Value'],
    ...pos.map((r) => [r.po_number, (r.created_at ?? '').slice(0, 10), r.vendor_name ?? '', r.status, r.total_qty, r.total_value]),
  ]), 'Purchase Orders');

  // GRNs sheet
  const grns = await db.getAllAsync<{
    grn_number: string; created_at: string; po_number: string; vendor_name: string;
    total_ordered_qty: number; total_accepted_qty: number;
  }>(
    `SELECT gr.grn_number, gr.created_at, gr.total_ordered_qty, gr.total_accepted_qty,
            po.po_number, v.name as vendor_name
     FROM grn_records gr LEFT JOIN purchase_orders po ON gr.po_id = po.id
     LEFT JOIN vendors v ON po.vendor_id = v.id ORDER BY gr.created_at DESC`
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['GRN Number', 'Date', 'PO Number', 'Vendor', 'Ordered', 'Accepted'],
    ...grns.map((r) => [r.grn_number, (r.created_at ?? '').slice(0, 10), r.po_number ?? '', r.vendor_name ?? '', r.total_ordered_qty, r.total_accepted_qty]),
  ]), 'GRNs');

  // Vendors sheet
  const vendors = await db.getAllAsync<{ name: string; city: string; phone: string; rank: string; total_orders: number; total_value: number }>(
    `SELECT name, city, phone, rank, total_orders, total_value FROM vendors WHERE is_active = 1 OR is_active IS NULL ORDER BY rank ASC`
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Name', 'City', 'Phone', 'Rank', 'Total Orders', 'Total Value'],
    ...vendors.map((r) => [r.name, r.city ?? '', r.phone ?? '', r.rank, r.total_orders ?? 0, r.total_value ?? 0]),
  ]), 'Vendors');

  // Stock sheet
  const stock = await db.getAllAsync<{ design_name: string; store_name: string; total_qty: number }>(
    `SELECT p.design_name, s.name as store_name, ss.total_qty
     FROM store_stock ss LEFT JOIN stores s ON ss.store_id = s.id
     LEFT JOIN products p ON ss.product_id = p.id ORDER BY s.name ASC`
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Product', 'Store', 'Total Qty'],
    ...stock.map((r) => [r.design_name ?? '', r.store_name ?? '', r.total_qty]),
  ]), 'Stock');

  // Demands sheet
  const demands = await db.getAllAsync<{ customer_name: string; description: string; status: string; created_at: string }>(
    `SELECT customer_name, description, status, created_at FROM customer_demands ORDER BY created_at DESC`
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Customer', 'Description', 'Status', 'Date'],
    ...demands.map((r) => [r.customer_name ?? '', r.description, r.status, (r.created_at ?? '').slice(0, 10)]),
  ]), 'Demands');

  await writeAndShare(wb, `VASTRA_Backup_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
