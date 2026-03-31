export interface Product {
  id: string;
  barcode?: string;
  design_name?: string;
  garment_type?: string;
  vendor_id?: string;
  purchase_price?: number;
  selling_price?: number;
  mrp?: number;
  primary_color?: string;
  secondary_color?: string;
  pattern?: string;
  fabric?: string;
  work_type?: string;
  occasion?: string;
  season?: string;
  sleeve?: string;
  neck?: string;
  fit?: string;
  length?: string;
  notes?: string;
  voice_note_uri?: string;
  voice_note_transcript?: string;
  ai_confidence?: number;
  ai_detected?: number;
  ai_overrides?: string;
  status: 'draft' | 'enriched' | 'in_po' | 'ordered' | 'received' | 'in_store';
  created_at: string;
  updated_at: string;
  // Joined fields
  photos?: ProductPhoto[];
  vendor?: Vendor;
  custom_attrs?: { name: string; value: string }[];
}

export interface ProductPhoto {
  id: string;
  product_id: string;
  uri: string;
  photo_type: 'main' | 'back' | 'tag' | 'detail' | 'fabric' | 'grn';
  is_primary: boolean;
  quality_score?: number;
  created_at: string;
}

export interface Vendor {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  alt_phone?: string;
  email?: string;
  area?: string;
  city?: string;
  state?: string;
  pincode?: string;
  address_line1?: string;
  address_line2?: string;
  speciality?: string;
  gstin?: string;
  pan?: string;
  bank_name?: string;
  bank_account?: string;
  bank_ifsc?: string;
  payment_terms?: string;
  rank: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D' | 'E';
  rating?: number;
  avg_lead_days?: number;
  total_orders?: number;
  total_value?: number;
  is_active?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomAttribute {
  id: string;
  garment_type: string;
  attribute_name: string;
  usage_count: number;
  is_suggested: boolean;
  created_at: string;
}

export const GARMENT_TYPES = [
  'Shirt', 'Kurta', 'Saree', 'Salwar Set', 'Lehenga', 'Trouser/Pant',
  'T-Shirt', 'Jeans', 'Jacket', 'Blazer', 'Sherwani', 'Dupatta',
  'Blouse', 'Palazzo', 'Kurti', 'Dhoti', 'Lungi', 'Tracksuit',
  'Nightwear', 'Innerwear', 'Other',
] as const;

export const COLORS = [
  'Maroon', 'Navy', 'Black', 'White', 'Red', 'Blue', 'Green',
  'Yellow', 'Pink', 'Rani Pink', 'Orange', 'Purple', 'Violet',
  'Brown', 'Beige', 'Cream', 'Gold', 'Silver', 'Teal', 'Turquoise',
  'Bottle Green', 'Magenta', 'Peach', 'Coral', 'Lavender', 'Olive',
  'Grey', 'Sky Blue', 'Rust', 'Mustard', 'Multi-color',
] as const;

export const PATTERNS = [
  'Solid', 'Checks', 'Stripes', 'Paisley', 'Floral', 'Geometric',
  'Abstract', 'Polka Dots', 'Bandhani', 'Ikat', 'Block Print',
  'Kalamkari', 'Batik', 'Tie-Dye', 'Animal Print', 'Camouflage',
  'Plaid', 'Tribal',
] as const;

export const FABRICS = [
  'Cotton', 'Silk', 'Georgette', 'Chiffon', 'Crepe', 'Rayon',
  'Polyester', 'Linen', 'Satin', 'Velvet', 'Net', 'Lycra',
  'Denim', 'Khadi', 'Organza', 'Banarasi', 'Chanderi', 'Tussar',
] as const;

export const WORK_TYPES = [
  'None/Plain', 'Embroidered', 'Zari', 'Chikankari', 'Mirror Work',
  'Sequin', 'Thread Work', 'Beadwork', 'Stone Work', 'Patch Work',
  'Block Print', 'Screen Print', 'Digital Print', 'Hand Paint', 'Applique',
] as const;

export const OCCASIONS = [
  'Daily Wear', 'Casual', 'Formal', 'Party', 'Wedding', 'Festival', 'Office', 'Sport',
] as const;

export const SEASONS = ['Summer', 'Winter', 'All-season', 'Monsoon'] as const;

// ── Purchase Order types ──────────────────────────────────────────────────────

export interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_id: string;
  trip_id?: string;
  status: 'draft' | 'sent' | 'confirmed' | 'dispatched' | 'received' | 'closed';
  total_qty: number;
  total_value: number;
  delivery_date?: string;
  dispatch_date?: string;
  store_arrival_date?: string;
  notes?: string;
  voice_note_uri?: string;
  cancellation_reason?: string;
  cancelled_qty?: number;
  is_deleted?: number;
  deleted_at?: string;
  document_uri?: string;
  created_at: string;
  updated_at: string;
  // Joined
  items?: POItem[];
  vendor?: Vendor;
  trip?: PurchaseTrip;
  vendor_name?: string;
}

