import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES } from './schema';
import type { Product, ProductPhoto, Vendor, CustomAttribute, PurchaseOrder, POItem, PurchaseTrip, DeliveryConfig, GRNRecord, GRNItem, GRNPhoto, LorryReceipt, GRNSizeData, Store, StockAllocation, User } from './types';
import { SIZE_TEMPLATES } from './types';

// ── DB singleton ──────────────────────────────────────────────────────────────

let _db: SQLite.SQLiteDatabase | null = null;

export async function initDatabase(): Promise<void> {
  _db = await SQLite.openDatabaseAsync('vastra.db');
  await _db.execAsync('PRAGMA journal_mode = WAL');
  await _db.execAsync('PRAGMA foreign_keys = ON');
  for (const sql of CREATE_TABLES) {
    await _db.execAsync(sql);
  }
  await runMigrations();
  await seedAttributeTemplates();
  await seedDeliveryConfig();
}

async function addCol(table: string, col: string, def: string): Promise<void> {
  try { await getDb().execAsync(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch { /* already exists */ }
}

async function runMigrations(): Promise<void> {
  // purchase_orders new columns
  await addCol('purchase_orders', 'cancellation_reason', 'TEXT');
  await addCol('purchase_orders', 'cancelled_qty', 'INTEGER DEFAULT 0');
  await addCol('purchase_orders', 'is_deleted', 'INTEGER DEFAULT 0');
  await addCol('purchase_orders', 'deleted_at', 'TEXT');
  await addCol('purchase_orders', 'document_uri', 'TEXT');
  // grn_items new columns
  await addCol('grn_items', 'size_data_json', 'TEXT');
  // vendors new columns (V9)
  await addCol('vendors', 'alt_phone', 'TEXT');
  await addCol('vendors', 'email', 'TEXT');
  await addCol('vendors', 'city', 'TEXT');
  await addCol('vendors', 'state', 'TEXT');
  await addCol('vendors', 'pincode', 'TEXT');
  await addCol('vendors', 'address_line1', 'TEXT');
  await addCol('vendors', 'address_line2', 'TEXT');
  await addCol('vendors', 'gstin', 'TEXT');
  await addCol('vendors', 'pan', 'TEXT');
  await addCol('vendors', 'bank_name', 'TEXT');
  await addCol('vendors', 'bank_account', 'TEXT');
  await addCol('vendors', 'bank_ifsc', 'TEXT');
  await addCol('vendors', 'payment_terms', 'TEXT');
  await addCol('vendors', 'rating', 'REAL DEFAULT 0');
  await addCol('vendors', 'avg_lead_days', 'INTEGER DEFAULT 0');
  await addCol('vendors', 'total_orders', 'INTEGER DEFAULT 0');
  await addCol('vendors', 'total_value', 'REAL DEFAULT 0');
  await addCol('vendors', 'is_active', 'INTEGER DEFAULT 1');
}

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) throw new Error('Database not initialized');
  return _db;
}

// ── UUID helper ───────────────────────────────────────────────────────────────

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Attribute templates seed ──────────────────────────────────────────────────

const TEMPLATE_SEED: Record<string, string[]> = {
  Saree: ['Pallu type', 'Border type', 'Blouse piece', 'Drape style'],
  Kurta: ['Slit type', 'Kurta length', 'Bottom included'],
  Shirt: ['Collar style', 'Cuff type', 'Pocket'],
  'Salwar Set': ['Dupatta included', 'Bottom type', 'Set pieces'],
  Lehenga: ['Flare type', 'Cancan', 'Blouse style'],
  'Trouser/Pant': ['Waist type', 'Pleat', 'Cuff'],
};

