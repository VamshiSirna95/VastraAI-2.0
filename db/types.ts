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
  area?: string;
  speciality?: string;
  rank: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D' | 'E';
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
