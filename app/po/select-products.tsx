import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { getProducts, addPOItem } from '../../db/database';
import type { Product } from '../../db/types';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function garmentColor(type?: string): string {
  const map: Record<string, string> = {
    Saree: '#ED93B1', Kurta: '#5DCAA5', Shirt: '#378ADD',
    'Salwar Set': '#AFA9EC', Lehenga: '#ED93B1', 'Trouser/Pant': '#EF9F27',
    Dupatta: '#ED93B1', Blazer: '#7F77DD', Jeans: '#378ADD',
  };
  return type ? (map[type] ?? '#AFA9EC') : '#AFA9EC';
}

interface SelectableProductCardProps {
  product: Product & { vendor_name?: string };
  selected: boolean;
  onToggle: () => void;
}

function SelectableProductCard({ product, selected, onToggle }: SelectableProductCardProps) {
  const thumbColor = garmentColor(product.garment_type);
  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onToggle}
      activeOpacity={0.75}
    >
      <View style={[styles.thumb, { backgroundColor: hexToRgba(thumbColor, 0.12) }]}>
        <Text style={[styles.thumbInitial, { color: thumbColor }]}>
          {(product.design_name ?? product.garment_type ?? '?')[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {product.design_name ?? 'Unnamed product'}
        </Text>
        <Text style={styles.cardSub} numberOfLines={1}>
          {[product.garment_type, product.primary_color].filter(Boolean).join(' · ')}
        </Text>
        {product.purchase_price != null && (
          <Text style={styles.cardPP}>PP: ₹{product.purchase_price.toLocaleString('en-IN')}</Text>
        )}
      </View>
      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
        {selected && (
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M20 6L9 17l-5-5" stroke="#000000" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function SelectProductsScreen() {
  const router = useRouter();
  const { poId } = useLocalSearchParams<{ poId: string }>();
  const [products, setProducts] = useState<(Product & { vendor_name?: string })[]>([]);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const all = await getProducts({ search: search || undefined });
    setProducts(all as (Product & { vendor_name?: string })[]);
  }, [search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleAdd = async () => {
    if (!poId || selectedIds.size === 0) return;
    setAdding(true);
    for (const productId of selectedIds) {
      await addPOItem({ po_id: poId, product_id: productId });
    }
    setAdding(false);
    router.back();
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Products</Text>
        {selectedIds.size > 0 && (
          <View style={styles.selectionBadge}>
            <Text style={styles.selectionBadgeText}>{selectedIds.size} selected</Text>
          </View>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBar}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Circle cx={11} cy={11} r={8} stroke="rgba(255,255,255,0.25)" strokeWidth={1.8} />
            <Path d="M21 21l-4.35-4.35" stroke="rgba(255,255,255,0.25)" strokeWidth={1.8} strokeLinecap="round" />
          </Svg>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={load}
            placeholder="Search products…"
            placeholderTextColor="rgba(255,255,255,0.25)"
            returnKeyType="search"
          />
        </View>
      </View>

      {/* List */}
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SelectableProductCard
            product={item}
            selected={selectedIds.has(item.id)}
            onToggle={() => toggle(item.id)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        }
      />

      {/* Add button */}
      {selectedIds.size > 0 && (
        <View style={styles.addBtnContainer}>
          <TouchableOpacity style={styles.addBtn} onPress={handleAdd} disabled={adding}>
            <Text style={styles.addBtnText}>
              {adding ? 'Adding…' : `Add ${selectedIds.size} Product${selectedIds.size > 1 ? 's' : ''}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 14,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter_800ExtraBold',
    flex: 1,
  },
  selectionBadge: {
    backgroundColor: 'rgba(93,202,165,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  selectionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.teal,
    fontFamily: 'Inter_700Bold',
  },

  searchWrapper: { paddingHorizontal: 20, paddingBottom: 10 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
    padding: 0,
  },

  listContent: { paddingHorizontal: 20, paddingBottom: 120, gap: 8 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
  },
  cardSelected: {
    backgroundColor: 'rgba(93,202,165,0.06)',
    borderColor: 'rgba(93,202,165,0.25)',
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbInitial: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'Inter_900Black',
  },
  cardBody: { flex: 1 },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  cardSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'Inter_400Regular',
  },
  cardPP: {
    fontSize: 12,
    color: colors.amber,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },

  emptyContainer: { flex: 1, alignItems: 'center', paddingVertical: 60 },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Inter_400Regular',
  },

  addBtnContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  addBtn: {
    backgroundColor: colors.teal,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'Inter_700Bold',
  },
});
