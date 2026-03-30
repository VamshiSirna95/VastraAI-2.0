import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { colors } from '../../constants/theme';
import { getDashboardData, type DashboardData } from '../../db/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 40;

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatINR(val: number): string {
  if (val >= 100000) return '₹' + (val / 100000).toFixed(1) + 'L';
  if (val >= 1000) return '₹' + (val / 1000).toFixed(1) + 'K';
  return '₹' + val;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  value: string;
  label: string;
  color: string;
  sub?: string;
}

function StatCard({ value, label, color, sub }: StatCardProps) {
  return (
    <View style={[styles.statCard, { borderColor: hexToRgba(color, 0.18) }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={[styles.statSub, { color: hexToRgba(color, 0.6) }]}>{sub}</Text> : null}
    </View>
  );
}

// ─── Section Label ────────────────────────────────────────────────────────────

function SectionLabel({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}

// ─── Activity Item ────────────────────────────────────────────────────────────

function ActivityItem({ type, description, timestamp }: { type: string; description: string; timestamp: string }) {
  const color = type === 'GRN' ? colors.teal : colors.amber;
  return (
    <View style={styles.activityItem}>
      <View style={[styles.activityDot, { backgroundColor: color }]} />
      <Text style={styles.activityDesc} numberOfLines={1}>{description}</Text>
      <Text style={styles.activityTime}>{timeAgo(timestamp)}</Text>
    </View>
  );
}

// ─── Quick Action ─────────────────────────────────────────────────────────────

function QuickAction({ label, color, icon, onPress }: { label: string; color: string; icon: React.ReactNode; onPress?: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.quickAction, { backgroundColor: hexToRgba(color, 0.08), borderColor: hexToRgba(color, 0.15) }]}
    >
      {icon}
      <Text style={[styles.quickActionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Chart config ─────────────────────────────────────────────────────────────

const chartConfig = {
  backgroundColor: 'transparent',
  backgroundGradientFrom: 'rgba(255,255,255,0.04)',
  backgroundGradientFromOpacity: 1,
  backgroundGradientTo: 'rgba(255,255,255,0.02)',
  backgroundGradientToOpacity: 1,
  color: (opacity = 1) => `rgba(239,159,39,${opacity})`,
  labelColor: (opacity = 1) => `rgba(255,255,255,${opacity * 0.5})`,
  strokeWidth: 2,
  propsForDots: { r: '4', strokeWidth: '2', stroke: '#EF9F27' },
  propsForBackgroundLines: { strokeDasharray: '', stroke: 'rgba(255,255,255,0.05)' },
  decimalPlaces: 0,
};

const barChartConfig = {
  ...chartConfig,
  color: (opacity = 1) => `rgba(93,202,165,${opacity})`,
  propsForDots: { r: '0' },
};

// ─── Home Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);

  useFocusEffect(useCallback(() => {
    getDashboardData().then(setData).catch(() => {});
  }, []));

  const trend = data?.monthlyTrend ?? [{ month: '—', value: 0 }];
  const lineData = {
    labels: trend.map((t) => t.month),
    datasets: [{ data: trend.map((t) => Math.max(t.value, 0)) }],
  };

  const quality = data?.vendorQuality ?? [];
  const barData = quality.length > 0
    ? {
        labels: quality.map((q) => q.vendor.substring(0, 6)),
        datasets: [{ data: quality.map((q) => q.acceptRate) }],
      }
    : { labels: ['—'], datasets: [{ data: [0] }] };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Greeting */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}, Vamshi</Text>
            <Text style={styles.greetingSub}>K.M. Fashions — today at a glance</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/reports')} style={styles.reportBtn}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M18 20V10M12 20V4M6 20v-6" stroke={colors.teal} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Stat Cards — horizontal scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsRow}
        >
          <StatCard value={String(data?.activePOs ?? '—')} label="Active POs" color={colors.amber} />
          <StatCard value={String(data?.pendingGRN ?? '—')} label="GRN Pending" color={colors.red} />
          <StatCard value={String(data?.totalVendors ?? '—')} label="Vendors" color={colors.blue} />
          <StatCard
            value={data ? formatINR(data.monthValue) : '—'}
            label="This Month"
            color={colors.teal}
            sub="PO value"
          />
        </ScrollView>

        {/* Quick Actions */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickActionsRow}
        >
          <QuickAction label="Scan" color={colors.teal} onPress={() => router.push('/(tabs)/scan')}
            icon={<Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M7 3H3v4M17 3h4v4M7 21H3v-4M17 21h4v-4" stroke={colors.teal} strokeWidth={2} strokeLinecap="round" /></Svg>}
          />
          <QuickAction label="New PO" color={colors.amber} onPress={() => router.push('/po/new')}
            icon={<Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6" stroke={colors.amber} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>}
          />
          <QuickAction label="Vendors" color={colors.blue} onPress={() => router.push('/vendors')}
            icon={<Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z" stroke={colors.blue} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>}
          />
          <QuickAction label="Reports" color={colors.purpleLight} onPress={() => router.push('/reports')}
            icon={<Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M18 20V10M12 20V4M6 20v-6" stroke={colors.purpleLight} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>}
          />
        </ScrollView>

        {/* Monthly PO Value Trend */}
        <SectionLabel title="PO VALUE TREND — 6 MONTHS" />
        <View style={styles.chartCard}>
          <LineChart
            data={lineData}
            width={CHART_WIDTH - 32}
            height={160}
            chartConfig={chartConfig}
            bezier
            withInnerLines
            withOuterLines={false}
            style={{ marginLeft: -16 }}
            formatYLabel={(v) => formatINR(Number(v))}
          />
        </View>

        {/* GRN Acceptance Rate by Vendor */}
        <SectionLabel title="GRN ACCEPTANCE RATE BY VENDOR" />
        <View style={styles.chartCard}>
          {quality.length > 0 ? (
            <BarChart
              data={barData}
              width={CHART_WIDTH - 32}
              height={160}
              chartConfig={barChartConfig}
              yAxisLabel=""
              yAxisSuffix="%"
              withInnerLines
              style={{ marginLeft: -16 }}
              showValuesOnTopOfBars
              fromZero
            />
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyChartText}>No GRN data yet</Text>
            </View>
          )}
        </View>

        {/* Recent Activity */}
        <SectionLabel title="RECENT ACTIVITY" />
        <View style={styles.activityCard}>
          {(data?.recentActivity ?? []).length > 0
            ? (data?.recentActivity ?? []).map((a, i) => (
                <ActivityItem key={i} type={a.type} description={a.description} timestamp={a.timestamp} />
              ))
            : <Text style={styles.emptyChartText}>No activity yet</Text>
          }
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  content: { paddingBottom: 60 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  greeting: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', fontFamily: 'Inter_900Black' },
  greetingSub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_400Regular', marginTop: 2 },
  reportBtn: { padding: 8 },

  statsRow: { paddingHorizontal: 20, gap: 10, paddingBottom: 4 },
  statCard: {
    width: 110,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 26, fontWeight: '900', fontFamily: 'Inter_900Black' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_400Regular' },
  statSub: { fontSize: 10, fontFamily: 'Inter_400Regular' },

  quickActionsRow: { paddingHorizontal: 20, gap: 10, paddingVertical: 12 },
  quickAction: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: 1, borderRadius: 20,
  },
  quickActionLabel: { fontSize: 13, fontWeight: '700', fontFamily: 'Inter_700Bold' },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)', paddingHorizontal: 20,
    marginTop: 20, marginBottom: 10, fontFamily: 'Inter_700Bold',
  },

  chartCard: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 16,
    overflow: 'hidden',
  },
  emptyChart: { height: 80, justifyContent: 'center', alignItems: 'center' },
  emptyChartText: { color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_400Regular', fontSize: 13 },

  activityCard: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  activityItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activityDot: { width: 7, height: 7, borderRadius: 4 },
  activityDesc: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter_400Regular' },
  activityTime: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular' },
});
