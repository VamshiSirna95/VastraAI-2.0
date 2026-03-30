import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { createLR, getPOById } from '../../db/database';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function todayString(): string {
  const d = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

export default function LRUploadScreen() {
  const router = useRouter();
  const { poId } = useLocalSearchParams<{ poId: string }>();

  const [lrNumber, setLrNumber] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [dispatchDate, setDispatchDate] = useState(todayString());
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (cam.status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow camera or gallery access');
        return;
      }
    }

    Alert.alert('LR Photo', 'Choose source', [
      {
        text: 'Camera',
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: 'images',
            quality: 0.8,
            allowsEditing: true,
          });
          if (!result.canceled && result.assets[0]) {
            setPhotoUri(result.assets[0].uri);
          }
        },
      },
      {
        text: 'Gallery',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            quality: 0.8,
            allowsEditing: true,
          });
          if (!result.canceled && result.assets[0]) {
            setPhotoUri(result.assets[0].uri);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    if (!poId) { Alert.alert('Error', 'No PO ID'); return; }
    if (!lrNumber.trim()) { Alert.alert('Required', 'Please enter LR Number'); return; }
    setSaving(true);
    try {
      await createLR(poId, {
        lr_number: lrNumber.trim(),
        transporter_name: transporterName.trim() || undefined,
        dispatch_date: dispatchDate || undefined,
        expected_delivery_date: expectedDeliveryDate || undefined,
        photo_uri: photoUri ?? undefined,
        notes: notes.trim() || undefined,
        status: 'dispatched',
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
              <Path d="M19 12H5M5 12l7-7M5 12l7 7" stroke={colors.blue} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lorry Receipt</Text>
        </View>

        {/* Form */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionLabel}>LR DETAILS</Text>

          <Field label="LR Number *">
            <TextInput
              style={styles.input}
              value={lrNumber}
              onChangeText={setLrNumber}
              placeholder="e.g. MH04-2026-001234"
              placeholderTextColor="rgba(255,255,255,0.2)"
              autoCapitalize="characters"
            />
          </Field>

          <Field label="Transporter Name">
            <TextInput
              style={styles.input}
              value={transporterName}
              onChangeText={setTransporterName}
              placeholder="e.g. Gati Logistics"
              placeholderTextColor="rgba(255,255,255,0.2)"
            />
          </Field>

          <Field label="Dispatch Date (DD-Mon-YYYY)">
            <TextInput
              style={styles.input}
              value={dispatchDate}
              onChangeText={setDispatchDate}
              placeholder="e.g. 28-Mar-2026"
              placeholderTextColor="rgba(255,255,255,0.2)"
            />
          </Field>

          <Field label="Expected Delivery Date (DD-Mon-YYYY)">
            <TextInput
              style={styles.input}
              value={expectedDeliveryDate}
              onChangeText={setExpectedDeliveryDate}
              placeholder="e.g. 01-Apr-2026"
              placeholderTextColor="rgba(255,255,255,0.2)"
            />
          </Field>

          <Field label="Notes">
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes…"
              placeholderTextColor="rgba(255,255,255,0.2)"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </Field>
        </View>

        {/* Photo */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionLabel}>LR PHOTO</Text>
          {photoUri ? (
            <View style={styles.photoPreview}>
              <Image source={{ uri: photoUri }} style={styles.photoThumb} resizeMode="cover" />
              <TouchableOpacity style={styles.retakeBtn} onPress={pickPhoto}>
                <Text style={styles.retakeBtnText}>Retake</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadPhotoBtn} onPress={pickPhoto}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
                  stroke={colors.blue} strokeWidth={1.8} strokeLinejoin="round" />
                <Circle cx={12} cy={13} r={4} stroke={colors.blue} strokeWidth={1.8} />
              </Svg>
              <Text style={styles.uploadPhotoText}>Take / Upload Photo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Lorry Receipt'}</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// SVG Circle helper (not from react-native-svg — inline)
function Circle({ cx, cy, r, stroke, strokeWidth }: { cx: number; cy: number; r: number; stroke: string; strokeWidth: number }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" style={{ position: 'absolute' }}>
      <Path d={`M ${cx} ${cy - r} A ${r} ${r} 0 1 0 ${cx + 0.01} ${cy - r}`} stroke={stroke} strokeWidth={strokeWidth} fill="none" />
    </Svg>
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
    flex: 1,
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 14,
  },

  fieldWrapper: { marginBottom: 14 },
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
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
  },
  notesInput: { minHeight: 72 },

  uploadPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    backgroundColor: 'rgba(55,138,221,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(55,138,221,0.2)',
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  uploadPhotoText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.blue,
    fontFamily: 'Inter_700Bold',
  },
  photoPreview: { alignItems: 'center', gap: 12 },
  photoThumb: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  retakeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(55,138,221,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(55,138,221,0.2)',
    borderRadius: 8,
  },
  retakeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.blue,
    fontFamily: 'Inter_700Bold',
  },

  saveBtn: {
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(239,159,39,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,159,39,0.35)',
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.amber,
    fontFamily: 'Inter_700Bold',
  },
});