async function seedAttributeTemplates(): Promise<void> {
  const db = getDb();
  const existing = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM attribute_templates'
  );
  if (existing && existing.cnt > 0) return;

  for (const [garmentType, attrs] of Object.entries(TEMPLATE_SEED)) {
    for (let i = 0; i < attrs.length; i++) {
      await db.runAsync(
        'INSERT INTO attribute_templates (id, garment_type, attribute_name, display_order) VALUES (?, ?, ?, ?)',
        [uuid(), garmentType, attrs[i], i]
      );
    }
  }
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function createProduct(product: Partial<Product>): Promise<string> {
  const db = getDb();
  const id = product.id ?? uuid();
  await db.runAsync(
    `INSERT INTO products (
      id, barcode, design_name, garment_type, vendor_id,
      purchase_price, selling_price, mrp,
      primary_color, secondary_color, pattern, fabric, work_type,
      occasion, season, sleeve, neck, fit, length,
      notes, voice_note_uri, voice_note_transcript, ai_confidence, status
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      product.barcode ?? null,
      product.design_name ?? null,
      product.garment_type ?? null,
      product.vendor_id ?? null,
      product.purchase_price ?? null,
      product.selling_price ?? null,
      product.mrp ?? null,
      product.primary_color ?? null,
      product.secondary_color ?? null,
      product.pattern ?? null,
      product.fabric ?? null,
      product.work_type ?? null,
      product.occasion ?? null,
      product.season ?? null,
      product.sleeve ?? null,
      product.neck ?? null,
      product.fit ?? null,
      product.length ?? null,
      product.notes ?? null,
      product.voice_note_uri ?? null,
      product.voice_note_transcript ?? null,
      product.ai_confidence ?? null,
      product.status ?? 'draft',
    ]
  );
  return id;
}

interface ProductFilters {
  garmentType?: string;
  vendor?: string;
  search?: string;
}

export async function getProducts(filters?: ProductFilters): Promise<Product[]> {
  const db = getDb();
  const conditions: string[] = [];
  const params: (string | null)[] = [];

  if (filters?.garmentType) {
    conditions.push('p.garment_type = ?');
    params.push(filters.garmentType);
  }
  if (filters?.vendor) {
    conditions.push('v.name LIKE ?');
    params.push(`%${filters.vendor}%`);
  }
  if (filters?.search) {
    const q = `%${filters.search}%`;
    conditions.push(
      '(p.design_name LIKE ? OR p.barcode LIKE ? OR p.garment_type LIKE ? OR p.primary_color LIKE ? OR v.name LIKE ?)'
    );
    params.push(q, q, q, q, q);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await db.getAllAsync<Product>(
    `SELECT p.*, v.name as vendor_name FROM products p
     LEFT JOIN vendors v ON p.vendor_id = v.id
     ${where}
     ORDER BY p.updated_at DESC`,
    params
  );
  return rows;
}

export async function getProductById(id: string): Promise<Product | null> {
  const db = getDb();
  const product = await db.getFirstAsync<Product>(
    `SELECT p.*, v.name as vendor_name, v.rank as vendor_rank
     FROM products p
     LEFT JOIN vendors v ON p.vendor_id = v.id
     WHERE p.id = ?`,
    [id]
  );
  if (!product) return null;
  product.photos = await getProductPhotos(id);
  product.custom_attrs = await getProductCustomAttrs(id);
  return product;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<void> {
  const db = getDb();
  const fields = Object.keys(updates).filter(
    (k) => !['id', 'created_at', 'photos', 'vendor', 'custom_attrs', 'vendor_name', 'vendor_rank'].includes(k)
  );
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => (updates as Record<string, unknown>)[f] ?? null) as (string | number | null)[];
  await db.runAsync(
    `UPDATE products SET ${setClause}, updated_at = datetime('now') WHERE id = ?`,
    [...values, id]
  );
}

export async function deleteProduct(id: string): Promise<void> {
  await getDb().runAsync('DELETE FROM products WHERE id = ?', [id]);
}

export async function getProductCount(): Promise<number> {
  const row = await getDb().getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM products'
  );
  return row?.cnt ?? 0;
}

// ── Photos ────────────────────────────────────────────────────────────────────

export async function addProductPhoto(
  productId: string,
  uri: string,
  photoType: string,
  isPrimary = false
): Promise<string> {
  const db = getDb();
  const id = uuid();
  if (isPrimary) {
    await db.runAsync(
      'UPDATE product_photos SET is_primary = 0 WHERE product_id = ?',
      [productId]
    );
  }
  await db.runAsync(
    'INSERT INTO product_photos (id, product_id, uri, photo_type, is_primary) VALUES (?,?,?,?,?)',
    [id, productId, uri, photoType, isPrimary ? 1 : 0]
  );
  return id;
}

export async function getProductPhotos(productId: string): Promise<ProductPhoto[]> {
  const rows = await getDb().getAllAsync<{
    id: string; product_id: string; uri: string; photo_type: string;
    is_primary: number; quality_score: number | null; created_at: string;
  }>(
    'SELECT * FROM product_photos WHERE product_id = ? ORDER BY is_primary DESC, created_at ASC',
    [productId]
  );
  return rows.map((r) => ({
    ...r,
    photo_type: r.photo_type as ProductPhoto['photo_type'],
    is_primary: r.is_primary === 1,
    quality_score: r.quality_score ?? undefined,
  }));
}

export async function deleteProductPhoto(id: string): Promise<void> {
  await getDb().runAsync('DELETE FROM product_photos WHERE id = ?', [id]);
}

// ── Vendors ───────────────────────────────────────────────────────────────────

export async function createVendor(vendor: Partial<Vendor>): Promise<string> {
  const db = getDb();
  const id = vendor.id ?? uuid();
  await db.runAsync(
    `INSERT INTO vendors (
       id, name, contact_person, phone, alt_phone, email,
       area, city, state, pincode, address_line1, address_line2,
       speciality, gstin, pan, bank_name, bank_account, bank_ifsc,
       payment_terms, rank, rating, avg_lead_days, is_active, notes
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      vendor.name ?? 'Unknown',
      vendor.contact_person ?? null,
      vendor.phone ?? null,
      vendor.alt_phone ?? null,
      vendor.email ?? null,
      vendor.area ?? null,
      vendor.city ?? null,
      vendor.state ?? null,
      vendor.pincode ?? null,
      vendor.address_line1 ?? null,
      vendor.address_line2 ?? null,
      vendor.speciality ?? null,
      vendor.gstin ?? null,
      vendor.pan ?? null,
      vendor.bank_name ?? null,
      vendor.bank_account ?? null,
      vendor.bank_ifsc ?? null,
      vendor.payment_terms ?? null,
      vendor.rank ?? 'B',
      vendor.rating ?? 0,
      vendor.avg_lead_days ?? 0,
      vendor.is_active ?? 1,
      vendor.notes ?? null,
    ]
  );
  return id;
}

export async function updateVendor(id: string, updates: Partial<Vendor>): Promise<void> {
  const db = getDb();
  const excluded = ['id', 'created_at'];
  const fields = Object.keys(updates).filter((k) => !excluded.includes(k));
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => (updates as Record<string, unknown>)[f] ?? null) as (string | number | null)[];
  await db.runAsync(
    `UPDATE vendors SET ${setClause}, updated_at = datetime('now') WHERE id = ?`,
    [...values, id]
  );
}

export async function getVendors(search?: string, activeOnly = false): Promise<Vendor[]> {
  const db = getDb();
  const conditions: string[] = [];
  const params: string[] = [];
  if (activeOnly) { conditions.push('(is_active = 1 OR is_active IS NULL)'); }
  if (search) {
    conditions.push('(name LIKE ? OR area LIKE ? OR city LIKE ? OR speciality LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.getAllAsync<Vendor>(
    `SELECT * FROM vendors ${where} ORDER BY rank, name`,
    params
  );
}

export async function getVendorById(id: string): Promise<Vendor | null> {
  return getDb().getFirstAsync<Vendor>('SELECT * FROM vendors WHERE id = ?', [id]);
}

export async function getVendorCount(): Promise<number> {
  const row = await getDb().getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM vendors WHERE is_active = 1 OR is_active IS NULL'
  );
  return row?.cnt ?? 0;
}

export async function deactivateVendor(id: string): Promise<void> {
  await getDb().runAsync(
    `UPDATE vendors SET is_active = 0, updated_at = datetime('now') WHERE id = ?`, [id]
  );
}

export async function reactivateVendor(id: string): Promise<void> {
  await getDb().runAsync(
    `UPDATE vendors SET is_active = 1, updated_at = datetime('now') WHERE id = ?`, [id]
  );
}

export async function updateVendorStats(vendorId: string): Promise<void> {
  await getDb().runAsync(
    `UPDATE vendors SET
       total_orders = (SELECT COUNT(*) FROM purchase_orders WHERE vendor_id = ? AND (is_deleted != 1 OR is_deleted IS NULL)),
       total_value  = (SELECT COALESCE(SUM(total_value), 0) FROM purchase_orders WHERE vendor_id = ? AND (is_deleted != 1 OR is_deleted IS NULL)),
       updated_at   = datetime('now')
     WHERE id = ?`,
    [vendorId, vendorId, vendorId]
  );
}

// ── Custom Attributes ─────────────────────────────────────────────────────────

export async function addCustomAttribute(
  garmentType: string,
  attrName: string
): Promise<void> {
  const db = getDb();
  const existing = await db.getFirstAsync<{ id: string; usage_count: number }>(
    'SELECT id, usage_count FROM custom_attributes WHERE garment_type = ? AND attribute_name = ?',
    [garmentType, attrName]
  );
  if (existing) {
    const newCount = existing.usage_count + 1;
    await db.runAsync(
      'UPDATE custom_attributes SET usage_count = ?, is_suggested = ? WHERE id = ?',
      [newCount, newCount >= 3 ? 1 : 0, existing.id]
    );
  } else {
    await db.runAsync(
      'INSERT INTO custom_attributes (id, garment_type, attribute_name, usage_count, is_suggested) VALUES (?,?,?,1,0)',
      [uuid(), garmentType, attrName]
    );
  }
}

