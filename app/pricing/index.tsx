import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import {
  getMarkdownCandidates, getActiveOffers, endProductOffer, createProductOffer,
  getUpcomingFestivals, getCompetitorOverpricedCount,
} from '../../db/database';
import type { MarkdownCandidate, ProductOffer } from '../../db/database';
import { formatINR } from '../../utils/format';

function estimateClearanceDays(sellThroughPct: number, markdownPct: number, daysInStock: number): number {
  // Each 10% markdown roughly 1.5x velocity; sell_through drives base estimate
  const velocityMultiplier = Math.pow(1.5, markdownPct / 10);
  const remainingPct = 100 - sellThroughPct;
  if (sellThroughPct <= 0) return 999;
  const baseDaysPerPct = daysInStock / Math.max(sellThroughPct, 0.5);
  return Math.round((remainingPct * baseDaysPerPct) / velocityMultiplier);
}

function suggestMarkdown(sellThroughPct: number, daysInStock: number): number {
  if (daysInStock > 180 || sellThroughPct < 2) return 30;
  if (daysInStock > 120 || sellThroughPct < 5) return 20;
  return 15;
}

export default function PricingScreen() {
  const router = useRouter();
  const [markdownCandidates, setMarkdownCandidates] = useState<MarkdownCandidate[]>([]);
  const [activeOffers, setActiveOffers] = useState<ProductOffer[]>([]);
  const [festivals, setFestivals] = useState<Array<{ season_name: string; start_date: string; days_away: number }>>([]);
  const [overpricedCount, setOverpricedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [md, offers, fests, over] = await Promise.all([
        getMarkdownCandidates(),
        getActiveOffers(),
        getUpcomingFestivals(),
        getCompetitorOverpricedCount(),
      ]);
      setMarkdownCandidates(md);
      setActiveOffers(offers);
      setFestivals(fests);
      setOverpricedCount(over);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleApplyOffer = async (candidate: MarkdownCandidate) => {
    const pct = suggestMarkdown(candidate.sell_through_pct, candidate.days_in_stock);
    Alert.alert(
      'Apply Markdown',
      `Apply ${pct}% off to "${candidate.design_name}"?\n\nCurrent price: ${candidate.selling_price ? formatINR(candidate.selling_price) : 'N/A'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Apply ${pct}% Off`,
          onPress: async () => {
            setApplyingId(candidate.product_id);
            try {
              const today = new Date().toISOString().slice(0, 10);
              const endDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
              await createProductOffer(candidate.product_id, 'percentage', pct, today, endDate, 'clearance');
              await load();
            } finally {
              setApplyingId(null);
            }
          },
        },
      ]
    );
  };

  const handleEndOffer = async (id: number) => {
    await endProductOffer(id);
    await load();
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M5 12l7-7M5 12l7 7" stroke={colors.blue} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <View>
            <Text style={styles.screenLabel}>PRICING</Text>
            <Text style={styles.screenTitle}>Pricing Intelligence</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.teal} size="large" />
          </View>
        ) : (
          <>
            {/* A. Markdown Suggestions */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>MARKDOWN SUGGESTIONS</Text>
              <Text style={styles.cardSub}>Products with slow sell-through ({'>'}90 days, {'<'}10% sell-through)</Text>
              {markdownCandidates.length === 0 ? (
                <Text style={styles.emptyText}>No markdown candidates — all products moving well.</Text>
              ) : (
                markdownCandidates.map((c) => {
                  const pct = suggestMarkdown(c.sell_through_pct, c.days_in_stock);
                  const clearDays = estimateClearanceDays(c.sell_through_pct, pct, c.days_in_stock);
                  const applying = applyingId === c.product_id;
                  return (
                    <View key={c.product_id} style={styles.candidateRow}>
                      <View style={styles.candidateInfo}>
                        <Text style={styles.candidateName} numberOfLines={1}>{c.design_name}</Text>
                        <Text style={styles.candidateMeta}>
                          {c.garment_type ?? ''} · {c.days_in_stock}d in stock · {Math.round(c.sell_through_pct)}% sell-through · {c.current_stock} pcs
                        </Text>
                        <Text style={styles.candidateSuggestion}>
                          AI: {pct}% markdown → clears in ~{clearDays < 999 ? `${clearDays} days` : 'long time'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.applyBtn, applying && styles.applyBtnDisabled]}
                        onPress={() => handleApplyOffer(c)}
                        disabled={applying}
                      >
                        {applying
                          ? <ActivityIndicator size="small" color={colors.amber} />
                          : <Text style={styles.applyBtnText}>Apply</Text>}
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>

            {/* B. Active Offers */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>ACTIVE OFFERS</Text>
              {activeOffers.length === 0 ? (
                <Text style={styles.emptyText}>No active offers running.</Text>
              ) : (
                activeOffers.map((o) => (
                  <View key={o.id} style={styles.offerRow}>
                    <View style={styles.offerBadge}>
                      <Text style={styles.offerBadgeText}>
                        {o.offer_type === 'percentage' ? `${o.offer_value}% OFF` : `₹${o.offer_value} OFF`}
                      </Text>
                    </View>
                    <View style={styles.offerBody}>
                      <Text style={styles.offerProduct} numberOfLines={1}>
                        {o.product_name ?? 'Product'}
                      </Text>
                      <Text style={styles.offerMeta}>
                        {o.reason ?? ''}{o.end_date ? ` · Ends ${o.end_date}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.endBtn} onPress={() => handleEndOffer(o.id)}>
                      <Text style={styles.endBtnText}>End</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

            {/* C. Festival Pricing */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>FESTIVAL PRICING</Text>
              {festivals.length === 0 ? (
                <Text style={styles.emptyText}>No upcoming festivals in the next 30 days.</Text>
              ) : (
                festivals.map((f, i) => (
                  <View key={i} style={styles.festRow}>
                    <View style={[styles.festDot, { backgroundColor: f.days_away <= 7 ? colors.red : f.days_away <= 14 ? colors.amber : colors.teal }]} />
                    <View style={styles.festBody}>
                      <Text style={styles.festName}>{f.season_name}</Text>
                      <Text style={styles.festMeta}>
                        {f.days_away <= 0 ? 'Today!' : `in ${f.days_away} day${f.days_away > 1 ? 's' : ''}`} · {f.start_date}
                      </Text>
                      <Text style={styles.festSuggestion}>
                        Consider 10–15% off on festive categories based on seasonal trends.
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* D. Competitor Summary */}
            <TouchableOpacity style={styles.card} onPress={() => router.push('/competition' as never)} activeOpacity={0.8}>
              <Text style={styles.cardLabel}>PRICE COMPARISON</Text>
              {overpricedCount > 0 ? (
                <>
                  <View style={styles.overpricedRow}>
                    <Text style={[styles.overpricedCount, { color: colors.red }]}>{overpricedCount}</Text>
                    <View>
                      <Text style={styles.overpricedLabel}>products priced above competitors</Text>
                      <Text style={styles.viewDetailsHint}>View Details →</Text>
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.overpricedRow}>
                  <Text style={[styles.overpricedCount, { color: colors.teal }]}>✓</Text>
                  <Text style={styles.overpricedLabel}>All prices competitive · View Details →</Text>
                </View>
              )}
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
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
    paddingBottom: 8,
    gap: 12,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  screenLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter_800ExtraBold',
  },

  loadingBox: { paddingTop: 80, alignItems: 'center' },

  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 16,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  cardSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'Inter_400Regular',
    paddingVertical: 8,
  },

  // Markdown candidates
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: 10,
  },
  candidateInfo: { flex: 1 },
  candidateName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    marginBottom: 2,
  },
  candidateMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
    marginBottom: 3,
  },
  candidateSuggestion: {
    fontSize: 12,
    color: colors.amber,
    fontFamily: 'Inter_400Regular',
  },
  applyBtn: {
    backgroundColor: `${colors.amber}15`,
    borderWidth: 1,
    borderColor: `${colors.amber}30`,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 54,
    alignItems: 'center',
  },
  applyBtnDisabled: { opacity: 0.5 },
  applyBtnText: { fontSize: 13, fontWeight: '700', color: colors.amber, fontFamily: 'Inter_700Bold' },

  // Active offers
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  offerBadge: {
    backgroundColor: `${colors.teal}15`,
    borderWidth: 1,
    borderColor: `${colors.teal}30`,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: 64,
    alignItems: 'center',
  },
  offerBadgeText: { fontSize: 12, fontWeight: '700', color: colors.teal, fontFamily: 'Inter_700Bold' },
  offerBody: { flex: 1 },
  offerProduct: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  offerMeta: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular' },
  endBtn: {
    backgroundColor: `${colors.red}10`,
    borderWidth: 1,
    borderColor: `${colors.red}25`,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  endBtnText: { fontSize: 12, fontWeight: '700', color: colors.red, fontFamily: 'Inter_700Bold' },

  // Festival
  festRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  festDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  festBody: { flex: 1 },
  festName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  festMeta: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular', marginBottom: 3 },
  festSuggestion: { fontSize: 12, color: colors.teal, fontFamily: 'Inter_400Regular' },

  // Competitor
  overpricedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  overpricedCount: { fontSize: 36, fontWeight: '800', fontFamily: 'Inter_800ExtraBold' },
  overpricedLabel: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter_400Regular' },
  viewDetailsHint: { fontSize: 13, color: colors.blue, fontFamily: 'Inter_700Bold', marginTop: 2 },
});
