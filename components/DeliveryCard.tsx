import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';
import type { DeliverySchedule } from '../services/delivery';
import { formatDate } from '../services/delivery';

interface DeliveryCardProps {
  schedule: DeliverySchedule;
}

export function DeliveryCard({ schedule }: DeliveryCardProps) {
  const uc = schedule.urgencyColor;

  return (
    <View style={styles.card}>
      {/* Section label + urgency badge */}
      <View style={styles.topRow}>
        <Text style={styles.sectionLabel}>SMART DELIVERY</Text>
        <View style={[styles.urgencyBadge, { backgroundColor: `${uc}22` }]}>
          <Text style={[styles.urgencyText, { color: uc }]}>{schedule.urgency}</Text>
        </View>
      </View>

      {/* Stock cover */}
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Stock cover now</Text>
        <Text style={[styles.rowValue, { color: schedule.stockCoverDays >= 999 ? colors.teal : uc }]}>
          {schedule.stockCoverDays >= 999 ? '∞' : `${schedule.stockCoverDays} days`}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Optimal target</Text>
        <Text style={[styles.rowValue, { color: colors.teal }]}>90 days</Text>
      </View>

      <View style={styles.divider} />

      {/* Delivery dates */}
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Vendor dispatch</Text>
        <Text style={[styles.rowValue, { color: colors.teal }]}>
          {formatDate(schedule.vendorDispatchDate)}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Warehouse arrival</Text>
        <Text style={[styles.rowValue, { color: colors.teal }]}>
          {formatDate(schedule.warehouseArrivalDate)}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Store shelf</Text>
        <Text style={[styles.rowValue, { color: colors.teal }]}>
          {formatDate(schedule.storeShelfDate)}
        </Text>
      </View>

      {/* Message */}
      <Text style={styles.message}>{schedule.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(93,202,165,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(93,202,165,0.12)',
    borderRadius: 12,
    padding: 14,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.teal,
    fontFamily: 'Inter_700Bold',
  },
  urgencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rowLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(93,202,165,0.08)',
    marginVertical: 8,
  },

  message: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
