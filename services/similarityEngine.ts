import { getDb, createNotification } from '../db/database';
import type { Product } from '../db/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SimilarityMatch {
  product: Product & { vendor_name?: string };
  score: number;           // 0.0 to 1.0
  matchReasons: string[];  // ["Same color", "Similar pattern", "Same vendor"]
  priceDiff?: number;      // positive = cheaper match found
  vendorName?: string;
}

// ── Color families for fuzzy color matching ───────────────────────────────────

const COLOR_FAMILIES: Record<string, string[]> = {
  red: ['red', 'maroon', 'crimson', 'scarlet', 'wine', 'burgundy', 'rust'],
  blue: ['blue', 'navy', 'royal blue', 'sky blue', 'teal', 'turquoise', 'indigo', 'cobalt'],
  green: ['green', 'olive', 'mint', 'sage', 'emerald', 'forest', 'lime', 'bottle green'],
  pink: ['pink', 'rose', 'blush', 'coral', 'salmon', 'magenta', 'fuchsia', 'rani pink'],
  yellow: ['yellow', 'gold', 'mustard', 'amber', 'saffron', 'turmeric'],
  white: ['white', 'off-white', 'ivory', 'cream', 'pearl', 'beige'],
  black: ['black', 'charcoal', 'ebony'],
  purple: ['purple', 'violet', 'lavender', 'plum', 'mauve'],
  orange: ['orange', 'peach', 'tangerine', 'terracotta'],
  brown: ['brown', 'tan', 'chocolate', 'coffee', 'camel', 'khaki'],
};

function areSimilarColors(a: string, b: string): boolean {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  for (const family of Object.values(COLOR_FAMILIES)) {
    if (family.includes(aLower) && family.includes(bLower)) return true;
  }
  return false;
}

// ── Core similarity engine ────────────────────────────────────────────────────

export async function findSimilarProducts(
  productId: string,
  limit = 10
): Promise<SimilarityMatch[]> {
  const db = getDb();

  const source = await db.getFirstAsync<Product>(
    `SELECT * FROM products WHERE id = ?`,
    [productId]
  );
  if (!source) return [];

  // Get all other products with their vendor names
  const candidates = await db.getAllAsync<Product & { vendor_name?: string }>(
    `SELECT p.*, v.name as vendor_name
     FROM products p
     LEFT JOIN vendors v ON v.id = p.vendor_id
     WHERE p.id != ?`,
    [productId]
  );

  const matches: SimilarityMatch[] = candidates.map((candidate) => {
    let score = 0;
    const reasons: string[] = [];

    // Garment type match (30% weight)
    if (candidate.garment_type && source.garment_type &&
        candidate.garment_type === source.garment_type) {
      score += 0.30;
      reasons.push('Same type');
    }

    // Color match (25% weight)
    if (candidate.primary_color && source.primary_color) {
      if (candidate.primary_color.toLowerCase() === source.primary_color.toLowerCase()) {
        score += 0.25;
        reasons.push('Same color');
      } else if (areSimilarColors(candidate.primary_color, source.primary_color)) {
        score += 0.15;
        reasons.push('Similar color');
      }
    }

    // Pattern match (20% weight)
    if (candidate.pattern && source.pattern &&
        candidate.pattern === source.pattern) {
      score += 0.20;
      reasons.push('Same pattern');
    }

    // Fabric match (15% weight)
    if (candidate.fabric && source.fabric &&
        candidate.fabric === source.fabric) {
      score += 0.15;
      reasons.push('Same fabric');
    }

    // Occasion match (10% weight)
    if (candidate.occasion && source.occasion &&
        candidate.occasion === source.occasion) {
      score += 0.10;
      reasons.push('Same occasion');
    }

    const priceDiff =
      source.purchase_price != null && candidate.purchase_price != null
        ? source.purchase_price - candidate.purchase_price
        : undefined;

    return {
      product: candidate,
      score,
      matchReasons: reasons,
      priceDiff,
      vendorName: candidate.vendor_name,
    };
  });

  return matches
    .filter((m) => m.score >= 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ── Proactive similarity check (background) ───────────────────────────────────

export async function runProactiveSimilarityCheck(productId: string): Promise<void> {
  try {
    const matches = await findSimilarProducts(productId, 5);
    for (const match of matches) {
      if (match.priceDiff != null && match.priceDiff > 0 && match.score >= 0.6) {
        const savings = match.priceDiff;
        await createNotification(
          'similarity',
          'Cheaper Alternative Found',
          `${match.vendorName ?? 'Another vendor'} has ${Math.round(match.score * 100)}% similar product at ₹${match.product.purchase_price} (save ₹${savings}/pc)`,
          'product',
          match.product.id
        );
      }
    }
  } catch {
    // Background task — swallow errors
  }
}

// ── Stock check helper ────────────────────────────────────────────────────────

export async function getTotalStockForProduct(productId: string): Promise<{ totalQty: number; storeName?: string }> {
  const db = getDb();
  const row = await db.getFirstAsync<{ total_qty: number; store_name: string }>(
    `SELECT SUM(ss.total_qty) as total_qty, s.name as store_name
     FROM store_stock ss
     LEFT JOIN stores s ON s.id = ss.store_id
     WHERE ss.product_id = ? AND ss.total_qty > 0
     GROUP BY ss.product_id
     LIMIT 1`,
    [productId]
  );
  return { totalQty: row?.total_qty ?? 0, storeName: row?.store_name };
}
