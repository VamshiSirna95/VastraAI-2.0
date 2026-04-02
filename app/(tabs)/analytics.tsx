import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { colors } from '../../constants/theme';
import {
  getAnalyticsData, getTopColors, getTopPatterns, getStorePerformance,
} from '../../db/database';
import type { AnalyticsData } from '../../db/types';
import type { ColorStat, PatternStat, StoreSalesStat } from '../../db/database';
import { formatINR } from '../../utils/format';

// ── Date range helpers ────────────────────────────────────────────────────────

type RangeKey = '1M' | '3M' | '6M' | '1Y' | 'ALL';
const RANGE_LABELS: { key: RangeKey; label: string }[] = [
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: '6M', label: '6M' },
  { key: '1Y', label: '1Y' },
  { key: 'ALL', label: 'All' },
];

function getDateRange(key: RangeKey): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now);
  if (key === '1M') from.setMonth(from.getMonth() - 1);
  else if (key === '3M') from.setMonth(from.getMonth() - 3);
  else if (key === '6M') from.setMonth(from.getMonth() - 6);
  else if (key === '1Y') from.setFullYear(from.getFullYear() - 1);
  else { return { from: '2000-01-01', to }; }
  return { from: from.toISOString().slice(0, 10), to };
}

// ── View-based bar chart ──────────────────────────────────────────────────────

const MAX_BAR_HEIGHT = 80;

interface BarChartProps {
  data: { month: string; value: number }[];
}

function BarChart({ data }: BarChartProps) {
  if (data.length === 0) {
    return (
      <View style={barStyles.empty}>
        <Text style={barStyles.emptyText}>No data for this period</Text>
      </View>
    );
  }
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={barStyles.container}>
      {data.map((d, i) => {
        const barH = Math.max(4, (d.value / maxVal) * MAX_BAR_HEIGHT);
        return (
          <View key={i} style={barStyles.barCol}>
            <Text style={barStyles.barLabel}>{formatINR(d.value)}</Text>
            <View style={[barStyles.bar, { height: barH }]} />
            <Text style={barStyles.barMonth}>{d.month}</Text>
          </View>
        );
      })}
    </View>
  );
}

const barStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 8,
    minHeight: MAX_BAR_HEIGHT + 50,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  bar: {
    width: '70%',
    backgroundColor: colors.teal,
    borderRadius: 4,
    opacity: 0.85,
  },
  barLabel: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  barMonth: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'Inter_400Regular',
  },
  empty: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_400Regular',
  },
});

// ── Metric card ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  accent: string;
  sub?: string;
}

function MetricCard({ label, value, accent, sub }: MetricCardProps) {
  return (
    <View style={[metricStyles.card, { borderColor: accent + '22' }]}>
      <Text style={[metricStyles.value, { color: accent }]}>{value}</Text>
      <Text style={metricStyles.label}>{label}</Text>
      {sub ? <Text style={metricStyles.sub}>{sub}</Text> : null}
    </View>
  );
}

const metricStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
    minWidth: '45%',
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
    letterSpacing: 0.5,
  },
  sub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.2)',
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const [range, setRange] = useState<RangeKey>('3M');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [topColors, setTopColors] = useState<ColorStat[]>([]);
  const [topPatterns, setTopPatterns] = useState<PatternStat[]>([]);
  const [storeStats, setStoreStats] = useState<StoreSalesStat[]>([]);

  const load = useCallback(async (r: RangeKey) => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(r);
      const [result, clrs, ptns, stores] = await Promise.all([
        getAnalyticsData(from, to),
        getTopColors(30),
        getTopPatterns(30),
        getStorePerformance(30),
      ]);
      setData(result);
      setTopColors(clrs);
      setTopPatterns(ptns);
      setStoreStats(stores);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(range); }, [range]));

  useEffect(() => { load(range); }, [range]);

  const grnTotal = data ? data.grnPerformance.completed + data.grnPerformance.partial + data.grnPerformance.pending : 0;
  const grnCompletePct = grnTotal > 0 ? Math.round((data!.grnPerformance.completed / grnTotal) * 100) : 0;

  const topVendorMax = data && data.topVendors.length > 0 ? Math.max(...data.topVendors.map((v) => v.value), 1) : 1;
  const categoryMax = data && data.categoryBreakdown.length > 0 ? Math.max(...data.categoryBreakdown.map((c) => c.value), 1) : 1;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.screenLabel}>ANALYTICS</Text>
          <Text style={styles.screenTitle}>Insights</Text>
        </View>

        {/* Date Range Segmented Control */}
        <View style={styles.rangeRow}>
          {RANGE_LABELS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.rangeBtn, range === key && styles.rangeBtnActive]}
              onPress={() => setRange(key)}
            >
              <Text style={[styles.rangeBtnText, range === key && styles.rangeBtnTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.teal} size="large" />
          </View>
        ) : data ? (
          <>
            {/* Metric Cards */}
            <View style={styles.metricsGrid}>
              <MetricCard
                label="PO Value"
                value={formatINR(data.totalPOValue)}
                accent={colors.teal}
                sub={`${data.totalPOCount} orders`}
              />
              <MetricCard
                label="GRNs Received"
                value={String(data.totalGRNCount)}
                accent={colors.blue}
                sub="receipts"
              />
              <MetricCard
                label="Active Vendors"
                value={String(data.totalVendorCount)}
                accent={colors.amber}
                sub="this period"
              />
              <MetricCard
                label="GRN Complete"
                value={`${grnCompletePct}%`}
                accent={colors.purple}
                sub={`${grnTotal} total`}
              />
            </View>

            {/* PO Value Chart */}
            <View style={styles.glassCard}>
              <Text style={styles.sectionLabel}>PO VALUE BY MONTH</Text>
              <BarChart data={data.monthlyPOValue} />
            </View>

            {/* Top Vendors */}
            <View style={styles.glassCard}>
              <Text style={styles.sectionLabel}>TOP VENDORS</Text>
              {data.topVendors.length === 0 ? (
                <Text style={styles.emptyText}>No data</Text>
              ) : data.topVendors.map((v, i) => {
                const pct = (v.value / topVendorMax) * 100;
                return (
                  <View key={i} style={styles.vendorRow}>
                    <View style={styles.vendorRank}>
                      <Text style={styles.vendorRankText}>{i + 1}</Text>
                    </View>
                    <View style={styles.vendorBody}>
                      <View style={styles.vendorNameRow}>
                        <Text style={styles.vendorName} numberOfLines={1}>{v.name}</Text>
                        <Text style={styles.vendorValue}>{formatINR(v.value)}</Text>
                      </View>
                      <View style={styles.barBg}>
                        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: colors.teal }]} />
                      </View>
                      <Text style={styles.vendorCount}>{v.count} orders</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* GRN Performance */}
            <View style={styles.glassCard}>
              <Text style={styles.sectionLabel}>GRN PERFORMANCE</Text>
              <View style={styles.grnRow}>
                <View style={[styles.grnPill, { backgroundColor: colors.teal + '22', borderColor: colors.teal + '44' }]}>
                  <Text style={[styles.grnPillCount, { color: colors.teal }]}>{data.grnPerformance.completed}</Text>
                  <Text style={styles.grnPillLabel}>Completed</Text>
                </View>
                <View style={[styles.grnPill, { backgroundColor: colors.amber + '22', borderColor: colors.amber + '44' }]}>
                  <Text style={[styles.grnPillCount, { color: colors.amber }]}>{data.grnPerformance.partial}</Text>
                  <Text style={styles.grnPillLabel}>Partial</Text>
                </View>
                <View style={[styles.grnPill, { backgroundColor: colors.blue + '22', borderColor: colors.blue + '44' }]}>
                  <Text style={[styles.grnPillCount, { color: colors.blue }]}>{data.grnPerformance.pending}</Text>
                  <Text style={styles.grnPillLabel}>Pending</Text>
                </View>
              </View>
              {grnTotal > 0 && (
                <View style={styles.grnBarBg}>
                  <View style={[styles.grnBarFill, { width: `${grnCompletePct}%` }]} />
                </View>
              )}
              {grnTotal > 0 && (
                <Text style={styles.grnPct}>{grnCompletePct}% completion rate</Text>
              )}
            </View>

            {/* Category Breakdown */}
            <View style={styles.glassCard}>
              <Text style={styles.sectionLabel}>CATEGORY BREAKDOWN</Text>
              {data.categoryBreakdown.length === 0 ? (
                <Text style={styles.emptyText}>No data</Text>
              ) : data.categoryBreakdown.map((c, i) => {
                const pct = (c.value / categoryMax) * 100;
                return (
                  <View key={i} style={styles.catRow}>
                    <Text style={styles.catName} numberOfLines={1}>{c.category}</Text>
                    <View style={styles.catBarContainer}>
                      <View style={styles.barBg}>
                        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: colors.purple }]} />
                      </View>
                    </View>
                    <View style={styles.catValues}>
                      <Text style={styles.catCount}>{c.count}</Text>
                      <Text style={styles.catValue}>{formatINR(c.value)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Trip Budget */}
            {data.tripBudget.length > 0 && (
              <View style={styles.glassCard}>
                <Text style={styles.sectionLabel}>TRIP BUDGETS</Text>
                {data.tripBudget.map((t, i) => {
                  const pct = Math.min(Math.round((t.spent / Math.max(t.budget, 1)) * 100), 100);
                  const over = t.spent > t.budget;
                  return (
                    <View key={i} style={styles.tripRow}>
                      <View style={styles.tripNameRow}>
                        <Text style={styles.tripName} numberOfLines={1}>{t.name}</Text>
                        <Text style={[styles.tripPct, { color: over ? colors.red : colors.amber }]}>
                          {pct}%
                        </Text>
                      </View>
                      <View style={styles.barBg}>
                        <View style={[styles.barFill, {
                          width: `${pct}%`,
                          backgroundColor: over ? colors.red : pct > 80 ? colors.amber : colors.teal,
                        }]} />
                      </View>
                      <View style={styles.tripValRow}>
                        <Text style={styles.tripValLabel}>Spent: {formatINR(t.spent)}</Text>
                        <Text style={styles.tripValLabel}>Budget: {formatINR(t.budget)}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Color Intelligence */}
            <View style={styles.glassCard}>
              <Text style={styles.sectionLabel}>COLOR INTELLIGENCE</Text>
              {topColors.length === 0 ? (
                <Text style={styles.emptyText}>No sales data yet. Import sales to see color trends.</Text>
              ) : (
                <>
                  <Text style={styles.subSectionLabel}>TOP SELLING COLORS (30d)</Text>
                  {topColors.slice(0, 5).map((c, i) => (
                    <View key={i} style={styles.intelRow}>
                      <View style={[styles.colorDot, { backgroundColor: c.primary_color?.toLowerCase() ?? '#888' }]} />
                      <Text style={styles.intelName} numberOfLines={1}>{c.primary_color || 'Unknown'}</Text>
                      <Text style={styles.intelQty}>{c.total_sold} pcs</Text>
                      <Text style={styles.intelValue}>{formatINR(c.revenue)}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>

            {/* Pattern & Fabric Intelligence */}
            <View style={styles.glassCard}>
              <Text style={styles.sectionLabel}>PATTERN INTELLIGENCE</Text>
              {topPatterns.length === 0 ? (
                <Text style={styles.emptyText}>No sales data yet. Import sales to see pattern trends.</Text>
              ) : (
                <>
                  <Text style={styles.subSectionLabel}>TOP PATTERNS (30d)</Text>
                  {topPatterns.slice(0, 6).map((p, i) => {
                    const maxSold = Math.max(...topPatterns.map((x) => x.total_sold), 1);
                    const pct = Math.round((p.total_sold / maxSold) * 100);
                    return (
                      <View key={i} style={styles.patternRow}>
                        <Text style={styles.patternName} numberOfLines={1}>{p.pattern || 'Unknown'}</Text>
                        <View style={styles.barBg}>
                          <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: colors.purple }]} />
                        </View>
                        <Text style={styles.patternQty}>{p.total_sold}</Text>
                      </View>
                    );
                  })}
                </>
              )}
            </View>

            {/* Store Performance */}
            <View style={styles.glassCard}>
              <Text style={styles.sectionLabel}>STORE PERFORMANCE (30d)</Text>
              {storeStats.length === 0 ? (
                <Text style={styles.emptyText}>No stores found. Add stores to track performance.</Text>
              ) : (
                storeStats.map((s, i) => {
                  const health = s.sold > 0 ? 'healthy' : s.current_stock > 0 ? 'watch' : 'idle';
                  const healthColor = health === 'healthy' ? colors.teal : health === 'watch' ? colors.amber : 'rgba(255,255,255,0.3)';
                  const healthLabel = health === 'healthy' ? '🟢' : health === 'watch' ? '🟡' : '🔴';
                  return (
                    <View key={i} style={styles.storeRow}>
                      <View style={styles.storeLeft}>
                        <Text style={styles.storeName} numberOfLines={1}>{s.store_name}</Text>
                        <Text style={styles.storeMeta}>
                          {s.sold} sold · {formatINR(s.revenue)} · {s.current_stock} in stock
                        </Text>
                      </View>
                      <Text style={styles.storeHealth}>{healthLabel}</Text>
                    </View>
                  );
                })
              )}
            </View>
          </>
        ) : null}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  content: { paddingBottom: 80 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  screenLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter_800ExtraBold',
  },

  rangeRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 4,
    gap: 2,
  },
  rangeBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 7,
  },
  rangeBtnActive: {
    backgroundColor: colors.teal,
  },
  rangeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_700Bold',
  },
  rangeBtnTextActive: {
    color: '#000000',
  },

  loadingContainer: {
    paddingTop: 80,
    alignItems: 'center',
  },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 20,
    gap: 10,
    marginBottom: 16,
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 14,
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_400Regular',
    paddingVertical: 12,
  },

  // Vendor rows
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  vendorRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorRankText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_700Bold',
  },
  vendorBody: { flex: 1 },
  vendorNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  vendorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    flex: 1,
  },
  vendorValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.teal,
    fontFamily: 'Inter_700Bold',
  },
  vendorCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },

  barBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },

  // GRN
  grnRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  grnPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  grnPillCount: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
  },
  grnPillLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  grnBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  grnBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.teal,
  },
  grnPct: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
    textAlign: 'right',
  },

  // Category
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  catName: {
    width: 80,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_400Regular',
  },
  catBarContainer: { flex: 1 },
  catValues: {
    alignItems: 'flex-end',
    gap: 1,
  },
  catCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
  },
  catValue: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.purple,
    fontFamily: 'Inter_700Bold',
  },

  subSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.2)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 10,
    marginTop: 4,
  },

  // Color intelligence
  intelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  intelName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  intelQty: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
    width: 52,
    textAlign: 'right',
  },
  intelValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.teal,
    fontFamily: 'Inter_700Bold',
    width: 60,
    textAlign: 'right',
  },

  // Pattern rows
  patternRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  patternName: {
    width: 90,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_400Regular',
  },
  patternQty: {
    width: 36,
    fontSize: 11,
    fontWeight: '600',
    color: colors.purple,
    fontFamily: 'Inter_700Bold',
    textAlign: 'right',
  },

  // Store performance
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: 10,
  },
  storeLeft: { flex: 1 },
  storeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    marginBottom: 2,
  },
  storeMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
  },
  storeHealth: { fontSize: 18 },

  // Trip budget
  tripRow: {
    marginBottom: 14,
  },
  tripNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  tripName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    flex: 1,
  },
  tripPct: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  tripValRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  tripValLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Inter_400Regular',
  },
});