export async function getCustomAttributes(garmentType: string): Promise<CustomAttribute[]> {
  const rows = await getDb().getAllAsync<{
    id: string; garment_type: string; attribute_name: string;
    usage_count: number; is_suggested: number; created_at: string;
  }>(
    'SELECT * FROM custom_attributes WHERE garment_type = ? ORDER BY usage_count DESC',
    [garmentType]
  );
  return rows.map((r) => ({ ...r, is_suggested: r.is_suggested === 1 }));
}

export async function getSuggestedAttributes(garmentType: string): Promise<string[]> {
  const rows = await getDb().getAllAsync<{ attribute_name: string }>(
    'SELECT attribute_name FROM custom_attributes WHERE garment_type = ? AND is_suggested = 1',
    [garmentType]
  );
  return rows.map((r) => r.attribute_name);
}

export async function setProductCustomAttr(
  productId: string,
  attrName: string,
  attrValue: string
): Promise<void> {
  const db = getDb();
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM product_custom_attrs WHERE product_id = ? AND attribute_name = ?',
    [productId, attrName]
  );
  if (existing) {
    await db.runAsync(
      'UPDATE product_custom_attrs SET attribute_value = ? WHERE id = ?',
      [attrValue, existing.id]
    );
  } else {
    await db.runAsync(
      'INSERT INTO product_custom_attrs (id, product_id, attribute_name, attribute_value) VALUES (?,?,?,?)',
      [uuid(), productId, attrName, attrValue]
    );
  }
}

export async function getProductCustomAttrs(
  productId: string
): Promise<{ name: string; value: string }[]> {
  const rows = await getDb().getAllAsync<{ attribute_name: string; attribute_value: string }>(
    'SELECT attribute_name, attribute_value FROM product_custom_attrs WHERE product_id = ?',
    [productId]
  );
  return rows.map((r) => ({ name: r.attribute_name, value: r.attribute_value }));
}

export async function getAttributeTemplate(garmentType: string): Promise<string[]> {
  const rows = await getDb().getAllAsync<{ attribute_name: string }>(
    'SELECT attribute_name FROM attribute_templates WHERE garment_type = ? ORDER BY display_order',
    [garmentType]
  );
  return rows.map((r) => r.attribute_name);
}

// ── Purchase Orders ───────────────────────────────────────────────────────────

async function getNextPOSequence(): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM purchase_orders'
  );
  return (row?.cnt ?? 0) + 1;
}

export async function createPO(po: Partial<PurchaseOrder>): Promise<string> {
  const db = getDb();
  const id = uuid();
  const seq = await getNextPOSequence();
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const po_number = `KMF/PO/${yymm}/${String(seq).padStart(4, '0')}`;
  await db.runAsync(
    `INSERT INTO purchase_orders (
      id, po_number, vendor_id, trip_id, status,
      total_qty, total_value, delivery_date, dispatch_date, store_arrival_date,
      notes, voice_note_uri
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      po_number,
      po.vendor_id ?? '',
      po.trip_id ?? null,
      po.status ?? 'draft',
      po.total_qty ?? 0,
      po.total_value ?? 0,
      po.delivery_date ?? null,
      po.dispatch_date ?? null,
      po.store_arrival_date ?? null,
      po.notes ?? null,
      po.voice_note_uri ?? null,
    ]
  );
  return id;
}

export async function getPOs(filters?: { status?: string; vendorId?: string; tripId?: string; includeDeleted?: boolean }): Promise<PurchaseOrder[]> {
  const db = getDb();
  const conditions: string[] = [];
  const params: (string | null)[] = [];
  if (!filters?.includeDeleted) { conditions.push('(po.is_deleted = 0 OR po.is_deleted IS NULL)'); }
  if (filters?.status) { conditions.push('po.status = ?'); params.push(filters.status); }
  if (filters?.vendorId) { conditions.push('po.vendor_id = ?'); params.push(filters.vendorId); }
  if (filters?.tripId) { conditions.push('po.trip_id = ?'); params.push(filters.tripId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.getAllAsync<PurchaseOrder>(
    `SELECT po.*, v.name as vendor_name FROM purchase_orders po
     LEFT JOIN vendors v ON po.vendor_id = v.id
     ${where}
     ORDER BY po.updated_at DESC`,
    params
  );
}

export async function getDeletedPOs(): Promise<PurchaseOrder[]> {
  return getDb().getAllAsync<PurchaseOrder>(
    `SELECT po.*, v.name as vendor_name FROM purchase_orders po
     LEFT JOIN vendors v ON po.vendor_id = v.id
     WHERE po.is_deleted = 1
     ORDER BY po.deleted_at DESC`
  );
}

export async function softDeletePO(poId: string): Promise<void> {
  const po = await getPOById(poId);
  if (!po) return;
  if (po.status !== 'draft' && po.status !== 'closed') {
    throw new Error('Only Draft or Closed POs can be deleted');
  }
  await getDb().runAsync(
    `UPDATE purchase_orders SET is_deleted = 1, deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [poId]
  );
}

export async function restorePO(poId: string): Promise<void> {
  await getDb().runAsync(
    `UPDATE purchase_orders SET is_deleted = 0, deleted_at = NULL, updated_at = datetime('now') WHERE id = ?`,
    [poId]
  );
}

export async function permanentDeletePO(poId: string): Promise<void> {
  await getDb().runAsync('DELETE FROM purchase_orders WHERE id = ? AND is_deleted = 1', [poId]);
}

export async function getDeletedPOCount(): Promise<number> {
  const row = await getDb().getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM purchase_orders WHERE is_deleted = 1'
  );
  return row?.cnt ?? 0;
}

export async function getPOById(id: string): Promise<PurchaseOrder | null> {
  const db = getDb();
  const po = await db.getFirstAsync<PurchaseOrder>(
    `SELECT po.*, v.name as vendor_name FROM purchase_orders po
     LEFT JOIN vendors v ON po.vendor_id = v.id
     WHERE po.id = ?`,
    [id]
  );
  if (!po) return null;
  po.items = await getPOItems(id);
  return po;
}

export async function updatePO(id: string, updates: Partial<PurchaseOrder>): Promise<void> {
  const db = getDb();
  const excluded = ['id', 'po_number', 'created_at', 'items', 'vendor', 'trip', 'vendor_name'];
  const fields = Object.keys(updates).filter((k) => !excluded.includes(k));
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => (updates as Record<string, unknown>)[f] ?? null) as (string | number | null)[];
  await db.runAsync(
    `UPDATE purchase_orders SET ${setClause}, updated_at = datetime('now') WHERE id = ?`,
    [...values, id]
  );
}

export async function deletePO(id: string): Promise<void> {
  await getDb().runAsync('DELETE FROM purchase_orders WHERE id = ?', [id]);
}

