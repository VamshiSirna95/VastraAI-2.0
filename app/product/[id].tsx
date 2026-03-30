import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { getProductById } from '../../db/database';
import type { Product } from '../../db/types';
import ProductForm from '../../components/ProductForm';

interface AIParams {
  garment_type?: string;
  primary_color?: string;
  secondary_color?: string;
  pattern?: string;
  fabric?: string;
  work_type?: string;
  occasion?: string;
  sleeve?: string;
  neck?: string;
  confidence?: number;
  source?: string;
}

export default function EditProductScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    ai_garment_type?: string;
    ai_primary_color?: string;
    ai_secondary_color?: string;
    ai_pattern?: string;
    ai_fabric?: string;
    ai_work_type?: string;
    ai_occasion?: string;
    ai_sleeve?: string;
    ai_neck?: string;
    ai_confidence?: string;
    ai_source?: string;
  }>();

  const { id } = params;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  // Extract AI detection params
  const aiParams: AIParams = {
    garment_type: params.ai_garment_type || undefined,
    primary_color: params.ai_primary_color || undefined,
    secondary_color: params.ai_secondary_color || undefined,
    pattern: params.ai_pattern || undefined,
    fabric: params.ai_fabric || undefined,
    work_type: params.ai_work_type || undefined,
    occasion: params.ai_occasion || undefined,
    sleeve: params.ai_sleeve || undefined,
    neck: params.ai_neck || undefined,
    confidence: params.ai_confidence ? parseFloat(params.ai_confidence) : undefined,
    source: params.ai_source,
  };

  const hasAiParams = Object.values(aiParams).some(
    (v) => v !== undefined && v !== ''
  );

  useEffect(() => {
    if (!id) return;
    getProductById(id)
      .then((p) => {
        if (p && hasAiParams) {
          // Merge AI params into product: AI fills empty fields only
          const merged: Product = {
            ...p,
            garment_type: p.garment_type || aiParams.garment_type,
            primary_color: p.primary_color || aiParams.primary_color,
            secondary_color: p.secondary_color || aiParams.secondary_color,
            pattern: p.pattern || aiParams.pattern,
            fabric: p.fabric || aiParams.fabric,
            work_type: p.work_type || aiParams.work_type,
            occasion: p.occasion || aiParams.occasion,
            sleeve: p.sleeve || aiParams.sleeve,
            neck: p.neck || aiParams.neck,
            ai_confidence: aiParams.confidence ?? p.ai_confidence,
          };
          setProduct(merged);
        } else {
          setProduct(p);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

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
        <Text style={styles.title} numberOfLines={1}>
          {product?.design_name ?? 'Edit Product'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color="#5DCAA5" size="large" />
        </View>
      ) : product ? (
        <ProductForm
          initial={product}
          productId={id}
          aiConfidence={aiParams.confidence}
          aiFields={hasAiParams ? {
            garment_type: aiParams.garment_type,
            primary_color: aiParams.primary_color,
            secondary_color: aiParams.secondary_color,
            pattern: aiParams.pattern,
            fabric: aiParams.fabric,
            work_type: aiParams.work_type,
            occasion: aiParams.occasion,
            sleeve: aiParams.sleeve,
            neck: aiParams.neck,
          } : undefined}
        />
      ) : (
        <View style={styles.loader}>
          <Text style={styles.notFound}>Product not found</Text>
        </View>
      )}
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
  headerSpacer: {
    width: 40,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFound: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
  },
});