export interface POItem {
  id: string;
  po_id: string;
  product_id: string;
  size_s: number;
  size_m: number;
  size_l: number;
  size_xl: number;
  size_xxl: number;
  size_free: number;
  total_qty: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  created_at: string;
  // Joined
  product?: Product;
}

export interface PurchaseTrip {
  id: string;
  name: string;
  budget: number;
  spent: number;
  vendor_area?: string;
  status: 'active' | 'completed' | 'cancelled';
  start_date?: string;
  end_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined
  purchase_orders?: PurchaseOrder[];
}

export interface DeliveryConfig {
  optimal_stock_cover_days: number;
  vendor_transit_days: number;
  inward_processing_days: number;
  store_dispatch_days: number;
}

// ── GRN size types ────────────────────────────────────────────────────────────

export interface GRNSizeEntry {
  ordered: number;
  received: number;
  accepted: number;
  rejected: number;
}

export type GRNSizeData = Record<string, GRNSizeEntry>;

// ── GRN types ─────────────────────────────────────────────────────────────────

export interface GRNRecord {
  id: string;
  po_id: string;
  grn_number: string;
  received_date: string;
  received_by?: string;
  warehouse_notes?: string;
  overall_status: 'pending' | 'accepted' | 'partial' | 'rejected';
  total_ordered_qty: number;
  total_received_qty: number;
  total_accepted_qty: number;
  total_rejected_qty: number;
  created_at: string;
  updated_at: string;
  // Joined
  items?: GRNItem[];
}

export interface GRNItem {
  id: string;
  grn_id: string;
  po_item_id: string;
  product_id: string;
  ordered_qty: number;
  received_qty: number;
  accepted_qty: number;
  rejected_qty: number;
  rejection_reason?: string;
  color_match_pct?: number;
  pattern_match_pct?: number;
  overall_match_pct?: number;
  status: 'pending' | 'accepted' | 'short' | 'rejected';
  size_data_json?: string;
  size_data?: GRNSizeData;
  notes?: string;
  created_at: string;
  // Joined from products
  design_name?: string;
  garment_type?: string;
  photos?: GRNPhoto[];
}

export interface GRNPhoto {
  id: string;
  grn_item_id: string;
  photo_uri: string;
  photo_type: 'received' | 'comparison' | 'evidence';
  created_at: string;
}

export interface Store {
  id: number;
  name: string;
  code: string;
  address?: string;
  city?: string;
  manager_name?: string;
  manager_phone?: string;
  is_active: number;
  created_at: string;
}

export interface StockAllocation {
  id: number;
  grn_id: string;
  grn_item_id: string;
  product_id: string;
  store_id: number;
  size_allocations_json: string;
  size_allocations?: Record<string, number>;
  total_allocated: number;
  status: 'pending' | 'dispatched' | 'received';
  created_at: string;
  // Joined
  store_name?: string;
  store_code?: string;
}

export interface User {
  id: number;
  name: string;
  role: string;
  phone: string;
  pin: string;
  is_active: number;
  last_login?: string;
  created_at: string;
}

