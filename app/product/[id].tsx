import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  ScrollView, Image, Alert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import {
  getProductById, updateProduct, getPOsByProduct,
  addProductPhoto, deleteProductPhoto,
} from '../../db/database';
import type { Product, ProductPhoto, PurchaseOrder } from '../../db/types';
import { findSimilarProducts, type SimilarityMatch } from '../../services/similarityEngine';
import { formatINR } from '../../utils/format';

const { width: SCREEN_W } = Dimensions.get('window');

function marginColor(pct: number): string {
  if (pct >= 30) return colors.teal;
  if (pct >= 15) return colors.amber;
  return colors.red;
}

// ── Attribute pill ────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  Kurta: colors.teal, Saree: colors.purple, Lehenga: colors.red,
  Shirt: colors.blue, Jeans: colors.blue, Dupatta: colors.purple,
};

function TypePill({ type }: { type: string }) {
  const col = TYPE_COLORS[type] ?? colors.amber;
  return (
    <View style={[styles.typePill, { backgroundColor: col + '22', borderColor: col + '44' }]}>
      <Text style={[styles.typePillText, { color: col }]}>{type}</Text>
    </View>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: 'rgba(255,255,255,0.3)' },
  enriched:  { label: 'Enriched',  color: colors.teal },
  in_po:     { label: 'In PO',     color: colors.amber },
  ordered:   { label: 'Ordered',   color: colors.blue },
  received:  { label: 'Received',  color: colors.teal },
  in_store:  { label: 'In Store',  color: colors.teal },
};

// ── Attr row ──────────────────────────────────────────────────────────────────

function AttrRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  if (!value) return null;
  return (
    <View style={styles.attrRow}>
      <Text style={styles.attrLabel}>{label}</Text>
      <Text style={[styles.attrValue, accent ? { color: accent } : {}]}>{value}</Text>
    </View>
  );
}

// ── PO status config ──────────────────────────────────────────────────────────

