import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Image, Alert, RefreshControl, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { getDemands, updateDemandStatus } from '../../db/database';
import type { CustomerDemand } from '../../db/types';
import { logError } from '../../services/errorLogger';

type FilterTab = 'Open' | 'Matched' | 'Fulfilled' | 'All';

const STATUS_COLOR: Record<string, string> = {
  open: colors.teal,
  matched: colors.blue,
  fulfilled: 'rgba(255,255,255,0.3)',
  expired: colors.amber,
  cancelled: colors.red,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function DemandListScreen() {
  const router = useRouter();
  const [demands, setDemands] = useState<CustomerDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('Open');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getDemands();
      setDemands(data);
    } catch (e) {
      logError('DemandListScreen.load', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = demands.filter((d) => {
    if (filter === 'Open' && d.status !== 'open') return false;
    if (filter === 'Matched' && d.status !== 'matched') return false;
    if (filter === 'Fulfilled' && d.status !== 'fulfilled') return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !d.description.toLowerCase().includes(q) &&
        !(d.customer_name ?? '').toLowerCase().includes(q) &&
        !(d.customer_phone ?? '').toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const handleMarkFulfilled = (d: CustomerDemand) => {
    Alert.alert('Mark Fulfilled?', `Mark "${d.description.slice(0, 50)}" as fulfilled?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes',
        onPress: async () => {
          await updateDemandStatus(d.id, 'fulfilled');
          load();
        },
      },
    ]);
  };

  const openCount = demands.filter((d) => d.status === 'open').length;

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
          <Text style={styles.screenLabel}>CUSTOMERS</Text>
          <Text style={styles.screenTitle}>
            Demand{openCount > 0 ? ` · ${openCount} open` : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/demand/new')}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={colors.teal} strokeWidth={2.2} strokeLinecap="round" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="rgba(255,255,255,0.3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <TextInput
          style={styles.searchInput}
          placeholder="Search demands…"
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

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['Open', 'Matched', 'Fulfilled', 'All'] as FilterTab[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.teal} size="large" />
        </View>
      ) : error ? (
        <View style={styles.errorState}>
          <Text style={styles.errorText}>Failed to load demands</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} colors={[colors.teal]} />}>
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No demands</Text>
              <Text style={styles.emptyBody}>
                {filter === 'Open'
                  ? 'Tap + to capture a new customer demand.'
                  : 'Nothing here for this filter.'}
              </Text>
            </View>
          ) : (
            filtered.map((d) => (
              <DemandCard key={d.id} demand={d} onMarkFulfilled={handleMarkFulfilled} />
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function DemandCard({
  demand: d,
  onMarkFulfilled,
}: {
  demand: CustomerDemand;
  onMarkFulfilled: (d: CustomerDemand) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const dotColor = STATUS_COLOR[d.status] ?? 'rgba(255,255,255,0.2)';
  const hasPrice = d.price_range_min != null || d.price_range_max != null;

  return (
    <TouchableOpacity style={styles.card} onPress={() => setExpanded(!expanded)} activeOpacity={0.85}>
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <View style={styles.statusRow}>
            <Circle cx={4} cy={4} r={4} fill={dotColor} />
            <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
            <Text style={[styles.statusText, { color: dotColor }]}>
              {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
            </Text>
            {d.store_name ? (
              <Text style={styles.storeName}> · {d.store_name}</Text>
            ) : null}
          </View>
          <Text style={styles.description} numberOfLines={3}>{d.description}</Text>
        </View>
        {d.photo_uri ? (
          <Image source={{ uri: d.photo_uri }} style={styles.thumb} />
        ) : null}
      </View>

      {/* Meta row */}
      <View style={styles.metaRow}>
        {d.customer_name ? (
          <Text style={styles.metaItem}>{d.customer_name}</Text>
        ) : null}
        {d.customer_phone ? (
          <Text style={styles.metaItem}>{d.customer_phone}</Text>
        ) : null}
        {d.garment_type ? (
          <Text style={styles.metaBadge}>{d.garment_type}</Text>
        ) : null}
        {d.color_preference ? (
          <Text style={styles.metaBadge}>{d.color_preference}</Text>
        ) : null}
        {hasPrice ? (
          <Text style={styles.metaBadge}>
            ₹{d.price_range_min ?? '?'}–{d.price_range_max ?? '?'}
          </Text>
        ) : null}
        <Text style={styles.timeAgo}>{timeAgo(d.created_at)}</Text>
      </View>

      {/* Actions */}
      {(d.status === 'matched' || d.status === 'open') && (
        <View style={styles.cardActions}>
          {d.status === 'matched' && (
            <TouchableOpacity
              style={styles.fulfillBtn}
              onPress={() => onMarkFulfilled(d)}
            >
              <Text style={styles.fulfillBtnText}>Mark Fulfilled</Text>
            </TouchableOpacity>
          )}
          {d.status === 'open' && (
            <TouchableOpacity style={styles.findBtn}>
              <Text style={styles.findBtnText}>Find Match</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Expanded section */}
      {expanded && (
        <View style={styles.expandedSection}>
          {d.notes ? <Text style={styles.expandedNotes}>{d.notes}</Text> : null}
          <View style={styles.contactRow}>
            {d.customer_phone ? (
              <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${d.customer_phone}`)}>
                <Text style={styles.callBtnText}>📞 Call</Text>
              </TouchableOpacity>
            ) : null}
            {d.customer_phone ? (
              <TouchableOpacity style={styles.waBtn} onPress={() => Linking.openURL(`whatsapp://send?phone=91${d.customer_phone}`)}>
                <Text style={styles.waBtnText}>💬 WhatsApp</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}
    </TouchableOpacity>
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
  addBtn: {
    width: 36,
    height: 36,
    backgroundColor: colors.teal + '22',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.teal + '44',
    justifyContent: 'center',
    alignItems: 'center',
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
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterChipActive: { backgroundColor: colors.teal + '22', borderColor: colors.teal + '55' },
  filterChipText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_700Bold', fontWeight: '700' },
  filterChipTextActive: { color: colors.teal },

  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 16 },

  emptyState: { paddingTop: 60, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_700Bold' },
  emptyBody: { fontSize: 13, color: 'rgba(255,255,255,0.2)', fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 32 },

  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
  errorText: { fontSize: 15, color: colors.red, fontFamily: 'Inter_400Regular' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.06)' },
  retryBtnText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_700Bold' },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  cardLeft: { flex: 1 },

  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  storeName: { fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_400Regular' },

  description: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    resizeMode: 'cover',
  },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 4,
  },
  metaItem: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
  },
  metaBadge: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter_400Regular',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  timeAgo: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    fontFamily: 'Inter_400Regular',
    marginLeft: 'auto',
  },

  cardActions: { marginTop: 8, flexDirection: 'row', gap: 8 },
  fulfillBtn: {
    backgroundColor: colors.teal + '22',
    borderWidth: 1,
    borderColor: colors.teal + '44',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  fulfillBtnText: { fontSize: 12, fontWeight: '700', color: colors.teal, fontFamily: 'Inter_700Bold' },
  findBtn: {
    backgroundColor: colors.blue + '22',
    borderWidth: 1,
    borderColor: colors.blue + '44',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  findBtnText: { fontSize: 12, fontWeight: '700', color: colors.blue, fontFamily: 'Inter_700Bold' },

  expandedSection: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  expandedNotes: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular', marginBottom: 8 },
  contactRow: { flexDirection: 'row', gap: 8 },
  callBtn: { backgroundColor: 'rgba(93,202,165,0.15)', borderWidth: 1, borderColor: 'rgba(93,202,165,0.3)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  callBtnText: { fontSize: 12, fontWeight: '700', color: '#5DCAA5', fontFamily: 'Inter_700Bold' },
  waBtn: { backgroundColor: 'rgba(55,138,221,0.15)', borderWidth: 1, borderColor: 'rgba(55,138,221,0.3)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  waBtnText: { fontSize: 12, fontWeight: '700', color: '#378ADD', fontFamily: 'Inter_700Bold' },
});
