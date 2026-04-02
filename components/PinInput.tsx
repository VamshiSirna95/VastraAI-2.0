import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../constants/theme';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface PinInputProps {
  value: string;
  onChange: (val: string) => void;
  onComplete: (val: string) => void;
  error?: boolean;
}

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

export default function PinInput({ value, onChange, onComplete, error }: PinInputProps) {
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (error) {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [error, shakeAnim]);

  const handleKey = (key: string) => {
    if (key === '') return;
    if (key === '⌫') {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length >= 4) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    const next = value + key;
    onChange(next);
    if (next.length === 4) onComplete(next);
  };

  return (
    <View style={styles.root}>
      {/* Circles */}
      <Animated.View style={[styles.circles, { transform: [{ translateX: shakeAnim }] }]}>
        {[0,1,2,3].map((i) => (
          <View
            key={i}
            style={[
              styles.circle,
              value.length > i && styles.circleFilled,
              error && styles.circleError,
            ]}
          />
        ))}
      </Animated.View>

      {/* Numpad */}
      <View style={styles.numpad}>
        {KEYS.map((key, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.key, key === '' && styles.keyEmpty]}
            onPress={() => handleKey(key)}
            disabled={key === ''}
            activeOpacity={0.6}
          >
            <Text style={[styles.keyText, key === '⌫' && styles.keyBackspace]}>{key}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 32 },

  circles: { flexDirection: 'row', gap: 20 },
  circle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  circleFilled: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  circleError: {
    borderColor: colors.red,
    backgroundColor: hexToRgba(colors.red, 0.5),
  },

  numpad: {
    width: 240,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  key: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyEmpty: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  keyText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  keyBackspace: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.5)',
  },
});
