import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { colors } from '../../constants/theme';
import {
  getPOById, updatePO, getLRByPO, getGRNByPO, getGRNsByPO, createGRN, getGRNPendingTotal,
  getPOPendingQty, updateGRNItem, softDeletePO, getVendorById,
  getVoiceNotes, createVoiceNote, deleteVoiceNote,
  addCommunication,
} from '../../db/database';
import type { PurchaseOrder, POItem, LorryReceipt, GRNRecord, Vendor, VoiceNote } from '../../db/types';
import VoiceNoteRecorder from '../../components/VoiceNoteRecorder';
import VoiceNotePlayer from '../../components/VoiceNotePlayer';
import { DeliveryCard } from '../../components/DeliveryCard';
import { calculateDelivery, type DeliverySchedule } from '../../services/delivery';
import { generatePODocument } from '../../services/poDocument';

const CANCEL_REASONS = [
  'Vendor unable to deliver',
  'Quality issues',
  'No longer needed',
  'Other',
] as const;
type CancelReason = typeof CANCEL_REASONS[number];

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
  draft:      { label: 'Draft',      color: 'rgba(255,255,255,0.4)' },
  confirmed:  { label: 'Confirmed',  color: '#EF9F27' },
  sent:       { label: 'Sent',       color: '#EF9F27' },
  dispatched: { label: 'Dispatched', color: '#378ADD' },
  received:   { label: 'Received',   color: '#378ADD' },
  closed:     { label: 'Closed',     color: '#5DCAA5' },
};

// Correct lifecycle order per spec
const STATUS_TRANSITIONS: Partial<Record<POStatus, POStatus>> = {
  draft:      'confirmed',
  confirmed:  'sent',
  sent:       'dispatched',
  dispatched: 'received',
  received:   'closed',
};

const NEXT_LABEL: Partial<Record<POStatus, string>> = {
  draft:      'Confirm PO',
  confirmed:  'Mark as Sent',
  sent:       'Mark as Dispatched',
  dispatched: 'Mark as Received',
  received:   'Mark as Closed',
};