export async function getPOCount(): Promise<number> {
  const row = await getDb().getFirstAsync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM purchase_orders WHERE status NOT IN ('closed','received')"
  );
  return row?.cnt ?? 0;
}

// ── PO Items ──────────────────────────────────────────────────────────────────

async function recalcPOTotals(poId: string): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `UPDATE purchase_orders SET
      total_qty = (SELECT COALESCE(SUM(total_qty),0) FROM po_items WHERE po_id = ?),
      total_value = (SELECT COALESCE(SUM(total_price),0) FROM po_items WHERE po_id = ?),
      updated_at = datetime('now')
     WHERE id = ?`,
    [poId, poId, poId]
  );
}

export async function addPOItem(item: Partial<POItem>): Promise<string> {
  const db = getDb();
  const id = uuid();
  const total_qty = (item.size_s ?? 0) + (item.size_m ?? 0) + (item.size_l ?? 0) +
    (item.size_xl ?? 0) + (item.size_xxl ?? 0) + (item.size_free ?? 0);
  const total_price = total_qty * (item.unit_price ?? 0);
  await db.runAsync(
    `INSERT INTO po_items (id, po_id, product_id, size_s, size_m, size_l, size_xl, size_xxl, size_free, total_qty, unit_price, total_price, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, item.po_id ?? '', item.product_id ?? '',
      item.size_s ?? 0, item.size_m ?? 0, item.size_l ?? 0,
      item.size_xl ?? 0, item.size_xxl ?? 0, item.size_free ?? 0,
      total_qty, item.unit_price ?? 0, total_price, item.notes ?? null,
    ]
  );
  if (item.po_id) await recalcPOTotals(item.po_id);
  return id;
}

export async function updatePOItem(id: string, updates: Partial<POItem>): Promise<void> {
  const db = getDb();
  const existing = await db.getFirstAsync<POItem>('SELECT * FROM po_items WHERE id = ?', [id]);
  if (!existing) return;
  const merged = { ...existing, ...updates };
  const total_qty = merged.size_s + merged.size_m + merged.size_l +
    merged.size_xl + merged.size_xxl + merged.size_free;
  const total_price = total_qty * merged.unit_price;
  await db.runAsync(
    `UPDATE po_items SET size_s=?, size_m=?, size_l=?, size_xl=?, size_xxl=?, size_free=?,
     total_qty=?, unit_price=?, total_price=?, notes=? WHERE id=?`,
    [merged.size_s, merged.size_m, merged.size_l, merged.size_xl, merged.size_xxl, merged.size_free,
     total_qty, merged.unit_price, total_price, merged.notes ?? null, id]
  );
  await recalcPOTotals(existing.po_id);
}

export async function removePOItem(id: string): Promise<void> {
  const db = getDb();
  const item = await db.getFirstAsync<{ po_id: string }>('SELECT po_id FROM po_items WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM po_items WHERE id = ?', [id]);
  if (item?.po_id) await recalcPOTotals(item.po_id);
}

export async function getPOItems(poId: string): Promise<POItem[]> {
  const db = getDb();
  const rows = await db.getAllAsync<POItem>(
    `SELECT pi.*, p.design_name, p.garment_type, p.primary_color, p.purchase_price,
            p.selling_price, p.mrp, p.vendor_id
     FROM po_items pi
     LEFT JOIN products p ON pi.product_id = p.id
     WHERE pi.po_id = ?
     ORDER BY pi.created_at ASC`,
    [poId]
  );
  return rows;
}

// ── Purchase Trips ────────────────────────────────────────────────────────────

export async function createTrip(trip: Partial<PurchaseTrip>): Promise<string> {
  const db = getDb();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO purchase_trips (id, name, budget, spent, vendor_area, status, start_date, end_date, notes)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      id, trip.name ?? 'New Trip', trip.budget ?? 0, 0,
      trip.vendor_area ?? null, trip.status ?? 'active',
      trip.start_date ?? null, trip.end_date ?? null, trip.notes ?? null,
    ]
  );
  return id;
}

export async function getTrips(status?: string): Promise<PurchaseTrip[]> {
  const db = getDb();
  if (status) {
    return db.getAllAsync<PurchaseTrip>(
      'SELECT * FROM purchase_trips WHERE status = ? ORDER BY created_at DESC',
      [status]
    );
  }
  return db.getAllAsync<PurchaseTrip>('SELECT * FROM purchase_trips ORDER BY created_at DESC');
}

export async function getTripById(id: string): Promise<PurchaseTrip | null> {
  const db = getDb();
  const trip = await db.getFirstAsync<PurchaseTrip>(
    'SELECT * FROM purchase_trips WHERE id = ?', [id]
  );
  if (!trip) return null;
  trip.purchase_orders = await getPOs({ tripId: id });
  return trip;
}

export async function updateTrip(id: string, updates: Partial<PurchaseTrip>): Promise<void> {
  const db = getDb();
  const excluded = ['id', 'created_at', 'purchase_orders'];
  const fields = Object.keys(updates).filter((k) => !excluded.includes(k));
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => (updates as Record<string, unknown>)[f] ?? null) as (string | number | null)[];
  await db.runAsync(
    `UPDATE purchase_trips SET ${setClause}, updated_at = datetime('now') WHERE id = ?`,
    [...values, id]
  );
}

export async function updateTripSpent(tripId: string): Promise<void> {
  await getDb().runAsync(
    `UPDATE purchase_trips SET
      spent = (SELECT COALESCE(SUM(total_value),0) FROM purchase_orders WHERE trip_id = ?),
      updated_at = datetime('now')
     WHERE id = ?`,
    [tripId, tripId]
  );
}

// ── Delivery Config ───────────────────────────────────────────────────────────

async function seedDeliveryConfig(): Promise<void> {
  const db = getDb();
  const existing = await db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM delivery_config');
  if (existing && existing.cnt > 0) return;
  await db.runAsync(
    `INSERT INTO delivery_config (id, optimal_stock_cover_days, vendor_transit_days, inward_processing_days, store_dispatch_days)
     VALUES (?,90,2,1,1)`,
    [uuid()]
  );
}

export async function getDeliveryConfig(): Promise<DeliveryConfig> {
  const row = await getDb().getFirstAsync<DeliveryConfig>(
    'SELECT optimal_stock_cover_days, vendor_transit_days, inward_processing_days, store_dispatch_days FROM delivery_config LIMIT 1'
  );
  return row ?? { optimal_stock_cover_days: 90, vendor_transit_days: 2, inward_processing_days: 1, store_dispatch_days: 1 };
}

export async function updateDeliveryConfig(config: Partial<DeliveryConfig>): Promise<void> {
  const db = getDb();
  const fields = Object.keys(config) as (keyof DeliveryConfig)[];
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => config[f] ?? null) as (number | null)[];
  await db.runAsync(
    `UPDATE delivery_config SET ${setClause}, updated_at = datetime('now')`,
    values
  );
}

// ── GRN helpers ───────────────────────────────────────────────────────────────

const SIZE_COLS = ['size_s', 'size_m', 'size_l', 'size_xl', 'size_xxl', 'size_free'] as const;

function buildGRNSizeData(item: POItem & { garment_type?: string }): GRNSizeData {
  const g = (item as unknown as Record<string, unknown>).garment_type as string | undefined ?? 'default';
  const labels = SIZE_TEMPLATES[g] ?? SIZE_TEMPLATES['default'];
  // For Free Size garments (Saree, Dupatta, etc.) the qty is stored in size_free, NOT size_s
  if (labels.length === 1 && labels[0] === 'Free') {
    return { Free: { ordered: item.size_free ?? 0, received: 0, accepted: 0, rejected: 0 } };
  }
  const cols = [item.size_s, item.size_m, item.size_l, item.size_xl, item.size_xxl, item.size_free];
  const data: GRNSizeData = {};
  labels.forEach((lbl, idx) => {
    data[lbl] = { ordered: cols[idx] ?? 0, received: 0, accepted: 0, rejected: 0 };
  });
  return data;
}

// ── GRN ───────────────────────────────────────────────────────────────────────

async function getNextGRNSequence(): Promise<number> {
  const row = await getDb().getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM grn_records'
  );
  return (row?.cnt ?? 0) + 1;
}

export async function createGRN(poId: string): Promise<string> {
  const db = getDb();
  const id = uuid();
  const seq = await getNextGRNSequence();
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const grn_number = `KMF/GRN/${yymm}/${String(seq).padStart(4, '0')}`;
  const today = now.toISOString().slice(0, 10);

  await db.runAsync(
    `INSERT INTO grn_records (id, po_id, grn_number, received_date, overall_status,
      total_ordered_qty, total_received_qty, total_accepted_qty, total_rejected_qty)
     VALUES (?,?,?,?,'pending',0,0,0,0)`,
    [id, poId, grn_number, today]
  );

  // Check if previous GRNs exist — if so, only include items with pending qty
  const existingGRNs = await db.getAllAsync<{ id: string; overall_status: string }>(
    `SELECT id, overall_status FROM grn_records WHERE po_id = ? AND id != ?`,
    [poId, id]
  );
  const hasPrevious = existingGRNs.length > 0;

  const poItems = await getPOItems(poId);
  let totalOrdered = 0;

  for (const item of poItems) {
    let sizeData = buildGRNSizeData(item as POItem & { garment_type?: string });
    let orderedQty = item.total_qty;

    if (hasPrevious) {
      // Sum received qty per size across all previous finalized GRN items for this PO item
      const prevRows = await db.getAllAsync<{ received_qty: number; size_data_json: string | null }>(
        `SELECT gi.received_qty, gi.size_data_json
         FROM grn_items gi
         JOIN grn_records gr ON gi.grn_id = gr.id
         WHERE gi.po_item_id = ? AND gr.overall_status != 'pending' AND gr.id != ?`,
        [item.id, id]
      );
      const prevTotalReceived = prevRows.reduce((s, r) => s + r.received_qty, 0);
      const pendingQty = Math.max(0, item.total_qty - prevTotalReceived);

      if (pendingQty === 0) continue; // fully received, skip

      orderedQty = pendingQty;

      // Rebuild size data with pending per-size quantities
      const pendingSizeData: GRNSizeData = {};
      for (const [lbl, entry] of Object.entries(sizeData)) {
        let prevReceivedForSize = 0;
        for (const row of prevRows) {
          if (row.size_data_json) {
            const sd = JSON.parse(row.size_data_json) as GRNSizeData;
            prevReceivedForSize += sd[lbl]?.received ?? 0;
          }
        }
        const pending = Math.max(0, entry.ordered - prevReceivedForSize);
        pendingSizeData[lbl] = { ordered: pending, received: 0, accepted: 0, rejected: 0 };
      }
      sizeData = pendingSizeData;
    }

    const sizeJson = JSON.stringify(sizeData);
    await db.runAsync(
      `INSERT INTO grn_items (id, grn_id, po_item_id, product_id, ordered_qty,
        received_qty, accepted_qty, rejected_qty, status, size_data_json)
       VALUES (?,?,?,?,?,0,0,0,'pending',?)`,
      [uuid(), id, item.id, item.product_id, orderedQty, sizeJson]
    );
    totalOrdered += orderedQty;
  }

  await db.runAsync('UPDATE grn_records SET total_ordered_qty = ? WHERE id = ?', [totalOrdered, id]);
  return id;
}

async function getGRNItems(grnId: string): Promise<GRNItem[]> {
  const db = getDb();
  const rows = await db.getAllAsync<GRNItem>(
    `SELECT gi.*, p.design_name, p.garment_type
     FROM grn_items gi
     LEFT JOIN products p ON gi.product_id = p.id
     WHERE gi.grn_id = ?
     ORDER BY gi.created_at ASC`,
    [grnId]
  );
  const result: GRNItem[] = [];
  for (const item of rows) {
    result.push({
      ...item,
      size_data: item.size_data_json ? JSON.parse(item.size_data_json) as GRNSizeData : undefined,
      photos: await db.getAllAsync<GRNPhoto>(
        'SELECT * FROM grn_photos WHERE grn_item_id = ? ORDER BY created_at ASC',
        [item.id]
      ),
    });
  }
  return result;
}

export async function getGRN(grnId: string): Promise<GRNRecord | null> {
  const grn = await getDb().getFirstAsync<GRNRecord>(
    'SELECT * FROM grn_records WHERE id = ?', [grnId]
  );
  if (!grn) return null;
  grn.items = await getGRNItems(grnId);
  return grn;
}

export async function getGRNByPO(poId: string): Promise<GRNRecord | null> {
  const grn = await getDb().getFirstAsync<GRNRecord>(
    'SELECT * FROM grn_records WHERE po_id = ? ORDER BY created_at DESC LIMIT 1',
    [poId]
  );
  if (!grn) return null;
  grn.items = await getGRNItems(grn.id);
  return grn;
}

/** Returns ALL GRNs for a PO (lightweight — no items loaded) */
export async function getGRNsByPO(poId: string): Promise<GRNRecord[]> {
  return getDb().getAllAsync<GRNRecord>(
    'SELECT * FROM grn_records WHERE po_id = ? ORDER BY created_at ASC',
    [poId]
  );
}

/**
 * For each PO item, returns how much has already been received across ALL
 * finalized/partial GRNs, and how much is still pending.
 */
export async function getPOPendingQty(poId: string): Promise<
  { poItemId: string; productId: string; orderedQty: number; totalReceived: number; pendingQty: number; sizeData: GRNSizeData }[]
> {
  const poItems = await getPOItems(poId);
  const result = [];
  for (const item of poItems) {
    const grnItemRows = await getDb().getAllAsync<{
      ordered_qty: number; received_qty: number; size_data_json: string | null; grn_id: string;
    }>(
      `SELECT gi.ordered_qty, gi.received_qty, gi.size_data_json, gi.grn_id
       FROM grn_items gi
       JOIN grn_records gr ON gi.grn_id = gr.id
       WHERE gi.po_item_id = ? AND gr.overall_status != 'pending'`,
      [item.id]
    );
    const totalReceived = grnItemRows.reduce((s, r) => s + r.received_qty, 0);
    const pendingQty = Math.max(0, item.total_qty - totalReceived);

    // Build pending size data
    const baseSizeData = buildGRNSizeData(item as POItem & { garment_type?: string });
    const pendingSizeData: GRNSizeData = {};
    for (const [lbl, entry] of Object.entries(baseSizeData)) {
      let receivedForSize = 0;
      for (const row of grnItemRows) {
        if (row.size_data_json) {
          const sd = JSON.parse(row.size_data_json) as GRNSizeData;
          receivedForSize += sd[lbl]?.received ?? 0;
        }
      }
      const pendingOrdered = Math.max(0, entry.ordered - receivedForSize);
      if (pendingOrdered > 0) {
        pendingSizeData[lbl] = { ordered: pendingOrdered, received: 0, accepted: 0, rejected: 0 };
      }
    }

    result.push({
      poItemId: item.id,
      productId: item.product_id,
      orderedQty: item.total_qty,
      totalReceived,
      pendingQty,
      sizeData: pendingSizeData,
    });
  }
  return result;
}

export async function updateGRNItem(itemId: string, data: Partial<GRNItem>): Promise<void> {
  const db = getDb();
  // If size_data provided, serialize to JSON and recalculate totals from size sums
  const writeData: Record<string, unknown> = { ...data };
  if (data.size_data) {
    const entries = Object.values(data.size_data);
    writeData.size_data_json = JSON.stringify(data.size_data);
    writeData.received_qty = entries.reduce((s, e) => s + e.received, 0);
    writeData.accepted_qty = entries.reduce((s, e) => s + e.accepted, 0);
    writeData.rejected_qty = entries.reduce((s, e) => s + e.rejected, 0);
    delete writeData.size_data;
  }
  const excluded = ['id', 'grn_id', 'po_item_id', 'product_id', 'created_at', 'design_name', 'garment_type', 'photos'];
  const fields = Object.keys(writeData).filter((k) => !excluded.includes(k));
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => writeData[f] ?? null) as (string | number | null)[];
  await db.runAsync(`UPDATE grn_items SET ${setClause} WHERE id = ?`, [...values, itemId]);
}

export async function finalizeGRN(grnId: string): Promise<void> {
  const db = getDb();
  const items = await db.getAllAsync<{
    ordered_qty: number; received_qty: number; accepted_qty: number; rejected_qty: number; size_data_json: string | null;
  }>('SELECT ordered_qty, received_qty, accepted_qty, rejected_qty, size_data_json FROM grn_items WHERE grn_id = ?', [grnId]);

  const totalOrdered = items.reduce((s, i) => s + i.ordered_qty, 0);
  const totalReceived = items.reduce((s, i) => s + i.received_qty, 0);
  const totalAccepted = items.reduce((s, i) => s + i.accepted_qty, 0);
  const totalRejected = items.reduce((s, i) => s + i.rejected_qty, 0);

  // Calculate total pending from size-level data
  let totalPending = 0;
  for (const item of items) {
    if (item.size_data_json) {
      const sizeData = JSON.parse(item.size_data_json) as GRNSizeData;
      for (const entry of Object.values(sizeData)) {
        totalPending += Math.max(0, entry.ordered - entry.received);
      }
    } else {
      totalPending += Math.max(0, item.ordered_qty - item.received_qty);
    }
  }

  let overall_status: GRNRecord['overall_status'];
  if (totalPending === 0 && totalRejected === 0) {
    overall_status = 'accepted';
  } else if (totalPending === 0 && totalRejected > 0) {
    overall_status = 'partial';
  } else {
    overall_status = 'partial';
  }

  await db.runAsync(
    `UPDATE grn_records SET overall_status=?, total_ordered_qty=?, total_received_qty=?,
      total_accepted_qty=?, total_rejected_qty=?, updated_at=datetime('now') WHERE id=?`,
    [overall_status, totalOrdered, totalReceived, totalAccepted, totalRejected, grnId]
  );
}

export async function getGRNPendingTotal(poId: string): Promise<{
  totalOrdered: number;
  totalReceived: number;
  totalPending: number;
  allReceived: boolean;
}> {
  const grn = await getGRNByPO(poId);
  if (!grn || !grn.items || grn.items.length === 0) {
    return { totalOrdered: 0, totalReceived: 0, totalPending: 0, allReceived: false };
  }

  let totalOrdered = 0;
  let totalReceived = 0;
  let totalPending = 0;

  for (const item of grn.items) {
    if (item.size_data) {
      for (const entry of Object.values(item.size_data)) {
        totalOrdered += entry.ordered;
        totalReceived += entry.received;
        totalPending += Math.max(0, entry.ordered - entry.received);
      }
    } else {
      totalOrdered += item.ordered_qty;
      totalReceived += item.received_qty;
      totalPending += Math.max(0, item.ordered_qty - item.received_qty);
    }
  }

  return { totalOrdered, totalReceived, totalPending, allReceived: totalPending === 0 };
}

export async function addGRNPhoto(grnItemId: string, photoUri: string, photoType = 'received'): Promise<string> {
  const id = uuid();
  await getDb().runAsync(
    'INSERT INTO grn_photos (id, grn_item_id, photo_uri, photo_type) VALUES (?,?,?,?)',
    [id, grnItemId, photoUri, photoType]
  );
  return id;
}

export async function getGRNPendingCount(): Promise<number> {
  const row = await getDb().getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM grn_records WHERE overall_status = 'pending'`
  );
  return row?.cnt ?? 0;
}

