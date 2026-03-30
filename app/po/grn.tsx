import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import {
  getGRNByPO, createGRN, updateGRNItem, finalizeGRN, addGRNPhoto, getPOById,
} from '../../db/database';
import type { GRNRecord, GRNItem, PurchaseOrder } from '../../db/types';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

type ItemStatus = GRNItem['status'];

function getItemStatus(item: GRNItem): ItemStatus {
  if (item.received_qty === 0) return 'pending';
  if (item.rejected_qty > 0) return 'rejected';
  if (item.received_qty < item.ordered_qty) return 'short';
  return 'accepted';
}

const ITEM_STATUS_CFG: Record<ItemStatus, { label: string; color: string }> = {
  pending:  { label: 'Pending',  color: 'rgba(255,255,255,0.3)' },
  accepted: { label: '✓ Full',   color: '#5DCAA5' },
  short:    { label: 'Short',    color: '#EF9F27' },
  rejected: { label: 'QC Fail',  color: '#E24B4A' },
};

// Local editable state for each item
type LocalItem = {
  receivedStr: string;
  acceptedStr: string;
  notes: string;
  rejectionReason: string;
};

export default function GRNScreen() {
  const router = useRouter();
  const { poId } = useLocalSearchParams<{ poId: string }>();

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [grn, setGrn] = useState<GRNRecord | null>(null);
  const [localData, setLocalData] = useState<Record<string, LocalItem>>({});
  const [finalizing, setFinalizing] = useState(false);

  const load = useCallback(async () => {
    if (!poId) return;
    const poData = await getPOById(poId);
    setPo(poData);

    let grnData = await getGRNByPO(poId);
    if (!grnData) {
      const grnId = await createGRN(poId);
      grnData = await getGRNByPO(poId);
      if (!grnData) return;
    }
    setGrn(grnData);

    // Initialize local state from DB (first load only — preserve user edits after that)
    setLocalData((prev) => {
      const next: Record<string, LocalItem> = {};
      for (const item of grnData!.items ?? []) {
        if (prev[item.id]) {
          next[item.id] = prev[item.id]; // preserve edits
        } else {
          next[item.id] = {
            receivedStr: item.received_qty > 0 ? String(item.received_qty) : '',
            acceptedStr: item.accepted_qty > 0 ? String(item.accepted_qty) : '',
            notes: item.notes ?? '',
            rejectionReason: item.rejection_reason ?? '',
          };
        }
      }
      return next;
    });
  }, [poId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const updateLocal = (itemId: string, patch: Partial<LocalItem>) => {
    setLocalData((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
  };

  const persistItem = async (item: GRNItem) => {
    const local = localData[item.id];
    if (!local) return;
    const received = parseInt(local.receivedStr || '0', 10) || 0;
    const accepted = parseInt(local.acceptedStr || '0', 10) || 0;
    const rejected = Math.max(0, received - accepted);
    const status = received === 0 ? 'pending'
      : rejected > 0 ? 'rejected'
      : received < item.ordered_qty ? 'short'
      : 'accepted';
    await updateGRNItem(item.id, {
      received_qty: received,
      accepted_qty: accepted,
      rejected_qty: rejected,
      notes: local.notes || undefined,
      rejection_reason: local.rejectionReason || undefined,
      status,
    });
  };

  const handleTakePhoto = async (item: GRNItem) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (lib.status !== 'granted') {
        Alert.alert('Permission needed', 'Camera or gallery access required');
        return;
      }
    }

    Alert.alert('GRN Photo', 'Capture received goods', [
      {
        text: 'Camera',
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8 });
          if (!result.canceled && result.assets[0]) {
            await addGRNPhoto(item.id, result.assets[0].uri, 'received');
            await load();
          }
        },
      },
      {
        text: 'Gallery',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
          if (!result.canceled && result.assets[0]) {
            await addGRNPhoto(item.id, result.assets[0].uri, 'received');
            await load();
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleFinalize = async () => {
    if (!grn) return;
    // Persist all items first
    for (const item of grn.items ?? []) {
      await persistItem(item);
    }
    setFinalizing(true);
    try {
      await finalizeGRN(grn.id);
      const updated = await getGRNByPO(poId!);
      setGrn(updated);
      const accepted = updated?.total_accepted_qty ?? 0;
      const ordered = updated?.total_ordered_qty ?? 0;
      Alert.alert('GRN Finalized', `${accepted}/${ordered} items accepted`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setFinalizing(false);
    }
  };

  if (!grn) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Preparing GRN…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const items = grn.items ?? [];
  const totalOrdered = items.reduce((s, i) => s + i.ordered_qty, 0);

  // Live totals from local state
  const liveReceived = items.reduce((s, i) => s + (parseInt(localData[i.id]?.receivedStr || '0', 10) || 0), 0);
  const liveAccepted = items.reduce((s, i) => s + (parseInt(localData[i.id]?.acceptedStr || '0', 10) || 0), 0);
  const liveRejected = items.reduce((s, i) => {
    const r = parseInt(localData[i.id]?.receivedStr || '0', 10) || 0;
    const a = parseInt(localData[i.id]?.acceptedStr || '0', 10) || 0;
    return s + Math.max(0, r - a);
  }, 0);
  const acceptRate = liveReceived > 0 ? Math.round((liveAccepted / liveReceived) * 100) : 0;
  const progressPct = totalOrdered > 0 ? Math.min(100, Math.round((liveReceived / totalOrdered) * 100)) : 0;

  const acceptRateColor = acceptRate >= 90 ? colors.teal : acceptRate >= 70 ? colors.amber : colors.red;
  const isFinalized = grn.overall_status !== 'pending';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>

      {/* Sticky summary footer lives outside ScrollView */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M5 12l7-7M5 12l7 7" stroke={colors.blue} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <View style={styles.headerBody}>
            <Text style={styles.headerTitle}>Goods Receipt</Text>
            <View style={[styles.grnBadge, { backgroundColor: hexToRgba(colors.blue, 0.12) }]}>
              <Text style={[styles.grnBadgeText, { color: colors.blue }]}>{grn.grn_number}</Text>
            </View>
          </View>
        </View>

        {/* PO reference */}
        <View style={styles.poRef}>
          <Text style={styles.poRefText}>
            {po?.po_number ?? poId} · {po?.vendor_name ?? ''}
          </Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Received / Ordered</Text>
            <Text style={styles.progressValue}>{liveReceived} / {totalOrdered} pcs</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` as `${number}%` }]} />
          </View>
          <Text style={styles.progressPct}>{progressPct}% received</Text>
        </View>

        {/* Item list */}
        {items.map((item) => {
          const local = localData[item.id] ?? { receivedStr: '', acceptedStr: '', notes: '', rejectionReason: '' };
          const received = parseInt(local.receivedStr || '0', 10) || 0;
          const accepted = parseInt(local.acceptedStr || '0', 10) || 0;
          const rejected = Math.max(0, received - accepted);
          const derivedStatus = received === 0 ? 'pending'
            : rejected > 0 ? 'rejected'
            : received < item.ordered_qty ? 'short'
            : 'accepted';
          const statusCfg = ITEM_STATUS_CFG[derivedStatus];
          const hasPhoto = (item.photos ?? []).length > 0;
          const latestPhoto = item.photos?.[item.photos.length - 1];

          return (
            <View key={item.id} style={styles.itemCard}>
              {/* Item header */}
              <View style={styles.itemHeader}>
                <View style={[styles.itemThumb, { backgroundColor: hexToRgba(colors.teal, 0.1) }]}>
                  <Text style={[styles.itemInitial, { color: colors.teal }]}>
                    {(item.design_name ?? 'U')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.itemHeaderBody}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.design_name ?? 'Unknown product'}
                  </Text>
                  <Text style={styles.itemSub}>{item.garment_type ?? ''}</Text>
                </View>
                <View style={styles.itemRight}>
                  <View style={[styles.orderedBadge, { backgroundColor: hexToRgba(colors.amber, 0.12) }]}>
                    <Text style={[styles.orderedBadgeText, { color: colors.amber }]}>
                      Ordered: {item.ordered_qty}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: hexToRgba(statusCfg.color, 0.12) }]}>
                    <Text style={[styles.statusPillText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                  </View>
                </View>
              </View>

              {/* Qty inputs */}
              <View style={styles.qtyRow}>
                <View style={styles.qtyField}>
                  <Text style={styles.qtyLabel}>Received</Text>
                  <TextInput
                    style={styles.qtyInput}
                    value={local.receivedStr}
                    onChangeText={(v) => {
                      const cleaned = v.replace(/[^0-9]/g, '');
                      updateLocal(item.id, { receivedStr: cleaned });
                    }}
                    onBlur={() => persistItem(item)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    editable={!isFinalized}
                  />
                </View>
                <View style={styles.qtyField}>
                  <Text style={styles.qtyLabel}>Accepted</Text>
                  <TextInput
                    style={styles.qtyInput}
                    value={local.acceptedStr}
                    onChangeText={(v) => {
                      const cleaned = v.replace(/[^0-9]/g, '');
                      updateLocal(item.id, { acceptedStr: cleaned });
                    }}
                    onBlur={() => persistItem(item)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    editable={!isFinalized}
                  />
                </View>
                <View style={styles.qtyField}>
                  <Text style={styles.qtyLabel}>Rejected</Text>
                  <View style={[styles.rejectedDisplay, rejected > 0 && styles.rejectedDisplayRed]}>
                    <Text style={[styles.rejectedText, rejected > 0 && styles.rejectedTextRed]}>
                      {rejected}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Rejection reason */}
              {rejected > 0 && !isFinalized && (
                <TextInput
                  style={styles.rejectionInput}
                  value={local.rejectionReason}
                  onChangeText={(v) => updateLocal(item.id, { rejectionReason: v })}
                  onBlur={() => persistItem(item)}
                  placeholder="Rejection reason…"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                />
              )}
              {rejected > 0 && local.rejectionReason !== '' && (
                <Text style={styles.rejectionReasonDisplay}>↳ {local.rejectionReason}</Text>
              )}

              {/* Photo row */}
              <View style={styles.photoRow}>
                {latestPhoto && (
                  <Image source={{ uri: latestPhoto.photo_uri }} style={styles.photoThumb} resizeMode="cover" />
                )}
                {!isFinalized && (
                  <TouchableOpacity style={styles.takePhotoBtn} onPress={() => handleTakePhoto(item)}>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
                        stroke={colors.blue} strokeWidth={1.8} strokeLinejoin="round" />
                      <Path d="M12 17a4 4 0 100-8 4 4 0 000 8z" stroke={colors.blue} strokeWidth={1.8} />
                    </Svg>
                    <Text style={styles.takePhotoBtnText}>
                      {hasPhoto ? 'Add photo' : 'Take photo'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Item notes */}
              {!isFinalized && (
                <TextInput
                  style={styles.notesInput}
                  value={local.notes}
                  onChangeText={(v) => updateLocal(item.id, { notes: v })}
                  onBlur={() => persistItem(item)}
                  placeholder="Item notes…"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                />
              )}
            </View>
          );
        })}

        {/* Summary */}
        <View style={[styles.summaryCard]}>
          <Text style={styles.sectionLabel}>SUMMARY</Text>
          <View style={styles.summaryGrid}>
            <SummaryStat label="Ordered" value={totalOrdered} color="rgba(255,255,255,0.5)" />
            <SummaryStat label="Received" value={liveReceived} color={colors.blue} />
            <SummaryStat label="Accepted" value={liveAccepted} color={colors.teal} />
            {liveRejected > 0 && (
              <SummaryStat label="Rejected" value={liveRejected} color={colors.red} />
            )}
          </View>
          {liveReceived > 0 && (
            <View style={styles.acceptRateRow}>
              <Text style={styles.acceptRateLabel}>Accept Rate</Text>
              <Text style={[styles.acceptRateValue, { color: acceptRateColor }]}>{acceptRate}%</Text>
            </View>
          )}
        </View>

        {/* Finalize button */}
        {!isFinalized ? (
          <TouchableOpacity
            style={[styles.finalizeBtn, finalizing && styles.finalizeBtnDisabled]}
            onPress={handleFinalize}
            disabled={finalizing}
          >
            <Text style={styles.finalizeBtnText}>{finalizing ? 'Finalizing…' : 'Finalize GRN'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.finalizedBanner}>
            <Text style={styles.finalizedText}>
              GRN {grn.overall_status.toUpperCase()} — {grn.total_accepted_qty}/{grn.total_ordered_qty} accepted
            </Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={[styles.summaryStatValue, { color }]}>{value}</Text>
      <Text style={styles.summaryStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  content: { paddingBottom: 60 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 14,
  },
  backBtn: { padding: 4 },
  headerBody: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', fontFamily: 'Inter_800ExtraBold' },
  grnBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  grnBadgeText: { fontSize: 10, fontWeight: '700', fontFamily: 'Inter_700Bold' },

  poRef: { paddingHorizontal: 20, marginBottom: 12 },
  poRefText: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular' },

  progressCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(55,138,221,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(55,138,221,0.1)',
    borderRadius: 14,
    padding: 14,
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular' },
  progressValue: { fontSize: 12, fontWeight: '700', color: colors.blue, fontFamily: 'Inter_700Bold' },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(55,138,221,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: colors.blue, borderRadius: 3 },
  progressPct: { fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_400Regular', marginTop: 6, textAlign: 'right' },

  itemCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  itemThumb: { width: 44, height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  itemInitial: { fontSize: 18, fontWeight: '900', fontFamily: 'Inter_900Black' },
  itemHeaderBody: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  itemSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular', marginTop: 2 },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  orderedBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  orderedBadgeText: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPillText: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold' },

  qtyRow: { flexDirection: 'row', gap: 10 },
  qtyField: { flex: 1, alignItems: 'center', gap: 4 },
  qtyLabel: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular' },
  qtyInput: {
    width: '100%',
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    padding: 0,
  },
  rejectedDisplay: {
    width: '100%',
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectedDisplayRed: { backgroundColor: 'rgba(226,75,74,0.08)', borderColor: 'rgba(226,75,74,0.25)' },
  rejectedText: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_700Bold' },
  rejectedTextRed: { color: colors.red },

  rejectionInput: {
    backgroundColor: 'rgba(226,75,74,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(226,75,74,0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
  },
  rejectionReasonDisplay: {
    fontSize: 12,
    color: colors.red,
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: 4,
  },

  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  photoThumb: { width: 60, height: 60, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)' },
  takePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(55,138,221,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(55,138,221,0.2)',
    borderRadius: 8,
  },
  takePhotoBtnText: { fontSize: 12, fontWeight: '700', color: colors.blue, fontFamily: 'Inter_700Bold' },

  notesInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_400Regular',
  },

  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    marginTop: 4,
    backgroundColor: 'rgba(93,202,165,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(93,202,165,0.12)',
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
    marginBottom: 12,
  },
  summaryGrid: { flexDirection: 'row', gap: 20, marginBottom: 10 },
  summaryStat: { alignItems: 'center', gap: 2 },
  summaryStatValue: { fontSize: 22, fontWeight: '800', fontFamily: 'Inter_800ExtraBold' },
  summaryStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular' },
  acceptRateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  acceptRateLabel: { fontSize: 13, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular' },
  acceptRateValue: { fontSize: 18, fontWeight: '800', fontFamily: 'Inter_800ExtraBold' },

  finalizeBtn: {
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(55,138,221,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(55,138,221,0.3)',
    alignItems: 'center',
  },
  finalizeBtnDisabled: { opacity: 0.5 },
  finalizeBtnText: { fontSize: 16, fontWeight: '700', color: colors.blue, fontFamily: 'Inter_700Bold' },
  finalizedBanner: {
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(93,202,165,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(93,202,165,0.2)',
    alignItems: 'center',
  },
  finalizedText: { fontSize: 14, fontWeight: '700', color: colors.teal, fontFamily: 'Inter_700Bold' },
});
