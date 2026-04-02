import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initDatabase, getUserCount } from '../db/database';
import { seedDemoData } from '../db/seed';
import { isLoggedIn } from '../services/auth';
import { generateAutoNotifications } from '../services/notifications';
import { cleanupOldPhotos } from '../services/imageManager';
import AuroraBackground from '../components/AuroraBackground';
import ErrorBoundary from '../components/ErrorBoundary';
import OfflineNotice from '../components/OfflineNotice';

SplashScreen.preventAutoHideAsync();

const CLEANUP_KEY = 'last_photo_cleanup';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });
  const [dbReady, setDbReady] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    async function init() {
      try {
        // DB init and seed run sequentially (seed depends on DB)
        await initDatabase();
        await seedDemoData();

        // Auth checks run in parallel (all depend on DB being ready)
        const [loggedIn, userCount, onboardingFlag] = await Promise.all([
          isLoggedIn(),
          getUserCount(),
          AsyncStorage.getItem('onboarding_complete'),
        ]);
        const noUsers = userCount === 0;
        const notComplete = onboardingFlag !== 'true';
        setNeedsOnboarding(noUsers && notComplete);
        setAuthed(loggedIn);
        setDbReady(true);

        // Defer non-critical background work
        setTimeout(() => {
          generateAutoNotifications().catch(() => {});
        }, 3000);

        // Run photo cleanup once per day
        setTimeout(async () => {
          try {
            const lastCleanup = await AsyncStorage.getItem(CLEANUP_KEY);
            const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
            if (!lastCleanup || parseInt(lastCleanup, 10) < oneDayAgo) {
              await cleanupOldPhotos(90);
              await AsyncStorage.setItem(CLEANUP_KEY, String(Date.now()));
            }
          } catch { /* non-critical */ }
        }, 5000);
      } catch (err) {
        console.error('DB init failed:', err);
        setNeedsOnboarding(false);
        setAuthed(false);
        setDbReady(true);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!fontsLoaded || !dbReady || authed === null || needsOnboarding === null) return;
    SplashScreen.hideAsync();
    const seg0 = segments[0] as string | undefined;
    const inLogin = seg0 === 'login';
    const inOnboarding = seg0 === 'onboarding';

    if (needsOnboarding && !inOnboarding) {
      router.replace('/onboarding' as never);
    } else if (!needsOnboarding && !authed && !inLogin && !inOnboarding) {
      router.replace('/login');
    } else if (authed && inLogin) {
      router.replace('/(tabs)');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsLoaded, dbReady, authed, needsOnboarding]);

  if (!fontsLoaded || !dbReady || authed === null || needsOnboarding === null) return null;

  return (
    <ErrorBoundary>
      <View style={styles.root}>
        <AuroraBackground />
        <OfflineNotice />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
        <StatusBar style="light" />
      </View>
    </ErrorBoundary>
  );
}
