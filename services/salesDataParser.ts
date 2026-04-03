import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { matchProductByBarcode, matchProductByName, matchStoreByName } from '../db/database';
import type { SalesRow } from '../db/database';

export interface ParseResult {
  rows: SalesRow[];
  matched: number;
  unmatched: number;
  errors: string[];
}

function pickField(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return String(row[k]).trim();
    }
  }
  return '';
}

function parseDate(raw: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  // Excel serial date numbers
  const num = Number(raw);
  if (!isNaN(num) && num > 10000) {
    const d = new Date((num - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  // Try ISO or DD/MM/YYYY or MM/DD/YYYY
  const cleaned = raw.replace(/\//g, '-');
  const parts = cleaned.split('-');
  if (parts.length === 3) {
    // If first part has 4 digits it's YYYY-MM-DD
    if (parts[0].length === 4) return cleaned.slice(0, 10);
    // Assume DD-MM-YYYY
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return new Date().toISOString().slice(0, 10);
}

export async function parseSalesExcel(fileUri: string): Promise<ParseResult> {
  const errors: string[] = [];
  const rows: SalesRow[] = [];
  let matched = 0;
  let unmatched = 0;

  try {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const workbook = XLSX.read(base64, { type: 'base64' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      errors.push('No sheets found in file');
      return { rows, matched, unmatched, errors };
    }
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        const barcode = pickField(row, ['Barcode', 'barcode', 'BARCODE', 'EAN', 'SKU']);
        const name = pickField(row, ['Item Name', 'Product', 'Description', 'ITEM', 'Item', 'product_name', 'Name']);
        const store = pickField(row, ['Store', 'Branch', 'STORE', 'Store Name', 'branch_name']);
        const qtyRaw = pickField(row, ['Qty', 'Quantity', 'QTY', 'qty', 'Units', 'Sold Qty']);
        const valueRaw = pickField(row, ['Amount', 'Value', 'AMOUNT', 'Sale Value', 'Revenue', 'Net Amount']);
        const dateRaw = pickField(row, ['Date', 'SALE_DATE', 'Bill Date', 'sale_date', 'Txn Date', 'Transaction Date']);

        const qty = parseInt(qtyRaw || '0', 10) || 0;
        const value = parseFloat(valueRaw || '0') || 0;
        const saleDate = parseDate(dateRaw);

        let productId: string | null = null;
        if (barcode) {
          productId = await matchProductByBarcode(barcode);
        }
        if (!productId && name) {
          productId = await matchProductByName(name);
        }

        let storeId: number | null = null;
        if (store) {
          storeId = await matchStoreByName(store);
        }

        if (productId) matched++;
        else unmatched++;

        rows.push({ productId, storeId, barcode, productName: name, qtySold: qty, saleValue: value, saleDate });
      } catch (e) {
        errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : 'parse error'}`);
      }
    }
  } catch (e) {
    errors.push(`File read error: ${e instanceof Error ? e.message : 'unknown'}`);
  }

  return { rows, matched, unmatched, errors };
}
