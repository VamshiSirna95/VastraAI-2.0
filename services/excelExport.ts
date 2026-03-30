import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { POSummaryReport, GRNSummaryReport, TripBudgetReport } from '../db/database';

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
