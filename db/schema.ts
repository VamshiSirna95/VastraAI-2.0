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

  // Stores
  `CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    address TEXT,
    city TEXT,
    manager_name TEXT,
    manager_phone TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Stock Allocations — per GRN item to stores with size breakdown
  `CREATE TABLE IF NOT EXISTS stock_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grn_id TEXT NOT NULL REFERENCES grn_records(id),
    grn_item_id TEXT NOT NULL REFERENCES grn_items(id),
    product_id TEXT NOT NULL,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    size_allocations_json TEXT NOT NULL,
    total_allocated INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Users
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    phone TEXT UNIQUE NOT NULL,
    pin TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    last_login TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Voice Notes — audio recordings attached to POs or PO items
  `CREATE TABLE IF NOT EXISTS voice_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id TEXT REFERENCES purchase_orders(id),
    po_item_id TEXT REFERENCES po_items(id),
    file_uri TEXT NOT NULL,
    duration_seconds INTEGER,
    transcription TEXT,
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

  // Store Stock Pool — per-store per-product inventory
  `CREATE TABLE IF NOT EXISTS store_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    size_stock_json TEXT NOT NULL DEFAULT '{}',
    total_qty INTEGER NOT NULL DEFAULT 0,
    last_updated TEXT DEFAULT (datetime('now')),
    UNIQUE(store_id, product_id)
  )`,

  // Stock Transfers — inter-store transfer requests
  `CREATE TABLE IF NOT EXISTS stock_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_store_id INTEGER NOT NULL REFERENCES stores(id),
    to_store_id INTEGER NOT NULL REFERENCES stores(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    size_transfer_json TEXT NOT NULL,
    total_qty INTEGER NOT NULL,
    status TEXT DEFAULT 'requested',
    requested_by TEXT,
    approved_by TEXT,
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  // Customer Demands — capture what customers are looking for
  `CREATE TABLE IF NOT EXISTS customer_demands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_phone TEXT,
    customer_name TEXT,
    description TEXT NOT NULL,
    photo_uri TEXT,
    garment_type TEXT,
    color_preference TEXT,
    price_range_min REAL,
    price_range_max REAL,
    store_id INTEGER REFERENCES stores(id),
    captured_by TEXT,
    status TEXT DEFAULT 'open',
    matched_product_id TEXT REFERENCES products(id),
    fulfilled_date TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Notifications — in-app notification center
  `CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    reference_type TEXT,
    reference_id TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Seasonal Plans — festival & seasonal purchase planning
  `CREATE TABLE IF NOT EXISTS seasonal_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_name TEXT NOT NULL,
    season_type TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    target_budget REAL,
    notes TEXT,
    status TEXT DEFAULT 'planning',
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Seasonal Plan Items — per-category breakdown within a plan
  `CREATE TABLE IF NOT EXISTS seasonal_plan_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL REFERENCES seasonal_plans(id),
    category TEXT NOT NULL,
    target_qty INTEGER,
    target_value REAL,
    color_preference TEXT,
    pattern_preference TEXT,
    vendor_ids TEXT,
    notes TEXT,
    priority TEXT DEFAULT 'medium'
  )`,

  // Competition Prices — competitor price tracking per product
  `CREATE TABLE IF NOT EXISTS competition_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT REFERENCES products(id),
    competitor_name TEXT NOT NULL,
    competitor_price REAL NOT NULL,
    our_mrp REAL,
    our_selling_price REAL,
    our_offer_percent REAL DEFAULT 0,
    photo_uri TEXT,
    notes TEXT,
    captured_at TEXT DEFAULT (datetime('now')),
    store_id INTEGER REFERENCES stores(id)
  )`,

  // Dispatch Notes — per-store dispatch records after allocation
  `CREATE TABLE IF NOT EXISTS dispatch_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grn_id TEXT REFERENCES grn_records(id),
    store_id INTEGER NOT NULL REFERENCES stores(id),
    dispatch_number TEXT NOT NULL,
    items_json TEXT NOT NULL,
    total_items INTEGER,
    total_qty INTEGER,
    status TEXT DEFAULT 'generated',
    dispatched_at TEXT,
    received_at TEXT,
    received_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Sales Data — imported from Ginesys or other POS systems
  `CREATE TABLE IF NOT EXISTS sales_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT REFERENCES products(id),
    store_id INTEGER REFERENCES stores(id),
    barcode TEXT,
    product_name TEXT,
    qty_sold INTEGER NOT NULL DEFAULT 0,
    sale_value REAL NOT NULL DEFAULT 0,
    sale_date TEXT NOT NULL,
    upload_batch TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Data Uploads — history of imported files
  `CREATE TABLE IF NOT EXISTS data_uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    upload_type TEXT NOT NULL DEFAULT 'sales',
    row_count INTEGER,
    matched_count INTEGER,
    unmatched_count INTEGER,
    status TEXT DEFAULT 'processing',
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Product Offers — markdown / promotion records
  `CREATE TABLE IF NOT EXISTS product_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT REFERENCES products(id),
    offer_type TEXT NOT NULL,
    offer_value REAL,
    start_date TEXT,
    end_date TEXT,
    reason TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Vendor Communications — log calls, WhatsApp, emails, meetings
  `CREATE TABLE IF NOT EXISTS vendor_communications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id TEXT NOT NULL REFERENCES vendors(id),
    po_id TEXT REFERENCES purchase_orders(id),
    type TEXT NOT NULL,
    direction TEXT DEFAULT 'outgoing',
    subject TEXT,
    content TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // ── Indexes ────────────────────────────────────────────────────────────────
  `CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)`,
  `CREATE INDEX IF NOT EXISTS idx_products_garment_type ON products(garment_type)`,
  `CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)`,

  `CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status)`,
  `CREATE INDEX IF NOT EXISTS idx_po_vendor_id ON purchase_orders(vendor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_po_is_deleted ON purchase_orders(is_deleted)`,
  `CREATE INDEX IF NOT EXISTS idx_po_created_at ON purchase_orders(created_at)`,

  `CREATE INDEX IF NOT EXISTS idx_po_items_po_id ON po_items(po_id)`,
  `CREATE INDEX IF NOT EXISTS idx_po_items_product_id ON po_items(product_id)`,

  `CREATE INDEX IF NOT EXISTS idx_grn_po_id ON grn_records(po_id)`,
  `CREATE INDEX IF NOT EXISTS idx_grn_status ON grn_records(overall_status)`,
  `CREATE INDEX IF NOT EXISTS idx_grn_items_grn_id ON grn_items(grn_id)`,

  `CREATE INDEX IF NOT EXISTS idx_vendors_active ON vendors(is_active)`,
  `CREATE INDEX IF NOT EXISTS idx_vendors_rating ON vendors(rating)`,

  `CREATE INDEX IF NOT EXISTS idx_store_stock_store ON store_stock(store_id)`,
  `CREATE INDEX IF NOT EXISTS idx_store_stock_product ON store_stock(product_id)`,

  `CREATE INDEX IF NOT EXISTS idx_sales_product ON sales_data(product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sales_store ON sales_data(store_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sales_date ON sales_data(sale_date)`,

  `CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at)`,

  `CREATE INDEX IF NOT EXISTS idx_demands_status ON customer_demands(status)`,

  `CREATE INDEX IF NOT EXISTS idx_voice_notes_po ON voice_notes(po_id)`,

  `CREATE INDEX IF NOT EXISTS idx_competition_product ON competition_prices(product_id)`,

  `CREATE INDEX IF NOT EXISTS idx_lr_po ON lorry_receipts(po_id)`,

  `CREATE INDEX IF NOT EXISTS idx_transfers_status ON stock_transfers(status)`,
  `CREATE INDEX IF NOT EXISTS idx_transfers_from ON stock_transfers(from_store_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transfers_to ON stock_transfers(to_store_id)`,
];
