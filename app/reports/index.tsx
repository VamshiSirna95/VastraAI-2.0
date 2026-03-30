import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { colors } from '../../constants/theme';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const REPORTS = [
  {
    key: 'po-summary',
    title: 'PO Summary',
    subtitle: 'Orders by status, vendor rankings, total value',
    color: colors.amber,
    icon: (c: string) => (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
        <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    ),
  },
  {
    key: 'grn-summary',
    title: 'GRN Summary',
    subtitle: 'Acceptance rates, rejections, vendor quality',
    color: colors.teal,
    icon: (c: string) => (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M9 11l3 3L22 4" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    key: 'trip-budget',
    title: 'Trip Budget',
    subtitle: 'Budget utilisation per buying trip',
    color: colors.blue,
    icon: (c: string) => (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Rect x="2" y="7" width="20" height="14" rx="2" stroke={c} strokeWidth={1.8} />
        <Path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
        <Path d="M12 12v4M10 14h4" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    ),
  },
] as const;

export default function ReportsScreen() {
  const router = useRouter();

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
          <Text style={styles.headerTitle}>Reports</Text>
        </View>

        <Text style={styles.subtitle}>Analyse your purchase operations</Text>

        {REPORTS.map(({ key, title, subtitle, color, icon }) => (
          <TouchableOpacity
            key={key}
            style={styles.reportCard}
            onPress={() => router.push(`/reports/${key}` as never)}
            activeOpacity={0.75}
          >
            <View style={[styles.iconBox, { backgroundColor: hexToRgba(color, 0.12), borderColor: hexToRgba(color, 0.2) }]}>
              {icon(color)}
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{title}</Text>
              <Text style={styles.cardSubtitle}>{subtitle}</Text>
            </View>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.25)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        ))}
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 14,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', fontFamily: 'Inter_800ExtraBold' },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: 20,
    marginBottom: 20,
  },

  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold', marginBottom: 3 },
  cardSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular' },
});
