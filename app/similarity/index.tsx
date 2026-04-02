import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { getProducts } from '../../db/database';
import type { Product } from '../../db/types';
import { logError } from '../../services/errorLogger';

export default function SimilarityHubScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getProducts().then(setProducts).catch((e) => logError('SimilarityHubScreen.load', e));
  }, []);

  const filtered = search.length >= 2
    ? products.filter((p) => {
        const s = search.toLowerCase();
        return (
          (p.design_name ?? '').toLowerCase().includes(s) ||
          (p.garment_type ?? '').toLowerCase().includes(s) ||
          (p.primary_color ?? '').toLowerCase().includes(s)
        );
      }).slice(0, 8)
    : [];

  const handleFindSimilar = () => {
    if (!selectedProduct) return;
    setLoading(true);
    router.push({
      pathname: '/similarity/results',
      params: { productId: selectedProduct.id },
    } as never);
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="rgba(255,255,255,0.7)"
                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.title}>Similar Products</Text>
        </View>

        {/* Product picker */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionLabel}>SELECT PRODUCT</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={(v) => {
              setSearch(v);
              setShowDropdown(true);
              if (!v) setSelectedProduct(null);
            }}
            placeholder="Search by name, type, color…"
            placeholderTextColor="rgba(255,255,255,0.2)"
            onFocus={() => setShowDropdown(true)}
          />

          {/* Dropdown results */}
          {showDropdown && filtered.length > 0 && (
            <View style={styles.dropdown}>
              {filtered.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedProduct(p);
                    setSearch(p.design_name ?? p.garment_type ?? p.id);
                    setShowDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownName} numberOfLines={1}>
                    {p.design_name ?? '—'}
                  </Text>
                  <Text style={styles.dropdownSub}>
                    {[p.garment_type, p.primary_color, p.pattern].filter(Boolean).join(' · ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Selected product */}
          {selectedProduct && (
            <View style={styles.selectedCard}>
              <View style={styles.selectedCardBody}>
                <Text style={styles.selectedName}>{selectedProduct.design_name ?? '—'}</Text>
                <Text style={styles.selectedSub}>
                  {[selectedProduct.garment_type, selectedProduct.primary_color, selectedProduct.fabric]
                    .filter(Boolean).join(' · ')}
                </Text>
                {selectedProduct.purchase_price != null && (
                  <Text style={styles.selectedPrice}>₹{selectedProduct.purchase_price}</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => { setSelectedProduct(null); setSearch(''); }}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.3)"
                    strokeWidth={2} strokeLinecap="round" />
                </Svg>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* How it works */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionLabel}>HOW IT WORKS</Text>
          <Text style={styles.helpText}>
            The similarity engine matches products by comparing garment type, color, pattern, fabric, and occasion.
            Matches are scored 0–100% and filtered to 40%+ threshold. Price comparisons show potential savings.
          </Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.teal }]} />
              <Text style={styles.legendText}>≥80% strong match</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.amber }]} />
              <Text style={styles.legendText}>≥60% good match</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.blue }]} />
              <Text style={styles.legendText}>≥40% partial</Text>
            </View>
          </View>
        </View>

        {/* Find Similar button */}
        <TouchableOpacity
          style={[styles.findBtn, !selectedProduct && styles.findBtnDisabled]}
          onPress={handleFindSimilar}
          disabled={!selectedProduct || loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  stroke="#000" strokeWidth={2.5} strokeLinecap="round" />
              </Svg>
              <Text style={styles.findBtnText}>Find Similar</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', gap: 10, marginBottom: 16,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', fontFamily: 'Inter_800ExtraBold' },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_700Bold', marginBottom: 12,
  },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 12,
    color: '#FFFFFF', fontFamily: 'Inter_400Regular', fontSize: 14,
  },
  dropdown: {
    marginTop: 4, backgroundColor: 'rgba(0,0,0,0.95)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden',
  },
  dropdownItem: {
    padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  dropdownName: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  dropdownSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular', marginTop: 2 },
  selectedCard: {
    flexDirection: 'row', alignItems: 'center', marginTop: 10,
    backgroundColor: `${colors.teal}10`, borderWidth: 1,
    borderColor: `${colors.teal}30`, borderRadius: 10, padding: 12,
  },
  selectedCardBody: { flex: 1 },
  selectedName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  selectedSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular', marginTop: 2 },
  selectedPrice: { fontSize: 13, color: colors.teal, fontFamily: 'Inter_700Bold', marginTop: 4 },
  helpText: {
    fontSize: 13, color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter_400Regular', lineHeight: 20, marginBottom: 12,
  },
  legendRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },
  findBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.teal, borderRadius: 14,
    paddingVertical: 16, marginTop: 4,
  },
  findBtnDisabled: { opacity: 0.35 },
  findBtnText: { fontSize: 16, fontWeight: '800', color: '#000', fontFamily: 'Inter_800ExtraBold' },
});
