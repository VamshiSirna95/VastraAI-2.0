import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../constants/theme';
import {
  addCompetitorPrice, getCompetitorPrices, getCompetitionSummary, getProducts,
  deleteCompetitorPrice,
} from '../../db/database';
import type { CompetitorPrice, CompetitionSummaryItem, Product } from '../../db/types';

const RECENT_COMPETITORS = ['RS Brothers', 'Mandir', 'Kalanjali', 'Vasavi', 'Nalli'];

function StatusBadge({ recommendation }: { recommendation: string }) {
  let col: string = colors.teal;
  if (recommendation.includes('⚠️')) col = colors.amber;
  else if (recommendation.includes('🔴')) col = colors.red;
  return (
    <View style={[styles.statusBadge, { backgroundColor: col + '20', borderColor: col + '44' }]}>
      <Text style={[styles.statusBadgeText, { color: col }]} numberOfLines={2}>
        {recommendation}
      </Text>
    </View>
  );
}

export default function CompetitionMonitorScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'log' | 'watch'>('watch');

  // Log form state
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [competitorName, setCompetitorName] = useState('');
  const [competitorPrice, setCompetitorPrice] = useState('');
  const [offerPct, setOfferPct] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Watch list state
  const [prices, setPrices] = useState<CompetitorPrice[]>([]);
  const [summary, setSummary] = useState<CompetitionSummaryItem[]>([]);
  const [loadingWatch, setLoadingWatch] = useState(false);

  const loadWatch = useCallback(async () => {
    setLoadingWatch(true);
    try {
      const [p, s] = await Promise.all([getCompetitorPrices(), getCompetitionSummary()]);
      setPrices(p);
      setSummary(s);
    } finally {
      setLoadingWatch(false);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    const ps = await getProducts();
    setProducts(ps);
  }, []);

  useFocusEffect(useCallback(() => {
    loadWatch();
    loadProducts();
  }, [loadWatch, loadProducts]));

  const filteredProducts = productSearch.length >= 2
    ? products.filter((p) => {
        const s = productSearch.toLowerCase();
        return (
          (p.design_name ?? '').toLowerCase().includes(s) ||
          (p.garment_type ?? '').toLowerCase().includes(s)
        );
      }).slice(0, 6)
    : [];

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSaveLog = async () => {
    if (!competitorName.trim()) { Alert.alert('Required', 'Enter competitor name'); return; }
    if (!competitorPrice || isNaN(parseFloat(competitorPrice))) {
      Alert.alert('Required', 'Enter competitor price'); return;
    }
    setSaving(true);
    try {
      await addCompetitorPrice({
        product_id: selectedProduct?.id,
        competitor_name: competitorName.trim(),
        competitor_price: parseFloat(competitorPrice),
        our_mrp: selectedProduct?.mrp ?? undefined,
        our_selling_price: selectedProduct?.selling_price ?? undefined,
        our_offer_percent: offerPct ? parseFloat(offerPct) : 0,
        photo_uri: photoUri ?? undefined,
        notes: notes.trim() || undefined,
      });
      // Reset form
      setCompetitorName('');
      setCompetitorPrice('');
      setOfferPct('');
      setNotes('');
      setPhotoUri(null);
      setSelectedProduct(null);
      setProductSearch('');
      Alert.alert('Saved', 'Competitor price logged successfully.');
      setTab('watch');
      await loadWatch();
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Entry', 'Remove this competitor price log?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteCompetitorPrice(id);
          await loadWatch();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="rgba(255,255,255,0.7)"
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.title}>Price Watch</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setTab('log')}>
          <Text style={styles.addBtnText}>＋ Log</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['watch', 'log'] as const).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'watch' ? 'Price Watch' : 'Log Price'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">

        {/* ── LOG TAB ─── */}
        {tab === 'log' && (
          <>
            <View style={styles.glassCard}>
              <Text style={styles.sectionLabel}>PRODUCT (OPTIONAL)</Text>
              <TextInput
                style={styles.input}
                value={productSearch}
                onChangeText={(v) => { setProductSearch(v); setShowProductDropdown(true); if (!v) setSelectedProduct(null); }}
                placeholder="Search our catalog…"
                placeholderTextColor="rgba(255,255,255,0.2)"
                onFocus={() => setShowProductDropdown(true)}
              />
              {showProductDropdown && filteredProducts.length > 0 && (
                <View style={styles.dropdown}>
                  {filteredProducts.map((p) => (
                    <TouchableOpacity key={p.id} style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedProduct(p);
                        setProductSearch(p.design_name ?? p.garment_type ?? '');
                        setShowProductDropdown(false);
                      }}>
                      <Text style={styles.dropdownName}>{p.design_name ?? '—'}</Text>
                      <Text style={styles.dropdownSub}>
                        {[p.garment_type, `₹${p.selling_price ?? '?'}`].filter(Boolean).join(' · ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {selectedProduct && (
                <View style={styles.selectedChip}>
                  <Text style={styles.selectedChipText}>
                    {selectedProduct.design_name ?? selectedProduct.garment_type}
                    {selectedProduct.selling_price ? ` · ₹${selectedProduct.selling_price}` : ''}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.glassCard}>
              <Text style={styles.sectionLabel}>COMPETITOR</Text>
              <Text style={styles.fieldLabel}>Competitor Name</Text>
              <TextInput
                style={styles.input}
                value={competitorName}
                onChangeText={setCompetitorName}
                placeholder="e.g. RS Brothers"
                placeholderTextColor="rgba(255,255,255,0.2)"
              />
              {/* Quick-fill buttons */}
              <View style={styles.quickRow}>
                {RECENT_COMPETITORS.map((c) => (
                  <TouchableOpacity key={c} style={styles.quickChip} onPress={() => setCompetitorName(c)}>
                    <Text style={styles.quickChipText}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Competitor Price (₹)</Text>
              <TextInput
                style={styles.input}
                value={competitorPrice}
                onChangeText={setCompetitorPrice}
                placeholder="₹ —"
                placeholderTextColor="rgba(255,255,255,0.2)"
                keyboardType="numeric"
              />

              <Text style={styles.fieldLabel}>Current Offer % (if any)</Text>
              <TextInput
                style={styles.input}
                value={offerPct}
                onChangeText={setOfferPct}
                placeholder="0"
                placeholderTextColor="rgba(255,255,255,0.2)"
                keyboardType="numeric"
              />

              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.input, { minHeight: 60 }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional notes…"
                placeholderTextColor="rgba(255,255,255,0.2)"
                multiline
              />

              <TouchableOpacity style={styles.photoBtn} onPress={handlePickPhoto}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
                ) : (
                  <>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
                        stroke={colors.blue} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      <Path d="M12 17a4 4 0 100-8 4 4 0 000 8z" stroke={colors.blue} strokeWidth={2} />
                    </Svg>
                    <Text style={styles.photoBtnText}>Capture Price Tag (optional)</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSaveLog} disabled={saving}>
              {saving ? <ActivityIndicator color="#000" size="small" /> : (
                <Text style={styles.saveBtnText}>Save Competitor Price</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* ── WATCH TAB ─── */}
        {tab === 'watch' && (
          <>
            {loadingWatch ? (
              <View style={styles.loaderBox}>
                <ActivityIndicator color={colors.teal} />
              </View>
            ) : prices.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📊</Text>
                <Text style={styles.emptyTitle}>No prices logged yet</Text>
                <Text style={styles.emptyBody}>
                  Tap "＋ Log" to record a competitor's price for any product.
                </Text>
                <TouchableOpacity style={styles.logBtn} onPress={() => setTab('log')}>
                  <Text style={styles.logBtnText}>Log Competitor Price</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Summary sorted by biggest disadvantage */}
                {summary.length > 0 && (
                  <>
                    <Text style={styles.watchSectionLabel}>PRICE ANALYSIS</Text>
                    {summary
                      .sort((a, b) => b.price_diff - a.price_diff)
                      .map((s, i) => (
                        <View key={i} style={styles.summaryCard}>
                          <View style={styles.summaryHeader}>
                            <Text style={styles.summaryProduct} numberOfLines={1}>{s.product_name}</Text>
                            <Text style={styles.summaryCompetitor}>{s.competitor_name}</Text>
                          </View>
                          <View style={styles.summaryPriceRow}>
                            <View style={styles.priceBlock}>
                              <Text style={styles.priceBlockLabel}>Our Price</Text>
                              <Text style={[styles.priceBlockValue, { color: colors.teal }]}>₹{s.our_price}</Text>
                            </View>
                            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                              <Path d="M5 12h14M12 5l7 7-7 7" stroke="rgba(255,255,255,0.2)"
                                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
                            <View style={styles.priceBlock}>
                              <Text style={styles.priceBlockLabel}>Competitor</Text>
                              <Text style={[styles.priceBlockValue, { color: colors.amber }]}>₹{s.competitor_price}</Text>
                            </View>
                          </View>
                          <StatusBadge recommendation={s.recommendation} />
                        </View>
                      ))}
                  </>
                )}

                {/* All logged entries */}
                <Text style={styles.watchSectionLabel}>ALL ENTRIES</Text>
                {prices.map((p) => (
                  <View key={p.id} style={styles.entryCard}>
                    <View style={styles.entryBody}>
                      <View style={styles.entryMain}>
                        {p.product_name && (
                          <Text style={styles.entryProduct} numberOfLines={1}>{p.product_name}</Text>
                        )}
                        <Text style={styles.entryCompetitor}>{p.competitor_name}</Text>
                        <Text style={styles.entryPrice}>₹{p.competitor_price}</Text>
                        {p.notes ? <Text style={styles.entryNotes}>{p.notes}</Text> : null}
                        <Text style={styles.entryDate}>{p.captured_at?.slice(0, 10)}</Text>
                      </View>
                      {p.photo_uri && (
                        <Image source={{ uri: p.photo_uri }} style={styles.entryPhoto} resizeMode="cover" />
                      )}
                    </View>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(p.id)}>
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                        <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                          stroke="rgba(255,255,255,0.3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', gap: 10,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: '#FFFFFF', fontFamily: 'Inter_800ExtraBold' },
  addBtn: {
    backgroundColor: `${colors.teal}20`, borderWidth: 1, borderColor: `${colors.teal}44`,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: colors.teal, fontFamily: 'Inter_700Bold' },
  tabRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)' },
  tabActive: { backgroundColor: `${colors.teal}20` },
  tabText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_700Bold' },
  tabTextActive: { color: colors.teal },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginBottom: 12, marginTop: 12,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_700Bold', marginBottom: 10,
  },
  fieldLabel: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 12,
    color: '#FFFFFF', fontFamily: 'Inter_400Regular', fontSize: 14,
  },
  dropdown: {
    marginTop: 4, backgroundColor: 'rgba(30,30,30,0.98)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden',
  },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  dropdownName: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  dropdownSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular', marginTop: 2 },
  selectedChip: {
    marginTop: 8, backgroundColor: `${colors.teal}15`, borderWidth: 1,
    borderColor: `${colors.teal}30`, borderRadius: 8, padding: 8,
  },
  selectedChipText: { fontSize: 13, color: colors.teal, fontFamily: 'Inter_700Bold' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 },
  quickChip: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  quickChipText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_400Regular' },
  photoBtn: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(55,138,221,0.08)', borderWidth: 1,
    borderColor: 'rgba(55,138,221,0.2)', borderRadius: 10, paddingVertical: 14,
  },
  photoBtnText: { fontSize: 13, color: colors.blue, fontFamily: 'Inter_700Bold' },
  photoPreview: { width: '100%', height: 100, borderRadius: 8 },
  saveBtn: {
    backgroundColor: colors.teal, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#000', fontFamily: 'Inter_800ExtraBold' },

  loaderBox: { paddingVertical: 40, alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold', marginBottom: 8 },
  emptyBody: { fontSize: 14, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  logBtn: {
    backgroundColor: `${colors.teal}20`, borderWidth: 1, borderColor: `${colors.teal}44`,
    borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10,
  },
  logBtnText: { fontSize: 14, fontWeight: '700', color: colors.teal, fontFamily: 'Inter_700Bold' },

  watchSectionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_700Bold', marginTop: 16, marginBottom: 10,
  },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginBottom: 10,
  },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  summaryProduct: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold', flex: 1 },
  summaryCompetitor: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular', marginLeft: 8 },
  summaryPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  priceBlock: { flex: 1, alignItems: 'center' },
  priceBlockLabel: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular', marginBottom: 3 },
  priceBlockValue: { fontSize: 20, fontWeight: '800', fontFamily: 'Inter_800ExtraBold' },
  statusBadge: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start',
  },
  statusBadgeText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },

  entryCard: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, marginBottom: 8,
    flexDirection: 'row', alignItems: 'flex-start',
  },
  entryBody: { flex: 1, flexDirection: 'row', gap: 10 },
  entryMain: { flex: 1 },
  entryProduct: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  entryCompetitor: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular', marginTop: 2 },
  entryPrice: { fontSize: 16, fontWeight: '700', color: colors.amber, fontFamily: 'Inter_700Bold', marginTop: 4 },
  entryNotes: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular', marginTop: 3 },
  entryDate: { fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: 'Inter_400Regular', marginTop: 3 },
  entryPhoto: { width: 56, height: 56, borderRadius: 8 },
  deleteBtn: { padding: 6, marginLeft: 8, alignSelf: 'flex-start' },
});