export interface LorryReceipt {
  id: string;
  po_id: string;
  lr_number?: string;
  transporter_name?: string;
  dispatch_date?: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  photo_uri?: string;
  status: 'dispatched' | 'in_transit' | 'delivered';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface VoiceNote {
  id: number;
  po_id?: string;
  po_item_id?: string;
  file_uri: string;
  duration_seconds?: number;
  transcription?: string;
  created_at: string;
}

export interface AnalyticsData {
  totalPOValue: number;
  totalPOCount: number;
  totalGRNCount: number;
  totalVendorCount: number;
  monthlyPOValue: { month: string; value: number }[];
  topVendors: { name: string; value: number; count: number }[];
  grnPerformance: { completed: number; partial: number; pending: number };
  categoryBreakdown: { category: string; count: number; value: number }[];
  tripBudget: { name: string; budget: number; spent: number }[];
}

export interface StoreStock {
  id: number;
  store_id: number;
  product_id: string;
  size_stock_json: string;
  size_stock?: Record<string, number>;
  total_qty: number;
  last_updated: string;
  // Joined
  store_name?: string;
  design_name?: string;
  garment_type?: string;
}

export interface StockTransfer {
  id: number;
  from_store_id: number;
  to_store_id: number;
  product_id: string;
  size_transfer_json: string;
  size_transfer?: Record<string, number>;
  total_qty: number;
  status: 'requested' | 'approved' | 'dispatched' | 'received' | 'cancelled';
  requested_by?: string;
  approved_by?: string;
  reason?: string;
  created_at: string;
  updated_at: string;
  // Joined
  from_store_name?: string;
  to_store_name?: string;
  design_name?: string;
}

export interface CustomerDemand {
  id: number;
  customer_phone?: string;
  customer_name?: string;
  description: string;
  photo_uri?: string;
  garment_type?: string;
  color_preference?: string;
  price_range_min?: number;
  price_range_max?: number;
  store_id?: number;
  captured_by?: string;
  status: 'open' | 'matched' | 'fulfilled' | 'expired' | 'cancelled';
  matched_product_id?: string;
  fulfilled_date?: string;
  notes?: string;
  created_at: string;
  // Joined
  store_name?: string;
}

export interface AppNotification {
  id: number;
  type: 'po_status' | 'grn_due' | 'stock_low' | 'demand_match' | 'transfer' | 'system';
  title: string;
  body: string;
  reference_type?: string;
  reference_id?: string;
  is_read: number;
  created_at: string;
}

export interface SeasonalPlan {
  id: number;
  season_name: string;
  season_type: 'festival' | 'wedding' | 'summer' | 'winter' | 'back_to_school' | 'custom';
  start_date: string;
  end_date: string;
  target_budget?: number;
  notes?: string;
  status: 'planning' | 'active' | 'completed';
  created_at: string;
  // Aggregated
  item_count?: number;
  allocated_value?: number;
}

export interface SeasonalPlanItem {
  id: number;
  plan_id: number;
  category: string;
  target_qty?: number;
  target_value?: number;
  color_preference?: string;
  pattern_preference?: string;
  vendor_ids?: string; // JSON array
  notes?: string;
  priority: 'high' | 'medium' | 'low';
}

// Size templates per garment type
export const SIZE_TEMPLATES: Record<string, string[]> = {
  'Shirt': ['S', 'M', 'L', 'XL', 'XXL'],
  'Kurta': ['S', 'M', 'L', 'XL', 'XXL'],
  'T-Shirt': ['S', 'M', 'L', 'XL', 'XXL'],
  'Jeans': ['28', '30', '32', '34', '36', '38'],
  'Trouser/Pant': ['28', '30', '32', '34', '36', '38'],
  'Saree': ['Free'],
  'Dupatta': ['Free'],
  'Lehenga': ['S', 'M', 'L', 'XL'],
  'Salwar Set': ['S', 'M', 'L', 'XL', 'XXL'],
  'default': ['S', 'M', 'L', 'XL', 'XXL'],
};
