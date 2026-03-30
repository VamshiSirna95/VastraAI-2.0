import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { getProducts, getProductCount } from '../../db/database';
import type { Product } from '../../db/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Status config ─────────────────────────────────────────────────────────────

type ProductStatus = Product['status'];

const STATUS_CONFIG: Record<ProductStatus, { label: string; color: string }> = {
  draft:     { label: 'Draft',    color: '#EF9F27' },
  enriched:  { label: 'Enriched', color: '#5DCAA5' },
  in_po:     { label: 'In PO',    color: '#7F77DD' },
  ordered:   { label: 'Ordered',  color: '#378ADD' },
  received:  { label: 'Received', color: '#5DCAA5' },
  in_store:  { label: 'In Store', color: '#5DCAA5' },
};

// ── Placeholder color by garment type ─────────────────────────────────────────

function garmentColor(type?: string): string {
  const map: Record<string, string> = {
    Saree: '#ED93B1', Kurta: '#5DCAA5', Shirt: '#378ADD',
    'Salwar Set': '#AFA9EC', Lehenga: '#ED93B1', 'Trouser/Pant': '#EF9F27',
    Dupatta: '#ED93B1', Blazer: '#7F77DD', Jeans: '#378ADD',
  };
  return type ? (map[type] ?? '#AFA9EC') : '#AFA9EC';
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Product card ──────────────────────────────────────────────────────────────

interface ProductCardProps {
  product: Product & { vendor_name?: string };
  onPress: () => void;
}

function ProductCard({ product, onPress }: ProductCardProps) {
  const status = STATUS_CONFIG[product.status] ?? STATUS_CONFIG.draft;
  const thumbColor = garmentColor(product.garment_type);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {/* Thumbnail */}
      <View style={[styles.thumb, { backgroundColor: hexToRgba(thumbColor, 0.12) }]}>
        <Text style={[styles.thumbInitial, { color: thumbColor }]}>
          {(product.design_name ?? product.garment_type ?? '?')[0].toUpperCase()}
        </Text>
      </View>

      {/* Middle content */}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {product.design_name ?? 'Unnamed product'}
        </Text>
        <Text style={styles.cardSub} numberOfLines={1}>
          {[product.garment_type, product.primary_color].filter(Boolean).join(' · ')}
        </Text>
        {(product as Product & { vendor_name?: string }).vendor_name ? (
          <Text style={styles.cardVendor} numberOfLines={1}>
            {(product as Product & { vendor_name?: string }).vendor_name}
          </Text>
        ) : null}
        {/* Attribute pills */}
        <View style={styles.pillsRow}>
          {product.pattern ? (
            <View style={[styles.pill, { backgroundColor: hexToRgba(colors.purpleLight, 0.15) }]}>
              <Text style={styles.pillText}>{product.pattern}</Text>
            </View>
          ) : null}
          {product.fabric ? (
            <View style={[styles.pill, { backgroundColor: hexToRgba(colors.blue, 0.15) }]}>
              <Text style={styles.pillText}>{product.fabric}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Right: price + status */}
      <View style={styles.cardRight}>
        {product.mrp != null ? (
          <Text style={styles.cardMrp}>₹{product.mrp.toLocaleString('en-IN')}</Text>
        ) : null}
        <View style={[styles.statusBadge, { backgroundColor: hexToRgba(status.color, 0.12) }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onScan }: { onScan: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <Svg width={64} height={64} viewBox="0 0 24 24" fill="none" style={styles.emptyIcon}>
        <Path
          d="M7 3H3v4M17 3h4v4M7 21H3v-4M17 21h4v-4"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <Circle cx={12} cy={12} r={3} stroke="rgba(255,255,255,0.1)" strokeWidth={1.5} />
      </Svg>
      <Text style={styles.emptyTitle}>No products yet</Text>
      <Text style={styles.emptySub}>Scan a garment to get started</Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onScan}>
        <Text style={styles.emptyBtnText}>Scan Now</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function OrdersScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<(Product & { vendor_name?: string })[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState<string | null>(null);

  const load = useCallback(async () => {
    const all = await getProducts({
      search: search || undefined,
      garmentType: activeType ?? undefined,
    });
    setProducts(all as (Product & { vendor_name?: string })[]);
    const cnt = await getProductCount();
    setTotalCount(cnt);
  }, [search, activeType]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Derive filter chips from loaded products
  const typeChips = Array.from(
    new Set(products.map((p) => p.garment_type).filter(Boolean) as string[])
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>

      {/* ── Header ─── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.screenLabel}>PRODUCTS</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{totalCount}</Text>
          </View>
        </View>
      </View>

      {/* ── Search ─── */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBar}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Circle cx={11} cy={11} r={8} stroke="rgba(255,255,255,0.25)" strokeWidth={1.8} />
            <Path d="M21 21l-4.35-4.35" stroke="rgba(255,255,255,0.25)" strokeWidth={1.8} strokeLinecap="round" />
          </Svg>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={(t) => { setSearch(t); }}
            onSubmitEditing={load}
            placeholder="Search products…"
            placeholderTextColor="rgba(255,255,255,0.25)"
            returnKeyType="search"
          />
        </View>
      </View>

      {/* ── Filter chips ─── */}
      {typeChips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}
          style={styles.chipsScroll}
        >
          <TouchableOpacity
            style={[styles.chip, activeType === null && styles.chipActive]}
            onPress={() => setActiveType(null)}
          >
            <Text style={[styles.chipText, activeType === null && styles.chipTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {typeChips.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.chip, activeType === type && styles.chipActive]}
              onPress={() => setActiveType(type === activeType ? null : type)}
            >
              <Text style={[styles.chipText, activeType === type && styles.chipTextActive]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── List ─── */}
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onPress={() => router.push(`/product/${item.id}`)}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          products.length === 0 && styles.listEmpty,
        ]}
        ListEmptyComponent={
          <EmptyState onScan={() => router.push('/(tabs)/scan')} />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* ── FAB ─── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/product/new')}
        activeOpacity={0.85}
      >
        <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 5v14M5 12h14"
            stroke="#000000"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </Svg>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  screenLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
  },
  countBadge: {
    backgroundColor: 'rgba(93,202,165,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5DCAA5',
    fontFamily: 'Inter_700Bold',
  },

  searchWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
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

  chipsScroll: {
    height: 48,
    marginBottom: 12,
  },
  chipsContent: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
  },
  chip: {
    height: 36,
    paddingHorizontal: 16,
    paddingVertical: 0,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: 'rgba(93,202,165,0.12)',
    borderColor: 'rgba(93,202,165,0.3)',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_500Medium',
  },
  chipTextActive: {
    color: '#5DCAA5',
  },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 10,
  },
  listEmpty: {
    flex: 1,
  },

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
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  thumbInitial: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: 'Inter_900Black',
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
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
  cardVendor: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_400Regular',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter_500Medium',
  },

  cardRight: {
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  cardMrp: {
    fontSize: 15,
    fontWeight: '800',
    color: '#5DCAA5',
    fontFamily: 'Inter_800ExtraBold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 80,
  },
  emptyIcon: {
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  emptySub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
  },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: 'rgba(93,202,165,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(93,202,165,0.3)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5DCAA5',
    fontFamily: 'Inter_700Bold',
  },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#5DCAA5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#5DCAA5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