// ── Lorry Receipts ────────────────────────────────────────────────────────────

export async function createLR(poId: string, data: Partial<LorryReceipt>): Promise<string> {
  const db = getDb();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO lorry_receipts (id, po_id, lr_number, transporter_name, dispatch_date,
      expected_delivery_date, actual_delivery_date, photo_uri, status, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      id, poId,
      data.lr_number ?? null, data.transporter_name ?? null, data.dispatch_date ?? null,
      data.expected_delivery_date ?? null, data.actual_delivery_date ?? null,
      data.photo_uri ?? null, data.status ?? 'dispatched', data.notes ?? null,
    ]
  );
  return id;
}

export async function getLRByPO(poId: string): Promise<LorryReceipt | null> {
  return getDb().getFirstAsync<LorryReceipt>(
    'SELECT * FROM lorry_receipts WHERE po_id = ? ORDER BY created_at DESC LIMIT 1',
    [poId]
  );
}

export async function updateLR(lrId: string, data: Partial<LorryReceipt>): Promise<void> {
  const db = getDb();
  const excluded = ['id', 'po_id', 'created_at'];
  const fields = Object.keys(data).filter((k) => !excluded.includes(k));
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => (data as Record<string, unknown>)[f] ?? null) as (string | number | null)[];
  await db.runAsync(
    `UPDATE lorry_receipts SET ${setClause}, updated_at=datetime('now') WHERE id=?`,
    [...values, lrId]
  );
}

