import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { parseSalesExcel } from '../../services/salesDataParser';
import {
  insertSalesRows, createDataUpload, getDataUploads,
} from '../../db/database';
import type { DataUpload, SalesRow } from '../../db/database';

interface PendingImport {
  filename: string;
  rows: SalesRow[];
  matched: number;
  unmatched: number;
  errors: string[];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DataUploadScreen() {
  const router = useRouter();
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [uploads, setUploads] = useState<DataUpload[]>([]);

  const loadHistory = useCallback(async () => {
    const list = await getDataUploads();
    setUploads(list);
  }, []);

  useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'application/octet-stream',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setParsing(true);
      setPending(null);
      try {
        const parsed = await parseSalesExcel(asset.uri);
        setPending({
          filename: asset.name,
          rows: parsed.rows,
          matched: parsed.matched,
          unmatched: parsed.unmatched,
          errors: parsed.errors,
        });
      } finally {
        setParsing(false);
      }
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  };

  const handleSaveImport = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      const batchId = `batch_${Date.now()}`;
      await insertSalesRows(pending.rows, batchId);
      await createDataUpload(pending.filename, pending.rows.length, pending.matched, pending.unmatched);
      setPending(null);
      await loadHistory();
      Alert.alert('Import Complete', `${pending.rows.length} rows saved — ${pending.matched} matched to products.`);
    } catch (e) {
      Alert.alert('Save Error', String(e));
    } finally {
      setSaving(false);
    }
  };

  const matchRate = pending && pending.rows.length > 0
    ? Math.round((pending.matched / pending.rows.length) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M5 12l7-7M5 12l7 7" stroke={colors.blue} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <View style={styles.headerBody}>
            <Text style={styles.screenLabel}>DATA</Text>
            <Text style={styles.screenTitle}>Import Data</Text>
          </View>
        </View>

        {/* Upload card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>UPLOAD SALES REPORT</Text>
          <Text style={styles.cardSub}>
            Import weekly or monthly sales from Ginesys or any POS system (Excel .xlsx/.xls or CSV).
          </Text>

          <TouchableOpacity style={styles.pickBtn} onPress={handlePickFile} disabled={parsing}>
            {parsing ? (
              <ActivityIndicator size="small" color={colors.teal} />
            ) : (
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
                  stroke={colors.teal} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            )}
            <Text style={styles.pickBtnText}>{parsing ? 'Processing…' : 'Select Excel / CSV File'}</Text>
          </TouchableOpacity>

          {/* Parse result */}
          {pending && (
            <View style={styles.resultCard}>
              <Text style={styles.resultFilename} numberOfLines={1}>{pending.filename}</Text>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.teal }]}>{pending.rows.length}</Text>
                  <Text style={styles.statLabel}>Rows</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.teal }]}>{pending.matched}</Text>
                  <Text style={styles.statLabel}>Matched</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: pending.unmatched > 0 ? colors.amber : colors.teal }]}>
                    {pending.unmatched}
                  </Text>
                  <Text style={styles.statLabel}>Unmatched</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: matchRate >= 80 ? colors.teal : colors.amber }]}>
                    {matchRate}%
                  </Text>
                  <Text style={styles.statLabel}>Match rate</Text>
                </View>
              </View>

              {pending.unmatched > 0 && (
                <Text style={styles.unmatchedNote}>
                  {pending.unmatched} rows couldn't be matched to existing products. They'll be saved with no product link and can be matched later.
                </Text>
              )}

              {pending.errors.length > 0 && (
                <View style={styles.errorsBox}>
                  <Text style={styles.errorsTitle}>{pending.errors.length} parse warning(s)</Text>
                  {pending.errors.slice(0, 5).map((e, i) => (
                    <Text key={i} style={styles.errorLine}>• {e}</Text>
                  ))}
                  {pending.errors.length > 5 && (
                    <Text style={styles.errorLine}>… and {pending.errors.length - 5} more</Text>
                  )}
                </View>
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.discardBtn} onPress={() => setPending(null)}>
                  <Text style={styles.discardBtnText}>Discard</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={handleSaveImport}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator size="small" color="#000" /> : null}
                  <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Import'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Upload history */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>IMPORT HISTORY</Text>
          {uploads.length === 0 ? (
            <Text style={styles.emptyText}>No imports yet. Upload your first sales report above.</Text>
          ) : (
            uploads.map((u) => {
              const rate = u.row_count && u.row_count > 0
                ? Math.round(((u.matched_count ?? 0) / u.row_count) * 100)
                : 0;
              return (
                <View key={u.id} style={styles.historyRow}>
                  <View style={styles.historyIcon}>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                        stroke={colors.teal} strokeWidth={1.8} strokeLinejoin="round" />
                    </Svg>
                  </View>
                  <View style={styles.historyBody}>
                    <Text style={styles.historyFilename} numberOfLines={1}>{u.filename}</Text>
                    <Text style={styles.historyMeta}>
                      {formatDate(u.created_at)} · {u.row_count ?? 0} rows · {rate}% matched
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: u.status === 'complete' ? `${colors.teal}20` : `${colors.amber}20` }]}>
                    <Text style={[styles.statusBadgeText, { color: u.status === 'complete' ? colors.teal : colors.amber }]}>
                      {u.status}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
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
    paddingBottom: 8,
    gap: 12,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerBody: {},
  screenLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter_800ExtraBold',
  },

  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 16,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  cardSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
    marginBottom: 14,
  },

  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: `${colors.teal}12`,
    borderWidth: 1,
    borderColor: `${colors.teal}30`,
    borderRadius: 12,
    paddingVertical: 14,
  },
  pickBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.teal,
    fontFamily: 'Inter_700Bold',
  },

  resultCard: {
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  resultFilename: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  statsRow: { flexDirection: 'row', gap: 10 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', fontFamily: 'Inter_800ExtraBold' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular' },

  unmatchedNote: {
    fontSize: 12,
    color: colors.amber,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
  },

  errorsBox: {
    backgroundColor: `${colors.red}08`,
    borderWidth: 1,
    borderColor: `${colors.red}20`,
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  errorsTitle: { fontSize: 12, fontWeight: '700', color: colors.red, fontFamily: 'Inter_700Bold' },
  errorLine: { fontSize: 11, color: `${colors.red}cc`, fontFamily: 'Inter_400Regular' },

  actionRow: { flexDirection: 'row', gap: 10 },
  discardBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  discardBtnText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_700Bold' },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: colors.teal,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#000000', fontFamily: 'Inter_700Bold' },

  emptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_400Regular',
    paddingVertical: 12,
    lineHeight: 19,
  },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: `${colors.teal}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyBody: { flex: 1 },
  historyFilename: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  historyMeta: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular', marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold' },
});
