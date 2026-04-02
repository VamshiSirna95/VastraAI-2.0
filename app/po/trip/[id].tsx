import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../../constants/theme';
import { getTripById, updateTrip } from '../../../db/database';
import type { PurchaseTrip } from '../../../db/types';
import { formatINR } from '../../../utils/format';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const PO_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:      { label: 'Draft',      color: '#EF9F27' },
  sent:       { label: 'Sent',       color: '#378ADD' },
  confirmed:  { label: 'Confirmed',  color: '#7F77DD' },
  dispatched: { label: 'Dispatched', color: '#AFA9EC' },
  received:   { label: 'Received',   color: '#5DCAA5' },
  closed:     { label: 'Closed',     color: 'rgba(255,255,255,0.3)' },
};

export default function TripDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<PurchaseTrip | null>(null);
  const [editBudget, setEditBudget] = useState('');
  const [editArea, setEditArea] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (id) load();
  }, [id]);

  const load = async () => {
    const data = await getTripById(id);
    if (data) {
      setTrip(data);
      setEditBudget(String(data.budget));
      setEditArea(data.vendor_area ?? '');
    }
  };

  const handleSave = async () => {
    if (!trip) return;
    await updateTrip(trip.id, {
      budget: parseFloat(editBudget) || trip.budget,
      vendor_area: editArea || undefined,
    });
    setDirty(false);
    await load();
  };

  if (!trip) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const spent = trip.spent ?? 0;
  const budget = parseFloat(editBudget) || trip.budget || 1;
  const pct = Math.round((spent / budget) * 100);
  const barColor = pct > 100 ? colors.red : pct > 80 ? colors.amber : colors.teal;
  const spentColor = pct > 100 ? colors.red : pct > 80 ? colors.amber : '#FFFFFF';
  const remaining = budget - spent;
  const overBudget = spent > budget;

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
          <Text style={styles.headerTitle} numberOfLines={1}>{trip.name}</Text>
        </View>

        {/* Budget editor */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionLabel}>TRIP DETAILS</Text>
          <Text style={styles.fieldLabel}>Budget (₹)</Text>
          <TextInput
            style={styles.input}
            value={editBudget}
            onChangeText={(v) => { setEditBudget(v); setDirty(true); }}
            keyboardType="numeric"
            placeholder="500000"
            placeholderTextColor="rgba(255,255,255,0.2)"
          />
          <Text style={styles.fieldLabel}>Vendor Area</Text>
          <TextInput
            style={styles.input}
            value={editArea}
            onChangeText={(v) => { setEditArea(v); setDirty(true); }}
            placeholder="e.g. Begum Bazaar"
            placeholderTextColor="rgba(255,255,255,0.2)"
          />
          {dirty && (
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Budget visualization */}
        <View style={[styles.glassCard, styles.budgetCard]}>
          <Text style={styles.sectionLabel}>BUDGET OVERVIEW</Text>

          {/* Large percentage */}
          <Text style={[styles.bigPct, { color: barColor }]}>{pct}%</Text>
          <Text style={styles.bigPctSub}>of budget used</Text>

          {/* Bar */}
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }]} />
          </View>

          {/* Row: spent / remaining */}
          <View style={styles.budgetRow}>
            <View style={styles.budgetItem}>
              <Text style={styles.budgetItemLabel}>Spent</Text>
              <Text style={[styles.budgetItemValue, { color: spentColor }]}>{formatINR(spent)}</Text>
            </View>
            <View style={styles.budgetItem}>
              <Text style={styles.budgetItemLabel}>Budget</Text>
              <Text style={styles.budgetItemValue}>{formatINR(budget)}</Text>
            </View>
            <View style={styles.budgetItem}>
              <Text style={styles.budgetItemLabel}>Remaining</Text>
              <Text style={[styles.budgetItemValue, { color: overBudget ? colors.red : colors.teal }]}>
                {overBudget ? `-${formatINR(Math.abs(remaining))}` : formatINR(remaining)}
              </Text>
            </View>
          </View>

          {overBudget && pct > 120 && (
            <View style={styles.alertBox}>
              <Text style={styles.alertText}>
                Over budget by {formatINR(Math.abs(remaining))}
              </Text>
            </View>
          )}
        </View>

        {/* POs in this trip */}
        <View style={styles.glassCard}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>PURCHASE ORDERS</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{trip.purchase_orders?.length ?? 0}</Text>
            </View>
          </View>

          {(trip.purchase_orders ?? []).length === 0 ? (
            <Text style={styles.emptyText}>No POs in this trip yet</Text>
          ) : (
            trip.purchase_orders?.map((po) => {
              const statusCfg = PO_STATUS_CONFIG[po.status] ?? PO_STATUS_CONFIG.draft;
              return (
                <TouchableOpacity
                  key={po.id}
                  style={styles.poRow}
                  onPress={() => router.push(`/po/${po.id}`)}
                  activeOpacity={0.75}
                >
                  <View style={styles.poInfo}>
                    <Text style={styles.poNumber}>{po.po_number}</Text>
                    <Text style={styles.poVendor}>{po.vendor_name ?? po.vendor_id}</Text>
                  </View>
                  <View style={styles.poRight}>
                    <Text style={styles.poValue}>{formatINR(po.total_value)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: hexToRgba(statusCfg.color, 0.12) }]}>
                      <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          <TouchableOpacity
            style={styles.addPOBtn}
            onPress={() => router.push(`/po/new?tripId=${trip.id}`)}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M12 5v14M5 12h14" stroke={colors.teal} strokeWidth={2.5} strokeLinecap="round" />
            </Svg>
            <Text style={styles.addPOText}>Add PO to Trip</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  content: { paddingBottom: 60 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
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

  glassCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 16,
  },
  budgetCard: {
    backgroundColor: 'rgba(93,202,165,0.03)',
    borderColor: 'rgba(93,202,165,0.1)',
    alignItems: 'center',
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
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
    color: colors.teal,
    fontFamily: 'Inter_700Bold',
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: colors.teal,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'Inter_700Bold',
  },

  bigPct: {
    fontSize: 56,
    fontWeight: '900',
    fontFamily: 'Inter_900Black',
    lineHeight: 60,
    marginBottom: 4,
  },
  bigPctSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
  },
  barBg: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
  },
  budgetItem: { alignItems: 'center', flex: 1 },
  budgetItemLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Inter_400Regular',
    marginBottom: 2,
  },
  budgetItemValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  alertBox: {
    marginTop: 12,
    backgroundColor: 'rgba(226,75,74,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(226,75,74,0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '100%',
  },
  alertText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.red,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },

  poRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: 8,
  },
  poInfo: { flex: 1 },
  poNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  poVendor: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
  },
  poRight: { alignItems: 'flex-end', gap: 4 },
  poValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.teal,
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
  emptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    paddingVertical: 16,
  },
  addPOBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 8,
    backgroundColor: 'rgba(93,202,165,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(93,202,165,0.2)',
    borderRadius: 10,
  },
  addPOText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.teal,
    fontFamily: 'Inter_700Bold',
  },
});
