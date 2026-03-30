export const CREATE_TABLES = [
  // Products — core product record
  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    barcode TEXT,
    design_name TEXT,
    garment_type TEXT,
    vendor_id TEXT,
    purchase_price REAL,
    selling_price REAL,
    mrp REAL,
    primary_color TEXT,
    secondary_color TEXT,
    pattern TEXT,
    fabric TEXT,
    work_type TEXT,
    occasion TEXT,
    season TEXT,
    sleeve TEXT,
    neck TEXT,
    fit TEXT,
    length TEXT,
    notes TEXT,
    voice_note_uri TEXT,
    voice_note_transcript TEXT,
    ai_confidence REAL,
    status TEXT DEFAULT 'draft',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  // Product photos — multiple per product
  `CREATE TABLE IF NOT EXISTS product_photos (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    uri TEXT NOT NULL,
    photo_type TEXT NOT NULL,
    is_primary INTEGER DEFAULT 0,
    quality_score REAL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  )`,

  // Vendors
  `CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    area TEXT,
    speciality TEXT,
    rank TEXT DEFAULT 'B',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  // Custom attributes — user-defined per garment type
  `CREATE TABLE IF NOT EXISTS custom_attributes (
    id TEXT PRIMARY KEY,
    garment_type TEXT NOT NULL,
    attribute_name TEXT NOT NULL,
    usage_count INTEGER DEFAULT 1,
    is_suggested INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Product custom attribute values
  `CREATE TABLE IF NOT EXISTS product_custom_attrs (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    attribute_name TEXT NOT NULL,
    attribute_value TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  )`,

  // Attribute templates — default fields per garment type
  `CREATE TABLE IF NOT EXISTS attribute_templates (
    id TEXT PRIMARY KEY,
    garment_type TEXT NOT NULL,
    attribute_name TEXT NOT NULL,
    display_order INTEGER DEFAULT 0
  )`,
];
