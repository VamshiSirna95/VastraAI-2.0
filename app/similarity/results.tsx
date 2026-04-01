import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { getProductById } from '../../db/database';
import { findSimilarProducts, type SimilarityMatch } from '../../services/similarityEngine';
import type { Product } from '../../db/types';

function scoreColor(score: number): string {
  if (score >= 0.8) return colors.teal;
  if (score >= 0.6) return colors.amber;
  return colors.blue;
}

function MatchPill({ label }: { label: string }) {
  return (
    <View style={styles.matchPill}>
      <Text style={styles.matchPillText}>{label}</Text>
    </View>
  );
}

export default function SimilarityResultsScreen() {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const [source, setSource] = useState<Product | null>(null);
  const [matches, setMatches] = useState<SimilarityMatch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const [prod, results] = await Promise.all([
        getProductById(productId),
        findSimilarProducts(productId, 20),
      ]);
      setSource(prod);
      setMatches(results);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.loader}>
          <ActivityIndicator color={colors.teal} size="large" />
          <Text style={styles.loaderText}>Finding similar products…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const mainPhoto = source?.photos?.find((p) => p.is_primary) ?? source?.photos?.[0];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
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
            <Text style={styles.title}>Similar Products</Text>
            <Text style={styles.subtitle}>{matches.length} match{matches.length !== 1 ? 'es' : ''} found</Text>
          </View>
        </View>

        {/* Source product */}
        {source && (
          <View style={styles.sourceCard}>
            <Text style={styles.sectionLabel}>SOURCE PRODUCT</Text>
            <View style={styles.sourceBody}>
              {mainPhoto ? (
                <Image source={{ uri: mainPhoto.uri }} style={styles.sourcePhoto} resizeMode="cover" />
              ) : (
                <View style={styles.sourcePhotoEmpty}>
                  <Text style={styles.sourcePhotoEmptyText}>No photo</Text>
                </View>
              )}
              <View style={styles.sourceInfo}>
                <Text style={styles.sourceName} numberOfLines={2}>{source.design_name ?? '—'}</Text>
                <Text style={styles.sourceAttrs}>
                  {[source.garment_type, source.primary_color, source.pattern].filter(Boolean).join(' · ')}
                </Text>
                {source.purchase_price != null && (
                  <Text style={styles.sourcePrice}>₹{source.purchase_price}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Match count header */}
        {matches.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>No Similar Products Found</Text>
            <Text style={styles.emptyBody}>
              No products reached the 40% similarity threshold. Add more products with detailed attributes to improve matching.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.matchesLabel}>MATCHES</Text>
            {matches.map((match, idx) => {
              const matchPhoto = match.product.photos?.find((ph) => ph.is_primary)
                ?? match.product.photos?.[0];
              const col = scoreColor(match.score);
              const priceDiff = match.priceDiff;
              return (
                <View key={match.product.id} style={styles.matchCard}>
                  <View style={styles.matchCardBody}>
                    {/* Rank badge */}
                    <View style={[styles.rankBadge, { backgroundColor: col + '20' }]}>
                      <Text style={[styles.rankText, { color: col }]}>#{idx + 1}</Text>
                    </View>

                    {/* Photo */}
                    {matchPhoto ? (
                      <Image source={{ uri: matchPhoto.uri }} style={styles.matchPhoto} resizeMode="cover" />
                    ) : (
                      <View style={styles.matchPhotoEmpty}>
                        <Text style={styles.matchPhotoEmptyText}>
                          {(match.product.design_name ?? 'P')[0].toUpperCase()}
                        </Text>
                      </View>
                    )}

                    {/* Details */}
                    <View style={styles.matchInfo}>
                      <View style={styles.matchTopRow}>
                        <Text style={styles.matchName} numberOfLines={1}>
                          {match.product.design_name ?? '—'}
                        </Text>
                        <View style={[styles.scoreBadge, { backgroundColor: col + '20', borderColor: col + '44' }]}>
                          <Text style={[styles.scoreText, { color: col }]}>
                            {Math.round(match.score * 100)}% match
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.matchSub}>
                        {[match.product.garment_type, match.product.primary_color, match.product.fabric]
                          .filter(Boolean).join(' · ')}
                      </Text>

                      {/* Match reason pills */}
                      {match.matchReasons.length > 0 && (
                        <View style={styles.pillsRow}>
                          {match.matchReasons.map((r) => <MatchPill key={r} label={r} />)}
                        </View>
                      )}

                      {/* Price comparison */}
                      {match.product.purchase_price != null && (
                        <View style={styles.priceRow}>
                          <Text style={styles.matchPrice}>₹{match.product.purchase_price}</Text>
                          {priceDiff != null && priceDiff > 0 && (
                            <Text style={styles.savings}>Save ₹{priceDiff}/pc</Text>
                          )}
                          {priceDiff != null && priceDiff < 0 && (
                            <Text style={styles.moreExpensive}>₹{Math.abs(priceDiff)} more</Text>
                          )}
                        </View>
                      )}

                      {/* Vendor */}
                      {match.vendorName && (
                        <Text style={styles.vendorName}>{match.vendorName}</Text>
                      )}
                    </View>
                  </View>

                  {/* View product link */}
                  <TouchableOpacity
                    style={styles.viewProductBtn}
                    onPress={() => router.push(`/product/${match.product.id}` as never)}
                  >
                    <Text style={styles.viewProductText}>View Product →</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loaderText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },

  header: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', gap: 10, marginBottom: 16,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerBody: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', fontFamily: 'Inter_800ExtraBold' },
  subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular', marginTop: 2 },

  sourceCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_700Bold', marginBottom: 10,
  },
  sourceBody: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  sourcePhoto: { width: 64, height: 64, borderRadius: 8 },
  sourcePhotoEmpty: {
    width: 64, height: 64, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center',
  },
  sourcePhotoEmptyText: { fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'Inter_400Regular' },
  sourceInfo: { flex: 1 },
  sourceName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  sourceAttrs: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular', marginTop: 3 },
  sourcePrice: { fontSize: 14, color: colors.amber, fontFamily: 'Inter_700Bold', marginTop: 4 },

  matchesLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_700Bold', marginBottom: 10,
  },

  matchCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 12, marginBottom: 10,
  },
  matchCardBody: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rankBadge: {
    width: 28, height: 28, borderRadius: 6, justifyContent: 'center', alignItems: 'center',
    alignSelf: 'flex-start',
  },
  rankText: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  matchPhoto: { width: 52, height: 52, borderRadius: 8 },
  matchPhotoEmpty: {
    width: 52, height: 52, borderRadius: 8,
    backgroundColor: `${colors.teal}20`, justifyContent: 'center', alignItems: 'center',
  },
  matchPhotoEmptyText: { fontSize: 18, fontWeight: '700', color: colors.teal, fontFamily: 'Inter_700Bold' },
  matchInfo: { flex: 1 },
  matchTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  matchName: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold', flex: 1 },
  scoreBadge: {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
  },
  scoreText: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  matchSub: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular', marginTop: 3 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  matchPill: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  matchPillText: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_400Regular' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  matchPrice: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  savings: { fontSize: 12, color: colors.teal, fontFamily: 'Inter_700Bold' },
  moreExpensive: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular' },
  vendorName: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular', marginTop: 3 },
  viewProductBtn: {
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
    alignItems: 'flex-end',
  },
  viewProductText: { fontSize: 13, color: colors.teal, fontFamily: 'Inter_700Bold' },

  emptyState: {
    alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold', marginBottom: 8 },
  emptyBody: {
    fontSize: 14, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular',
    textAlign: 'center', lineHeight: 20,
  },
});
