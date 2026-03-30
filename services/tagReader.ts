export interface TagData {
  mrp?: number;
  barcode?: string;
  design_code?: string;
  color_name?: string;
}

// Placeholder — ML Kit OCR comes with dev build
export async function readTag(_imageUri: string): Promise<TagData> {
  return {};
}

export function parseMRP(text: string): number | undefined {
  const match = text.match(/(?:₹|Rs\.?|MRP|Price[:\s])\s*([0-9,]+(?:\.[0-9]{2})?)/i);
  return match ? parseFloat(match[1].replace(/,/g, '')) : undefined;
}

export function parseBarcode(text: string): string | undefined {
  const match = text.match(/\b(\d{8,13})\b/);
  return match?.[1];
}

export function parseDesignCode(text: string): string | undefined {
  const match = text.match(/(?:Design|Style|Code|Art)[:\s#]*([A-Z0-9-]{3,12})/i);
  return match?.[1];
}
