import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { getDeletedPOs, restorePO, permanentDeletePO } from '../../db/database';
import type { PurchaseOrder } from '../../db/types';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

const STATUS_COLOR: Partial<Record<PurchaseOrder['status'], string>> = {
  draft:      'rgba(255,255,255,0.35)',
  confirmed:  '#EF9F27',
  sent:       '#EF9F27',
  dispatched: '#378ADD',
  received:   '#378ADD',
  closed:     '#5DCAA5',
};

export default function DeletedPOsScreen() {
  const router = useRouter();
  const [deletedPOs, setDeletedPOs] = useState<PurchaseOrder[]>([]);

  const load = useCallback(async () => {
    const list = await getDeletedPOs();
    setDeletedPOs(list);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRestore = async (po: PurchaseOrder) => {
    try {
      await restorePO(po.id);
      await load();
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  };

  const handleDeleteForever = (po: PurchaseOrder) => {
    Alert.alert(
      'Delete Permanently',
      `This cannot be undone. Delete ${po.po_number} permanently?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              await permanentDeletePO(po.id);
              await load();
            } catch (e) {
              Alert.alert('Error', String(e));
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Deleted POs</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {deletedPOs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No deleted POs</Text>
          </View>
        ) : (
          deletedPOs.map((po) => {
            const statusColor = STATUS_COLOR[po.status] ?? 'rgba(255,255,255,0.35)';
            return (
              <View key={po.id} style={styles.card}>
                {/* Card header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={styles.poNumber}>{po.po_number}</Text>
                    <Text style={styles.vendorName}>{(po as PurchaseOrder & { vendor_name?: string }).vendor_name ?? po.vendor_id}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: hexToRgba(statusColor, 0.12) }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                    </Text>
                  </View>
                </View>

                {/* Deleted date */}
                <Text style={styles.deletedDate}>
                  Deleted on {formatDate((po as PurchaseOrder & { deleted_at?: string }).deleted_at)}
                </Text>

                {/* Cancellation reason */}
                {po.cancellation_reason ? (
                  <Text style={styles.cancelReason} numberOfLines={2}>
                    Reason: {po.cancellation_reason}
                  </Text>
                ) : null}

                {/* Actions */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.restoreBtn}
                    onPress={() => handleRestore(po)}
                  >
                    <Text style={styles.restoreBtnText}>Restore</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteForeverBtn}
                    onPress={() => handleDeleteForever(po)}
                  >
                    <Text style={styles.deleteForeverText}>Delete Forever</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  content: { paddingBottom: 40, paddingHorizontal: 20 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 14,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', fontFamily: 'Inter_800ExtraBold' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 15, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular' },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardHeaderLeft: { flex: 1, gap: 2 },
  poNumber: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  vendorName: { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter_400Regular' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold' },

  deletedDate: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular' },
  cancelReason: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular', fontStyle: 'italic' },

  cardActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  restoreBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(93,202,165,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(93,202,165,0.25)',
  },
  restoreBtnText: { fontSize: 13, fontWeight: '700', color: colors.teal, fontFamily: 'Inter_700Bold' },
  deleteForeverBtn: { paddingHorizontal: 12, paddingVertical: 7 },
  deleteForeverText: { fontSize: 13, color: colors.red, fontFamily: 'Inter_400Regular' },
});
