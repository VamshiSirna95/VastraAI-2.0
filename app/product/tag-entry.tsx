import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { updateProduct } from '../../db/database';
import type { Product } from '../../db/types';
import GlassInput from '../../components/ui/GlassInput';

export default function TagEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ productId: string; photoUri?: string }>();
  const { productId, photoUri } = params;

  const [mrp, setMrp] = useState('');
  const [barcode, setBarcode] = useState('');
  const [designCode, setDesignCode] = useState('');
  const [colorName, setColorName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleApply = async () => {
    setSaving(true);
    try {
      const updates: Partial<Product> = {};
      if (mrp) updates.mrp = parseFloat(mrp);
      if (barcode) updates.barcode = barcode;
      if (designCode) updates.design_name = designCode;
      if (Object.keys(updates).length > 0) {
        await updateProduct(productId, updates);
      }
      router.replace({ pathname: '/product/[id]', params: { id: productId } });
    } catch {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    router.replace({ pathname: '/product/[id]', params: { id: productId } });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleSkip}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tag Data</Text>
        </View>

        {/* Tag photo */}
        <View style={styles.photoCard}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.tagPhoto} resizeMode="cover" />
          ) : (
            <View style={[styles.tagPhoto, styles.tagPhotoPlaceholder]}>
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <Path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"
                  stroke="rgba(255,255,255,0.15)" strokeWidth={1.8} strokeLinejoin="round" />
                <Path d="M7 7h.01" stroke="rgba(255,255,255,0.15)" strokeWidth={2.5} strokeLinecap="round" />
              </Svg>
              <Text style={styles.noPhotoText}>No tag photo</Text>
            </View>
          )}
        </View>

        {/* Form */}
        <Text style={styles.sectionLabel}>ENTER TAG VALUES</Text>
        <View style={styles.formCard}>
          <GlassInput
            label="MRP ₹"
            value={mrp}
            onChangeText={setMrp}
            placeholder="e.g. 1299"
            keyboardType="decimal-pad"
          />
          <GlassInput
            label="Barcode"
            value={barcode}
            onChangeText={setBarcode}
            placeholder="8–13 digit barcode"
            keyboardType="number-pad"
          />
          <GlassInput
            label="Design Code"
            value={designCode}
            onChangeText={setDesignCode}
            placeholder="e.g. KRT-2024-001"
          />
          <GlassInput
            label="Color (from tag)"
            value={colorName}
            onChangeText={setColorName}
            placeholder="e.g. Maroon"
          />

          <View style={styles.infoRow}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
                stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} />
              <Path d="M12 16v-4M12 8h.01" stroke="rgba(255,255,255,0.2)" strokeWidth={1.8} strokeLinecap="round" />
            </Svg>
            <Text style={styles.infoText}>Auto-reading from tag photos coming soon</Text>
          </View>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={[styles.applyBtn, saving && styles.applyBtnDisabled]}
          onPress={handleApply}
          disabled={saving}
        >
          <Text style={styles.applyBtnText}>{saving ? 'Applying…' : 'Apply to Product'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipBtnText}>Skip</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 32,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter_800ExtraBold',
  },

  photoCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  tagPhoto: {
    width: '100%',
    height: 180,
  },
  tagPhotoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  noPhotoText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.2)',
    fontFamily: 'Inter_400Regular',
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.amber,
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
  },

  formCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 2,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  infoText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_400Regular',
  },

  applyBtn: {
    backgroundColor: colors.teal,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  applyBtnDisabled: {
    opacity: 0.5,
  },
  applyBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
    fontFamily: 'Inter_800ExtraBold',
  },

  skipBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  skipBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_700Bold',
  },
});
