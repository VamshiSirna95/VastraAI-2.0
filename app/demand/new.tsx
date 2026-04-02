import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { compressImage } from '../../services/imageManager';
import { colors } from '../../constants/theme';
import * as Haptics from 'expo-haptics';
import { createDemand, getStores } from '../../db/database';
import type { Store } from '../../db/types';
import { GARMENT_TYPES, COLORS } from '../../db/types';

export default function NewDemandScreen() {
  const router = useRouter();

  const [stores, setStores] = useState<Store[]>([]);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [garmentType, setGarmentType] = useState('');
  const [colorPref, setColorPref] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [storeId, setStoreId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  useFocusEffect(useCallback(() => {
    getStores().then(setStores);
  }, []));

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(await compressImage(result.assets[0].uri));
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Camera access is required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(await compressImage(result.assets[0].uri));
    }
  };

  const canSave = description.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSaving(true);
    try {
      await createDemand({
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        description: description.trim(),
        photo_uri: photoUri ?? undefined,
        garment_type: garmentType || undefined,
        color_preference: colorPref || undefined,
        price_range_min: priceMin ? parseFloat(priceMin) : undefined,
        price_range_max: priceMax ? parseFloat(priceMax) : undefined,
        store_id: storeId ?? undefined,
        notes: notes.trim() || undefined,
      });
      Alert.alert('Saved', 'Customer demand recorded successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to save demand request.');
    } finally {
      setSaving(false);
    }
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
        <View style={styles.headerBody}>
          <Text style={styles.screenLabel}>CUSTOMERS</Text>
          <Text style={styles.screenTitle}>Capture Demand</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Customer Info */}
        <Section label="CUSTOMER INFO">
          <TextInput
            style={styles.input}
            placeholder="Customer name (optional)"
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={customerName}
            onChangeText={setCustomerName}
          />
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            placeholder="Phone number (optional)"
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={customerPhone}
            onChangeText={setCustomerPhone}
            keyboardType="phone-pad"
          />
        </Section>

        {/* Description (required) */}
        <Section label="WHAT ARE THEY LOOKING FOR? *">
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Describe what the customer wants…"
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </Section>

        {/* Photo */}
        <Section label="REFERENCE PHOTO">
          {photoUri ? (
            <View style={styles.photoPreviewWrap}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              <TouchableOpacity style={styles.removePhoto} onPress={() => setPhotoUri(null)}>
                <Text style={styles.removePhotoText}>✕ Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoButtons}>
              <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={colors.teal} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M12 17a4 4 0 100-8 4 4 0 000 8z" stroke={colors.teal} strokeWidth={1.8} />
                </Svg>
                <Text style={styles.photoBtnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke={colors.teal} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.photoBtnText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          )}
        </Section>

        {/* Garment Type */}
        <Section label="GARMENT TYPE">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {(GARMENT_TYPES as readonly string[]).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, garmentType === g && styles.chipActive]}
                  onPress={() => setGarmentType(garmentType === g ? '' : g)}
                >
                  <Text style={[styles.chipText, garmentType === g && styles.chipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </Section>

        {/* Color Preference */}
        <Section label="COLOR PREFERENCE">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {(COLORS as readonly string[]).map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, colorPref === c && styles.chipActive]}
                  onPress={() => setColorPref(colorPref === c ? '' : c)}
                >
                  <Text style={[styles.chipText, colorPref === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </Section>

        {/* Price Range */}
        <Section label="PRICE RANGE (₹)">
          <View style={styles.priceRow}>
            <TextInput
              style={[styles.input, styles.priceInput]}
              placeholder="Min"
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={priceMin}
              onChangeText={(v) => setPriceMin(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
            />
            <Text style={styles.priceSep}>–</Text>
            <TextInput
              style={[styles.input, styles.priceInput]}
              placeholder="Max"
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={priceMax}
              onChangeText={(v) => setPriceMax(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
            />
          </View>
        </Section>

        {/* Store */}
        {stores.length > 0 && (
          <Section label="STORE">
            <View style={styles.chipRow}>
              {stores.filter((s) => s.is_active).map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.chip, storeId === s.id && styles.chipBlue]}
                  onPress={() => setStoreId(storeId === s.id ? null : s.id)}
                >
                  <Text style={[styles.chipText, storeId === s.id && styles.chipTextBlue]}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>
        )}

        {/* Notes */}
        <Section label="NOTES">
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Any additional notes…"
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </Section>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave || saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save Request</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerBody: { flex: 1 },
  screenLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter_800ExtraBold',
  },

  content: { paddingHorizontal: 16, paddingTop: 8 },

  section: { marginBottom: 22 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 10,
  },

  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
  },
  multilineInput: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 },

  photoPreviewWrap: { borderRadius: 10, overflow: 'hidden' },
  photoPreview: { width: '100%', height: 180, borderRadius: 10, resizeMode: 'cover' },
  removePhoto: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.red + '22',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.red + '44',
  },
  removePhotoText: { fontSize: 12, color: colors.red, fontFamily: 'Inter_700Bold' },

  photoButtons: { flexDirection: 'row', gap: 10 },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.teal + '11',
    borderWidth: 1,
    borderColor: colors.teal + '33',
    borderRadius: 10,
    paddingVertical: 12,
  },
  photoBtnText: { fontSize: 14, fontWeight: '600', color: colors.teal, fontFamily: 'Inter_700Bold' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: { backgroundColor: colors.teal + '22', borderColor: colors.teal + '55' },
  chipBlue: { backgroundColor: colors.blue + '22', borderColor: colors.blue + '55' },
  chipText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },
  chipTextActive: { color: colors.teal },
  chipTextBlue: { color: colors.blue },

  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceInput: { flex: 1 },
  priceSep: { fontSize: 18, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular' },

  saveBtn: {
    backgroundColor: colors.teal + '33',
    borderWidth: 1,
    borderColor: colors.teal + '66',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: colors.teal, fontFamily: 'Inter_700Bold' },
});
