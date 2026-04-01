import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, type ViewStyle } from 'react-native';

interface SkeletonCardProps {
  height?: number;
  style?: ViewStyle;
  rows?: number;
}

export default function SkeletonCard({ height, style, rows = 1 }: SkeletonCardProps) {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  if (height != null) {
    return (
      <Animated.View
        style={[styles.card, { height, opacity: pulseAnim }, style]}
      />
    );
  }

  // Multi-row skeleton
  return (
    <Animated.View style={[styles.card, { opacity: pulseAnim }, style]}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[styles.row, i > 0 && styles.rowGap]}>
          <View style={[styles.bar, styles.barTitle, i > 0 && styles.barShort]} />
          {i === 0 && <View style={styles.barBadge} />}
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowGap: { marginTop: 10 },
  bar: {
    height: 12, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  barTitle: { flex: 1 },
  barShort: { maxWidth: '60%' },
  barBadge: {
    width: 48, height: 20, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
});