export default function PODetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [lr, setLr] = useState<LorryReceipt | null>(null);
  const [grn, setGrn] = useState<GRNRecord | null>(null);
  const [allGrns, setAllGrns] = useState<GRNRecord[]>([]);
  const [grnPendingItems, setGrnPendingItems] = useState(0);
  const [deliverySchedule, setDeliverySchedule] = useState<DeliverySchedule | null>(null);
  const [grnPending, setGrnPending] = useState<{ totalOrdered: number; totalReceived: number; totalPending: number; allReceived: boolean } | null>(null);
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [showRecorder, setShowRecorder] = useState(false);

  // Cancel remaining modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState<CancelReason>('Vendor unable to deliver');
  const [cancelCustomReason, setCancelCustomReason] = useState('');
  const [cancelNotes, setCancelNotes] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [data, lrData, grnData, allGrnData, sched] = await Promise.all([
      getPOById(id),
      getLRByPO(id),
      getGRNByPO(id),
      getGRNsByPO(id),
      calculateDelivery(0, 1),
    ]);
    setPo(data);
    setLr(lrData);
    setGrn(grnData);
    setAllGrns(allGrnData);
    setDeliverySchedule(sched);
    if (data?.vendor_id) {
      const v = await getVendorById(data.vendor_id);
      setVendor(v);
    }
    if (data?.status === 'received' && grnData) {
      const pending = await getGRNPendingTotal(id);
      setGrnPending(pending);
    } else {
      setGrnPending(null);
    }
    if (id) {
      const pendingQtyData = await getPOPendingQty(id);
      setGrnPendingItems(pendingQtyData.filter((i) => i.pendingQty > 0).length);
      const notes = await getVoiceNotes(id);
      setVoiceNotes(notes);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!po) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isPartialClose = po.status === 'closed' && (po.cancelled_qty ?? 0) > 0;
  const statusCfg = isPartialClose
    ? { label: 'Closed (Partial)', color: '#EF9F27' }
    : STATUS_CONFIG[po.status];
  const isEditable = po.status === 'draft';
  const nextStatus = STATUS_TRANSITIONS[po.status];
  const nextCfg = nextStatus ? STATUS_CONFIG[nextStatus] : null;
  const nextLabel = NEXT_LABEL[po.status];

  // ── Gate checks ──────────────────────────────────────────────────────────────
  const hasArticlesWithQtyAndPrice = (po.items ?? []).some(
    (i) => i.total_qty > 0 && i.unit_price > 0
  );

  type GateResult = { allowed: boolean; reason?: string; actionLabel?: string; actionPath?: string; pendingClose?: boolean };

  function getGate(): GateResult {
    switch (po!.status) {
      case 'draft':
        return hasArticlesWithQtyAndPrice
          ? { allowed: true }
          : { allowed: false, reason: 'Add at least one article with qty and price' };
      case 'sent':
        return lr
          ? { allowed: true }
          : { allowed: false, reason: 'Upload Lorry Receipt first', actionLabel: 'Upload LR →', actionPath: `/po/lr-upload?poId=${id}` };
      case 'received': {
        if (!grn || grn.overall_status === 'pending') {
          return { allowed: false, reason: 'Complete GRN verification first', actionLabel: grn ? 'Open GRN →' : 'Start GRN →', actionPath: `/po/grn?poId=${id}` };
        }
        if (grnPending && !grnPending.allReceived) {
          return { allowed: false, reason: `${grnPending.totalPending} pcs still pending receipt`, pendingClose: true };
        }
        return { allowed: true };
      }
      default:
        return { allowed: true };
    }
  }

  const gate = getGate();

  const handleCancelRemaining = async () => {
    if (!po || !grn) return;
    if (cancelReason === 'Other' && cancelCustomReason.trim().length < 10) {
      Alert.alert('Reason required', 'Please enter at least 10 characters for the custom reason.');
      return;
    }
    setCancelling(true);
    try {
      const reasonText = cancelReason === 'Other'
        ? `Other: ${cancelCustomReason.trim()}`
        : cancelReason;
      const fullReason = cancelNotes.trim()
        ? `${reasonText}. Notes: ${cancelNotes.trim()}`
        : reasonText;

      // Zero out all pending size quantities in GRN items
      for (const item of grn.items ?? []) {
        if (item.size_data) {
          const updatedSizeData = { ...item.size_data };
          for (const lbl of Object.keys(updatedSizeData)) {
            const entry = updatedSizeData[lbl];
            if (entry.received < entry.ordered) {
              updatedSizeData[lbl] = { ...entry, received: entry.ordered, accepted: entry.ordered, rejected: entry.rejected };
            }
          }
          await updateGRNItem(item.id, { size_data: updatedSizeData });
        }
      }

      await updatePO(po.id, {
        status: 'closed',
        cancellation_reason: fullReason,
        cancelled_qty: grnPending?.totalPending ?? 0,
      });
      setShowCancelModal(false);
      await load();
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setCancelling(false);
    }
  };

  const handleAdvanceStatus = async () => {
    if (!po || !nextStatus) return;
    if (!gate.allowed) {
      Alert.alert('Cannot advance', gate.reason ?? 'Gate condition not met');
      return;
    }

    if (po.status === 'draft') {
      Alert.alert('Confirm PO', `Lock PO ${po.po_number}? It cannot be edited after confirmation.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm', onPress: async () => {
            await updatePO(po.id, { status: 'confirmed' });
            // Generate PDF document
            setGeneratingDoc(true);
            try {
              const vendor = po.vendor_id ? await getVendorById(po.vendor_id) : null;
              const items = po.items ?? [];
              const uri = await generatePODocument(po, items as Parameters<typeof generatePODocument>[1], vendor);
              await updatePO(po.id, { document_uri: uri });
              await load();
              Alert.alert('PO Confirmed & Document Generated ✓', `${po.po_number} is now confirmed.`);
            } catch (e) {
              await load();
              Alert.alert('PO Confirmed', `Document generation failed: ${String(e)}`);
            } finally {
              setGeneratingDoc(false);
            }
          },
        },
      ]);
      return;
    }

    if (po.status === 'dispatched') {
      // Auto-create GRN on transition to Received
      await updatePO(po.id, { status: 'received' });
      if (!grn) await createGRN(po.id);
      await load();
      return;
    }

    await updatePO(po.id, { status: nextStatus });
    await load();
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
          {/* Vendor row — tappable link */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vendor</Text>
            <TouchableOpacity onPress={() => router.push(`/vendors/${po.vendor_id}` as never)}>
              <Text style={[styles.infoValue, { color: colors.teal }]}>
                {po.vendor_name ?? po.vendor_id}
              </Text>
            </TouchableOpacity>
          </View>
          {vendor?.phone ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${vendor.phone}`)}>
                <Text style={[styles.infoValue, { color: colors.blue }]}>{vendor.phone}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {/* Message Vendor quick-log */}
          {vendor ? (
            <View style={styles.msgVendorRow}>
              {(['call', 'whatsapp', 'email'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={styles.msgVendorBtn}
                  onPress={() => {
                    Alert.prompt(
                      `Log ${type.charAt(0).toUpperCase() + type.slice(1)}`,
                      'Add a note (optional):',
                      async (note) => {
                        await addCommunication(po.vendor_id, po.id, type, 'outgoing', `Re: ${po.po_number}`, note ?? '');
                        Alert.alert('Logged', `${type} logged for ${vendor.name}`);
                      },
                      'plain-text',
                      '',
                    );
                  }}
                >
                  <Text style={styles.msgVendorBtnText}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <InfoRow label="Created" value={new Date(po.created_at).toLocaleDateString('en-IN')} />
          {po.delivery_date && <InfoRow label="Delivery Date" value={po.delivery_date} />}
          {po.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{po.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* PO Document buttons */}
        {(po.document_uri || generatingDoc) && (
          <View style={styles.docRow}>
            {generatingDoc ? (
              <Text style={styles.generatingText}>Generating document…</Text>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.docBtnOutline}
                  onPress={async () => { if (po.document_uri) await Print.printAsync({ uri: po.document_uri }); }}
                >
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke={colors.amber} strokeWidth={1.8} strokeLinejoin="round" />
                    <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={colors.amber} strokeWidth={1.8} strokeLinecap="round" />
                  </Svg>
                  <Text style={styles.docBtnOutlineText}>View PO Document</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.docBtnFilled}
                  onPress={async () => {
                    if (!po.document_uri) return;
                    const available = await Sharing.isAvailableAsync();
                    if (available) {
                      await Sharing.shareAsync(po.document_uri, { mimeType: 'application/pdf', dialogTitle: `Share ${po.po_number}` });
                    } else {
                      Alert.alert('Sharing not available', 'Sharing is not supported on this device.');
                    }
                  }}
                >
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="#000" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={styles.docBtnFilledText}>Share PO</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Delivery Card */}
        {deliverySchedule && (
          <View style={styles.deliverySection}>
            <DeliveryCard schedule={deliverySchedule} />
          </View>
        )}

        {/* Lorry Receipt section */}
        <View style={[styles.glassCard, styles.blueCard]}>
          <View style={styles.sectionRow}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" stroke={colors.blue} strokeWidth={1.8} strokeLinejoin="round" />
              <Circle cx={5.5} cy={18.5} r={2.5} stroke={colors.blue} strokeWidth={1.8} />
              <Circle cx={18.5} cy={18.5} r={2.5} stroke={colors.blue} strokeWidth={1.8} />
            </Svg>
            <Text style={[styles.sectionLabel, { color: colors.blue, marginBottom: 0 }]}>LORRY RECEIPT</Text>
          </View>
          {lr ? (
            <View style={styles.lrDetails}>
              {lr.lr_number ? <InfoRow label="LR Number" value={lr.lr_number} /> : null}
              {lr.transporter_name ? <InfoRow label="Transporter" value={lr.transporter_name} /> : null}
              {lr.dispatch_date ? <InfoRow label="Dispatched" value={lr.dispatch_date} /> : null}
              {lr.expected_delivery_date ? <InfoRow label="Expected Delivery" value={lr.expected_delivery_date} /> : null}
              <View style={[styles.lrStatusBadge, { backgroundColor: hexToRgba(colors.blue, 0.12) }]}>
                <Text style={[styles.lrStatusText, { color: colors.blue }]}>{lr.status.replace('_', ' ').toUpperCase()}</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.uploadLrBtn}
              onPress={() => router.push(`/po/lr-upload?poId=${id}`)}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke={colors.blue} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.uploadLrText}>Upload Lorry Receipt</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* GRN section — only show once dispatched or beyond */}
        {(po.status === 'dispatched' || po.status === 'received' || po.status === 'closed') && (
          <View style={[styles.glassCard, styles.blueCard]}>
            <View style={styles.sectionRow}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M9 11l3 3L22 4" stroke={colors.blue} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke={colors.blue} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={[styles.sectionLabel, { color: colors.blue, marginBottom: 0 }]}>GOODS RECEIPT (GRN)</Text>
            </View>
            {allGrns.length > 0 ? (
              <View style={styles.grnDetails}>
                {allGrns.map((g, idx) => (
                  <TouchableOpacity
                    key={g.id}
                    style={styles.grnHistoryCard}
                    onPress={() => router.push(`/po/grn?poId=${id}&grnId=${g.id}`)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.grnHistoryRow}>
                      <Text style={styles.grnHistoryNum}>GRN {idx + 1} — {g.grn_number}</Text>
                      <View style={[styles.grnStatusBadge, {
                        backgroundColor: g.overall_status === 'accepted'
                          ? 'rgba(93,202,165,0.12)' : g.overall_status === 'pending'
                          ? 'rgba(239,159,39,0.12)' : 'rgba(55,138,221,0.12)',
                      }]}>
                        <Text style={[styles.grnStatusText, {
                          color: g.overall_status === 'accepted' ? colors.teal
                            : g.overall_status === 'pending' ? colors.amber : colors.blue,
                        }]}>{g.overall_status.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={styles.grnHistorySub}>
                      {g.received_date}{'  ·  '}
                      {g.total_received_qty}/{g.total_ordered_qty} pcs received
                    </Text>
                    {g.overall_status !== 'pending' && (
                      <TouchableOpacity
                        style={styles.allocateBtn}
                        onPress={() => router.push(`/po/allocate?grnId=${g.id}`)}
                      >
                        <Text style={styles.allocateBtnText}>Allocate to Stores →</Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                ))}
                {grnPendingItems > 0 && (
                  <View style={styles.grnPendingRow}>
                    <Text style={styles.grnPendingText}>
                      {grnPendingItems} item{grnPendingItems > 1 ? 's' : ''} still pending delivery
                    </Text>
                    <TouchableOpacity
                      style={styles.createGrnBtn}
                      onPress={async () => {
                        try {
                          const newGrnId = await createGRN(id!);
                          await load();
                          router.push(`/po/grn?poId=${id}&grnId=${newGrnId}`);
                        } catch (e) {
                          Alert.alert('Error', String(e));
                        }
                      }}
                    >
                      <Text style={styles.createGrnBtnText}>Create GRN for Remaining →</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadLrBtn}
                onPress={async () => {
                  try {
                    const newGrnId = await createGRN(id!);
                    await load();
                    router.push(`/po/grn?poId=${id}&grnId=${newGrnId}`);
                  } catch (e) {
                    Alert.alert('Error', String(e));
                  }
                }}
              >
                <Text style={[styles.uploadLrText, { color: colors.blue }]}>Start GRN Verification</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Articles */}
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

        {/* Voice Notes */}
        <View style={styles.glassCard}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>VOICE NOTES</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{voiceNotes.length}</Text>
            </View>
          </View>
          {voiceNotes.map((vn, i) => (
            <VoiceNotePlayer
              key={vn.id}
              uri={vn.file_uri}
              duration={vn.duration_seconds}
              label={`Note ${i + 1}`}
              onDelete={async () => {
                await deleteVoiceNote(vn.id);
                if (id) setVoiceNotes(await getVoiceNotes(id));
              }}
            />
          ))}
          {showRecorder ? (
            <VoiceNoteRecorder
              onSave={async (fileUri, durationSeconds) => {
                await createVoiceNote(id ?? null, null, fileUri, durationSeconds);
                if (id) setVoiceNotes(await getVoiceNotes(id));
                setShowRecorder(false);
              }}
              onCancel={() => setShowRecorder(false)}
            />
          ) : (
            <TouchableOpacity style={styles.addNoteBtn} onPress={() => setShowRecorder(true)}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke={colors.amber} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke={colors.amber} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.addNoteBtnText}>Add Voice Note</Text>
            </TouchableOpacity>
          )}
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
        <View style={styles.actionSection}>
          {isEditable && (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => router.push(`/po/new?editId=${po.id}`)}
            >
              <Text style={styles.editBtnText}>Edit PO</Text>
            </TouchableOpacity>
          )}

          {nextCfg && nextLabel && (
            <View style={styles.advanceWrapper}>
              <TouchableOpacity
                style={[
                  styles.advanceBtn,
                  gate.allowed
                    ? { backgroundColor: hexToRgba(nextCfg.color, 0.15), borderColor: hexToRgba(nextCfg.color, 0.3) }
                    : styles.advanceBtnDisabled,
                ]}
                onPress={handleAdvanceStatus}
                activeOpacity={gate.allowed ? 0.75 : 0.95}
              >
                <Text style={[styles.advanceBtnText, { color: gate.allowed ? nextCfg.color : 'rgba(255,255,255,0.25)' }]}>
                  {nextLabel}
                </Text>
              </TouchableOpacity>

              {!gate.allowed && (
                <View style={styles.gateMessage}>
                  <Text style={styles.gateReason}>{gate.reason}</Text>
                  {gate.actionLabel && gate.actionPath && (
                    <TouchableOpacity onPress={() => router.push(gate.actionPath as never)}>
                      <Text style={styles.gateAction}>{gate.actionLabel}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {gate.pendingClose && (
                <TouchableOpacity
                  style={styles.cancelRemainingBtn}
                  onPress={() => setShowCancelModal(true)}
                >
                  <Text style={styles.cancelRemainingText}>Cancel Remaining &amp; Close</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {/* Soft-delete for draft or closed POs */}
          {(po.status === 'draft' || po.status === 'closed') && (
            <TouchableOpacity
              style={styles.deleteLink}
              onPress={() => {
                Alert.alert(
                  'Delete PO',
                  'You can recover it from Deleted POs.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await softDeletePO(po!.id);
                          router.back();
                        } catch (e) {
                          Alert.alert('Error', String(e));
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <Text style={styles.deleteLinkText}>Delete PO</Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>

      {/* Cancel Remaining Modal */}
      <Modal visible={showCancelModal} transparent animationType="slide" onRequestClose={() => setShowCancelModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Cancel Pending Items</Text>
            <Text style={styles.modalSubtitle}>
              {grnPending ? `${grnPending.totalPending} pcs pending receipt` : 'Pending items will be cancelled'}
            </Text>

            <Text style={styles.modalLabel}>Reason</Text>
            <View style={styles.reasonPicker}>
              {CANCEL_REASONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.reasonChip, cancelReason === r && styles.reasonChipActive]}
                  onPress={() => setCancelReason(r)}
                >
                  <Text style={[styles.reasonChipText, cancelReason === r && styles.reasonChipTextActive]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {cancelReason === 'Other' && (
              <TextInput
                style={styles.modalInput}
                value={cancelCustomReason}
                onChangeText={setCancelCustomReason}
                placeholder="Describe reason (min 10 chars)…"
                placeholderTextColor="rgba(255,255,255,0.2)"
                multiline
              />
            )}

            <Text style={styles.modalLabel}>Additional notes (optional)</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 60 }]}
              value={cancelNotes}
              onChangeText={setCancelNotes}
              placeholder="Any additional notes…"
              placeholderTextColor="rgba(255,255,255,0.2)"
              multiline
            />

            <TouchableOpacity
              style={[styles.confirmCancelBtn, cancelling && { opacity: 0.5 }]}
              onPress={handleCancelRemaining}
              disabled={cancelling}
            >
              <Text style={styles.confirmCancelText}>{cancelling ? 'Cancelling…' : 'Confirm Cancellation'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.goBackBtn} onPress={() => setShowCancelModal(false)}>
              <Text style={styles.goBackText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

function GRNStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.grnStat}>
      <Text style={[styles.grnStatValue, { color }]}>{value}</Text>
      <Text style={styles.grnStatLabel}>{label}</Text>
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
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold' },

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
  blueCard: {
    backgroundColor: 'rgba(55,138,221,0.04)',
    borderColor: 'rgba(55,138,221,0.12)',
  },
  deliverySection: { marginHorizontal: 20, marginBottom: 16 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  countBadge: {
    backgroundColor: 'rgba(93,202,165,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: { fontSize: 12, fontWeight: '700', color: colors.teal, fontFamily: 'Inter_700Bold' },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  infoLabel: { fontSize: 13, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular' },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', fontFamily: 'Inter_500Medium' },
  msgVendorRow: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  msgVendorBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  msgVendorBtnText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_700Bold', textTransform: 'capitalize' },
  notesBox: { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10 },
  notesText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_400Regular' },
  addNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
    backgroundColor: 'rgba(239,159,39,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,159,39,0.2)',
    borderRadius: 8,
  },
  addNoteBtnText: { fontSize: 13, fontWeight: '700', color: colors.amber, fontFamily: 'Inter_700Bold' },

  lrDetails: { gap: 2 },
  lrStatusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 6 },
  lrStatusText: { fontSize: 10, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  uploadLrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(55,138,221,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(55,138,221,0.2)',
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  uploadLrText: { fontSize: 13, fontWeight: '700', color: colors.blue, fontFamily: 'Inter_700Bold' },

  grnDetails: { gap: 4 },
  grnStats: { flexDirection: 'row', gap: 16, marginTop: 8, marginBottom: 8 },
  grnStat: { alignItems: 'center', gap: 2 },
  grnStatValue: { fontSize: 20, fontWeight: '800', fontFamily: 'Inter_800ExtraBold' },
  grnStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular' },
  openGrnBtn: { paddingVertical: 8, marginTop: 4 },
  openGrnText: { fontSize: 13, fontWeight: '700', color: colors.blue, fontFamily: 'Inter_700Bold' },
  allocateBtn: { paddingVertical: 6, marginTop: 4 },
  allocateBtnText: { fontSize: 12, fontWeight: '700', color: colors.teal, fontFamily: 'Inter_700Bold' },

  // GRN history
  grnHistoryCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  grnHistoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  grnHistoryNum: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  grnStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  grnStatusText: { fontSize: 10, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  grnHistorySub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },
  grnPendingRow: { marginTop: 6, gap: 8 },
  grnPendingText: { fontSize: 13, color: colors.amber, fontFamily: 'Inter_500Medium' },
  createGrnBtn: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: 'rgba(55,138,221,0.1)', borderWidth: 1, borderColor: 'rgba(55,138,221,0.25)', borderRadius: 10, alignItems: 'center' },
  createGrnBtnText: { fontSize: 13, fontWeight: '700', color: colors.blue, fontFamily: 'Inter_700Bold' },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  itemThumb: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  itemInitial: { fontSize: 16, fontWeight: '900', fontFamily: 'Inter_900Black' },
  itemBody: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  itemSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },
  itemQty: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_400Regular', marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: '800', color: colors.teal, fontFamily: 'Inter_800ExtraBold' },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular' },
  summaryValue: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },

  actionSection: { paddingHorizontal: 20, gap: 10, marginTop: 4 },
  editBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  editBtnText: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter_700Bold' },
  advanceWrapper: { gap: 8 },
  advanceBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  advanceBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  advanceBtnText: { fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  gateMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  gateReason: { fontSize: 12, color: colors.red, fontFamily: 'Inter_400Regular' },
  gateAction: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.red,
    fontFamily: 'Inter_700Bold',
    textDecorationLine: 'underline',
  },

  // Document buttons
  docRow: {
    marginHorizontal: 20,
    marginBottom: 16,
    flexDirection: 'row',
    gap: 10,
  },
  generatingText: { fontSize: 13, color: colors.amber, fontFamily: 'Inter_400Regular' },
  docBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,159,39,0.3)',
    backgroundColor: 'rgba(239,159,39,0.06)',
  },
  docBtnOutlineText: { fontSize: 13, fontWeight: '700', color: colors.amber, fontFamily: 'Inter_700Bold' },
  docBtnFilled: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: colors.amber,
  },
  docBtnFilledText: { fontSize: 13, fontWeight: '700', color: '#000', fontFamily: 'Inter_700Bold' },

  // Soft delete
  deleteLink: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  deleteLinkText: { fontSize: 13, color: colors.red, fontFamily: 'Inter_400Regular' },

  cancelRemainingBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,159,39,0.3)',
    backgroundColor: 'rgba(239,159,39,0.1)',
    alignItems: 'center',
  },
  cancelRemainingText: { fontSize: 15, fontWeight: '700', color: colors.amber, fontFamily: 'Inter_700Bold' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  modalSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
  },
  reasonPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  reasonChipActive: {
    borderColor: 'rgba(239,159,39,0.4)',
    backgroundColor: 'rgba(239,159,39,0.12)',
  },
  reasonChipText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_400Regular' },
  reasonChipTextActive: { color: colors.amber, fontWeight: '600', fontFamily: 'Inter_500Medium' },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
  },
  confirmCancelBtn: {
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: 'rgba(226,75,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(226,75,74,0.3)',
    alignItems: 'center',
    marginTop: 4,
  },
  confirmCancelText: { fontSize: 16, fontWeight: '700', color: colors.red, fontFamily: 'Inter_700Bold' },
  goBackBtn: { alignItems: 'center', paddingVertical: 10 },
  goBackText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },
});
