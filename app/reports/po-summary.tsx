import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { getPOSummaryReport } from '../../db/database';
import type { POSummaryReport } from '../../db/database';
import { exportPOSummaryExcel } from '../../services/excelExport';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatINR(val: number): string {
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
  return '₹' + val.toLocaleString('en-IN');
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'rgba(255,255,255,0.35)',
  confirmed: colors.amber,
  sent: colors.amber,
  dispatched: colors.blue,
  received: colors.blue,
  closed: colors.teal,
};

function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function getToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function POSummaryScreen() {
  const router = useRouter();
  const [report, setReport] = useState<POSummaryReport | null>(null);
  const [exporting, setExporting] = useState(false);
  const [dateFrom, setDateFrom] = useState(getMonthStart());
  const [dateTo, setDateTo] = useState(getToday());
  const [pendingFrom, setPendingFrom] = useState(getMonthStart());
  const [pendingTo, setPendingTo] = useState(getToday());

  const fetchReport = useCallback((from: string, to: string) => {
    getPOSummaryReport(from || undefined, to || undefined).then(setReport);
  }, []);

  useFocusEffect(useCallback(() => {
    fetchReport(dateFrom, dateTo);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  const handleExport = async () => {
    if (!report) return;
    setExporting(true);
    try {
      await exportPOSummaryExcel(report);
    } catch (e) {
      Alert.alert('Export failed', String(e));
    } finally {
      setExporting(false);
    }
  };

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
          <Text style={styles.headerTitle}>PO Summary</Text>
          <TouchableOpacity
            style={[styles.exportBtn, exporting && { opacity: 0.5 }]}
            onPress={handleExport}
            disabled={exporting}
          >
            <Text style={styles.exportBtnText}>{exporting ? 'Exporting…' : 'Export'}</Text>
          </TouchableOpacity>
        </View>

        {/* Hero stats */}
        {report && (
          <>
            <View style={styles.heroRow}>
              <View style={styles.heroCard}>
                <Text style={[styles.heroValue, { color: colors.amber }]}>{report.total}</Text>
                <Text style={styles.heroLabel}>Total POs</Text>
              </View>
              <View style={styles.heroCard}>
                <Text style={[styles.heroValue, { color: colors.teal }]}>{formatINR(report.totalValue)}</Text>
                <Text style={styles.heroLabel}>Total Value</Text>
              </View>
            </View>

            {/* By Status */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>BY STATUS</Text>
              {report.byStatus.map((row) => {
                const sc = STATUS_COLOR[row.status] ?? 'rgba(255,255,255,0.35)';
                const pct = report.total > 0 ? (row.count / report.total) * 100 : 0;
                return (
                  <View key={row.status} style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: sc }]} />
                    <Text style={styles.statusName}>
                      {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                    </Text>
                    <View style={styles.statusBarBg}>
                      <View style={[styles.statusBarFill, { width: `${pct}%`, backgroundColor: sc }]} />
                    </View>
                    <Text style={[styles.statusCount, { color: sc }]}>{row.count}</Text>
                    <Text style={styles.statusValue}>{formatINR(row.value)}</Text>
                  </View>
                );
              })}
            </View>

            {/* Top Vendors */}
            {report.topVendors.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>TOP VENDORS</Text>
                {report.topVendors.map((row, i) => (
                  <View key={i} style={styles.vendorRow}>
                    <View style={styles.vendorRankPill}>
                      <Text style={styles.vendorRankText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.vendorName} numberOfLines={1}>{row.vendor_name ?? 'Unknown'}</Text>
                    <View style={styles.vendorStats}>
                      <Text style={styles.vendorCount}>{row.count} POs</Text>
                      <Text style={[styles.vendorValue, { color: colors.teal }]}>{formatINR(row.value)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {!report && (
          <View style={styles.loading}>
            <Text style={styles.loadingText}>Loading report…</Text>
          </View>
        )}
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
    paddingBottom: 16,
    gap: 14,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#FFFFFF', fontFamily: 'Inter_800ExtraBold' },
  exportBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: hexToRgba(colors.amber, 0.12),
    borderWidth: 1,
    borderColor: hexToRgba(colors.amber, 0.25),
  },
  exportBtnText: { fontSize: 13, fontWeight: '700', color: colors.amber, fontFamily: 'Inter_700Bold' },

  heroRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 16 },
  heroCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  heroValue: { fontSize: 28, fontWeight: '900', fontFamily: 'Inter_900Black' },
  heroLabel: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular', marginTop: 4 },

  section: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
  },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusName: { fontSize: 13, color: '#FFFFFF', fontFamily: 'Inter_500Medium', width: 72 },
  statusBarBg: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  statusBarFill: { height: 4, borderRadius: 2 },
  statusCount: { fontSize: 13, fontWeight: '700', fontFamily: 'Inter_700Bold', width: 28, textAlign: 'right' },
  statusValue: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular', width: 60, textAlign: 'right' },

  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  vendorRankPill: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorRankText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_700Bold' },
  vendorName: { flex: 1, fontSize: 13, color: '#FFFFFF', fontFamily: 'Inter_500Medium' },
  vendorStats: { alignItems: 'flex-end' },
  vendorCount: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular' },
  vendorValue: { fontSize: 13, fontWeight: '700', fontFamily: 'Inter_700Bold' },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  loadingText: { color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular' },
});
