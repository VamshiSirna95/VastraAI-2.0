import { createVendor, createProduct, getProductCount, createTrip, createPO, addPOItem, updateTripSpent } from './database';

export async function seedDemoData(): Promise<void> {
  const count = await getProductCount();
  if (count > 0) return;

  // ── Vendors ────────────────────────────────────────────────────────────────
  const v1 = await createVendor({
    name: 'Ratan Creation',
    contact_person: 'Ratan Joshi',
    phone: '9876543210',
    area: 'Surat',
    speciality: 'Kurtas, Kurtis',
    rank: 'S+',
  });

  const v2 = await createVendor({
    name: 'Shivali Iconic',
    contact_person: 'Shivali Shah',
    phone: '9123456789',
    area: 'Hyderabad',
    speciality: 'Sarees, Lehengas',
    rank: 'A',
  });

  const v3 = await createVendor({
    name: 'Fabric India',
    contact_person: 'Mukesh Verma',
    phone: '9001234567',
    area: 'Jaipur',
    speciality: 'Shirts, Trousers',
    rank: 'B',
  });

  // ── Products ───────────────────────────────────────────────────────────────
  await createProduct({
    design_name: 'Maroon Paisley Kurta',
    garment_type: 'Kurta',
    vendor_id: v1,
    purchase_price: 480,
    selling_price: 1495,
    mrp: 1495,
    primary_color: 'Maroon',
    pattern: 'Paisley',
    fabric: 'Cotton',
    work_type: 'Block Print',
    occasion: 'Festival',
    season: 'All-season',
    sleeve: '3/4 sleeve',
    neck: 'Round',
    fit: 'Regular',
    length: 'Knee length',
    status: 'enriched',
    ai_confidence: 0.92,
  });

  await createProduct({
    design_name: 'Navy Checks Shirt',
    garment_type: 'Shirt',
    vendor_id: v3,
    purchase_price: 320,
    selling_price: 995,
    mrp: 995,
    primary_color: 'Navy',
    pattern: 'Checks',
    fabric: 'Cotton',
    work_type: 'None/Plain',
    occasion: 'Formal',
    season: 'All-season',
    sleeve: 'Full sleeve',
    neck: 'Collar',
    fit: 'Regular',
    status: 'enriched',
    ai_confidence: 0.88,
  });

  await createProduct({
    design_name: 'Red Banarasi Saree',
    garment_type: 'Saree',
    vendor_id: v2,
    purchase_price: 2800,
    selling_price: 6595,
    mrp: 6595,
    primary_color: 'Red',
    secondary_color: 'Gold',
    pattern: 'Paisley',
    fabric: 'Banarasi',
    work_type: 'Zari',
    occasion: 'Wedding',
    season: 'All-season',
    status: 'in_store',
    ai_confidence: 0.95,
  });

  await createProduct({
    design_name: 'Pink Chiffon Dupatta',
    garment_type: 'Dupatta',
    vendor_id: v1,
    purchase_price: 180,
    selling_price: 495,
    mrp: 495,
    primary_color: 'Pink',
    fabric: 'Chiffon',
    work_type: 'None/Plain',
    occasion: 'Casual',
    season: 'Summer',
    status: 'enriched',
  });

  const p5 = await createProduct({
    design_name: 'Black Formal Trouser',
    garment_type: 'Trouser/Pant',
    vendor_id: v3,
    purchase_price: 450,
    selling_price: 1295,
    mrp: 1295,
    primary_color: 'Black',
    pattern: 'Solid',
    fabric: 'Polyester',
    work_type: 'None/Plain',
    occasion: 'Formal',
    season: 'All-season',
    fit: 'Slim',
    status: 'enriched',
  });

  // ── Demo Purchase Trip ────────────────────────────────────────────────────
  const trip1 = await createTrip({
    name: 'March Week 4 — Begum Bazaar',
    budget: 500000,
    vendor_area: 'Begum Bazaar, Hyderabad',
    status: 'active',
    start_date: '28-Mar-2026',
    end_date: '31-Mar-2026',
  });

  // ── Demo POs ──────────────────────────────────────────────────────────────
  const po1 = await createPO({
    vendor_id: v1,
    trip_id: trip1,
    status: 'draft',
    notes: 'Reorder for Ameerpet store',
  });
  await addPOItem({
    po_id: po1,
    product_id: p5,
    size_s: 5, size_m: 10, size_l: 8, size_xl: 6, size_xxl: 3, size_free: 0,
    unit_price: 480,
  });

  const po2 = await createPO({
    vendor_id: v2,
    trip_id: trip1,
    status: 'sent',
    notes: 'Festival stock — Dussehra collection',
  });
  await addPOItem({
    po_id: po2,
    product_id: p5,
    size_s: 2, size_m: 4, size_l: 4, size_xl: 2, size_xxl: 0, size_free: 0,
    unit_price: 2800,
  });

  // Sync trip spent
  await updateTripSpent(trip1);
}
