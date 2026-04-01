import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import * as Sharing from 'expo-sharing';
import { colors } from '../../constants/theme';
import { getDispatchNotes, updateDispatchNoteStatus } from '../../db/database';
import { generateDispatchPDF } from '../../services/dispatchNote';
import type { DispatchNote, DispatchNoteItem } from '../../db/types';

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  generated:  { label: 'Generated',  color: 'rgba(255,255,255,0.35)' },
  dispatched: { label: 'Dispatched', color: colors.blue },
  in_transit: { label: 'In Transit', color: colors.amber },
  received:   { label: 'Received',   color: colors.teal },
};

export default function DispatchNotesScreen() {
  const router = useRouter();
  const [notes, setNotes] = useState<DispatchNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState<DispatchNote | null>(null);
  const [receiverName, setReceiverName] = useState('');
  const [showReceiverInput, setShowReceiverInput] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDispatchNotes();
      setNotes(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleMarkDispatched = async (note: DispatchNote) => {
    Alert.alert(
      'Mark as Dispatched',
      `Confirm dispatch of ${note.dispatch_number} to ${note.store_name ?? 'store'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Dispatched',
          onPress: async () => {
            await updateDispatchNoteStatus(note.id, 'dispatched');
            await load();
          },
        },
      ]
    );
  };

  const handleMarkReceived = (note: DispatchNote) => {
    setSelectedNote(note);
    setShowReceiverInput(true);
    setReceiverName('');
  };

  const confirmReceived = async () => {
    if (!selectedNote) return;
    await updateDispatchNoteStatus(selectedNote.id, 'received', receiverName.trim() || undefined);
    setShowReceiverInput(false);
    setSelectedNote(null);
    setReceiverName('');
    await load();
  };

  const handleShare = async (note: DispatchNote) => {
    setGenerating(true);
    try {
      const uri = await generateDispatchPDF(note.id);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Dispatch Note ${note.dispatch_number}`,
        });
      } else {
        Alert.alert('PDF Generated', `Saved to: ${uri}`);
      }
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.loader}>
          <ActivityIndicator color={colors.teal} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Receiver input modal overlay */}
      {showReceiverInput && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Mark as Received</Text>
            <Text style={styles.modalSub}>
              {selectedNote?.dispatch_number} → {selectedNote?.store_name}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={receiverName}
              onChangeText={setReceiverName}
              placeholder="Received by (name or phone)…"
              placeholderTextColor="rgba(255,255,255,0.2)"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn}
                onPress={() => { setShowReceiverInput(false); setSelectedNote(null); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmReceived}>
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="rgba(255,255,255,0.7)"
                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <View style={styles.headerBody}>
            <Text style={styles.title}>Dispatch Notes</Text>
            <Text style={styles.subtitle}>{notes.length} note{notes.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        {notes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No Dispatch Notes</Text>
            <Text style={styles.emptyBody}>
              Dispatch notes are auto-generated after stock allocations. Complete a GRN allocation to create them.
            </Text>
          </View>
        ) : (
          notes.map((note) => {
            const statusCfg = STATUS_CFG[note.status] ?? STATUS_CFG.generated;
            const items: DispatchNoteItem[] = note.items_json
              ? (JSON.parse(note.items_json) as DispatchNoteItem[])
              : [];

            return (
              <View key={note.id} style={styles.noteCard}>
                {/* Card header */}
                <View style={styles.noteHeader}>
                  <View style={styles.noteHeaderLeft}>
                    <Text style={styles.dispatchNumber}>{note.dispatch_number}</Text>
                    <Text style={styles.storeName}>{note.store_name ?? 'Store'}</Text>
                  </View>
                  <View style={[styles.statusPill, {
                    backgroundColor: statusCfg.color + '20',
                    borderColor: statusCfg.color + '44',
                  }]}>
                    <Text style={[styles.statusPillText, { color: statusCfg.color }]}>
                      {statusCfg.label}
                    </Text>
                  </View>
                </View>

                {/* Stats row */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{note.total_items ?? items.length}</Text>
                    <Text style={styles.statLabel}>Items</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{note.total_qty ?? 0}</Text>
                    <Text style={styles.statLabel}>Qty</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{note.created_at?.slice(0, 10) ?? '—'}</Text>
                    <Text style={styles.statLabel}>Created</Text>
                  </View>
                </View>

                {/* Items preview */}
                {items.slice(0, 3).map((item, i) => (
                  <View key={i} style={styles.itemRow}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.productName}</Text>
                    <Text style={styles.itemQty}>{item.totalQty} pcs</Text>
                  </View>
                ))}
                {items.length > 3 && (
                  <Text style={styles.moreItems}>+{items.length - 3} more items</Text>
                )}

                {/* GRN reference */}
                {note.grn_number && (
                  <Text style={styles.grnRef}>GRN: {note.grn_number}</Text>
                )}

                {/* Action buttons */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.shareBtn}
                    onPress={() => handleShare(note)}
                    disabled={generating}
                  >
                    {generating ? (
                      <ActivityIndicator color={colors.blue} size="small" />
                    ) : (
                      <>
                        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                          <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"
                            stroke={colors.blue} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                        <Text style={styles.shareBtnText}>Share PDF</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {note.status === 'generated' && (
                    <TouchableOpacity
                      style={styles.dispatchBtn}
                      onPress={() => handleMarkDispatched(note)}
                    >
                      <Text style={styles.dispatchBtnText}>Mark Dispatched</Text>
                    </TouchableOpacity>
                  )}

                  {(note.status === 'dispatched' || note.status === 'in_transit') && (
                    <TouchableOpacity
                      style={styles.receivedBtn}
                      onPress={() => handleMarkReceived(note)}
                    >
                      <Text style={styles.receivedBtnText}>Mark Received</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Received details */}
                {note.status === 'received' && note.received_by && (
                  <Text style={styles.receivedBy}>
                    Received by {note.received_by} on {note.received_at?.slice(0, 10) ?? '—'}
                  </Text>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', gap: 10, marginBottom: 16,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerBody: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', fontFamily: 'Inter_800ExtraBold' },
  subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular', marginTop: 2 },

  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold', marginBottom: 8 },
  emptyBody: {
    fontSize: 14, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular',
    textAlign: 'center', lineHeight: 20,
  },

  noteCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginBottom: 12,
  },
  noteHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  noteHeaderLeft: { flex: 1 },
  dispatchNumber: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  storeName: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular', marginTop: 2 },
  statusPill: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold' },

  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular' },

  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  itemName: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter_400Regular', flex: 1 },
  itemQty: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },
  moreItems: { fontSize: 12, color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_400Regular', marginTop: 4 },
  grnRef: { fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: 'Inter_400Regular', marginTop: 6 },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${colors.blue}15`, borderWidth: 1, borderColor: `${colors.blue}30`,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  shareBtnText: { fontSize: 13, color: colors.blue, fontFamily: 'Inter_700Bold' },
  dispatchBtn: {
    backgroundColor: `${colors.amber}15`, borderWidth: 1, borderColor: `${colors.amber}30`,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  dispatchBtnText: { fontSize: 13, color: colors.amber, fontFamily: 'Inter_700Bold' },
  receivedBtn: {
    backgroundColor: `${colors.teal}15`, borderWidth: 1, borderColor: `${colors.teal}30`,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  receivedBtnText: { fontSize: 13, color: colors.teal, fontFamily: 'Inter_700Bold' },
  receivedBy: { fontSize: 11, color: colors.teal, fontFamily: 'Inter_400Regular', marginTop: 6 },

  // Modal
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center',
    zIndex: 100, paddingHorizontal: 24,
  },
  modal: {
    width: '100%', backgroundColor: '#1a1a1a', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold', marginBottom: 4 },
  modalSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular', marginBottom: 16 },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 12,
    color: '#FFFFFF', fontFamily: 'Inter_400Regular', fontSize: 14, marginBottom: 16,
  },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_700Bold' },
  modalConfirmBtn: {
    flex: 1, backgroundColor: colors.teal, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  modalConfirmText: { fontSize: 14, fontWeight: '700', color: '#000', fontFamily: 'Inter_700Bold' },
});
