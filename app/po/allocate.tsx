import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import {
  getGRN, getStores, getAllocationsByGRN,
  createAllocation, deleteAllocationsByGRN,
  getStoreStock, updateStoreStock,
} from '../../db/database';
import type { GRNRecord, GRNItem, Store } from '../../db/types';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Map of grnItemId -> storeId -> sizeLabel -> quantity
type AllocMap = Record<string, Record<number, Record<string, number>>>;

function buildSizeKeys(item: GRNItem): string[] {
  if (item.size_data) return Object.keys(item.size_data);
  return ['S', 'M', 'L', 'XL', 'XXL'].filter((s) => {
    const col = `size_${s.toLowerCase()}` as keyof GRNItem;
    return ((item as unknown as Record<string, number>)[col] ?? 0) > 0;
  });
}

function getAccepted(item: GRNItem, size: string): number {
  if (item.size_data && item.size_data[size]) return item.size_data[size].accepted;
  return item.accepted_qty;
}

function totalAllocatedForSize(alloc: AllocMap, itemId: string, size: string): number {
  const storeMap = alloc[itemId] ?? {};
  return Object.values(storeMap).reduce((s, sizeMap) => s + (sizeMap[size] ?? 0), 0);
}

export default function AllocateScreen() {
  const router = useRouter();
  const { grnId } = useLocalSearchParams<{ grnId: string }>();
  const [grn, setGrn] = useState<GRNRecord | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [alloc, setAlloc] = useState<AllocMap>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!grnId) return;
    const [grnData, storeList, existingAllocs] = await Promise.all([
      getGRN(grnId),
      getStores(true),
      getAllocationsByGRN(grnId),
    ]);
    setGrn(grnData);
    setStores(storeList);

    // Pre-fill from existing allocations
    const initial: AllocMap = {};
    for (const a of existingAllocs) {
      const sizeMap = a.size_allocations ?? {};
      if (!initial[a.grn_item_id]) initial[a.grn_item_id] = {};
      initial[a.grn_item_id][a.store_id] = sizeMap;
    }
    // Ensure all items/stores have an entry
    if (grnData?.items) {
      for (const item of grnData.items) {
        if (!initial[item.id]) initial[item.id] = {};
        for (const store of storeList) {
          if (!initial[item.id][store.id]) initial[item.id][store.id] = {};
        }
      }
    }
    setAlloc(initial);
  }, [grnId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setQty = (itemId: string, storeId: number, size: string, raw: string) => {
    const val = parseInt(raw, 10) || 0;
    setAlloc((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as AllocMap;
      if (!next[itemId]) next[itemId] = {};
      if (!next[itemId][storeId]) next[itemId][storeId] = {};
      next[itemId][storeId][size] = val;
      return next;
    });
  };

  const handleAutoDistribute = () => {
    if (!grn?.items) return;
    const next: AllocMap = JSON.parse(JSON.stringify(alloc)) as AllocMap;
    for (const item of grn.items) {
      const sizes = buildSizeKeys(item);
      for (const size of sizes) {
        const accepted = getAccepted(item, size);
        const perStore = Math.floor(accepted / stores.length);
        let remainder = accepted - perStore * stores.length;
        stores.forEach((store, idx) => {
          if (!next[item.id]) next[item.id] = {};
          if (!next[item.id][store.id]) next[item.id][store.id] = {};
          next[item.id][store.id][size] = perStore + (idx === 0 ? remainder-- : 0);
          if (remainder < 0) remainder = 0;
        });
      }
    }
    setAlloc(next);
  };

  const validate = (): boolean => {
    if (!grn?.items) return false;
    for (const item of grn.items) {
      const sizes = buildSizeKeys(item);
      for (const size of sizes) {
        const accepted = getAccepted(item, size);
        const allocated = totalAllocatedForSize(alloc, item.id, size);
        if (allocated > accepted) {
          Alert.alert(
            'Over-allocated',
            `${(item as GRNItem & { design_name?: string }).design_name ?? 'Item'} — size ${size}: allocated ${allocated} exceeds accepted ${accepted}`
          );
          return false;
        }
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!grn) return;
    setSaving(true);
    try {
      // Delete existing allocations for this GRN and re-insert
      await deleteAllocationsByGRN(grnId!);
      for (const item of grn.items ?? []) {
        for (const store of stores) {
          const sizeMap = alloc[item.id]?.[store.id] ?? {};
          const total = Object.values(sizeMap).reduce((s, v) => s + v, 0);
          if (total > 0) {
            await createAllocation(grnId!, item.id, item.product_id, store.id, sizeMap);
          }
        }
      }
      // Update store_stock for each store/product
      // Build a map: storeId:productId → sizeMap
      const stockUpdates: Map<string, Record<string, number>> = new Map();
      for (const item of grn.items ?? []) {
        for (const store of stores) {
          const sizeMap = alloc[item.id]?.[store.id] ?? {};
          const total = Object.values(sizeMap).reduce((s, v) => s + v, 0);
          if (total > 0 && item.product_id) {
            const key = `${store.id}:${item.product_id}`;
            if (!stockUpdates.has(key)) stockUpdates.set(key, {});
            const existing = stockUpdates.get(key)!;
            for (const [size, qty] of Object.entries(sizeMap)) {
              existing[size] = (existing[size] ?? 0) + qty;
            }
          }
        }
      }

      // Fetch existing stock and merge
      for (const [key, newSizes] of stockUpdates.entries()) {
        const [storeIdStr, productId] = key.split(':');
        const storeId = parseInt(storeIdStr, 10);
        const allStock = await getStoreStock(storeId);
        const existing = allStock.find(s => s.product_id === productId);
        const mergedSizes: Record<string, number> = { ...(existing?.size_stock ?? {}) };
        for (const [size, qty] of Object.entries(newSizes)) {
          mergedSizes[size] = (mergedSizes[size] ?? 0) + qty;
        }
        await updateStoreStock(storeId, productId, mergedSizes);
      }

      Alert.alert('Saved', 'Stock allocations saved successfully.');
      router.back();
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!grn) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <View style={styles.headerBody}>
            <Text style={styles.headerTitle}>Stock Allocation</Text>
            <Text style={styles.headerSub}>{grn.grn_number}</Text>
          </View>
          <TouchableOpacity style={styles.autoBtn} onPress={handleAutoDistribute}>
            <Text style={styles.autoBtnText}>Auto</Text>
          </TouchableOpacity>
        </View>

        {/* Per item */}
        {(grn.items ?? []).map((item) => {
          const name = (item as GRNItem & { design_name?: string }).design_name ?? 'Product';
          const garmentType = (item as GRNItem & { garment_type?: string }).garment_type ?? '';
          const sizes = buildSizeKeys(item);

          return (
            <View key={item.id} style={styles.itemCard}>
              {/* Item header */}
              <View style={styles.itemHeader}>
                <View style={[styles.itemThumb, { backgroundColor: hexToRgba(colors.teal, 0.1) }]}>
                  <Text style={[styles.itemInitial, { color: colors.teal }]}>
                    {name[0]?.toUpperCase() ?? '?'}
                  </Text>
                </View>
                <View style={styles.itemHeaderBody}>
                  <Text style={styles.itemName} numberOfLines={1}>{name}</Text>
                  {garmentType ? <Text style={styles.itemSub}>{garmentType}</Text> : null}
                </View>
              </View>

              {/* Accepted qty row */}
              <View style={styles.acceptedRow}>
                <Text style={styles.acceptedLabel}>Accepted:</Text>
                {sizes.map((size) => (
                  <View key={size} style={styles.acceptedCell}>
                    <Text style={styles.sizeLabel}>{size}</Text>
                    <Text style={styles.acceptedQty}>{getAccepted(item, size)}</Text>
                  </View>
                ))}
              </View>

              {/* Per store allocation rows */}
              {stores.map((store) => (
                <View key={store.id} style={styles.storeRow}>
                  <Text style={styles.storeName} numberOfLines={1}>{store.code}</Text>
                  {sizes.map((size) => (
                    <TextInput
                      key={size}
                      style={styles.qtyInput}
                      value={String(alloc[item.id]?.[store.id]?.[size] ?? 0)}
                      onChangeText={(v) => setQty(item.id, store.id, size, v)}
                      keyboardType="numeric"
                      selectTextOnFocus
                    />
                  ))}
                </View>
              ))}

              {/* Remaining row */}
              <View style={styles.remainingRow}>
                <Text style={styles.remainingLabel}>Remaining:</Text>
                {sizes.map((size) => {
                  const accepted = getAccepted(item, size);
                  const allocated = totalAllocatedForSize(alloc, item.id, size);
                  const remaining = accepted - allocated;
                  return (
                    <View key={size} style={styles.remainingCell}>
                      <Text style={[styles.remainingQty, { color: remaining < 0 ? colors.red : remaining > 0 ? colors.amber : colors.teal }]}>
                        {remaining}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Allocations'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 60 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerBody: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', fontFamily: 'Inter_800ExtraBold' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular', marginTop: 2 },
  autoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: hexToRgba(colors.amber, 0.12),
    borderWidth: 1,
    borderColor: hexToRgba(colors.amber, 0.25),
  },
  autoBtnText: { fontSize: 13, fontWeight: '700', color: colors.amber, fontFamily: 'Inter_700Bold' },

  itemCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  itemThumb: { width: 38, height: 38, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  itemInitial: { fontSize: 16, fontWeight: '900', fontFamily: 'Inter_900Black' },
  itemHeaderBody: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  itemSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },

  acceptedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
    backgroundColor: 'rgba(93,202,165,0.06)',
    borderRadius: 8,
    padding: 8,
  },
  acceptedLabel: { fontSize: 11, color: colors.teal, fontFamily: 'Inter_700Bold', width: 64 },
  acceptedCell: { flex: 1, alignItems: 'center' },
  sizeLabel: { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular' },
  acceptedQty: { fontSize: 14, fontWeight: '700', color: colors.teal, fontFamily: 'Inter_700Bold' },

  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  storeName: {
    width: 64,
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter_500Medium',
  },
  qtyInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    paddingVertical: 6,
    textAlign: 'center',
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Inter_500Medium',
  },

  remainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  remainingLabel: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular', width: 64 },
  remainingCell: { flex: 1, alignItems: 'center' },
  remainingQty: { fontSize: 13, fontWeight: '700', fontFamily: 'Inter_700Bold' },

  saveBtn: {
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.teal,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#000', fontFamily: 'Inter_700Bold' },
});
