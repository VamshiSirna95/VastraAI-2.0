import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { createVendor } from '../../db/database';
import type { Vendor } from '../../db/types';

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

function Field({
  label, value, onChange, placeholder, keyboardType, multiline, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'email-address' | 'numeric';
  multiline?: boolean;
  required?: boolean;
}) {
  return (
    <View style={fStyles.wrap}>
      <Text style={fStyles.label}>
        {label}{required && <Text style={{ color: colors.red }}> *</Text>}
      </Text>
      <TextInput
        style={[fStyles.input, multiline && fStyles.multiline]}
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

const fStyles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_700Bold', marginBottom: 5 },
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

export default function NewVendorScreen() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Vendor>>({ rank: 'B', is_active: 1 });

  const f = (key: keyof Vendor) => String(form[key] ?? '');
  const set = (key: keyof Vendor) => (v: string) => setForm((prev) => ({ ...prev, [key]: v }));

  const handleCreate = async () => {
    if (!form.name?.trim()) {
      Alert.alert('Required', 'Vendor name is required');
      return;
    }
    setSaving(true);
    try {
      const id = await createVendor({ ...form, name: form.name.trim() });
      router.replace(`/vendors/${id}`);
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setSaving(false);
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
          <Text style={styles.headerTitle}>New Vendor</Text>
        </View>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BASIC INFO</Text>
          <Field label="Vendor Name" value={f('name')} onChange={set('name')} required />
          <Field label="Contact Person" value={f('contact_person')} onChange={set('contact_person')} />
          <Field label="Speciality" value={f('speciality')} onChange={set('speciality')} placeholder="e.g. Kurtas, Sarees" />
          <Text style={fStyles.label}>Rank</Text>
          <View style={styles.rankPicker}>
            {RANKS.map((r) => {
              const rc = RANK_COLOR[r] ?? 'rgba(255,255,255,0.3)';
              const active = (form.rank ?? 'B') === r;
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
        </View>

        {/* Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONTACT</Text>
          <Field label="Phone" value={f('phone')} onChange={set('phone')} keyboardType="phone-pad" />
          <Field label="Alt Phone" value={f('alt_phone')} onChange={set('alt_phone')} keyboardType="phone-pad" />
          <Field label="Email" value={f('email')} onChange={set('email')} keyboardType="email-address" />
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LOCATION</Text>
          <Field label="Address Line 1" value={f('address_line1')} onChange={set('address_line1')} />
          <Field label="Area / Market" value={f('area')} onChange={set('area')} />
          <Field label="City" value={f('city')} onChange={set('city')} />
          <Field label="State" value={f('state')} onChange={set('state')} />
          <Field label="Pincode" value={f('pincode')} onChange={set('pincode')} keyboardType="numeric" />
        </View>

        {/* Business */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BUSINESS</Text>
          <Field label="GSTIN" value={f('gstin')} onChange={set('gstin')} />
          <Field label="PAN" value={f('pan')} onChange={set('pan')} />
          <Field label="Payment Terms" value={f('payment_terms')} onChange={set('payment_terms')} placeholder="e.g. 30 days, Advance" />
          <Field label="Avg Lead Days" value={f('avg_lead_days')} onChange={set('avg_lead_days')} keyboardType="numeric" />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOTES</Text>
          <Field label="" value={f('notes')} onChange={set('notes')} placeholder="Optional notes…" multiline />
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createBtn, saving && { opacity: 0.5 }]}
          onPress={handleCreate}
          disabled={saving}
        >
          <Text style={styles.createBtnText}>{saving ? 'Creating…' : 'Create Vendor'}</Text>
        </TouchableOpacity>

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
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', fontFamily: 'Inter_800ExtraBold' },

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

  rankPicker: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  rankChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rankChipText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_700Bold' },

  createBtn: {
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.teal,
    alignItems: 'center',
    marginBottom: 20,
  },
  createBtnText: { fontSize: 16, fontWeight: '700', color: '#000', fontFamily: 'Inter_700Bold' },
});