const PO_STATUS_COLOR: Record<string, string> = {
  draft: 'rgba(255,255,255,0.3)', confirmed: colors.amber, sent: colors.amber,
  dispatched: colors.blue, received: colors.blue, closed: colors.teal,
};

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProductDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    ai_garment_type?: string;
    ai_primary_color?: string;
    ai_secondary_color?: string;
    ai_pattern?: string;
    ai_fabric?: string;
    ai_work_type?: string;
    ai_occasion?: string;
    ai_sleeve?: string;
    ai_neck?: string;
    ai_confidence?: string;
    ai_source?: string;
  }>();

  const { id } = params;
  const [product, setProduct] = useState<Product | null>(null);
  const [poHistory, setPoHistory] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);
  const [similarMatches, setSimilarMatches] = useState<SimilarityMatch[]>([]);

  const hasAiParams = !!(
    params.ai_garment_type || params.ai_primary_color || params.ai_pattern || params.ai_fabric
  );
  const aiConfidence = params.ai_confidence ? parseFloat(params.ai_confidence) : undefined;

  const load = useCallback(async () => {
    if (!id) return;
    const [p, pos] = await Promise.all([getProductById(id), getPOsByProduct(id)]);

    if (p && hasAiParams) {
      // Merge AI suggestions into empty fields
      const merged: Product = {
        ...p,
        garment_type: p.garment_type || params.ai_garment_type,
        primary_color: p.primary_color || params.ai_primary_color,
        secondary_color: p.secondary_color || params.ai_secondary_color,
        pattern: p.pattern || params.ai_pattern,
        fabric: p.fabric || params.ai_fabric,
        work_type: p.work_type || params.ai_work_type,
        occasion: p.occasion || params.ai_occasion,
        sleeve: p.sleeve || params.ai_sleeve,
        neck: p.neck || params.ai_neck,
        ai_confidence: aiConfidence ?? p.ai_confidence,
        ai_detected: hasAiParams ? 1 : p.ai_detected,
      };
      // Persist AI data into DB if product is fresh (no garment_type yet)
      if (!p.garment_type && params.ai_garment_type) {
        await updateProduct(id, {
          garment_type: merged.garment_type,
          primary_color: merged.primary_color,
          secondary_color: merged.secondary_color,
          pattern: merged.pattern,
          fabric: merged.fabric,
          work_type: merged.work_type,
          occasion: merged.occasion,
          sleeve: merged.sleeve,
          neck: merged.neck,
          ai_confidence: merged.ai_confidence,
          ai_detected: 1,
        });
      }
      setProduct(merged);
    } else {
      setProduct(p);
    }
    setPoHistory(pos);
    setLoading(false);
    // Load similar products in background
    if (id) {
      findSimilarProducts(id, 3).then(setSimilarMatches).catch(() => {});
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.loader}>
          <ActivityIndicator color={colors.teal} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.loader}>
          <Text style={styles.notFound}>Product not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const photos = product.photos ?? [];
  const mainPhoto = photos[selectedPhotoIdx] ?? photos.find((p) => p.is_primary) ?? photos[0];
  const statusCfg = STATUS_CFG[product.status] ?? { label: product.status, color: colors.amber };
  const aiPct = product.ai_confidence ? Math.round(product.ai_confidence) : null;

  const pp = product.purchase_price ?? 0;
  const sp = product.selling_price ?? 0;
  const margin = sp > 0 && pp > 0 ? Math.round(((sp - pp) / sp) * 100) : null;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <View style={styles.headerBody}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {product.design_name ?? 'Product Detail'}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + '22' }]}>
              <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push({
              pathname: `/product/edit/${id}` as `/product/edit/${string}`,
              params: {
                ai_garment_type: params.ai_garment_type ?? '',
                ai_primary_color: params.ai_primary_color ?? '',
                ai_secondary_color: params.ai_secondary_color ?? '',
                ai_pattern: params.ai_pattern ?? '',
                ai_fabric: params.ai_fabric ?? '',
                ai_work_type: params.ai_work_type ?? '',
                ai_occasion: params.ai_occasion ?? '',
                ai_sleeve: params.ai_sleeve ?? '',
                ai_neck: params.ai_neck ?? '',
                ai_confidence: params.ai_confidence ?? '',
                ai_source: params.ai_source ?? '',
              },
            })}
          >
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* ── A. Photo Gallery ── */}
        <View style={styles.photoSection}>
          {mainPhoto ? (
            <Image
              source={{ uri: mainPhoto.uri }}
              style={styles.mainPhoto}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.mainPhotoEmpty}>
              <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
                <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M12 17a4 4 0 100-8 4 4 0 000 8z" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />
              </Svg>
              <Text style={styles.mainPhotoEmptyText}>No photo</Text>
            </View>
          )}

          {/* AI badge overlay */}
          {aiPct != null && product.ai_detected === 1 && (
            <View style={[
              styles.aiBadgeOverlay,
              { backgroundColor: aiPct >= 80 ? colors.teal + 'CC' : colors.amber + 'CC' },
            ]}>
              <Text style={styles.aiBadgeOverlayText}>AI {aiPct}%</Text>
            </View>
          )}

          {/* Thumbnails */}
          {photos.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow} contentContainerStyle={styles.thumbRowContent}>
              {photos.map((ph, i) => (
                <TouchableOpacity
                  key={ph.id}
                  onPress={() => setSelectedPhotoIdx(i)}
                  onLongPress={() => {
                    Alert.alert('Photo Options', ph.photo_type, [
                      { text: 'Set as Main', onPress: async () => {
                        await deleteProductPhoto(ph.id);
                        await addProductPhoto(id, ph.uri, ph.photo_type, true);
                        load();
                      }},
                      { text: 'Delete', style: 'destructive', onPress: async () => {
                        await deleteProductPhoto(ph.id);
                        load();
                      }},
                      { text: 'Cancel', style: 'cancel' },
                    ]);
                  }}
                  style={[styles.thumbBtn, i === selectedPhotoIdx && styles.thumbBtnActive]}
                >
                  <Image source={{ uri: ph.uri }} style={styles.thumb} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity
            style={styles.addPhotoBtn}
            onPress={() => router.push(`/scan?productId=${id}` as never)}
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M12 5v14M5 12h14" stroke={colors.teal} strokeWidth={2.5} strokeLinecap="round" />
            </Svg>
            <Text style={styles.addPhotoBtnText}>Add Photo</Text>
          </TouchableOpacity>
        </View>

        {/* ── B. Attributes ── */}
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardLabel}>ATTRIBUTES</Text>
            {product.garment_type && <TypePill type={product.garment_type} />}
          </View>
          <AttrRow label="Garment Type" value={product.garment_type ?? ''} />
          <View style={styles.divider} />
          <AttrRow label="Primary Color" value={product.primary_color ?? ''} />
          {!!product.secondary_color && <View style={styles.divider} />}
          <AttrRow label="Secondary Color" value={product.secondary_color ?? ''} />
          <View style={styles.divider} />
          <AttrRow label="Pattern" value={product.pattern ?? ''} />
          <View style={styles.divider} />
          <AttrRow label="Fabric" value={product.fabric ?? ''} />
          {!!product.work_type && <View style={styles.divider} />}
          <AttrRow label="Work Type" value={product.work_type ?? ''} />
          <View style={styles.divider} />
          <AttrRow label="Occasion" value={product.occasion ?? ''} />
          {!!product.sleeve && <View style={styles.divider} />}
          <AttrRow label="Sleeve" value={product.sleeve ?? ''} />
          {!!product.neck && <View style={styles.divider} />}
          <AttrRow label="Neck" value={product.neck ?? ''} />
          {!!product.season && <View style={styles.divider} />}
          <AttrRow label="Season" value={product.season ?? ''} />
        </View>

        {/* ── C. Pricing ── */}
        <View style={styles.glassCard}>
          <Text style={styles.cardLabel}>PRICING</Text>
          <View style={styles.priceGrid}>
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Purchase</Text>
              <Text style={[styles.priceValue, { color: colors.amber }]}>
                {pp > 0 ? formatINR(pp) : '—'}
              </Text>
            </View>
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Selling</Text>
              <Text style={[styles.priceValue, { color: colors.teal }]}>
                {sp > 0 ? formatINR(sp) : '—'}
              </Text>
            </View>
            {product.mrp != null && product.mrp > 0 && (
              <View style={styles.priceItem}>
                <Text style={styles.priceLabel}>MRP</Text>
                <Text style={styles.priceValue}>{formatINR(product.mrp)}</Text>
              </View>
            )}
            {margin != null && (
              <View style={styles.priceItem}>
                <Text style={styles.priceLabel}>Margin</Text>
                <Text style={[styles.priceValue, { color: marginColor(margin) }]}>{margin}%</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── D. Stock Info ── */}
        <View style={styles.glassCard}>
          <Text style={styles.cardLabel}>STOCK INFO</Text>
          {(product as Product & { vendor_name?: string }).vendor_name ? (
            <AttrRow label="Vendor" value={(product as Product & { vendor_name?: string }).vendor_name!} />
          ) : null}
          {product.barcode ? (
            <>
              <View style={styles.divider} />
              <AttrRow label="Barcode" value={product.barcode} />
            </>
          ) : null}
          {product.notes ? (
            <>
              <View style={styles.divider} />
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>Notes</Text>
                <Text style={styles.notesText}>{product.notes}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* ── E. PO History ── */}
        <View style={styles.glassCard}>
          <Text style={styles.cardLabel}>PO HISTORY</Text>
          {poHistory.length === 0 ? (
            <Text style={styles.emptyText}>Not included in any PO yet</Text>
          ) : poHistory.map((po) => {
            const poColor = PO_STATUS_COLOR[po.status] ?? colors.amber;
            return (
              <TouchableOpacity
                key={po.id}
                style={styles.poRow}
                onPress={() => router.push(`/po/${po.id}` as never)}
              >
                <View style={styles.poRowBody}>
                  <Text style={styles.poNumber}>{po.po_number}</Text>
                  <Text style={styles.poVendor}>{(po as PurchaseOrder & { vendor_name?: string }).vendor_name ?? ''}</Text>
                  <Text style={styles.poDate}>{po.created_at?.slice(0, 10) ?? ''}</Text>
                </View>
                <View style={[styles.poStatusPill, { backgroundColor: poColor + '22' }]}>
                  <Text style={[styles.poStatusText, { color: poColor }]}>
                    {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── F. Similar Products ── */}
        <View style={styles.glassCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardLabel}>SIMILAR PRODUCTS</Text>
            {similarMatches.length > 0 && (
              <TouchableOpacity onPress={() => router.push({
                pathname: '/similarity/results',
                params: { productId: id },
              } as never)}>
                <Text style={styles.seeAllLink}>See All →</Text>
              </TouchableOpacity>
            )}
          </View>
          {similarMatches.length === 0 ? (
            <Text style={styles.emptyText}>No similar products found yet. Add more products with detailed attributes.</Text>
          ) : (
            similarMatches.map((match) => {
              const col = match.score >= 0.8 ? colors.teal : match.score >= 0.6 ? colors.amber : colors.blue;
              return (
                <TouchableOpacity
                  key={match.product.id}
                  style={styles.simCard}
                  onPress={() => router.push(`/product/${match.product.id}` as never)}
                >
                  <View style={styles.simCardBody}>
                    <View style={[styles.simThumb, { backgroundColor: col + '20' }]}>
                      <Text style={[styles.simThumbText, { color: col }]}>
                        {(match.product.design_name ?? 'P')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.simInfo}>
                      <View style={styles.simTopRow}>
                        <Text style={styles.simName} numberOfLines={1}>{match.product.design_name ?? '—'}</Text>
                        <View style={[styles.simScoreBadge, { backgroundColor: col + '20' }]}>
                          <Text style={[styles.simScoreText, { color: col }]}>
                            {Math.round(match.score * 100)}%
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.simReasons}>{match.matchReasons.join(' · ')}</Text>
                      {match.priceDiff != null && match.priceDiff > 0 && match.product.purchase_price != null && (
                        <Text style={styles.simSavings}>
                          ₹{match.product.purchase_price} — Save ₹{match.priceDiff}/pc
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  content: { paddingBottom: 40 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { fontSize: 16, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 8,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerBody: { flex: 1, gap: 3 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '700', fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  editBtn: {
    backgroundColor: 'rgba(93,202,165,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(93,202,165,0.3)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: colors.teal, fontFamily: 'Inter_700Bold' },

  // Photo gallery
  photoSection: { marginBottom: 16 },
  mainPhoto: {
    width: SCREEN_W,
    height: 300,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  mainPhotoEmpty: {
    width: SCREEN_W,
    height: 300,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  mainPhotoEmptyText: { fontSize: 13, color: 'rgba(255,255,255,0.2)', fontFamily: 'Inter_400Regular' },
  aiBadgeOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  aiBadgeOverlayText: { fontSize: 11, fontWeight: '700', color: '#000', fontFamily: 'Inter_700Bold' },
  thumbRow: { marginTop: 8 },
  thumbRowContent: { paddingHorizontal: 16, gap: 8 },
  thumbBtn: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbBtnActive: { borderColor: colors.teal },
  thumb: { width: '100%', height: '100%' },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginTop: 10,
    paddingVertical: 9,
    backgroundColor: 'rgba(93,202,165,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(93,202,165,0.2)',
    borderRadius: 8,
  },
  addPhotoBtnText: { fontSize: 13, fontWeight: '600', color: colors.teal, fontFamily: 'Inter_700Bold' },

  // Glass card
  glassCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  // Attribute rows
  attrRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  attrLabel: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },
  attrValue: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', fontFamily: 'Inter_700Bold', textAlign: 'right', flex: 1, marginLeft: 12 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)' },

  // Type pill
  typePill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  typePillText: { fontSize: 12, fontWeight: '700', fontFamily: 'Inter_700Bold' },

  // Pricing
  priceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  priceItem: {
    flex: 1,
    minWidth: '40%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: 10,
  },
  priceLabel: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular', marginBottom: 4 },
  priceValue: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', fontFamily: 'Inter_800ExtraBold' },

  // Stock / notes
  notesBox: { paddingTop: 8 },
  notesLabel: { fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_400Regular', marginBottom: 4 },
  notesText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter_400Regular', lineHeight: 18 },

  // PO history
  poRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: 10,
  },
  poRowBody: { flex: 1 },
  poNumber: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  poVendor: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },
  poDate: { fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_400Regular' },
  poStatusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  poStatusText: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold' },

  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_400Regular', paddingVertical: 8 },

  seeAllLink: { fontSize: 13, color: colors.teal, fontFamily: 'Inter_700Bold' },
  simCard: {
    marginBottom: 8, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  simCardBody: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  simThumb: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  simThumbText: { fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  simInfo: { flex: 1 },
  simTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  simName: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold', flex: 1 },
  simScoreBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8 },
  simScoreText: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  simReasons: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular', marginTop: 2 },
  simSavings: { fontSize: 12, color: colors.teal, fontFamily: 'Inter_700Bold', marginTop: 2 },
});
