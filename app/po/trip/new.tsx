import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../../constants/theme';
import { createTrip } from '../../../db/database';

export default function NewTripScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [vendorArea, setVendorArea] = useState('');
  const [startDate, setStartDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Please enter a trip name'); return; }
    setSaving(true);
    try {
      await createTrip({
        name: name.trim(),
        budget: parseFloat(budget) || 0,
        vendor_area: vendorArea.trim() || undefined,
        start_date: startDate.trim() || undefined,
        status: 'active',
      });
      router.back();
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
          <Text style={styles.headerTitle}>New Purchase Trip</Text>
        </View>

        <View style={styles.glassCard}>
          <Field
            label="Trip Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. March Week 4 — Begum Bazaar"
          />
          <Field
            label="Budget (₹)"
            value={budget}
            onChangeText={setBudget}
            placeholder="500000"
            keyboardType="numeric"
          />
          <Field
            label="Vendor Area"
            value={vendorArea}
            onChangeText={setVendorArea}
            placeholder="e.g. Begum Bazaar, Hyderabad"
          />
          <Field
            label="Start Date (DD-Mon-YYYY)"
            value={startDate}
            onChangeText={setStartDate}
            placeholder="28-Mar-2026"
          />
        </View>

        <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={saving}>
          <Text style={styles.createBtnText}>{saving ? 'Creating…' : 'Create Trip'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label, value, onChangeText, placeholder, keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.2)"
        keyboardType={keyboardType}
      />
    </View>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter_800ExtraBold',
  },

  glassCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 16,
  },

  fieldWrap: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
  },

  createBtn: {
    marginHorizontal: 20,
    backgroundColor: colors.teal,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'Inter_700Bold',
  },
});
