import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import ProductForm from '../../components/ProductForm';
import type { Product } from '../../db/types';

export default function NewProductScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    garment_type?: string;
    primary_color?: string;
    secondary_color?: string;
    pattern?: string;
    fabric?: string;
    work_type?: string;
    occasion?: string;
    sleeve?: string;
    neck?: string;
    ai_confidence?: string;
    ai_source?: string;
  }>();

  const hasAiParams = !!(
    params.garment_type || params.primary_color || params.pattern || params.fabric
  );

  const aiConfidence = params.ai_confidence ? parseFloat(params.ai_confidence) : undefined;

  const initial: Partial<Product> = {
    garment_type: params.garment_type,
    primary_color: params.primary_color,
    secondary_color: params.secondary_color,
    pattern: params.pattern,
    fabric: params.fabric,
    work_type: params.work_type,
    occasion: params.occasion,
    sleeve: params.sleeve,
    neck: params.neck,
    status: 'draft',
  };

  const aiFields = hasAiParams ? {
    garment_type: params.garment_type,
    primary_color: params.primary_color,
    secondary_color: params.secondary_color,
    pattern: params.pattern,
    fabric: params.fabric,
    work_type: params.work_type,
    occasion: params.occasion,
    sleeve: params.sleeve,
    neck: params.neck,
  } : undefined;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M19 12H5M5 12l7-7M5 12l7 7"
              stroke="rgba(255,255,255,0.7)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.title}>New Product</Text>
        {hasAiParams && aiConfidence != null ? (
          <View style={[
            styles.aiSourceBadge,
            { backgroundColor: aiConfidence >= 80 ? `${colors.teal}22` : `${colors.amber}22`,
              borderColor: aiConfidence >= 80 ? `${colors.teal}44` : `${colors.amber}44` },
          ]}>
            <Text style={[
              styles.aiSourceText,
              { color: aiConfidence >= 80 ? colors.teal : colors.amber },
            ]}>
              AI {Math.round(aiConfidence)}%
            </Text>
          </View>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {!hasAiParams && (
        <View style={styles.noAiBanner}>
          <Text style={styles.noAiText}>AI detection unavailable — fill manually</Text>
        </View>
      )}

      <ProductForm
        initial={initial}
        aiConfidence={aiConfidence}
        aiFields={aiFields}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter_800ExtraBold',
    textAlign: 'center',
  },
  headerSpacer: { width: 40 },
  aiSourceBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 40,
    alignItems: 'center',
  },
  aiSourceText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  noAiBanner: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(239,159,39,0.06)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239,159,39,0.12)',
  },
  noAiText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
