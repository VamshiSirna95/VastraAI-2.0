import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, Linking,
  Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import {
  getVendorById, updateVendor, deactivateVendor, reactivateVendor,
  updateVendorStats, getPOs, calculateVendorRank,
  addCommunication, getCommunications,
} from '../../db/database';
import type { VendorCommunication } from '../../db/database';
import type { Vendor, PurchaseOrder } from '../../db/types';
import { formatINR, formatPhone } from '../../utils/format';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const RANKS = ['S+', 'S', 'A', 'B', 'C', 'D', 'E'] as const;
const RANK_COLOR: Record<string, string> = {
  'S+': '#9B72F2', S: '#5DCAA5', A: '#EF9F27', B: '#378ADD',
  C: 'rgba(255,255,255,0.4)', D: 'rgba(255,255,255,0.3)', E: 'rgba(255,255,255,0.2)',
};

const COMM_COLOR: Record<string, string> = {
  call: colors.teal,
  whatsapp: '#25D366',
  email: colors.blue,
  meeting: colors.amber,
  note: 'rgba(255,255,255,0.4)',
};

const PO_STATUS_COLOR: Partial<Record<string, string>> = {
  draft: 'rgba(255,255,255,0.35)',
  confirmed: '#EF9F27',
  sent: '#EF9F27',
  dispatched: '#378ADD',
  received: '#378ADD',
  closed: '#5DCAA5',
};

function Field({
  label, value, onChange, placeholder, keyboardType, multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'email-address' | 'numeric';
  multiline?: boolean;
}) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, multiline && fieldStyles.multiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? label}
        placeholderTextColor="rgba(255,255,255,0.15)"
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_700Bold', marginBottom: 5, letterSpacing: 0.5 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
});

