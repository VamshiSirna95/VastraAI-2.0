export const APP_CONFIG = {
  appName: 'VASTRA',
  version: '1.0.0',
  buildDate: '2026-04-02',
  businessName: 'K.M. Fashions',

  // Default stores (pre-seeded on first install)
  defaultStores: [
    { name: 'KMF Main Store', code: 'KMF-01', city: 'Begum Bazaar' },
    { name: 'KMF Kukatpally', code: 'KMF-02', city: 'Kukatpally' },
    { name: 'KMF Dilsukhnagar', code: 'KMF-03', city: 'Dilsukhnagar' },
    { name: 'Mangalagowri Main', code: 'MGBT-01', city: 'Abids' },
    { name: 'Mangalagowri LB Nagar', code: 'MGBT-02', city: 'LB Nagar' },
    { name: 'KMF Ameerpet', code: 'KMF-04', city: 'Ameerpet' },
    { name: 'KMF Kothapet', code: 'KMF-05', city: 'Kothapet' },
  ],

  // Document number prefixes
  poPrefix: 'KMF/PO',
  grnPrefix: 'KMF/GRN',
  dnPrefix: 'KMF/DN',

  // Defaults
  defaultPaymentTerms: '30 days',
  defaultLeadDays: 3,
  optimalStockCoverDays: 60,

  // Stock cover thresholds (days)
  criticalStockDays: 7,
  urgentStockDays: 14,
  planStockDays: 30,
  excessStockDays: 90,

  // GRN quality thresholds (%)
  grnGoodAcceptRate: 90,
  grnWarnAcceptRate: 70,

  // Vendor ranking score thresholds
  vendorSPlusMin: 95,
  vendorSMin: 90,
  vendorAMin: 80,
  vendorBMin: 70,
  vendorCMin: 60,
  vendorDMin: 40,
} as const;
