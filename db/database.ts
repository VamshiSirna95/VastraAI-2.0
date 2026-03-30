import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES } from './schema';
import type { Product, ProductPhoto, Vendor, CustomAttribute, PurchaseOrder, POItem, PurchaseTrip, DeliveryConfig, GRNRecord, GRNItem, GRNPhoto, LorryReceipt, GRNSizeData } from './types';
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
    `INSERT INTO vendors (id, name, contact_person, phone, area, speciality, rank, notes)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      id,
      vendor.name ?? 'Unknown',
      vendor.contact_person ?? null,
      vendor.phone ?? null,
      vendor.area ?? null,
      vendor.speciality ?? null,
      vendor.rank ?? 'B',
      vendor.notes ?? null,
    ]
  );
  return id;
}

export async function getVendors(search?: string): Promise<Vendor[]> {
  const db = getDb();
  if (search) {
    return db.getAllAsync<Vendor>(
      'SELECT * FROM vendors WHERE name LIKE ? OR area LIKE ? ORDER BY rank, name',
      [`%${search}%`, `%${search}%`]
    );
  }
  return db.getAllAsync<Vendor>('SELECT * FROM vendors ORDER BY rank, name');
}

export async function getVendorById(id: string): Promise<Vendor | null> {
  return getDb().getFirstAsync<Vendor>('SELECT * FROM vendors WHERE id = ?', [id]);
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

  // Create grn_items for each po_item, including size breakdown
  const poItems = await getPOItems(poId);
  for (const item of poItems) {
    const sizeJson = JSON.stringify(buildGRNSizeData(item as POItem & { garment_type?: string }));
    await db.runAsync(
      `INSERT INTO grn_items (id, grn_id, po_item_id, product_id, ordered_qty,
        received_qty, accepted_qty, rejected_qty, status, size_data_json)
       VALUES (?,?,?,?,?,0,0,0,'pending',?)`,
      [uuid(), id, item.id, item.product_id, item.total_qty, sizeJson]
    );
  }

  // Set total_ordered_qty
  const totalOrdered = poItems.reduce((s, i) => s + i.total_qty, 0);
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