export default function VendorDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [recentPOs, setRecentPOs] = useState<PurchaseOrder[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scoreData, setScoreData] = useState<{ score: number; rank: string; breakdown: { quality: number; delivery: number; volume: number } } | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  // Editable state mirrors vendor fields
  const [form, setForm] = useState<Partial<Vendor>>({});

  // Communication log state
  const [communications, setCommunications] = useState<VendorCommunication[]>([]);
  const [showCommModal, setShowCommModal] = useState(false);
  const [commType, setCommType] = useState('call');
  const [commDirection, setCommDirection] = useState('outgoing');
  const [commSubject, setCommSubject] = useState('');
  const [commContent, setCommContent] = useState('');
  const [savingComm, setSavingComm] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const v = await getVendorById(id);
    if (!v) return;
    await updateVendorStats(id);
    const freshV = await getVendorById(id);
    setVendor(freshV);
    setForm(freshV ?? {});
    const pos = await getPOs({ vendorId: id });
    setRecentPOs(pos.slice(0, 5));
    const sc = await calculateVendorRank(id);
    setScoreData(sc);
    const comms = await getCommunications(id);
    setCommunications(comms);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!vendor) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const rankColor = RANK_COLOR[vendor.rank] ?? 'rgba(255,255,255,0.3)';
  const isInactive = vendor.is_active === 0;

  const handleSave = async () => {
    const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (form.gstin && form.gstin.trim() && !GSTIN_REGEX.test(form.gstin.trim().toUpperCase())) {
      Alert.alert('Invalid GSTIN', 'Expected format: 36ABCDE1234F1Z5');
      return;
    }
    setSaving(true);
    try {
      await updateVendor(id!, form);
      setEditing(false);
      await load();
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = () => {
    Alert.alert(
      isInactive ? 'Reactivate Vendor' : 'Deactivate Vendor',
      isInactive
        ? `Reactivate ${vendor.name}?`
        : `Deactivate ${vendor.name}? They won't appear in vendor picker.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isInactive ? 'Reactivate' : 'Deactivate',
          style: isInactive ? 'default' : 'destructive',
          onPress: async () => {
            if (isInactive) { await reactivateVendor(vendor.id); }
            else { await deactivateVendor(vendor.id); }
            await load();
          },
        },
      ]
    );
  };

  const f = (key: keyof Vendor) => String(form[key] ?? '');
  const set = (key: keyof Vendor) => (v: string) => setForm((prev) => ({ ...prev, [key]: v }));

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
          <View style={[styles.rankBadgeLarge, { backgroundColor: hexToRgba(rankColor, 0.15), borderColor: hexToRgba(rankColor, 0.3) }]}>
            <Text style={[styles.rankLargeText, { color: rankColor }]}>{vendor.rank}</Text>
          </View>
          <View style={styles.headerBody}>
            <Text style={styles.vendorName} numberOfLines={1}>{vendor.name}</Text>
            {isInactive && (
              <View style={styles.inactivePill}>
                <Text style={styles.inactivePillText}>Inactive</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.editToggleBtn, editing && styles.editToggleBtnActive]}
            onPress={() => {
              if (editing) { setForm(vendor); setEditing(false); }
              else { setEditing(true); }
            }}
          >
            <Text style={[styles.editToggleText, editing && styles.editToggleTextActive]}>
              {editing ? 'Cancel' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.amber }]}>
              {vendor.total_orders ?? 0}
            </Text>
            <Text style={styles.statLabel}>Total POs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.teal }]}>
              {formatINR(vendor.total_value ?? 0)}
            </Text>
            <Text style={styles.statLabel}>Total Value</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.blue }]}>
              {vendor.avg_lead_days ?? 0}d
            </Text>
            <Text style={styles.statLabel}>Lead Days</Text>
          </View>
        </View>

        {/* Vendor Scorecard */}
        {scoreData && (
          <View style={styles.section}>
            <View style={styles.scorecardHeader}>
              <Text style={styles.sectionLabel}>VENDOR SCORECARD</Text>
              <TouchableOpacity
                style={[styles.recalcBtn, recalculating && { opacity: 0.5 }]}
                onPress={async () => {
                  setRecalculating(true);
                  try { const sc = await calculateVendorRank(id!); setScoreData(sc); }
                  finally { setRecalculating(false); }
                }}
                disabled={recalculating}
              >
                <Text style={styles.recalcBtnText}>{recalculating ? '…' : 'Recalculate'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.scorecardMain}>
              <View style={[styles.scoreBadgeLarge, { backgroundColor: hexToRgba(rankColor, 0.15), borderColor: hexToRgba(rankColor, 0.3) }]}>
                <Text style={[styles.scoreBadgeRank, { color: rankColor }]}>{scoreData.rank}</Text>
                <Text style={[styles.scoreBadgeScore, { color: rankColor }]}>{scoreData.score}/100</Text>
              </View>
              <View style={styles.scoreBreakdown}>
                {[
                  { label: 'Quality', value: scoreData.breakdown.quality, color: colors.teal },
                  { label: 'Delivery', value: scoreData.breakdown.delivery, color: colors.amber },
                  { label: 'Volume', value: scoreData.breakdown.volume, color: colors.blue },
                ].map(({ label, value, color }) => (
                  <View key={label} style={styles.scoreBarRow}>
                    <Text style={styles.scoreBarLabel}>{label}</Text>
                    <View style={styles.scoreBarBg}>
                      <View style={[styles.scoreBarFill, { width: `${value}%` as `${number}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={[styles.scoreBarPct, { color }]}>{value}%</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONTACT</Text>
          {editing ? (
            <>
              <Field label="Contact Person" value={f('contact_person')} onChange={set('contact_person')} />
              <Field label="Phone" value={f('phone')} onChange={set('phone')} keyboardType="phone-pad" />
              <Field label="Alt Phone" value={f('alt_phone')} onChange={set('alt_phone')} keyboardType="phone-pad" />
              <Field label="Email" value={f('email')} onChange={set('email')} keyboardType="email-address" />
            </>
          ) : (
            <>
              {vendor.contact_person ? <InfoRow label="Contact" value={vendor.contact_person} /> : null}
              {vendor.phone ? (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${vendor.phone}`)}>
                  <InfoRow label="Phone" value={formatPhone(vendor.phone)} highlight />
                </TouchableOpacity>
              ) : null}
              {vendor.alt_phone ? (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${vendor.alt_phone}`)}>
                  <InfoRow label="Alt Phone" value={vendor.alt_phone!} highlight />
                </TouchableOpacity>
              ) : null}
              {vendor.email ? <InfoRow label="Email" value={vendor.email} /> : null}
            </>
          )}
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LOCATION</Text>
          {editing ? (
            <>
              <Field label="Address Line 1" value={f('address_line1')} onChange={set('address_line1')} />
              <Field label="Address Line 2" value={f('address_line2')} onChange={set('address_line2')} />
              <Field label="Area / Market" value={f('area')} onChange={set('area')} />
              <Field label="City" value={f('city')} onChange={set('city')} />
              <Field label="State" value={f('state')} onChange={set('state')} />
              <Field label="Pincode" value={f('pincode')} onChange={set('pincode')} keyboardType="numeric" />
            </>
          ) : (
            <>
              {vendor.address_line1 ? <InfoRow label="Address" value={[vendor.address_line1, vendor.address_line2].filter(Boolean).join(', ')} /> : null}
              {vendor.area ? <InfoRow label="Area" value={vendor.area} /> : null}
              {vendor.city ? <InfoRow label="City" value={[vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(' – ')} /> : null}
            </>
          )}
        </View>

        {/* Business */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BUSINESS</Text>
          {editing ? (
            <>
              <Text style={fieldStyles.label}>Rank</Text>
              <View style={styles.rankPicker}>
                {RANKS.map((r) => {
                  const rc = RANK_COLOR[r] ?? 'rgba(255,255,255,0.3)';
                  const active = (form.rank ?? vendor.rank) === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[styles.rankChip, active && { backgroundColor: hexToRgba(rc, 0.2), borderColor: rc }]}
                      onPress={() => setForm((prev) => ({ ...prev, rank: r }))}
                    >
                      <Text style={[styles.rankChipText, active && { color: rc }]}>{r}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Field label="Speciality" value={f('speciality')} onChange={set('speciality')} />
              <Field label="GSTIN" value={f('gstin')} onChange={set('gstin')} />
              <Field label="PAN" value={f('pan')} onChange={set('pan')} />
              <Field label="Payment Terms" value={f('payment_terms')} onChange={set('payment_terms')} placeholder="e.g. 30 days, Advance, On delivery" />
              <Field label="Avg Lead Days" value={f('avg_lead_days')} onChange={set('avg_lead_days')} keyboardType="numeric" />
            </>
          ) : (
            <>
              {vendor.speciality ? <InfoRow label="Speciality" value={vendor.speciality} /> : null}
              {vendor.gstin ? <InfoRow label="GSTIN" value={vendor.gstin} /> : null}
              {vendor.pan ? <InfoRow label="PAN" value={vendor.pan} /> : null}
              {vendor.payment_terms ? <InfoRow label="Payment Terms" value={vendor.payment_terms} /> : null}
              {(vendor.avg_lead_days ?? 0) > 0 ? <InfoRow label="Avg Lead Days" value={`${vendor.avg_lead_days} days`} /> : null}
            </>
          )}
        </View>

        {/* Banking */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BANKING</Text>
          {editing ? (
            <>
              <Field label="Bank Name" value={f('bank_name')} onChange={set('bank_name')} />
              <Field label="Account Number" value={f('bank_account')} onChange={set('bank_account')} />
              <Field label="IFSC Code" value={f('bank_ifsc')} onChange={set('bank_ifsc')} />
            </>
          ) : (
            <>
              {vendor.bank_name ? <InfoRow label="Bank" value={vendor.bank_name} /> : null}
              {vendor.bank_account ? <InfoRow label="Account" value={vendor.bank_account} /> : null}
              {vendor.bank_ifsc ? <InfoRow label="IFSC" value={vendor.bank_ifsc} /> : null}
              {!vendor.bank_name && !vendor.bank_account && (
                <Text style={styles.emptySection}>No banking details added</Text>
              )}
            </>
          )}
        </View>

        {/* Notes */}
        {editing ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NOTES</Text>
            <Field label="" value={f('notes')} onChange={set('notes')} placeholder="Optional notes…" multiline />
          </View>
        ) : vendor.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NOTES</Text>
            <Text style={styles.notesText}>{vendor.notes}</Text>
          </View>
        ) : null}

        {/* Recent POs */}
        {recentPOs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>RECENT POs</Text>
            {recentPOs.map((po) => {
              const sc = PO_STATUS_COLOR[po.status] ?? 'rgba(255,255,255,0.35)';
              return (
                <TouchableOpacity key={po.id} style={styles.poRow} onPress={() => router.push(`/po/${po.id}`)}>
                  <View style={styles.poRowLeft}>
                    <Text style={styles.poNumber}>{po.po_number}</Text>
                    <Text style={styles.poValue}>{formatINR(po.total_value)}</Text>
                  </View>
                  <View style={[styles.poStatusBadge, { backgroundColor: hexToRgba(sc, 0.12) }]}>
                    <Text style={[styles.poStatusText, { color: sc }]}>
                      {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Communication Log */}
        <View style={styles.section}>
          <View style={styles.commHeader}>
            <Text style={styles.sectionLabel}>COMMUNICATION LOG</Text>
            <TouchableOpacity style={styles.logCommBtn} onPress={() => setShowCommModal(true)}>
              <Text style={styles.logCommBtnText}>+ Log</Text>
            </TouchableOpacity>
          </View>
          {communications.length === 0 ? (
            <Text style={styles.emptySection}>No communications logged yet</Text>
          ) : (
            communications.slice(0, 10).map((c) => (
              <View key={c.id} style={styles.commRow}>
                <View style={[styles.commTypeDot, { backgroundColor: COMM_COLOR[c.type] ?? 'rgba(255,255,255,0.2)' }]} />
                <View style={styles.commBody}>
                  <View style={styles.commTopRow}>
                    <Text style={styles.commTypeLabel}>{c.type.toUpperCase()}</Text>
                    <Text style={styles.commDir}>{c.direction}</Text>
                    <Text style={styles.commDate}>{c.created_at.slice(0, 10)}</Text>
                  </View>
                  {c.subject ? <Text style={styles.commSubject}>{c.subject}</Text> : null}
                  {c.content ? <Text style={styles.commContent} numberOfLines={2}>{c.content}</Text> : null}
                  {c.po_number ? <Text style={styles.commPO}>PO: {c.po_number}</Text> : null}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Log Communication Modal */}
        <Modal visible={showCommModal} transparent animationType="slide" onRequestClose={() => setShowCommModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Log Communication</Text>

              <Text style={styles.modalFieldLabel}>TYPE</Text>
              <View style={styles.chipRow}>
                {['call', 'whatsapp', 'email', 'meeting', 'note'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeChip, commType === t && { backgroundColor: hexToRgba(COMM_COLOR[t] ?? colors.teal, 0.2), borderColor: COMM_COLOR[t] ?? colors.teal }]}
                    onPress={() => setCommType(t)}
                  >
                    <Text style={[styles.typeChipText, commType === t && { color: COMM_COLOR[t] ?? colors.teal }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalFieldLabel}>DIRECTION</Text>
              <View style={styles.chipRow}>
                {['outgoing', 'incoming'].map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.typeChip, commDirection === d && { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.3)' }]}
                    onPress={() => setCommDirection(d)}
                  >
                    <Text style={[styles.typeChipText, commDirection === d && { color: '#FFFFFF' }]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalFieldLabel}>SUBJECT (optional)</Text>
              <TextInput
                style={styles.modalInput}
                value={commSubject}
                onChangeText={setCommSubject}
                placeholder="Brief subject…"
                placeholderTextColor="rgba(255,255,255,0.15)"
              />

              <Text style={styles.modalFieldLabel}>NOTES</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 80, textAlignVertical: 'top' }]}
                value={commContent}
                onChangeText={setCommContent}
                placeholder="What was discussed…"
                placeholderTextColor="rgba(255,255,255,0.15)"
                multiline
              />

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCommModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSave, savingComm && { opacity: 0.5 }]}
                  disabled={savingComm}
                  onPress={async () => {
                    setSavingComm(true);
                    try {
                      await addCommunication(id!, null, commType, commDirection, commSubject, commContent);
                      setCommSubject('');
                      setCommContent('');
                      setCommType('call');
                      setCommDirection('outgoing');
                      setShowCommModal(false);
                      const comms = await getCommunications(id!);
                      setCommunications(comms);
                    } catch (e) {
                      Alert.alert('Error', String(e));
                    } finally {
                      setSavingComm(false);
                    }
                  }}
                >
                  {savingComm ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.modalSaveText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Save / Deactivate buttons */}
        <View style={styles.bottomBtns}>
          {editing && (
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.deactivateBtn} onPress={handleToggleActive}>
            <Text style={[styles.deactivateBtnText, isInactive && { color: colors.teal }]}>
              {isInactive ? 'Reactivate Vendor' : 'Deactivate Vendor'}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.value, highlight && infoStyles.highlight]}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  label: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular' },
  value: { fontSize: 13, color: '#FFFFFF', fontFamily: 'Inter_500Medium', flex: 1, textAlign: 'right' },
  highlight: { color: colors.teal },
});

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
    gap: 12,
  },
  backBtn: { padding: 4 },
  rankBadgeLarge: {
    width: 44,
    height: 44,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankLargeText: { fontSize: 14, fontWeight: '900', fontFamily: 'Inter_900Black' },
  headerBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  vendorName: { flex: 1, fontSize: 18, fontWeight: '800', color: '#FFFFFF', fontFamily: 'Inter_800ExtraBold' },
  inactivePill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inactivePillText: { fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular' },
  editToggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  editToggleBtnActive: { borderColor: colors.amber, backgroundColor: hexToRgba(colors.amber, 0.08) },
  editToggleText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_700Bold' },
  editToggleTextActive: { color: colors.amber },

  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 14,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '900', fontFamily: 'Inter_900Black' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 4 },

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
    marginBottom: 10,
  },
  emptySection: { fontSize: 13, color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  notesText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_400Regular', lineHeight: 20 },

  scorecardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  recalcBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  recalcBtnText: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_400Regular' },
  scorecardMain: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  scoreBadgeLarge: { width: 72, height: 72, borderRadius: 16, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  scoreBadgeRank: { fontSize: 22, fontWeight: '900', fontFamily: 'Inter_900Black' },
  scoreBadgeScore: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 2 },
  scoreBreakdown: { flex: 1, gap: 8 },
  scoreBarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scoreBarLabel: { width: 54, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },
  scoreBarBg: { flex: 1, height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  scoreBarFill: { height: 5, borderRadius: 3 },
  scoreBarPct: { width: 36, fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold', textAlign: 'right' },

  rankPicker: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  rankChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rankChipText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_700Bold' },

  poRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  poRowLeft: { gap: 2 },
  poNumber: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  poValue: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },
  poStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  poStatusText: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold' },

  commHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  logCommBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  logCommBtnText: { fontSize: 12, color: colors.teal, fontFamily: 'Inter_700Bold' },
  commRow: { flexDirection: 'row', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  commTypeDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  commBody: { flex: 1 },
  commTopRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 2 },
  commTypeLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  commDir: { fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_400Regular' },
  commDate: { flex: 1, fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'Inter_400Regular', textAlign: 'right' },
  commSubject: { fontSize: 13, color: '#FFFFFF', fontFamily: 'Inter_500Medium', marginBottom: 2 },
  commContent: { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter_400Regular', lineHeight: 17 },
  commPO: { fontSize: 11, color: colors.amber, fontFamily: 'Inter_400Regular', marginTop: 3 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', fontFamily: 'Inter_800ExtraBold', marginBottom: 18 },
  modalFieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_700Bold', marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  typeChipText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_700Bold', textTransform: 'capitalize' },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
    marginBottom: 14,
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: { flex: 1, paddingVertical: 13, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  modalCancelText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },
  modalSave: { flex: 1, paddingVertical: 13, borderRadius: 11, backgroundColor: colors.teal, alignItems: 'center' },
  modalSaveText: { fontSize: 14, fontWeight: '700', color: '#000', fontFamily: 'Inter_700Bold' },

  bottomBtns: { marginHorizontal: 20, gap: 10 },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.teal,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#000', fontFamily: 'Inter_700Bold' },
  deactivateBtn: { paddingVertical: 12, alignItems: 'center' },
  deactivateBtnText: { fontSize: 14, color: colors.red, fontFamily: 'Inter_400Regular' },
});
