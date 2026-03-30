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
import type { GRNRecord, GRNItem, GRNSizeData, PurchaseOrder } from '../../db/types';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

type ItemStatus = GRNItem['status'];

const ITEM_STATUS_CFG: Record<ItemStatus, { label: string; color: string }> = {
  pending:  { label: 'Pending',  color: 'rgba(255,255,255,0.3)' },
  accepted: { label: '✓ Full',   color: '#5DCAA5' },
  short:    { label: 'Partial',  color: '#EF9F27' },
  rejected: { label: 'QC Issue', color: '#EF9F27' },
};

// Local editable state per GRN item
type LocalItem = {
  sizeReceived: Record<string, string>; // sizeLabel → received qty string
  acceptedStr: string;                  // total accepted (defaults to total received)
  notes: string;
  rejectionReason: string;
};

function initLocalItem(item: GRNItem): LocalItem {
  const sizeReceived: Record<string, string> = {};
  if (item.size_data) {
    for (const [lbl, entry] of Object.entries(item.size_data)) {
      sizeReceived[lbl] = entry.received > 0 ? String(entry.received) : '';
    }
  }
  const totalReceived = Object.values(sizeReceived).reduce(
    (s, v) => s + (parseInt(v || '0', 10) || 0), 0,
  );
  return {
    sizeReceived,
    acceptedStr: item.accepted_qty > 0 ? String(item.accepted_qty) : (totalReceived > 0 ? String(totalReceived) : ''),
    notes: item.notes ?? '',
    rejectionReason: item.rejection_reason ?? '',
  };
}

