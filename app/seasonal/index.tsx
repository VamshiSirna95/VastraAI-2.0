import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { getSeasonalPlans, createSeasonalPlan } from '../../db/database';
import type { SeasonalPlan } from '../../db/types';
import { logError } from '../../services/errorLogger';
import { formatINR } from '../../utils/format';

// ── Indian retail festival calendar ──────────────────────────────────────────

type Suggestion = {
  name: string;
  type: SeasonalPlan['season_type'];
  month: string;       // e.g. "Mar–Apr"
  accent: string;
  defaultStart: string;
  defaultEnd: string;
  icon: string;
};

const FESTIVAL_SUGGESTIONS: Suggestion[] = [
  { name: 'Sankranti / Pongal', type: 'festival', month: 'Jan', accent: colors.amber, defaultStart: '2027-01-10', defaultEnd: '2027-01-14', icon: '🪁' },
  { name: 'Republic Day Sale', type: 'festival', month: 'Jan', accent: colors.blue, defaultStart: '2027-01-20', defaultEnd: '2027-01-26', icon: '🇮🇳' },
  { name: 'Valentine\'s Week', type: 'festival', month: 'Feb', accent: '#E24B4A', defaultStart: '2027-02-07', defaultEnd: '2027-02-14', icon: '❤️' },
  { name: 'Ugadi / Gudi Padwa', type: 'festival', month: 'Mar–Apr', accent: colors.teal, defaultStart: '2027-03-28', defaultEnd: '2027-04-06', icon: '🌸' },
  { name: 'Ramadan / Eid', type: 'festival', month: 'Mar–Apr', accent: '#5DCAA5', defaultStart: '2027-03-01', defaultEnd: '2027-03-31', icon: '🌙' },
  { name: 'Summer Collection', type: 'summer', month: 'Apr–Jun', accent: colors.amber, defaultStart: '2027-04-01', defaultEnd: '2027-06-30', icon: '☀️' },
  { name: 'Raksha Bandhan', type: 'festival', month: 'Aug', accent: colors.amber, defaultStart: '2027-08-07', defaultEnd: '2027-08-10', icon: '🧵' },
  { name: 'Ganesh Chaturthi', type: 'festival', month: 'Aug–Sep', accent: colors.amber, defaultStart: '2027-08-18', defaultEnd: '2027-08-28', icon: '🐘' },
  { name: 'Navratri / Durga Puja', type: 'festival', month: 'Sep–Oct', accent: colors.red, defaultStart: '2027-09-22', defaultEnd: '2027-10-02', icon: '🪔' },
  { name: 'Diwali Season', type: 'festival', month: 'Oct–Nov', accent: colors.amber, defaultStart: '2027-10-15', defaultEnd: '2027-11-05', icon: '🪔' },
  { name: 'Wedding Season', type: 'wedding', month: 'Nov–Feb', accent: colors.red, defaultStart: '2027-11-01', defaultEnd: '2028-02-28', icon: '💍' },
  { name: 'Back to School', type: 'back_to_school', month: 'Jun', accent: colors.blue, defaultStart: '2027-06-01', defaultEnd: '2027-06-20', icon: '📚' },
  { name: 'Winter Collection', type: 'winter', month: 'Nov–Jan', accent: colors.blue, defaultStart: '2027-11-01', defaultEnd: '2028-01-31', icon: '❄️' },
];

const STATUS_COLOR: Record<string, string> = {
  planning: colors.amber,
  active: colors.teal,
  completed: 'rgba(255,255,255,0.3)',
};

