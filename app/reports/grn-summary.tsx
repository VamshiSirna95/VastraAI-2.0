import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { getGRNSummaryReport } from '../../db/database';
import type { GRNSummaryReport } from '../../db/database';
import { exportGRNSummaryExcel } from '../../services/excelExport';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function GRNSummaryScreen() {
  const router = useRouter();
  const [report, setReport] = useState<GRNSummaryReport | null>(null);
  const [exporting, setExporting] = useState(false);

  useFocusEffect(useCallback(() => {
    getGRNSummaryReport().then(setReport);
  }, []));

  const handleExport = async () => {
    if (!report) return;
    setExporting(true);
    try {
      await exportGRNSummaryExcel(report);
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
          <Text style={styles.headerTitle}>GRN Summary</Text>
          <TouchableOpacity
            style={[styles.exportBtn, exporting && { opacity: 0.5 }]}
            onPress={handleExport}
            disabled={exporting}
          >
            <Text style={styles.exportBtnText}>{exporting ? 'Exporting…' : 'Export'}</Text>
          </TouchableOpacity>
        </View>

        {report && (
          <>
            {/* Acceptance rate hero */}
            <View style={styles.acceptanceHero}>
              <Text style={[styles.acceptanceRate, {
                color: report.acceptanceRate >= 90 ? colors.teal : report.acceptanceRate >= 70 ? colors.amber : colors.red,
              }]}>
                {report.acceptanceRate}%
              </Text>
              <Text style={styles.acceptanceLabel}>Overall Acceptance Rate</Text>
              <Text style={styles.totalGRNs}>{report.totalGRNs} GRNs processed</Text>
            </View>

            {/* Qty breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>QUANTITY BREAKDOWN</Text>
              <QtyRow label="Ordered" value={report.totalOrdered} color="rgba(255,255,255,0.5)" />
              <QtyRow label="Received" value={report.totalReceived} color={colors.blue} />
              <QtyRow label="Accepted" value={report.totalAccepted} color={colors.teal} />
              {report.totalRejected > 0 && (
                <QtyRow label="Rejected" value={report.totalRejected} color={colors.red} />
              )}
              {report.totalOrdered > report.totalReceived && (
                <QtyRow label="Pending" value={report.totalOrdered - report.totalReceived} color={colors.amber} />
              )}
            </View>

            {/* Per-vendor */}
            {report.byVendor.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>BY VENDOR</Text>
                {report.byVendor.map((row, i) => {
                  const rateColor = row.acceptance_rate >= 90 ? colors.teal
                    : row.acceptance_rate >= 70 ? colors.amber : colors.red;
                  return (
                    <View key={i} style={styles.vendorRow}>
                      <View style={styles.vendorLeft}>
                        <Text style={styles.vendorName} numberOfLines={1}>{row.vendor_name ?? 'Unknown'}</Text>
                        <Text style={styles.vendorOrdered}>{row.ordered} ordered · {row.accepted} accepted</Text>
                      </View>
                      <View style={[styles.ratePill, { backgroundColor: hexToRgba(rateColor, 0.12) }]}>
                        <Text style={[styles.rateText, { color: rateColor }]}>{row.acceptance_rate}%</Text>
                      </View>
                    </View>
                  );
                })}
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

function QtyRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={qStyles.row}>
      <View style={[qStyles.dot, { backgroundColor: color }]} />
      <Text style={qStyles.label}>{label}</Text>
      <Text style={[qStyles.value, { color }]}>{value.toLocaleString('en-IN')}</Text>
    </View>
  );
}

const qStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_400Regular' },
  value: { fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold' },
});

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
    backgroundColor: hexToRgba(colors.teal, 0.12),
    borderWidth: 1,
    borderColor: hexToRgba(colors.teal, 0.25),
  },
  exportBtnText: { fontSize: 13, fontWeight: '700', color: colors.teal, fontFamily: 'Inter_700Bold' },

  acceptanceHero: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
  },
  acceptanceRate: { fontSize: 52, fontWeight: '900', fontFamily: 'Inter_900Black' },
  acceptanceLabel: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_400Regular', marginTop: 4 },
  totalGRNs: { fontSize: 12, color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_400Regular', marginTop: 6 },

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

  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  vendorLeft: { flex: 1 },
  vendorName: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  vendorOrdered: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular', marginTop: 1 },
  ratePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  rateText: { fontSize: 13, fontWeight: '700', fontFamily: 'Inter_700Bold' },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  loadingText: { color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular' },
});
