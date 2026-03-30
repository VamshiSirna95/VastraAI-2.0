import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES } from './schema';
import type { Product, ProductPhoto, Vendor, CustomAttribute } from './types';

// ── DB singleton ──────────────────────────────────────────────────────────────

let _db: SQLite.SQLiteDatabase | null = null;

export async function initDatabase(): Promise<void> {
  _db = await SQLite.openDatabaseAsync('vastra.db');
  await _db.execAsync('PRAGMA journal_mode = WAL');
  await _db.execAsync('PRAGMA foreign_keys = ON');
  for (const sql of CREATE_TABLES) {
    await _db.execAsync(sql);
  }
  await seedAttributeTemplates();
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
