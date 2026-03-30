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
    alt_phone TEXT,
    email TEXT,
    area TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    speciality TEXT,
    gstin TEXT,
    pan TEXT,
    bank_name TEXT,
    bank_account TEXT,
    bank_ifsc TEXT,
    payment_terms TEXT,
    rank TEXT DEFAULT 'B',
    rating REAL DEFAULT 0,
    avg_lead_days INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_value REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
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

  // Purchase Orders
  `CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    po_number TEXT UNIQUE NOT NULL,
    vendor_id TEXT NOT NULL,
    trip_id TEXT,
    status TEXT DEFAULT 'draft',
    total_qty INTEGER DEFAULT 0,
    total_value REAL DEFAULT 0,
    delivery_date TEXT,
    dispatch_date TEXT,
    store_arrival_date TEXT,
    notes TEXT,
    voice_note_uri TEXT,
    cancellation_reason TEXT,
    cancelled_qty INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    document_uri TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (vendor_id) REFERENCES vendors(id)
  )`,

  // PO Line Items
  `CREATE TABLE IF NOT EXISTS po_items (
    id TEXT PRIMARY KEY,
    po_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    size_s INTEGER DEFAULT 0,
    size_m INTEGER DEFAULT 0,
    size_l INTEGER DEFAULT 0,
    size_xl INTEGER DEFAULT 0,
    size_xxl INTEGER DEFAULT 0,
    size_free INTEGER DEFAULT 0,
    total_qty INTEGER DEFAULT 0,
    unit_price REAL DEFAULT 0,
    total_price REAL DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`,

  // Purchase Trips (budget tracking)
  `CREATE TABLE IF NOT EXISTS purchase_trips (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    budget REAL DEFAULT 0,
    spent REAL DEFAULT 0,
    vendor_area TEXT,
    status TEXT DEFAULT 'active',
    start_date TEXT,
    end_date TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  // Delivery tracking config
  `CREATE TABLE IF NOT EXISTS delivery_config (
    id TEXT PRIMARY KEY,
    optimal_stock_cover_days INTEGER DEFAULT 90,
    vendor_transit_days INTEGER DEFAULT 2,
    inward_processing_days INTEGER DEFAULT 1,
    store_dispatch_days INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  // GRN Records
  `CREATE TABLE IF NOT EXISTS grn_records (
    id TEXT PRIMARY KEY,
    po_id TEXT NOT NULL REFERENCES purchase_orders(id),
    grn_number TEXT NOT NULL,
    received_date TEXT NOT NULL,
    received_by TEXT,
    warehouse_notes TEXT,
    overall_status TEXT NOT NULL DEFAULT 'pending',
    total_ordered_qty INTEGER DEFAULT 0,
    total_received_qty INTEGER DEFAULT 0,
    total_accepted_qty INTEGER DEFAULT 0,
    total_rejected_qty INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  // GRN Line Items (one per PO item)
  `CREATE TABLE IF NOT EXISTS grn_items (
    id TEXT PRIMARY KEY,
    grn_id TEXT NOT NULL REFERENCES grn_records(id),
    po_item_id TEXT NOT NULL REFERENCES po_items(id),
    product_id TEXT NOT NULL,
    ordered_qty INTEGER NOT NULL,
    received_qty INTEGER NOT NULL DEFAULT 0,
    accepted_qty INTEGER NOT NULL DEFAULT 0,
    rejected_qty INTEGER NOT NULL DEFAULT 0,
    rejection_reason TEXT,
    color_match_pct REAL,
    pattern_match_pct REAL,
    overall_match_pct REAL,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    size_data_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // GRN Photos (comparison evidence)
  `CREATE TABLE IF NOT EXISTS grn_photos (
    id TEXT PRIMARY KEY,
    grn_item_id TEXT NOT NULL REFERENCES grn_items(id),
    photo_uri TEXT NOT NULL,
    photo_type TEXT NOT NULL DEFAULT 'received',
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Lorry Receipts
  `CREATE TABLE IF NOT EXISTS lorry_receipts (
    id TEXT PRIMARY KEY,
    po_id TEXT NOT NULL REFERENCES purchase_orders(id),
    lr_number TEXT,
    transporter_name TEXT,
    dispatch_date TEXT,
    expected_delivery_date TEXT,
    actual_delivery_date TEXT,
    photo_uri TEXT,
    status TEXT NOT NULL DEFAULT 'dispatched',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
];
