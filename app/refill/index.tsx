import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { getRefillSuggestions, generateRefillPO, type RefillSuggestion } from '../../services/refillEngine';
import { formatINR } from '../../utils/format';

const URGENCY_COLOR: Record<RefillSuggestion['urgency'], string> = {
  critical: '#E24B4A',
  soon: '#EF9F27',
  plan: '#5DCAA5',
};

const RANK_COLOR: Record<string, string> = {
  'S+': '#9B72F2', S: '#5DCAA5', A: '#EF9F27', B: '#378ADD',
  C: 'rgba(255,255,255,0.4)', D: 'rgba(255,255,255,0.3)', E: 'rgba(255,255,255,0.2)',
};

type FilterTab = 'All' | 'Critical' | 'Soon' | 'Plan';

export default function RefillScreen() {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<RefillSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('All');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getRefillSuggestions();
      setSuggestions(data);
      // Default: select all critical + soon
      const defaultSelected = new Set(
        data.filter(s => s.urgency === 'critical' || s.urgency === 'soon').map(s => s.productId)
      );
      setSelected(defaultSelected);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleGeneratePOs = async () => {
    const toGenerate = suggestions.filter(s => selected.has(s.productId));
    if (toGenerate.length === 0) { Alert.alert('No Items Selected', 'Select at least one item to generate POs.'); return; }
    const withVendor = toGenerate.filter(s => s.bestVendor);
    if (withVendor.length === 0) { Alert.alert('No Vendors', 'None of the selected items have a known vendor from previous POs.'); return; }
    setGenerating(true);
    try {
      const count = await generateRefillPO(withVendor);
      Alert.alert('POs Created', `${count} draft PO${count !== 1 ? 's' : ''} created — review in the Orders tab.`, [
        { text: 'Go to Orders', onPress: () => router.push('/(tabs)/orders' as never) },
        { text: 'Stay Here', style: 'cancel' },
      ]);
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setGenerating(false);
    }
  };

  const filtered = filter === 'All' ? suggestions : suggestions.filter(s => s.urgency === filter.toLowerCase());
  const critical = suggestions.filter(s => s.urgency === 'critical').length;
  const soon = suggestions.filter(s => s.urgency === 'soon').length;
  const totalValue = suggestions.reduce((sum, s) => sum + s.estimatedValue, 0);
  const selectedCount = selected.size;

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
          <Text style={styles.screenLabel}>SMART REPLENISHMENT</Text>
          <Text style={styles.screenTitle}>Refill Engine</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={colors.teal} size="large" /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} colors={[colors.teal]} />}
        >
          {/* Summary card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryValue, { color: colors.red }]}>{critical}</Text>
                <Text style={styles.summaryLabel}>Critical</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryValue, { color: colors.amber }]}>{soon}</Text>
                <Text style={styles.summaryLabel}>Soon</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryValue, { color: colors.teal }]}>{formatINR(totalValue)}</Text>
                <Text style={styles.summaryLabel}>Est. Value</Text>
              </View>
            </View>
            {(critical + soon) > 0 && (
              <Text style={styles.summaryAlert}>
                {critical + soon} item{critical + soon !== 1 ? 's' : ''} need{critical + soon === 1 ? 's' : ''} attention
              </Text>
            )}
          </View>

          {/* Filter tabs */}
          <View style={styles.filterRow}>
            {(['All', 'Critical', 'Soon', 'Plan'] as FilterTab[]).map((tab) => {
              const tabColor = tab === 'Critical' ? colors.red : tab === 'Soon' ? colors.amber : tab === 'Plan' ? colors.teal : 'rgba(255,255,255,0.5)';
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.filterChip, filter === tab && { backgroundColor: tabColor + '22', borderColor: tabColor + '55' }]}
                  onPress={() => setFilter(tab)}
                >
                  <Text style={[styles.filterChipText, filter === tab && { color: tabColor }]}>{tab}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Suggestion cards */}
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>All good!</Text>
              <Text style={styles.emptyBody}>No refill needed for this filter.</Text>
            </View>
          ) : (
            filtered.map((s) => {
              const urgencyColor = URGENCY_COLOR[s.urgency];
              const vendorRankColor = s.bestVendor ? (RANK_COLOR[s.bestVendor.rank] ?? 'rgba(255,255,255,0.3)') : 'rgba(255,255,255,0.2)';
              const isSelected = selected.has(s.productId);
              return (
                <TouchableOpacity key={s.productId} style={[styles.card, isSelected && styles.cardSelected]} onPress={() => toggleSelect(s.productId)} activeOpacity={0.85}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <View style={styles.cardHeaderBody}>
                      <Text style={styles.productName} numberOfLines={1}>{s.productName}</Text>
                      {s.garmentType ? <Text style={styles.garmentType}>{s.garmentType}</Text> : null}
                    </View>
                    <View style={[styles.urgencyBadge, { backgroundColor: urgencyColor + '22', borderColor: urgencyColor + '44' }]}>
                      <Text style={[styles.urgencyText, { color: urgencyColor }]}>
                        {s.urgency.charAt(0).toUpperCase() + s.urgency.slice(1)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.statsRow}>
                    <View style={styles.statCell}>
                      <Text style={[styles.statValue, { color: urgencyColor }]}>{s.currentStock} pcs</Text>
                      <Text style={styles.statLabel}>In stock</Text>
                    </View>
                    <View style={styles.statCell}>
                      <Text style={[styles.statValue, { color: urgencyColor }]}>
                        {s.stockCoverDays > 0 ? `${s.stockCoverDays}d` : '0d'}
                      </Text>
                      <Text style={styles.statLabel}>Cover</Text>
                    </View>
                    <View style={styles.statCell}>
                      <Text style={[styles.statValue, { color: colors.teal }]}>{s.suggestedQty} pcs</Text>
                      <Text style={styles.statLabel}>Order</Text>
                    </View>
                    <View style={styles.statCell}>
                      <Text style={[styles.statValue, { color: colors.amber }]}>{formatINR(s.estimatedValue)}</Text>
                      <Text style={styles.statLabel}>Value</Text>
                    </View>
                  </View>

                  {s.bestVendor && (
                    <View style={styles.vendorRow}>
                      <View style={[styles.vendorRankBadge, { backgroundColor: vendorRankColor + '22', borderColor: vendorRankColor + '33' }]}>
                        <Text style={[styles.vendorRankText, { color: vendorRankColor }]}>{s.bestVendor.rank}</Text>
                      </View>
                      <Text style={styles.vendorName} numberOfLines={1}>{s.bestVendor.name}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.createPOBtn}
                    onPress={() => router.push({
                      pathname: '/po/new',
                      params: { productId: s.productId, vendorId: s.bestVendor?.id ?? '' },
                    })}
                  >
                    <Text style={styles.createPOBtnText}>Create PO</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          )}

          {suggestions.length > 0 && (
            <TouchableOpacity
              style={[styles.genPOsBtn, generating && { opacity: 0.5 }]}
              onPress={handleGeneratePOs}
              disabled={generating}
            >
              {generating ? <ActivityIndicator size="small" color="#000" /> : null}
              <Text style={styles.genPOsBtnText}>
                {generating ? 'Creating POs…' : `Generate POs for ${selectedCount} Selected`}
              </Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10 },
  backBtn: { padding: 4 },
  headerBody: { flex: 1 },
  screenLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_700Bold' },
  screenTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', fontFamily: 'Inter_800ExtraBold' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 60 },

  summaryCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  summaryCell: { alignItems: 'center' },
  summaryValue: { fontSize: 24, fontWeight: '800', fontFamily: 'Inter_800ExtraBold' },
  summaryLabel: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular', marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  summaryAlert: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular', textAlign: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },

  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  filterChipText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_700Bold' },

  emptyState: { paddingTop: 60, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_700Bold' },
  emptyBody: { fontSize: 13, color: 'rgba(255,255,255,0.2)', fontFamily: 'Inter_400Regular' },

  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardHeaderBody: { flex: 1, marginRight: 8 },
  productName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  garmentType: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular', marginTop: 2 },
  urgencyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  urgencyText: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  statCell: { alignItems: 'center' },
  statValue: { fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular', marginTop: 2 },

  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  vendorRankBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  vendorRankText: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  vendorName: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter_400Regular' },

  createPOBtn: { backgroundColor: colors.teal, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  createPOBtnText: { fontSize: 13, fontWeight: '700', color: '#000000', fontFamily: 'Inter_700Bold' },

  cardSelected: { borderColor: `${colors.teal}44`, backgroundColor: `${colors.teal}06` },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
    marginRight: 4,
  },
  checkboxSelected: { backgroundColor: colors.teal, borderColor: colors.teal },
  checkmark: { fontSize: 12, color: '#000', fontWeight: '800' },

  genPOsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.teal, borderRadius: 14,
    paddingVertical: 16, marginTop: 6,
  },
  genPOsBtnText: { fontSize: 15, fontWeight: '700', color: '#000000', fontFamily: 'Inter_700Bold' },
});
