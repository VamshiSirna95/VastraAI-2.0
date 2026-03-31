import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, FlatList, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { getVendors } from '../../db/database';
import type { Vendor } from '../../db/types';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const RANK_COLOR: Record<string, string> = {
  'S+': '#9B72F2',
  S: '#5DCAA5',
  A: '#EF9F27',
  B: '#378ADD',
  C: 'rgba(255,255,255,0.4)',
  D: 'rgba(255,255,255,0.3)',
  E: 'rgba(255,255,255,0.2)',
};

function VendorCard({ vendor, onPress }: { vendor: Vendor; onPress: () => void }) {
  const rankColor = RANK_COLOR[vendor.rank] ?? 'rgba(255,255,255,0.3)';
  const location = [vendor.city, vendor.state].filter(Boolean).join(', ') || vendor.area || '';
  const isInactive = vendor.is_active === 0;

  return (
    <TouchableOpacity style={[styles.card, isInactive && styles.cardInactive]} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <View style={[styles.rankBadge, { backgroundColor: hexToRgba(rankColor, 0.15), borderColor: hexToRgba(rankColor, 0.3) }]}>
          <Text style={[styles.rankText, { color: rankColor }]}>{vendor.rank}</Text>
        </View>
        <View style={styles.cardHeaderBody}>
          <Text style={styles.vendorName} numberOfLines={1}>{vendor.name}</Text>
          {vendor.contact_person ? (
            <Text style={styles.vendorContact}>{vendor.contact_person}</Text>
          ) : null}
        </View>
        {isInactive && (
          <View style={styles.inactivePill}>
            <Text style={styles.inactivePillText}>Inactive</Text>
          </View>
        )}
      </View>

      <View style={styles.cardMeta}>
        {location ? (
          <View style={styles.metaItem}>
            <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
              <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5 14.5 7.62 14.5 9 13.38 11.5 12 11.5z"
                stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} fill="none" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.metaText}>{location}</Text>
          </View>
        ) : null}
        {vendor.speciality ? (
          <View style={styles.metaItem}>
            <Text style={styles.metaText}>{vendor.speciality}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardStats}>
        {vendor.phone ? (
          <Text style={styles.phoneText}>{vendor.phone}</Text>
        ) : null}
        {(vendor.total_orders ?? 0) > 0 ? (
          <Text style={styles.statsText}>
            {vendor.total_orders} POs · ₹{((vendor.total_value ?? 0) / 1000).toFixed(0)}K
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function VendorsScreen() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);

  const load = useCallback(async () => {
    const list = await getVendors(search || undefined, activeOnly);
    setVendors(list);
  }, [search, activeOnly]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vendors</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{vendors.length}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" stroke="rgba(255,255,255,0.3)" strokeWidth={2} strokeLinecap="round" />
          </Svg>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, city, speciality…"
            placeholderTextColor="rgba(255,255,255,0.2)"
            onSubmitEditing={load}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterChip, activeOnly && styles.filterChipActive]}
          onPress={() => setActiveOnly((v) => !v)}
        >
          <Text style={[styles.filterChipText, activeOnly && styles.filterChipTextActive]}>
            {activeOnly ? 'Active' : 'All'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={vendors}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <VendorCard vendor={item} onPress={() => router.push(`/vendors/${item.id}`)} />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} colors={[colors.teal]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No vendors found</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/vendors/new')}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path d="M12 5v14M5 12h14" stroke="#000" strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
      </TouchableOpacity>
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
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#FFFFFF', fontFamily: 'Inter_800ExtraBold' },
  countPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_700Bold' },

  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 12, alignItems: 'center' },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#FFFFFF', fontFamily: 'Inter_400Regular' },
  clearSearch: { fontSize: 12, color: 'rgba(255,255,255,0.3)', padding: 2 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(93,202,165,0.12)',
    borderColor: 'rgba(93,202,165,0.3)',
  },
  filterChipText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_700Bold' },
  filterChipTextActive: { color: colors.teal },

  list: { paddingHorizontal: 20, paddingBottom: 100 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  cardInactive: { opacity: 0.5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: { fontSize: 13, fontWeight: '900', fontFamily: 'Inter_900Black' },
  cardHeaderBody: { flex: 1 },
  vendorName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  vendorContact: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular', marginTop: 1 },
  inactivePill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inactivePillText: { fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular' },

  cardMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular' },

  cardStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  phoneText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },
  statsText: { fontSize: 12, color: colors.amber, fontFamily: 'Inter_500Medium' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 15, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular' },

  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.teal,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
