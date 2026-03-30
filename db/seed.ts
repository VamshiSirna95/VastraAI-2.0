import { createVendor, createProduct, getProductCount, createTrip, getTrips, createPO, addPOItem, updateTripSpent } from './database';

export async function seedDemoData(): Promise<void> {
  const count = await getProductCount();

  // Always ensure demo trip exists even if products were seeded before
  if (count > 0) {
    const existingTrips = await getTrips();
    if (existingTrips.length === 0) {
      await createTrip({
        name: 'March Week 4 — Begum Bazaar',
        budget: 500000,
        vendor_area: 'Begum Bazaar, Hyderabad',
        status: 'active',
        start_date: '28-Mar-2026',
        end_date: '31-Mar-2026',
      });
    }
    return;
  }

  // ── Vendors ────────────────────────────────────────────────────────────────
  const v1 = await createVendor({
    name: 'Ratan Creation',
    contact_person: 'Ratan Joshi',
    phone: '9876543210',
    alt_phone: '9876543211',
    email: 'ratan@ratancreation.com',
    area: 'Surat',
    city: 'Surat',
    state: 'Gujarat',
    pincode: '395003',
    address_line1: 'Shop 14, Udhna Textile Market',
    speciality: 'Kurtas, Kurtis',
    gstin: '24ABCDE1234F1Z5',
    payment_terms: '30 days',
    avg_lead_days: 12,
    rank: 'S+',
    is_active: 1,
  });

  const v2 = await createVendor({
    name: 'Shivali Iconic',
    contact_person: 'Shivali Shah',
    phone: '9123456789',
    email: 'shivali@shivaliiconic.in',
    area: 'Hyderabad',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500012',
    address_line1: '42 Begum Bazaar',
    speciality: 'Sarees, Lehengas',
    gstin: '36FGHIJ5678K2L6',
    payment_terms: 'Advance',
    avg_lead_days: 7,
    rank: 'A',
    is_active: 1,
  });

  const v3 = await createVendor({
    name: 'Fabric India',
    contact_person: 'Mukesh Verma',
    phone: '9001234567',
    area: 'Jaipur',
    city: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302001',
    address_line1: '8, Nehru Bazaar',
    speciality: 'Shirts, Trousers',
    payment_terms: 'On delivery',
    avg_lead_days: 15,
    rank: 'B',
    is_active: 1,
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
