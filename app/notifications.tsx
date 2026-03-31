import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '../constants/theme';
import { getNotifications, markRead, markAllRead } from '../services/notifications';
import type { AppNotification } from '../db/types';

const TYPE_COLOR: Record<AppNotification['type'], string> = {
  po_status: colors.amber,
  grn_due: colors.red,
  stock_low: colors.teal,
  demand_match: colors.blue,
  transfer: colors.purple,
  system: 'rgba(255,255,255,0.4)',
};

const TYPE_ICON_PATH: Record<AppNotification['type'], string> = {
  po_status: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z',
  grn_due: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  stock_low: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  demand_match: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z',
  transfer: 'M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4',
  system: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleMarkAll = async () => {
    await markAllRead();
    load();
  };

  const handleTap = async (n: AppNotification) => {
    if (!n.is_read) {
      await markRead(n.id);
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, is_read: 1 } : x))
      );
    }
    // Navigate to reference
    if (n.reference_type === 'po' && n.reference_id) {
      router.push({ pathname: '/po/[id]', params: { id: n.reference_id } });
    } else if (n.reference_type === 'product' && n.reference_id) {
      router.push({ pathname: '/product/[id]', params: { id: n.reference_id } });
    } else if (n.reference_type === 'demand') {
      router.push('/demand/index');
    } else if (n.reference_type === 'transfer') {
      router.push('/stock/index');
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

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
          <Text style={styles.screenLabel}>ALERTS</Text>
          <Text style={styles.screenTitle}>
            Notifications{unreadCount > 0 ? ` · ${unreadCount}` : ''}
          </Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAll}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.teal} size="large" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
            <Path
              d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptyBody}>No notifications right now. Check back later.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} colors={[colors.teal]} />}>
          {notifications.map((n) => {
            const dotColor = TYPE_COLOR[n.type];
            const iconPath = TYPE_ICON_PATH[n.type];
            const unread = !n.is_read;
            return (
              <TouchableOpacity
                key={n.id}
                style={[styles.card, unread && styles.cardUnread]}
                onPress={() => handleTap(n)}
                activeOpacity={0.7}
              >
                {/* Icon */}
                <View style={[styles.iconWrap, { backgroundColor: dotColor + '22', borderColor: dotColor + '44' }]}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d={iconPath} stroke={dotColor} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>

                {/* Body */}
                <View style={styles.cardBody}>
                  <View style={styles.cardTitleRow}>
                    <Text style={[styles.cardTitle, unread && styles.cardTitleUnread]} numberOfLines={1}>
                      {n.title}
                    </Text>
                    {unread && <View style={[styles.unreadDot, { backgroundColor: dotColor }]} />}
                  </View>
                  <Text style={styles.cardBodyText} numberOfLines={2}>{n.body}</Text>
                  <Text style={styles.cardTime}>{timeAgo(n.created_at)}</Text>
                </View>
              </TouchableOpacity>
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
  markAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  markAllText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_400Regular' },

  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingBottom: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_700Bold' },
  emptyBody: { fontSize: 13, color: 'rgba(255,255,255,0.2)', fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 40 },

  content: { paddingHorizontal: 16, paddingTop: 4 },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  cardUnread: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.09)',
  },

  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  cardTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter_700Bold',
  },
  cardTitleUnread: { color: '#FFFFFF' },
  unreadDot: { width: 7, height: 7, borderRadius: 4 },
  cardBodyText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
    marginBottom: 4,
  },
  cardTime: { fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: 'Inter_400Regular' },
});
