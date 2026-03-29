import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Polyline } from 'react-native-svg';
import { colors } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// 14px padding on each side + 8px gap between 2 columns
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - 36) / 2);

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ points, color }: { points: string; color: string }) {
  return (
    <Svg height={18} width="100%" viewBox="0 0 60 18" preserveAspectRatio="none">
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        opacity={0.5}
      />
    </Svg>
  );
}

// ─── Section Label ────────────────────────────────────────────────────────────

function SectionLabel({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  value: string;
  label: string;
  color: string;
  sparkPoints: string;
}

function StatCard({ value, label, color, sparkPoints }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Sparkline points={sparkPoints} color={color} />
    </View>
  );
}

// ─── Quick Action ─────────────────────────────────────────────────────────────

interface QuickActionProps {
  label: string;
  color: string;
  icon: React.ReactNode;
}

function QuickAction({ label, color, icon }: QuickActionProps) {
  return (
    <TouchableOpacity
      style={[
        styles.quickAction,
        {
          backgroundColor: hexToRgba(color, 0.08),
          borderColor: hexToRgba(color, 0.15),
        },
      ]}
    >
      {icon}
      <Text style={[styles.quickActionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Module Card ──────────────────────────────────────────────────────────────

interface MetricData {
  value: string;
  label: string;
  color: string;
}

interface ModuleCardData {
  name: string;
  accent: string;
  title: string;
  metrics: MetricData[];
}

function ModuleCard({ name, accent, title, metrics }: ModuleCardData) {
  return (
    <View style={[styles.moduleCard, { width: CARD_WIDTH }]}>
      <View style={[styles.moduleTop, { backgroundColor: hexToRgba(accent, 0.15) }]} />
      <View style={styles.moduleBottom}>
        <View
          style={[styles.eyebrowTag, { backgroundColor: hexToRgba(accent, 0.12) }]}
        >
          <Text style={[styles.eyebrowText, { color: accent }]}>{name}</Text>
        </View>
        <Text style={styles.moduleTitle}>{title}</Text>
        <View style={styles.metricsRow}>
          {metrics.map((metric, index) => (
            <View key={index} style={styles.metric}>
              <Text style={[styles.metricValue, { color: metric.color }]}>
                {metric.value}
              </Text>
              <Text style={styles.metricLabel}>{metric.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Alert Item ───────────────────────────────────────────────────────────────

interface AlertItemProps {
  dotColor: string;
  children: React.ReactNode;
}

function AlertItem({ dotColor, children }: AlertItemProps) {
  return (
    <View style={styles.alertItem}>
      <View style={[styles.alertDot, { backgroundColor: dotColor }]} />
      <Text style={styles.alertText}>{children}</Text>
    </View>
  );
}

// ─── Module Data ──────────────────────────────────────────────────────────────

const modules: ModuleCardData[] = [
  {
    name: 'Enrichment',
    accent: colors.teal,
    title: 'Tag attributes',
    metrics: [
      { value: '847', label: 'Tagged', color: colors.teal },
      { value: '92%', label: 'AI acc.', color: colors.textPrimary },
    ],
  },
  {
    name: 'Purchase',
    accent: colors.amber,
    title: 'Order builder',
    metrics: [
      { value: '12', label: 'Active', color: colors.amber },
      { value: '₹3.4L', label: 'Week', color: colors.textPrimary },
    ],
  },
  {
    name: 'Warehouse',
    accent: colors.blue,
    title: 'GRN verify',
    metrics: [
      { value: '3', label: 'Pending', color: colors.red },
      { value: '98%', label: 'Accept', color: colors.teal },
    ],
  },
  {
    name: 'Intelligence',
    accent: colors.pink,
    title: 'Similarity',
    metrics: [
      { value: '24', label: 'Matches', color: colors.pink },
      { value: '₹48K', label: 'Saved', color: colors.teal },
    ],
  },
  {
    name: 'Analytics',
    accent: colors.purpleLight,
    title: 'Refill engine',
    metrics: [{ value: '8', label: 'Due', color: colors.purpleLight }],
  },
  {
    name: 'Vendors',
    accent: colors.red,
    title: 'Rankings S+',
    metrics: [{ value: '3', label: 'S+ rank', color: colors.teal }],
  },
];

// ─── Home Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.glowTeal} />
          <View style={styles.glowPurple} />
          <Text style={styles.heroEyebrow}>MERCHANDISE INTELLIGENCE</Text>
          <Text style={styles.heroTitle}>Scan. Tag.</Text>
          <Text style={[styles.heroTitle, { color: colors.teal }]}>Sell smarter.</Text>
          <Text style={styles.heroSubtitle}>K.M. Fashions — 7 stores active</Text>
        </View>

        {/* ── Stats Row ────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard
            value="847"
            label="Tagged"
            color={colors.teal}
            sparkPoints="0,14 10,12 20,10 30,11 40,8 50,6 60,4"
          />
          <StatCard
            value="12"
            label="Active POs"
            color={colors.amber}
            sparkPoints="0,10 10,9 20,11 30,8 40,10 50,9 60,8"
          />
          <StatCard
            value="3"
            label="GRN due"
            color={colors.red}
            sparkPoints="0,12 10,10 20,13 30,9 40,12 50,8 60,10"
          />
        </View>

        {/* ── Quick Actions ─────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickActionsScroll}
          contentContainerStyle={styles.quickActionsContent}
        >
          <QuickAction
            label="Scan"
            color={colors.teal}
            icon={
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M7 3H3v4M17 3h4v4M7 21H3v-4M17 21h4v-4"
                  stroke={colors.teal}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </Svg>
            }
          />
          <QuickAction
            label="New article"
            color={colors.amber}
            icon={
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
                  stroke={colors.amber}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
                <Path
                  d="M12 17a4 4 0 100-8 4 4 0 000 8z"
                  stroke={colors.amber}
                  strokeWidth={2}
                />
              </Svg>
            }
          />
          <QuickAction
            label="Create PO"
            color={colors.purple}
            icon={
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                  stroke={colors.purple}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
                <Path
                  d="M14 2v6h6"
                  stroke={colors.purple}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </Svg>
            }
          />
        </ScrollView>

        {/* ── Modules ──────────────────────────────────────────────── */}
        <SectionLabel title="MODULES" />
        <View style={styles.moduleGrid}>
          {modules.map((mod) => (
            <ModuleCard key={mod.name} {...mod} />
          ))}
        </View>

        {/* ── Alerts ───────────────────────────────────────────────── */}
        <SectionLabel title="PROACTIVE ALERTS" />
        <View style={styles.alertsList}>
          <AlertItem dotColor={colors.red}>
            {'Cotton kurta stock '}
            <Text style={{ fontWeight: '700', color: colors.red }}>18 days</Text>
            {' at Ameerpet'}
          </AlertItem>
          <AlertItem dotColor={colors.amber}>
            {'Vendor B: similar at '}
            <Text style={{ fontWeight: '700', color: colors.amber }}>₹380</Text>
            {' vs ₹450'}
          </AlertItem>
          <AlertItem dotColor={colors.purpleLight}>
            <Text style={{ fontWeight: '700', color: colors.purpleLight }}>
              5 customers
            </Text>
            {' need blue Banarasi saree'}
          </AlertItem>
          <AlertItem dotColor={colors.teal}>
            {'PO #247 '}
            <Text style={{ fontWeight: '700', color: colors.teal }}>delivered</Text>
            {' — start GRN'}
          </AlertItem>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 32,
  },

  // Hero
  hero: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  glowTeal: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.teal,
    opacity: 0.14,
    right: -40,
    top: -40,
  },
  glowPurple: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.purple,
    opacity: 0.08,
    left: -20,
    top: 20,
  },
  heroEyebrow: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.25)',
    textTransform: 'uppercase',
    marginBottom: 10,
    fontFamily: 'Inter_700Bold',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    fontFamily: 'Inter_900Black',
    lineHeight: 30,
  },
  heroSubtitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 8,
    fontFamily: 'Inter_400Regular',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: 75,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'Inter_900Black',
  },
  statLabel: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    marginBottom: 6,
    marginTop: 1,
  },

  // Quick Actions
  quickActionsScroll: {
    marginBottom: 4,
  },
  quickActionsContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },

  // Section Label
  sectionLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
    fontFamily: 'Inter_700Bold',
  },

  // Module Grid
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
  },
  moduleCard: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  moduleTop: {
    height: 70,
  },
  moduleBottom: {
    backgroundColor: 'rgba(14,14,14,0.95)',
    padding: 10,
  },
  eyebrowTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  eyebrowText: {
    fontSize: 8,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  moduleTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    fontFamily: 'Inter_800ExtraBold',
    marginBottom: 6,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metric: {},
  metricValue: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: 'Inter_900Black',
  },
  metricLabel: {
    fontSize: 7,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Inter_400Regular',
  },

  // Alerts
  alertsList: {
    paddingHorizontal: 16,
    gap: 6,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
  },
  alertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  alertText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    flex: 1,
    fontFamily: 'Inter_400Regular',
  },
});
