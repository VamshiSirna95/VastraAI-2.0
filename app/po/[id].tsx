import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { getPOById, updatePO } from '../../db/database';
import type { PurchaseOrder, POItem } from '../../db/types';
import { DeliveryCard } from '../../components/DeliveryCard';
import { calculateDelivery, type DeliverySchedule } from '../../services/delivery';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatINR(val: number): string {
  return '₹' + val.toLocaleString('en-IN');
}

type POStatus = PurchaseOrder['status'];

const STATUS_CONFIG: Record<POStatus, { label: string; color: string }> = {
  draft:      { label: 'Draft',      color: '#EF9F27' },
  sent:       { label: 'Sent',       color: '#378ADD' },
  confirmed:  { label: 'Confirmed',  color: '#7F77DD' },
  dispatched: { label: 'Dispatched', color: '#AFA9EC' },
  received:   { label: 'Received',   color: '#5DCAA5' },
  closed:     { label: 'Closed',     color: 'rgba(255,255,255,0.3)' },
};

const STATUS_TRANSITIONS: Partial<Record<POStatus, POStatus>> = {
  draft: 'sent',
  sent: 'confirmed',
  confirmed: 'dispatched',
  dispatched: 'received',
  received: 'closed',
};

export default function PODetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [deliverySchedule, setDeliverySchedule] = useState<DeliverySchedule | null>(null);

  useEffect(() => {
    if (id) load();
  }, [id]);

  const load = async () => {
    const data = await getPOById(id);
    setPo(data);
    // Compute delivery urgency based on default stock levels
    const s = await calculateDelivery(0, 1);
    setDeliverySchedule(s);
  };

  const handleAdvanceStatus = async () => {
    if (!po) return;
    const next = STATUS_TRANSITIONS[po.status];
    if (!next) return;
    await updatePO(po.id, { status: next });
    await load();
  };

  if (!po) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusCfg = STATUS_CONFIG[po.status];
  const isEditable = po.status === 'draft';
  const nextStatus = STATUS_TRANSITIONS[po.status];
  const nextCfg = nextStatus ? STATUS_CONFIG[nextStatus] : null;

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
          <View style={styles.headerBody}>
            <Text style={styles.headerTitle}>{po.po_number}</Text>
            <View style={[styles.statusBadge, { backgroundColor: hexToRgba(statusCfg.color, 0.12) }]}>
              <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>
          </View>
        </View>

        {/* PO Info */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionLabel}>PO INFO</Text>
          <InfoRow label="Vendor" value={po.vendor_name ?? po.vendor_id} />
          <InfoRow label="Created" value={new Date(po.created_at).toLocaleDateString('en-IN')} />
          {po.delivery_date && <InfoRow label="Delivery Date" value={po.delivery_date} />}
          {po.dispatch_date && <InfoRow label="Dispatch Date" value={po.dispatch_date} />}
          {po.store_arrival_date && <InfoRow label="Store Arrival" value={po.store_arrival_date} />}
          {po.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{po.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Delivery Card */}
        {deliverySchedule && (
          <View style={styles.deliverySection}>
            <DeliveryCard schedule={deliverySchedule} />
          </View>
        )}

        {/* Items */}
        <View style={styles.glassCard}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>ARTICLES</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{po.items?.length ?? 0}</Text>
            </View>
          </View>
          {po.items?.map((item) => {
            const name = (item as POItem & { design_name?: string }).design_name ?? 'Unknown product';
            const garmentType = (item as POItem & { garment_type?: string }).garment_type ?? '';
            return (
              <View key={item.id} style={styles.itemRow}>
                <View style={[styles.itemThumb, { backgroundColor: hexToRgba(colors.teal, 0.1) }]}>
                  <Text style={[styles.itemInitial, { color: colors.teal }]}>
                    {name[0]?.toUpperCase() ?? '?'}
                  </Text>
                </View>
                <View style={styles.itemBody}>
                  <Text style={styles.itemName} numberOfLines={1}>{name}</Text>
                  <Text style={styles.itemSub}>{garmentType}</Text>
                  <Text style={styles.itemQty}>{item.total_qty} pcs @ {formatINR(item.unit_price)}</Text>
                </View>
                <Text style={styles.itemTotal}>{formatINR(item.total_price)}</Text>
              </View>
            );
          })}
        </View>

        {/* Summary */}
        <View style={[styles.glassCard, styles.summaryCard]}>
          <Text style={styles.sectionLabel}>SUMMARY</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Quantity</Text>
            <Text style={styles.summaryValue}>{po.total_qty} pcs</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Value</Text>
            <Text style={[styles.summaryValue, { color: colors.teal }]}>{formatINR(po.total_value)}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionBtns}>
          {isEditable && (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => router.push(`/po/new?editId=${po.id}`)}
            >
              <Text style={styles.editBtnText}>Edit PO</Text>
            </TouchableOpacity>
          )}
          {nextCfg && nextStatus && (
            <TouchableOpacity
              style={[styles.advanceBtn, { backgroundColor: hexToRgba(nextCfg.color, 0.15), borderColor: hexToRgba(nextCfg.color, 0.3) }]}
              onPress={handleAdvanceStatus}
            >
              <Text style={[styles.advanceBtnText, { color: nextCfg.color }]}>
                Mark as {nextCfg.label}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
    paddingBottom: 16,
    gap: 14,
  },
  backBtn: { padding: 4 },
  headerBody: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter_800ExtraBold',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },

  glassCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 16,
  },
  summaryCard: {
    backgroundColor: 'rgba(93,202,165,0.04)',
    borderColor: 'rgba(93,202,165,0.12)',
  },
  deliverySection: {
    marginHorizontal: 20,
    marginBottom: 16,
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
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  countBadge: {
    backgroundColor: 'rgba(93,202,165,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.teal,
    fontFamily: 'Inter_700Bold',
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter_500Medium',
  },
  notesBox: {
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    padding: 10,
  },
  notesText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter_400Regular',
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  itemThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInitial: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'Inter_900Black',
  },
  itemBody: { flex: 1 },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  itemSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
  },
  itemQty: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.teal,
    fontFamily: 'Inter_800ExtraBold',
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },

  actionBtns: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  editBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  editBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_700Bold',
  },
  advanceBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  advanceBtnText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
});