// ── Reports ───────────────────────────────────────────────────────────────────

export interface POSummaryReport {
  total: number;
  totalValue: number;
  byStatus: { status: string; count: number; value: number }[];
  topVendors: { vendor_name: string; count: number; value: number }[];
}

export async function getPOSummaryReport(): Promise<POSummaryReport> {
  const db = getDb();
  const meta = await db.getFirstAsync<{ total: number; totalValue: number }>(
    `SELECT COUNT(*) as total, COALESCE(SUM(total_value),0) as totalValue
     FROM purchase_orders WHERE is_deleted != 1 OR is_deleted IS NULL`
  );
  const byStatus = await db.getAllAsync<{ status: string; count: number; value: number }>(
    `SELECT status, COUNT(*) as count, COALESCE(SUM(total_value),0) as value
     FROM purchase_orders WHERE is_deleted != 1 OR is_deleted IS NULL
     GROUP BY status ORDER BY count DESC`
  );
  const topVendors = await db.getAllAsync<{ vendor_name: string; count: number; value: number }>(
    `SELECT v.name as vendor_name, COUNT(po.id) as count, COALESCE(SUM(po.total_value),0) as value
     FROM purchase_orders po
     LEFT JOIN vendors v ON po.vendor_id = v.id
     WHERE po.is_deleted != 1 OR po.is_deleted IS NULL
     GROUP BY po.vendor_id ORDER BY value DESC LIMIT 10`
  );
  return {
    total: meta?.total ?? 0,
    totalValue: meta?.totalValue ?? 0,
    byStatus,
    topVendors,
  };
}

