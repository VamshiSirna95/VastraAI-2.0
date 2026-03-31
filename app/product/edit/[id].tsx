import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { getProductById } from '../../../db/database';
import type { Product } from '../../../db/types';
import ProductForm from '../../../components/ProductForm';
import type { AIFields } from '../../../components/ProductForm';

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

  const aiConfidence = params.ai_confidence ? parseFloat(params.ai_confidence) : undefined;
  const hasAiParams = !!(params.ai_garment_type || params.ai_primary_color);
  const aiFields: AIFields | undefined = hasAiParams ? {
    garment_type: params.ai_garment_type,
    primary_color: params.ai_primary_color,
    secondary_color: params.ai_secondary_color,
    pattern: params.ai_pattern,
    fabric: params.ai_fabric,
    work_type: params.ai_work_type,
    occasion: params.ai_occasion,
    sleeve: params.ai_sleeve,
    neck: params.ai_neck,
  } : undefined;

  useEffect(() => {
    if (!id) return;
    getProductById(id)
      .then((p) => {
        if (p && hasAiParams) {
          setProduct({
            ...p,
            garment_type: p.garment_type || params.ai_garment_type,
            primary_color: p.primary_color || params.ai_primary_color,
            secondary_color: p.secondary_color || params.ai_secondary_color,
            pattern: p.pattern || params.ai_pattern,
            fabric: p.fabric || params.ai_fabric,
            work_type: p.work_type || params.ai_work_type,
            occasion: p.occasion || params.ai_occasion,
            sleeve: p.sleeve || params.ai_sleeve,
            neck: p.neck || params.ai_neck,
            ai_confidence: aiConfidence ?? p.ai_confidence,
          });
        } else {
          setProduct(p);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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
          aiConfidence={aiConfidence}
          aiFields={aiFields}
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
  root: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter_800ExtraBold',
    textAlign: 'center',
  },
  headerSpacer: { width: 40 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { fontSize: 16, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },
});
