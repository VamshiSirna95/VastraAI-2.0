import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { getTrips } from '../../db/database';
import type { PurchaseTrip } from '../../db/types';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatINR(val: number): string {
  return '₹' + val.toLocaleString('en-IN');
}

interface TripCardProps {
  trip: PurchaseTrip;
  onPress: () => void;
}

function TripCard({ trip, onPress }: TripCardProps) {
  const spent = trip.spent ?? 0;
  const budget = trip.budget ?? 1;
  const pct = Math.min(Math.round((spent / budget) * 100), 100);
  const barColor = pct > 100 ? colors.red : pct > 80 ? colors.amber : colors.teal;
  const spentColor = pct > 100 ? colors.red : pct > 80 ? colors.amber : '#FFFFFF';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.tripName}>{trip.name}</Text>
        <View style={[styles.statusBadge, {
          backgroundColor: trip.status === 'active' ? hexToRgba(colors.teal, 0.12) : hexToRgba(colors.amber, 0.12),
        }]}>
          <Text style={[styles.statusText, {
            color: trip.status === 'active' ? colors.teal : colors.amber,
          }]}>{trip.status.toUpperCase()}</Text>
        </View>
      </View>

      {(trip.start_date || trip.vendor_area) && (
        <Text style={styles.tripMeta}>
          {[trip.vendor_area, trip.start_date].filter(Boolean).join(' · ')}
        </Text>
      )}

      {/* Budget bar */}
      <View style={styles.budgetSection}>
        <View style={styles.budgetRow}>
          <Text style={styles.budgetLabel}>Spent</Text>
          <Text style={[styles.budgetSpent, { color: spentColor }]}>{formatINR(spent)}</Text>
          <Text style={styles.budgetSlash}>/</Text>
          <Text style={styles.budgetTotal}>{formatINR(budget)}</Text>
          <Text style={styles.budgetPct}>{pct}%</Text>
        </View>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: barColor }]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function TripsScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState<PurchaseTrip[]>([]);

  const load = useCallback(async () => {
    const all = await getTrips();
    setTrips(all);
  }, []);

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
        <Text style={styles.screenLabel}>PURCHASE TRIPS</Text>
      </View>

      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        renderItem={useCallback(({ item }: { item: typeof trips[0] }) => (
          <TripCard
            trip={item}
            onPress={() => router.push(`/po/trip/${item.id}`)}
          />
        ), [router])}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No trips yet</Text>
            <Text style={styles.emptySub}>Create your first purchase trip</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/po/trip/new')}
        activeOpacity={0.85}
      >
        <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
          <Path d="M12 5v14M5 12h14" stroke="#000000" strokeWidth={2.5} strokeLinecap="round" />
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
    paddingBottom: 16,
    gap: 14,
  },
  backBtn: { padding: 4 },
  screenLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
  },

  listContent: { paddingHorizontal: 20, paddingBottom: 120, gap: 12 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 16,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tripName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter_800ExtraBold',
    flex: 1,
    marginRight: 8,
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
  tripMeta: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },

  budgetSection: { marginTop: 4 },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  budgetLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
    marginRight: 4,
  },
  budgetSpent: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  budgetSlash: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.2)',
    fontFamily: 'Inter_400Regular',
  },
  budgetTotal: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  budgetPct: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_700Bold',
  },
  barBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },

  emptyContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: 8,
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

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.amber,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