function formatDate(d: string): string {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SeasonalIndexScreen() {
  const router = useRouter();
  const [plans, setPlans] = useState<SeasonalPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setPlans(await getSeasonalPlans());
    } catch (e) {
      logError('SeasonalIndexScreen.load', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handlePlanNow = async (s: Suggestion) => {
    const id = await createSeasonalPlan({
      season_name: s.name,
      season_type: s.type,
      start_date: s.defaultStart,
      end_date: s.defaultEnd,
      status: 'planning',
    });
    router.push({ pathname: '/seasonal/plan', params: { id: String(id) } });
  };

  const handleCustom = async () => {
    const id = await createSeasonalPlan({
      season_name: 'Custom Season',
      season_type: 'custom',
      start_date: '',
      end_date: '',
      status: 'planning',
    });
    router.push({ pathname: '/seasonal/plan', params: { id: String(id) } });
  };

  // Map plan names to suggestions for accent color
  const accentFor = (name: string): string => {
    const match = FESTIVAL_SUGGESTIONS.find((s) => s.name === name);
    return match?.accent ?? colors.teal;
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
          <Text style={styles.screenLabel}>PLANNING</Text>
          <Text style={styles.screenTitle}>Seasonal Plans</Text>
        </View>
        <TouchableOpacity style={styles.customBtn} onPress={handleCustom}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={colors.teal} strokeWidth={2.2} strokeLinecap="round" />
          </Svg>
          <Text style={styles.customBtnText}>Custom</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={colors.teal} size="large" /></View>
      ) : error ? (
        <View style={styles.errorState}>
          <Text style={styles.errorText}>Failed to load plans</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          {/* Existing plans */}
          {plans.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>YOUR PLANS</Text>
              {plans.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.planCard}
                  onPress={() => router.push({ pathname: '/seasonal/plan', params: { id: String(p.id) } })}
                >
                  <View style={[styles.planAccentBar, { backgroundColor: accentFor(p.season_name) }]} />
                  <View style={styles.planCardBody}>
                    <View style={styles.planCardTop}>
                      <Text style={styles.planName}>{p.season_name}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[p.status] + '22', borderColor: STATUS_COLOR[p.status] + '44' }]}>
                        <Text style={[styles.statusBadgeText, { color: STATUS_COLOR[p.status] }]}>
                          {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.planDates}>{formatDate(p.start_date)} – {formatDate(p.end_date)}</Text>
                    <View style={styles.planMeta}>
                      {(p.item_count ?? 0) > 0 && (
                        <Text style={styles.planMetaText}>{p.item_count} categories</Text>
                      )}
                      {p.target_budget ? (
                        <Text style={styles.planMetaText}>Budget: {formatINR(p.target_budget)}</Text>
                      ) : null}
                      {(p.allocated_value ?? 0) > 0 ? (
                        <Text style={[styles.planMetaText, { color: colors.teal }]}>{formatINR(p.allocated_value ?? 0)} planned</Text>
                      ) : null}
                    </View>
                  </View>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* Upcoming festivals */}
          <Text style={styles.sectionLabel}>UPCOMING FESTIVALS & SEASONS</Text>
          {FESTIVAL_SUGGESTIONS.map((s) => {
            const existing = plans.find((p) => p.season_name === s.name);
            return (
              <View key={s.name} style={styles.suggCard}>
                <View style={[styles.suggAccentBar, { backgroundColor: s.accent }]} />
                <View style={styles.suggBody}>
                  <View style={styles.suggTop}>
                    <Text style={styles.suggIcon}>{s.icon}</Text>
                    <View style={styles.suggInfo}>
                      <Text style={styles.suggName}>{s.name}</Text>
                      <Text style={styles.suggMonth}>{s.month}</Text>
                    </View>
                  </View>
                </View>
                {existing ? (
                  <TouchableOpacity
                    style={[styles.planNowBtn, { backgroundColor: s.accent + '22', borderColor: s.accent + '44' }]}
                    onPress={() => router.push({ pathname: '/seasonal/plan', params: { id: String(existing.id) } })}
                  >
                    <Text style={[styles.planNowBtnText, { color: s.accent }]}>View →</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.planNowBtn, { backgroundColor: s.accent + '15', borderColor: s.accent + '33' }]}
                    onPress={() => handlePlanNow(s)}
                  >
                    <Text style={[styles.planNowBtnText, { color: s.accent }]}>Plan Now →</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10,
  },
  backBtn: { padding: 4 },
  headerBody: { flex: 1 },
  screenLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_700Bold',
  },
  screenTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', fontFamily: 'Inter_800ExtraBold' },
  customBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: colors.teal + '15', borderRadius: 10,
    borderWidth: 1, borderColor: colors.teal + '33',
  },
  customBtnText: { fontSize: 13, fontWeight: '700', color: colors.teal, fontFamily: 'Inter_700Bold' },

  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
  errorText: { fontSize: 15, color: colors.red, fontFamily: 'Inter_400Regular' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.06)' },
  retryBtnText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_700Bold' },
  content: { paddingHorizontal: 16 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_700Bold', marginBottom: 10, marginTop: 16,
  },

  // Existing plan card
  planCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14, overflow: 'hidden', marginBottom: 10,
    paddingRight: 14,
  },
  planAccentBar: { width: 4, alignSelf: 'stretch' },
  planCardBody: { flex: 1, padding: 14 },
  planCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  planName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  planDates: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular', marginBottom: 6 },
  planMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  planMetaText: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },

  // Suggestion card
  suggCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, overflow: 'hidden', marginBottom: 8,
    paddingRight: 14,
  },
  suggAccentBar: { width: 3, alignSelf: 'stretch' },
  suggBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  suggTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suggIcon: { fontSize: 20 },
  suggInfo: {},
  suggName: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter_700Bold' },
  suggMonth: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular', marginTop: 2 },
  planNowBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1,
  },
  planNowBtnText: { fontSize: 12, fontWeight: '700', fontFamily: 'Inter_700Bold' },
});
