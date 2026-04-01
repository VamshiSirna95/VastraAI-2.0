import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors } from '../constants/theme';

const CHECK_INTERVAL_MS = 12000;
const TIMEOUT_MS = 4000;

async function checkOnline(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await fetch('https://clients3.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    return true;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

export default function OfflineNotice() {
  const [offline, setOffline] = useState(false);
  const slideAnim = useRef(new Animated.Value(-40)).current;

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const run = async () => {
      const online = await checkOnline();
      if (!cancelled) { setOffline(!online); }
      intervalId = setInterval(async () => {
        const result = await checkOnline();
        if (!cancelled) { setOffline(!result); }
      }, CHECK_INTERVAL_MS);
    };

    run().catch(() => {});

    return () => {
      cancelled = true;
      if (intervalId) { clearInterval(intervalId); }
    };
  }, []);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: offline ? 0 : -40,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [offline]);

  if (!offline) return null;

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.dot} />
      <Text style={styles.text}>Offline — data saved locally</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999,
    backgroundColor: `${colors.amber}E8`,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 6, paddingHorizontal: 16, gap: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#000000', opacity: 0.6 },
  text: { fontSize: 12, color: '#000000', fontFamily: 'Inter_700Bold' },
});
