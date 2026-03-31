import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { getStoreStock, getStores } from '../../db/database';
import type { StoreStock, Store } from '../../db/types';

type FilterTab = 'Low Stock' | 'Surplus' | 'All';

function formatQty(n: number): string { return n.toString(); }

// Detect imbalance: at least one store has 0, another has > 5
function hasImbalance(storeData: StoreStock[]): boolean {
  if (storeData.length < 2) return false;
  const hasZero = storeData.some((s) => s.total_qty === 0);
  const hasSurplus = storeData.some((s) => s.total_qty >= 5);
  return hasZero && hasSurplus;
}

// Group store_stock rows by product_id
function groupByProduct(rows: StoreStock[]): Map<string, StoreStock[]> {
  const map = new Map<string, StoreStock[]>();
  for (const row of rows) {
    const arr = map.get(row.product_id) ?? [];
    arr.push(row);
    map.set(row.product_id, arr);
  }
  return map;
}

// Bar for a single store
function StoreBar({ store, qty, maxQty }: { store: string; qty: number; maxQty: number }) {
  const pct = maxQty > 0 ? Math.max(4, (qty / maxQty) * 100) : 4;
  const barColor = qty === 0 ? colors.red : qty < 5 ? colors.amber : colors.teal;
  return (
    <View style={barStyles.row}>
      <Text style={barStyles.storeName} numberOfLines={1}>{store}</Text>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${pct}%` as `${number}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[barStyles.qty, { color: barColor }]}>{formatQty(qty)}</Text>
    </View>
  );
}
const barStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  storeName: { width: 64, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },
  track: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  qty: { width: 28, fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold', textAlign: 'right' },
});

export default function StockPoolScreen() {
  const router = useRouter();
  const [allStock, setAllStock] = useState<StoreStock[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('Low Stock');
  const [storeFilter, setStoreFilter] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [stock, storeList] = await Promise.all([getStoreStock(), getStores()]);
      setAllStock(stock);
      setStores(storeList);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const productMap = groupByProduct(allStock);

  // Apply filters
  const filtered: [string, StoreStock[]][] = [];
  for (const [productId, rows] of productMap) {
    const totalAcrossStores = rows.reduce((s, r) => s + r.total_qty, 0);
    const name = rows[0]?.design_name ?? productId;
    if (search && !name.toLowerCase().includes(search.toLowerCase())) continue;
    if (storeFilter != null && !rows.some((r) => r.store_id === storeFilter)) continue;
    if (filter === 'Low Stock' && totalAcrossStores >= 5) continue;
    if (filter === 'Surplus' && totalAcrossStores < 20) continue;
    filtered.push([productId, rows]);
  }
  // Sort: low stock first
  filtered.sort((a, b) => {
    const ta = a[1].reduce((s, r) => s + r.total_qty, 0);
    const tb = b[1].reduce((s, r) => s + r.total_qty, 0);
    return ta - tb;
  });

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <View style={styles.headerBody}>
          <Text style={styles.screenLabel}>INVENTORY</Text>
          <Text style={styles.screenTitle}>Stock Pool</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="rgba(255,255,255,0.3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products…"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearSearch}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {(['Low Stock', 'Surplus', 'All'] as FilterTab[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.filterSep} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.filterChip, storeFilter === null && styles.filterChipBlue]}
            onPress={() => setStoreFilter(null)}
          >
            <Text style={[styles.filterChipText, storeFilter === null && { color: colors.blue }]}>All Stores</Text>
          </TouchableOpacity>
          {stores.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.filterChip, storeFilter === s.id && styles.filterChipBlue]}
              onPress={() => setStoreFilter(s.id)}
            >
              <Text style={[styles.filterChipText, storeFilter === s.id && { color: colors.blue }]}>{s.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.teal} size="large" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No stock records</Text>
              <Text style={styles.emptyBody}>Stock updates automatically when GRN allocations are saved.</Text>
            </View>
          ) : (
            filtered.map(([productId, rows]) => {
              const totalQty = rows.reduce((s, r) => s + r.total_qty, 0);
              const maxQty = Math.max(...rows.map((r) => r.total_qty), 1);
              const imbalanced = hasImbalance(rows);
              const name = rows[0]?.design_name ?? '—';
              const garmentType = rows[0]?.garment_type ?? '';
              const totalColor = totalQty === 0 ? colors.red : totalQty < 5 ? colors.amber : colors.teal;

              return (
                <View key={productId} style={styles.productCard}>
                  <View style={styles.productCardHeader}>
                    <View style={styles.productCardInfo}>
                      <Text style={styles.productName} numberOfLines={1}>{name}</Text>
                      {garmentType ? <Text style={styles.productType}>{garmentType}</Text> : null}
                    </View>
                    <View style={styles.productCardRight}>
                      <Text style={[styles.totalQty, { color: totalColor }]}>{totalQty} total</Text>
                      {imbalanced && (
                        <TouchableOpacity
                          style={styles.transferBtn}
                          onPress={() => router.push({ pathname: '/stock/transfer', params: { productId } })}
                        >
                          <Text style={styles.transferBtnText}>Transfer</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <View style={styles.storeBars}>
                    {rows.map((r) => (
                      <StoreBar key={r.id} store={r.store_name ?? `Store ${r.store_id}`} qty={r.total_qty} maxQty={maxQty} />
                    ))}
                  </View>
                </View>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerBody: { flex: 1 },
  screenLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter_800ExtraBold',
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
  },
  clearSearch: { fontSize: 14, color: 'rgba(255,255,255,0.3)' },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 6,
  },
  filterSep: { width: 1, height: 18, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 2 },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterChipActive: { backgroundColor: colors.teal + '22', borderColor: colors.teal + '55' },
  filterChipBlue: { backgroundColor: colors.blue + '22', borderColor: colors.blue + '55' },
  filterChipText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_700Bold', fontWeight: '700' },
  filterChipTextActive: { color: colors.teal },

  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 16 },

  emptyState: { paddingTop: 60, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_700Bold' },
  emptyBody: { fontSize: 13, color: 'rgba(255,255,255,0.2)', fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 32 },

  productCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  productCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  productCardInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  productType: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular', marginTop: 1 },
  productCardRight: { alignItems: 'flex-end', gap: 6 },
  totalQty: { fontSize: 13, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  transferBtn: {
    backgroundColor: colors.blue + '22',
    borderWidth: 1,
    borderColor: colors.blue + '44',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  transferBtnText: { fontSize: 11, fontWeight: '700', color: colors.blue, fontFamily: 'Inter_700Bold' },
  storeBars: { gap: 2 },
});
