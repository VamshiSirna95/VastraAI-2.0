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
import { useRouter } from 'expo-router';
import Svg, { Path, Polyline } from 'react-native-svg';
import { colors } from '../../constants/theme';
import ModuleCard, { type PatternType, type MetricData } from '../../components/ModuleCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// 20px padding on each side + 12px gap between 2 columns
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - 52) / 2);

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ points, color }: { points: string; color: string }) {
  return (
    <Svg height={24} width={80} viewBox="0 0 60 18" preserveAspectRatio="none">
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
  onPress?: () => void;
}

function QuickAction({ label, color, icon, onPress }: QuickActionProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
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

// ─── Module Data Types ────────────────────────────────────────────────────────

interface ModuleData {
  name: string;
  accent: string;
  title: string;
  metrics: MetricData[];
  patternType: PatternType;
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

const modules: ModuleData[] = [
  {
    name: 'Enrichment',
    accent: colors.teal,
    title: 'Tag attributes',
    patternType: 'wave',
    metrics: [
      { value: '847', label: 'Tagged', color: colors.teal },
      { value: '92%', label: 'AI acc.', color: colors.textPrimary },
    ],
  },
  {
    name: 'Purchase',
    accent: colors.amber,
    title: 'Order builder',
    patternType: 'grid',
    metrics: [
      { value: '12', label: 'Active', color: colors.amber },
      { value: '₹3.4L', label: 'Week', color: colors.textPrimary },
    ],
  },
  {
    name: 'Warehouse',
    accent: colors.blue,
    title: 'GRN verify',
    patternType: 'hexdots',
    metrics: [
      { value: '3', label: 'Pending', color: colors.red },
      { value: '98%', label: 'Accept', color: colors.teal },
    ],
  },
  {
    name: 'Intelligence',
    accent: colors.pink,
    title: 'Similarity',
    patternType: 'blobs',
    metrics: [
      { value: '24', label: 'Matches', color: colors.pink },
      { value: '₹48K', label: 'Saved', color: colors.teal },
    ],
  },
  {
    name: 'Analytics',
    accent: colors.purpleLight,
    title: 'Refill engine',
    patternType: 'zigzag',
    metrics: [{ value: '8', label: 'Due', color: colors.purpleLight }],
  },
  {
    name: 'Vendors',
    accent: colors.red,
    title: 'Rankings S+',
    patternType: 'rings',
    metrics: [{ value: '3', label: 'S+ rank', color: colors.teal }],
  },
];

// ─── Home Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();

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
            onPress={() => router.push('/(tabs)/scan')}
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
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
            onPress={() => router.push('/product/new')}
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
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
            onPress={() => router.push('/(tabs)/orders')}
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
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
            <ModuleCard key={mod.name} {...mod} width={CARD_WIDTH} />
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
    paddingBottom: 40,
  },

  // Hero
  hero: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  glowTeal: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.teal,
    opacity: 0.14,
    right: -60,
    top: -60,
  },
  glowPurple: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.purple,
    opacity: 0.08,
    left: -30,
    top: 20,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.25)',
    textTransform: 'uppercase',
    marginBottom: 10,
    fontFamily: 'Inter_700Bold',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.textPrimary,
    fontFamily: 'Inter_900Black',
    lineHeight: 36,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 8,
    fontFamily: 'Inter_400Regular',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: 90,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: 'Inter_900Black',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    marginBottom: 6,
    marginTop: 2,
  },

  // Quick Actions
  quickActionsScroll: {
    marginBottom: 4,
  },
  quickActionsContent: {
    paddingHorizontal: 20,
    gap: 10,
    flexDirection: 'row',
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },

  // Section Label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 10,
    fontFamily: 'Inter_700Bold',
  },

  // Module Grid
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
  },

  // Alerts
  alertsList: {
    paddingHorizontal: 20,
    gap: 10,
    paddingBottom: 100,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  alertText: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.5)',
    flex: 1,
    fontFamily: 'Inter_400Regular',
  },
});