export interface GRNSummaryReport {
  totalGRNs: number;
  totalOrdered: number;
  totalReceived: number;
  totalAccepted: number;
  totalRejected: number;
  acceptanceRate: number;
  byVendor: { vendor_name: string; ordered: number; accepted: number; acceptance_rate: number }[];
}

export async function getGRNSummaryReport(): Promise<GRNSummaryReport> {
  const db = getDb();
  const totals = await db.getFirstAsync<{
    cnt: number; ordered: number; received: number; accepted: number; rejected: number;
  }>(
    `SELECT COUNT(*) as cnt,
     COALESCE(SUM(total_ordered_qty),0) as ordered,
     COALESCE(SUM(total_received_qty),0) as received,
     COALESCE(SUM(total_accepted_qty),0) as accepted,
     COALESCE(SUM(total_rejected_qty),0) as rejected
     FROM grn_records`
  );
  const byVendor = await db.getAllAsync<{ vendor_name: string; ordered: number; accepted: number }>(
    `SELECT v.name as vendor_name,
     COALESCE(SUM(gr.total_ordered_qty),0) as ordered,
     COALESCE(SUM(gr.total_accepted_qty),0) as accepted
     FROM grn_records gr
     LEFT JOIN purchase_orders po ON gr.po_id = po.id
     LEFT JOIN vendors v ON po.vendor_id = v.id
     GROUP BY po.vendor_id ORDER BY ordered DESC LIMIT 10`
  );
  const acceptanceRate = totals?.ordered
    ? Math.round((totals.accepted / totals.ordered) * 100)
    : 0;
  return {
    totalGRNs: totals?.cnt ?? 0,
    totalOrdered: totals?.ordered ?? 0,
    totalReceived: totals?.received ?? 0,
    totalAccepted: totals?.accepted ?? 0,
    totalRejected: totals?.rejected ?? 0,
    acceptanceRate,
    byVendor: byVendor.map((r) => ({
      ...r,
      acceptance_rate: r.ordered ? Math.round((r.accepted / r.ordered) * 100) : 0,
    })),
  };
}

export interface TripBudgetReport {
  trips: { name: string; budget: number; spent: number; utilization: number; po_count: number }[];
}

export async function getTripBudgetReport(): Promise<TripBudgetReport> {
  const rows = await getDb().getAllAsync<{ name: string; budget: number; spent: number; po_count: number }>(
    `SELECT pt.name, pt.budget, pt.spent,
     (SELECT COUNT(*) FROM purchase_orders WHERE trip_id = pt.id AND (is_deleted != 1 OR is_deleted IS NULL)) as po_count
     FROM purchase_trips pt ORDER BY pt.created_at DESC`
  );
  return {
    trips: rows.map((r) => ({
      ...r,
      utilization: r.budget > 0 ? Math.round((r.spent / r.budget) * 100) : 0,
    })),
  };
}

// ── Stores ────────────────────────────────────────────────────────────────────

export async function getStores(activeOnly = false): Promise<Store[]> {
  const db = getDb();
  if (activeOnly) {
    return db.getAllAsync<Store>('SELECT * FROM stores WHERE is_active = 1 ORDER BY code');
  }
  return db.getAllAsync<Store>('SELECT * FROM stores ORDER BY code');
}

export async function getStoreById(id: number): Promise<Store | null> {
  return getDb().getFirstAsync<Store>('SELECT * FROM stores WHERE id = ?', [id]);
}