function calcItemTotals(local: LocalItem, orderedQty: number) {
  const totalReceived = Object.values(local.sizeReceived).reduce(
    (s, v) => s + (parseInt(v || '0', 10) || 0), 0,
  );
  const accepted = parseInt(local.acceptedStr || '0', 10) || 0;
  const rejected = Math.max(0, totalReceived - accepted);
  const pending = Math.max(0, orderedQty - totalReceived);
  return { totalReceived, accepted, rejected, pending };
}

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
      await createGRN(poId);
      grnData = await getGRNByPO(poId);
      if (!grnData) return;
    }
    setGrn(grnData);

    setLocalData((prev) => {
      const next: Record<string, LocalItem> = {};
      for (const item of grnData!.items ?? []) {
        next[item.id] = prev[item.id] ?? initLocalItem(item);
      }
      return next;
    });
  }, [poId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Update a specific size received qty, auto-update acceptedStr if it was tracking
  const updateSizeReceived = (itemId: string, sizeLabel: string, rawVal: string, item: GRNItem) => {
    const cleaned = rawVal.replace(/[^0-9]/g, '');
    setLocalData((prev) => {
      const current = prev[itemId];
      if (!current) return prev;

      const oldTotal = Object.values(current.sizeReceived).reduce(
        (s, v) => s + (parseInt(v || '0', 10) || 0), 0,
      );
      const newSizeReceived = { ...current.sizeReceived, [sizeLabel]: cleaned };
      const newTotal = Object.values(newSizeReceived).reduce(
        (s, v) => s + (parseInt(v || '0', 10) || 0), 0,
      );

      // Auto-update accepted if it was equal to (or tracking) old total
      const currentAccepted = parseInt(current.acceptedStr || '0', 10) || 0;
      const newAccepted = currentAccepted >= oldTotal ? newTotal : currentAccepted;

      return {
        ...prev,
        [itemId]: { ...current, sizeReceived: newSizeReceived, acceptedStr: String(newAccepted) },
      };
    });
  };

  const updateLocal = (itemId: string, patch: Partial<LocalItem>) => {
    setLocalData((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
  };

  const persistItem = async (item: GRNItem) => {
    const local = localData[item.id];
    if (!local) return;

    const { totalReceived, accepted, rejected, pending } = calcItemTotals(local, item.ordered_qty);
    const status: ItemStatus = totalReceived === 0 ? 'pending'
      : pending > 0 ? 'short'
      : rejected > 0 ? 'rejected'
      : 'accepted';

    // Build size_data with per-size received; distribute item-level rejection from last sizes first
    const finalSizeData: GRNSizeData = {};
    if (item.size_data) {
      const sizeEntries = Object.entries(item.size_data);
      // First pass: set received per size, default accepted = received
      for (const [lbl, entry] of sizeEntries) {
        const rcvd = parseInt(local.sizeReceived[lbl] || '0', 10) || 0;
        finalSizeData[lbl] = { ordered: entry.ordered, received: rcvd, accepted: rcvd, rejected: 0 };
      }
      // Second pass: distribute rejection from last sizes first
      let remainingRejection = rejected;
      for (let i = sizeEntries.length - 1; i >= 0 && remainingRejection > 0; i--) {
        const lbl = sizeEntries[i][0];
        const entry = finalSizeData[lbl];
        const sizeReject = Math.min(entry.received, remainingRejection);
        finalSizeData[lbl] = { ...entry, accepted: entry.received - sizeReject, rejected: sizeReject };
        remainingRejection -= sizeReject;
      }
    }

    await updateGRNItem(item.id, {
      size_data: Object.keys(finalSizeData).length > 0 ? finalSizeData : undefined,
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

    // Warn if pending quantities remain
    const items = grn.items ?? [];
    const totalPending = items.reduce((s, item) => {
      const local = localData[item.id];
      if (!local) return s;
      const { pending } = calcItemTotals(local, item.ordered_qty);
      return s + pending;
    }, 0);

    if (totalPending > 0) {
      await new Promise<void>((resolve, reject) => {
        Alert.alert(
          'Pending Items Remain',
          `${totalPending} pcs are still pending receipt. Finalize as partial GRN?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => reject(new Error('cancelled')) },
            { text: 'Finalize Partial', style: 'destructive', onPress: () => resolve() },
          ],
        );
      }).catch(() => { return; });
      // If user cancelled, bail
      const recheck = await getGRNByPO(poId!);
      if (!recheck) return;
    }

    setFinalizing(true);
    try {
      await finalizeGRN(grn.id);
      const updated = await getGRNByPO(poId!);
      setGrn(updated);
      const accepted = updated?.total_accepted_qty ?? 0;
      const ordered = updated?.total_ordered_qty ?? 0;
      Alert.alert('GRN Finalized', `${accepted}/${ordered} pcs accepted`, [
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
  const isFinalized = grn.overall_status !== 'pending';

  // Live totals across all items
  const totalOrdered = items.reduce((s, i) => s + i.ordered_qty, 0);
  const liveReceived = items.reduce((s, i) => {
    const local = localData[i.id];
    if (!local) return s;
    return s + Object.values(local.sizeReceived).reduce((ss, v) => ss + (parseInt(v || '0', 10) || 0), 0);
  }, 0);
  const liveAccepted = items.reduce((s, i) => {
    const local = localData[i.id];
    return s + (parseInt(local?.acceptedStr || '0', 10) || 0);
  }, 0);
  const liveRejected = items.reduce((s, i) => {
    const local = localData[i.id];
    if (!local) return s;
    const r = Object.values(local.sizeReceived).reduce((ss, v) => ss + (parseInt(v || '0', 10) || 0), 0);
    const a = parseInt(local.acceptedStr || '0', 10) || 0;
    return s + Math.max(0, r - a);
  }, 0);
  const livePending = Math.max(0, totalOrdered - liveReceived);
  const progressPct = totalOrdered > 0 ? Math.min(100, Math.round((liveReceived / totalOrdered) * 100)) : 0;
  const acceptRate = liveReceived > 0 ? Math.round((liveAccepted / liveReceived) * 100) : 0;
  const acceptRateColor = acceptRate >= 90 ? colors.teal : acceptRate >= 70 ? colors.amber : colors.red;

  // Summary groups
  const fullyReceived = items.filter((i) => {
    const local = localData[i.id];
    if (!local) return false;
    const { pending } = calcItemTotals(local, i.ordered_qty);
    return pending === 0;
  });
  const partialItems = items.filter((i) => {
    const local = localData[i.id];
    if (!local) return false;
    const r = Object.values(local.sizeReceived).reduce((s, v) => s + (parseInt(v || '0', 10) || 0), 0);
    const { pending } = calcItemTotals(local, i.ordered_qty);
    return r > 0 && pending > 0;
  });
  const notReceived = items.filter((i) => {
    const local = localData[i.id];
    if (!local) return true;
    const r = Object.values(local.sizeReceived).reduce((s, v) => s + (parseInt(v || '0', 10) || 0), 0);
    return r === 0;
  });

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
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
          <View style={styles.progressFooter}>
            <Text style={styles.progressPct}>{progressPct}% received</Text>
            {livePending > 0 && (
              <Text style={styles.pendingPill}>{livePending} pending</Text>
            )}
          </View>
        </View>

        {/* Item list */}
        {items.map((item) => {
          const local = localData[item.id] ?? { sizeReceived: {}, acceptedStr: '', notes: '', rejectionReason: '' };
          const { totalReceived: itemReceived, accepted: itemAccepted, rejected: itemRejected, pending: itemPending } = calcItemTotals(local, item.ordered_qty);
          const derivedStatus: ItemStatus = itemReceived === 0 ? 'pending'
            : itemPending > 0 ? 'short'
            : itemRejected > 0 ? 'rejected'
            : 'accepted';
          const statusCfg = ITEM_STATUS_CFG[derivedStatus];
          const hasSizeData = item.size_data && Object.keys(item.size_data).length > 0;
          const latestPhoto = item.photos?.[item.photos.length - 1];
          const hasPhoto = (item.photos ?? []).length > 0;

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
                <View style={[styles.statusPill, { backgroundColor: hexToRgba(statusCfg.color, 0.12) }]}>
                  <Text style={[styles.statusPillText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                </View>
              </View>

              {/* Size table */}
              {hasSizeData ? (
                <View style={styles.sizeTable}>
                  {/* Table header */}
                  <View style={styles.sizeRow}>
                    <Text style={[styles.sizeCell, styles.sizeCellHeader]}>SIZE</Text>
                    <Text style={[styles.ordCell, styles.sizeCellHeader]}>ORD</Text>
                    <Text style={[styles.rcvCell, styles.sizeCellHeader]}>RCVD</Text>
                    <Text style={[styles.pendCell, styles.sizeCellHeader]}>PEND</Text>
                  </View>

                  {/* Data rows */}
                  {Object.entries(item.size_data!).map(([lbl, entry]) => {
                    const rcvd = parseInt(local.sizeReceived[lbl] || '0', 10) || 0;
                    const pend = entry.ordered - rcvd;
                    const pendColor = pend < 0 ? colors.red : pend > 0 ? colors.amber : colors.teal;
                    const pendLabel = pend === 0 ? '✓' : pend < 0 ? `+${Math.abs(pend)}!` : String(pend);
                    return (
                      <View key={lbl} style={styles.sizeRow}>
                        <Text style={[styles.sizeCell, styles.sizeLabelText]}>{lbl}</Text>
                        <Text style={[styles.ordCell, styles.ordText]}>{entry.ordered}</Text>
                        <TextInput
                          style={styles.rcvInput}
                          value={local.sizeReceived[lbl] ?? ''}
                          onChangeText={(v) => updateSizeReceived(item.id, lbl, v, item)}
                          onBlur={() => persistItem(item)}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="rgba(255,255,255,0.15)"
                          editable={!isFinalized}
                          selectTextOnFocus
                        />
                        <View style={styles.pendCell}>
                          <Text style={[styles.pendText, { color: pendColor }]}>{pendLabel}</Text>
                        </View>
                      </View>
                    );
                  })}

                  {/* Total row */}
                  <View style={[styles.sizeRow, styles.sizeRowTotal]}>
                    <Text style={[styles.sizeCell, styles.totalLabelText]}>Total</Text>
                    <Text style={[styles.ordCell, styles.totalValueText]}>{item.ordered_qty}</Text>
                    <Text style={[styles.rcvCell, styles.totalValueText]}>{itemReceived}</Text>
                    <Text style={[styles.pendCell, styles.totalValueText, { color: itemPending > 0 ? colors.amber : colors.teal }]}>
                      {itemPending}
                    </Text>
                  </View>
                </View>
              ) : (
                /* Fallback for items without size data */
                <View style={styles.noSizeFallback}>
                  <Text style={styles.noSizeLabel}>Ordered: {item.ordered_qty} pcs · Received: {itemReceived}</Text>
                </View>
              )}

              {/* Accepted + Rejected row */}
              <View style={styles.acceptRow}>
                <View style={styles.acceptField}>
                  <Text style={styles.acceptLabel}>Accepted</Text>
                  <TextInput
                    style={styles.acceptInput}
                    value={local.acceptedStr}
                    onChangeText={(v) => updateLocal(item.id, { acceptedStr: v.replace(/[^0-9]/g, '') })}
                    onBlur={() => persistItem(item)}
                    keyboardType="numeric"
                    placeholder={String(itemReceived)}
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    editable={!isFinalized}
                    selectTextOnFocus
                  />
                </View>
                {itemRejected > 0 && (
                  <View style={styles.rejectedBadge}>
                    <Text style={styles.rejectedBadgeText}>{itemRejected} rejected</Text>
                  </View>
                )}
              </View>

              {/* Rejection reason */}
              {itemRejected > 0 && !isFinalized && (
                <TextInput
                  style={styles.rejectionInput}
                  value={local.rejectionReason}
                  onChangeText={(v) => updateLocal(item.id, { rejectionReason: v })}
                  onBlur={() => persistItem(item)}
                  placeholder="Rejection reason…"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                />
              )}
              {itemRejected > 0 && local.rejectionReason !== '' && (
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
                    <Text style={styles.takePhotoBtnText}>{hasPhoto ? 'Add photo' : 'Take photo'}</Text>
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

        {/* Summary card */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionLabel}>SUMMARY</Text>

          <View style={styles.summaryGrid}>
            <SummaryStat label="Ordered" value={totalOrdered} color="rgba(255,255,255,0.5)" />
            <SummaryStat label="Received" value={liveReceived} color={colors.blue} />
            <SummaryStat label="Accepted" value={liveAccepted} color={colors.teal} />
            {liveRejected > 0 && (
              <SummaryStat label="Rejected" value={liveRejected} color={colors.red} />
            )}
            {livePending > 0 && (
              <SummaryStat label="Pending" value={livePending} color={colors.amber} />
            )}
          </View>

          {liveReceived > 0 && (
            <View style={styles.acceptRateRow}>
              <Text style={styles.acceptRateLabel}>Accept Rate</Text>
              <Text style={[styles.acceptRateValue, { color: acceptRateColor }]}>{acceptRate}%</Text>
            </View>
          )}

          {/* Receipt groups */}
          {(fullyReceived.length > 0 || partialItems.length > 0 || notReceived.length > 0) && (
            <View style={styles.groupsRow}>
              {fullyReceived.length > 0 && (
                <View style={[styles.groupBadge, { backgroundColor: hexToRgba(colors.teal, 0.1) }]}>
                  <Text style={[styles.groupBadgeText, { color: colors.teal }]}>
                    {fullyReceived.length} full
                  </Text>
                </View>
              )}
              {partialItems.length > 0 && (
                <View style={[styles.groupBadge, { backgroundColor: hexToRgba(colors.amber, 0.1) }]}>
                  <Text style={[styles.groupBadgeText, { color: colors.amber }]}>
                    {partialItems.length} partial
                  </Text>
                </View>
              )}
              {notReceived.length > 0 && (
                <View style={[styles.groupBadge, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                  <Text style={[styles.groupBadgeText, { color: 'rgba(255,255,255,0.4)' }]}>
                    {notReceived.length} pending
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Finalize / Finalized */}
        {!isFinalized ? (() => {
          const isPartial = livePending > 0;
          const itemsWithPending = items.filter((i) => {
            const local = localData[i.id];
            if (!local) return false;
            return calcItemTotals(local, i.ordered_qty).pending > 0;
          }).length;
          return (
            <View style={styles.finalizeWrapper}>
              <TouchableOpacity
                style={[
                  styles.finalizeBtn,
                  isPartial ? styles.finalizeBtnAmber : styles.finalizeBtnBlue,
                  finalizing && styles.finalizeBtnDisabled,
                ]}
                onPress={handleFinalize}
                disabled={finalizing}
              >
                <Text style={[styles.finalizeBtnText, { color: isPartial ? colors.amber : colors.blue }]}>
                  {finalizing ? 'Finalizing…' : isPartial ? 'Finalize Partial GRN' : 'Finalize GRN'}
                </Text>
              </TouchableOpacity>
              {isPartial && !finalizing && (
                <Text style={styles.finalizeWarning}>
                  {livePending} pcs still pending across {itemsWithPending} {itemsWithPending === 1 ? 'item' : 'items'}
                </Text>
              )}
            </View>
          );
        })() : (
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
  progressTrack: { height: 6, backgroundColor: 'rgba(55,138,221,0.1)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.blue, borderRadius: 3 },
  progressFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  progressPct: { fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_400Regular' },
  pendingPill: { fontSize: 11, fontWeight: '700', color: colors.amber, fontFamily: 'Inter_700Bold' },

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
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemThumb: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  itemInitial: { fontSize: 16, fontWeight: '900', fontFamily: 'Inter_900Black' },
  itemHeaderBody: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  itemSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular', marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPillText: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold' },

  // Size table
  sizeTable: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  sizeRowTotal: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderBottomWidth: 0,
  },
  sizeCell: { width: 32, marginRight: 4 },
  ordCell: { flex: 1, textAlign: 'center' },
  rcvCell: { width: 56, textAlign: 'center' },
  pendCell: { width: 44, alignItems: 'flex-end' },
  sizeCellHeader: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
  },
  sizeLabelText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  ordText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular', textAlign: 'center' },
  rcvInput: {
    width: 56,
    height: 34,
    backgroundColor: 'rgba(55,138,221,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(55,138,221,0.2)',
    borderRadius: 7,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    padding: 0,
  },
  pendText: { fontSize: 13, fontWeight: '700', fontFamily: 'Inter_700Bold', textAlign: 'right' },
  totalLabelText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_700Bold' },
  totalValueText: { fontSize: 13, fontWeight: '800', fontFamily: 'Inter_800ExtraBold', textAlign: 'center' },

  noSizeFallback: { paddingVertical: 4 },
  noSizeLabel: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },

  // Accepted / Rejected row
  acceptRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  acceptField: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  acceptLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },
  acceptInput: {
    width: 70,
    height: 36,
    backgroundColor: 'rgba(93,202,165,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(93,202,165,0.2)',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: '700',
    color: colors.teal,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    padding: 0,
  },
  rejectedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(226,75,74,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(226,75,74,0.25)',
    borderRadius: 6,
  },
  rejectedBadgeText: { fontSize: 12, fontWeight: '700', color: colors.red, fontFamily: 'Inter_700Bold' },

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
  photoThumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)' },
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
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
  },
  summaryGrid: { flexDirection: 'row', gap: 20, flexWrap: 'wrap', marginBottom: 10 },
  summaryStat: { alignItems: 'center', gap: 2 },
  summaryStatValue: { fontSize: 22, fontWeight: '800', fontFamily: 'Inter_800ExtraBold' },
  summaryStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular' },
  acceptRateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  acceptRateLabel: { fontSize: 13, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular' },
  acceptRateValue: { fontSize: 18, fontWeight: '800', fontFamily: 'Inter_800ExtraBold' },
  groupsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  groupBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  groupBadgeText: { fontSize: 12, fontWeight: '700', fontFamily: 'Inter_700Bold' },

  finalizeWrapper: { marginHorizontal: 20, gap: 8 },
  finalizeBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  finalizeBtnBlue: {
    backgroundColor: 'rgba(55,138,221,0.12)',
    borderColor: 'rgba(55,138,221,0.3)',
  },
  finalizeBtnAmber: {
    backgroundColor: 'rgba(239,159,39,0.12)',
    borderColor: 'rgba(239,159,39,0.3)',
  },
  finalizeBtnDisabled: { opacity: 0.5 },
  finalizeBtnText: { fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  finalizeWarning: {
    fontSize: 12,
    color: colors.amber,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
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
