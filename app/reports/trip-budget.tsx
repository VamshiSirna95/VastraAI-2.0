import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { getTripBudgetReport } from '../../db/database';
import type { TripBudgetReport } from '../../db/database';
import { exportTripBudgetExcel } from '../../services/excelExport';
import { formatINR } from '../../utils/format';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function TripBudgetScreen() {
  const router = useRouter();
  const [report, setReport] = useState<TripBudgetReport | null>(null);
  const [exporting, setExporting] = useState(false);

  useFocusEffect(useCallback(() => {
    getTripBudgetReport().then(setReport);
  }, []));

  const handleExport = async () => {
    if (!report) return;
    setExporting(true);
    try {
      await exportTripBudgetExcel(report);
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
          <Text style={styles.headerTitle}>Trip Budget</Text>
          <TouchableOpacity
            style={[styles.exportBtn, exporting && { opacity: 0.5 }]}
            onPress={handleExport}
            disabled={exporting}
          >
            <Text style={styles.exportBtnText}>{exporting ? 'Exporting…' : 'Export'}</Text>
          </TouchableOpacity>
        </View>

        {report && report.trips.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No trips found</Text>
          </View>
        )}

        {report?.trips.map((trip, i) => {
          const barColor = trip.utilization > 100 ? colors.red
            : trip.utilization > 80 ? colors.amber : colors.teal;
          return (
            <View key={i} style={styles.tripCard}>
              <View style={styles.tripHeader}>
                <Text style={styles.tripName} numberOfLines={1}>{trip.name}</Text>
                <Text style={[styles.tripPct, { color: barColor }]}>{trip.utilization}%</Text>
              </View>

              <View style={styles.barBg}>
                <View style={[styles.barFill, {
                  width: `${Math.min(trip.utilization, 100)}%`,
                  backgroundColor: barColor,
                }]} />
              </View>

              <View style={styles.tripStats}>
                <View style={styles.tripStat}>
                  <Text style={styles.tripStatValue}>{formatINR(trip.budget)}</Text>
                  <Text style={styles.tripStatLabel}>Budget</Text>
                </View>
                <View style={styles.tripStat}>
                  <Text style={[styles.tripStatValue, { color: barColor }]}>{formatINR(trip.spent)}</Text>
                  <Text style={styles.tripStatLabel}>Spent</Text>
                </View>
                <View style={styles.tripStat}>
                  <Text style={[styles.tripStatValue, { color: colors.amber }]}>
                    {formatINR(Math.max(0, trip.budget - trip.spent))}
                  </Text>
                  <Text style={styles.tripStatLabel}>Remaining</Text>
                </View>
                <View style={styles.tripStat}>
                  <Text style={[styles.tripStatValue, { color: colors.blue }]}>{trip.po_count}</Text>
                  <Text style={styles.tripStatLabel}>POs</Text>
                </View>
              </View>
            </View>
          );
        })}

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
    backgroundColor: hexToRgba(colors.blue, 0.12),
    borderWidth: 1,
    borderColor: hexToRgba(colors.blue, 0.25),
  },
  exportBtnText: { fontSize: 13, fontWeight: '700', color: colors.blue, fontFamily: 'Inter_700Bold' },

  tripCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
  },
  tripHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  tripName: { flex: 1, fontSize: 14, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  tripPct: { fontSize: 16, fontWeight: '900', fontFamily: 'Inter_900Black', marginLeft: 8 },

  barBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  barFill: { height: 6, borderRadius: 3 },

  tripStats: { flexDirection: 'row', justifyContent: 'space-between' },
  tripStat: { alignItems: 'center', flex: 1 },
  tripStatValue: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  tripStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular', marginTop: 2 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 15, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  loadingText: { color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular' },
});