export async function createStore(data: Partial<Store>): Promise<number> {
  const db = getDb();
  const result = await db.runAsync(
    `INSERT INTO stores (name, code, address, city, manager_name, manager_phone, is_active)
     VALUES (?,?,?,?,?,?,?)`,
    [
      data.name ?? 'Store',
      data.code ?? '',
      data.address ?? null,
      data.city ?? null,
      data.manager_name ?? null,
      data.manager_phone ?? null,
      data.is_active ?? 1,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateStore(id: number, data: Partial<Store>): Promise<void> {
  const db = getDb();
  const excluded = ['id', 'created_at'];
  const fields = Object.keys(data).filter((k) => !excluded.includes(k));
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => (data as Record<string, unknown>)[f] ?? null) as (string | number | null)[];
  await db.runAsync(`UPDATE stores SET ${setClause} WHERE id = ?`, [...values, id]);
}

// ── Stock Allocations ─────────────────────────────────────────────────────────

export async function createAllocation(
  grnId: string,
  grnItemId: string,
  productId: string,
  storeId: number,
  sizeAllocations: Record<string, number>
): Promise<number> {
  const db = getDb();
  const totalAllocated = Object.values(sizeAllocations).reduce((s, v) => s + v, 0);
  const result = await db.runAsync(
    `INSERT INTO stock_allocations (grn_id, grn_item_id, product_id, store_id, size_allocations_json, total_allocated, status)
     VALUES (?,?,?,?,?,?,'pending')`,
    [grnId, grnItemId, productId, storeId, JSON.stringify(sizeAllocations), totalAllocated]
  );
  return result.lastInsertRowId;
}

export async function getAllocationsByGRN(grnId: string): Promise<StockAllocation[]> {
  const rows = await getDb().getAllAsync<StockAllocation>(
    `SELECT sa.*, s.name as store_name, s.code as store_code
     FROM stock_allocations sa
     LEFT JOIN stores s ON sa.store_id = s.id
     WHERE sa.grn_id = ? ORDER BY sa.store_id, sa.created_at`,
    [grnId]
  );
  return rows.map((r) => ({
    ...r,
    size_allocations: r.size_allocations_json ? JSON.parse(r.size_allocations_json) as Record<string, number> : {},
  }));
}

export async function getAllocationsByStore(storeId: number): Promise<StockAllocation[]> {
  const rows = await getDb().getAllAsync<StockAllocation>(
    `SELECT sa.*, s.name as store_name, s.code as store_code
     FROM stock_allocations sa
     LEFT JOIN stores s ON sa.store_id = s.id
     WHERE sa.store_id = ? ORDER BY sa.created_at DESC`,
    [storeId]
  );
  return rows.map((r) => ({
    ...r,
    size_allocations: r.size_allocations_json ? JSON.parse(r.size_allocations_json) as Record<string, number> : {},
  }));
}

export async function deleteAllocationsByGRN(grnId: string): Promise<void> {
  await getDb().runAsync('DELETE FROM stock_allocations WHERE grn_id = ?', [grnId]);
}

// ── Dashboard Data ────────────────────────────────────────────────────────────

export interface DashboardData {
  activePOs: number;
  pendingGRN: number;
  totalVendors: number;
  monthValue: number;
  monthlyTrend: { month: string; value: number }[];
  vendorQuality: { vendor: string; acceptRate: number }[];
  recentActivity: { type: string; description: string; timestamp: string }[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const db = getDb();

  // Active POs
  const poRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM purchase_orders WHERE is_deleted = 0 AND status NOT IN ('closed')`
  );
  const activePOs = poRow?.count ?? 0;

  // Pending GRN items
  const grnRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM grn_items WHERE status = 'pending'`
  );
  const pendingGRN = grnRow?.count ?? 0;

  // Total active vendors
  const vRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM vendors WHERE is_active = 1`
  );
  const totalVendors = vRow?.count ?? 0;

  // Current month PO value
  const monthRow = await db.getFirstAsync<{ val: number }>(
    `SELECT COALESCE(SUM(total_value),0) as val FROM purchase_orders
     WHERE is_deleted = 0 AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
  );
  const monthValue = monthRow?.val ?? 0;

  // Monthly PO value trend — last 6 months
  const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const trendRows = await db.getAllAsync<{ month: string; value: number }>(
    `SELECT strftime('%m', created_at) as month,
            COALESCE(SUM(total_value),0) as value
     FROM purchase_orders
     WHERE is_deleted = 0
       AND created_at >= date('now', '-6 months')
     GROUP BY strftime('%Y-%m', created_at)
     ORDER BY strftime('%Y-%m', created_at) ASC`
  );
  const monthlyTrend = trendRows.length > 0
    ? trendRows.map((r) => ({ month: MONTH_NAMES[parseInt(r.month, 10)] ?? r.month, value: r.value }))
    : [{ month: 'Now', value: 0 }];

  // Vendor quality — accept rate from GRN items joined to PO
  const qualityRows = await db.getAllAsync<{ vendor: string; acceptRate: number }>(
    `SELECT COALESCE(v.name, 'Unknown') as vendor,
            CASE WHEN SUM(gi.received_qty) > 0
                 THEN ROUND(100.0 * SUM(gi.accepted_qty) / SUM(gi.received_qty), 1)
                 ELSE 0 END as acceptRate
     FROM grn_items gi
     JOIN grn_records gr ON gi.grn_id = gr.id
     JOIN purchase_orders po ON gr.po_id = po.id
     LEFT JOIN vendors v ON po.vendor_id = v.id
     WHERE po.is_deleted = 0
     GROUP BY po.vendor_id
     ORDER BY acceptRate DESC
     LIMIT 5`
  );
  const vendorQuality = qualityRows;

  // Recent activity — last 8 events from POs and GRNs
  const activityPOs = await db.getAllAsync<{ description: string; timestamp: string }>(
    `SELECT 'PO ' || po_number || ' — ' || status as description, updated_at as timestamp
     FROM purchase_orders WHERE is_deleted = 0
     ORDER BY updated_at DESC LIMIT 4`
  );
  const activityGRNs = await db.getAllAsync<{ description: string; timestamp: string }>(
    `SELECT 'GRN ' || grn_number || ' — ' || overall_status as description, updated_at as timestamp
     FROM grn_records ORDER BY updated_at DESC LIMIT 4`
  );
  const combined = [
    ...activityPOs.map((a) => ({ type: 'PO', description: a.description, timestamp: a.timestamp })),
    ...activityGRNs.map((a) => ({ type: 'GRN', description: a.description, timestamp: a.timestamp })),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 8);

  return { activePOs, pendingGRN, totalVendors, monthValue, monthlyTrend, vendorQuality, recentActivity: combined };
}

// ── Users ─────────────────────────────────────────────────────────────────────

export function hashPin(pin: string): string {
  let hash = 5381;
  for (let i = 0; i < pin.length; i++) {
    hash = ((hash << 5) + hash) ^ pin.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash.toString(16);
}

export async function createUser(data: { name: string; role: string; phone: string; pin: string; is_active?: number }): Promise<number> {
  const db = getDb();
  const pinHash = hashPin(data.pin);
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO users (name, role, phone, pin, is_active) VALUES (?,?,?,?,?)`,
    [data.name, data.role, data.phone, pinHash, data.is_active ?? 1]
  );
  return result.lastInsertRowId;
}

export async function getUserByPhone(phone: string): Promise<User | null> {
  return getDb().getFirstAsync<User>('SELECT * FROM users WHERE phone = ? AND is_active = 1', [phone]);
}

export async function verifyPin(userId: number, pin: string): Promise<boolean> {
  const user = await getDb().getFirstAsync<User>('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return false;
  return user.pin === hashPin(pin);
}

export async function updateLastLogin(userId: number): Promise<void> {
  await getDb().runAsync(`UPDATE users SET last_login = datetime('now') WHERE id = ?`, [userId]);
}

export async function getUserCount(): Promise<number> {
  const row = await getDb().getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM users');
  return row?.count ?? 0;
}
