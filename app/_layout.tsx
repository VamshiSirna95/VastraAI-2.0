import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
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
import { initDatabase, destroyDatabase } from '../db/database';
import { seedDemoData } from '../db/seed';
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

  useEffect(() => {
    async function init() {
      try {
        try {
          await initDatabase();
        } catch (dbErr) {
          console.error('DB init failed, resetting database:', dbErr);
          await destroyDatabase();
          await initDatabase();
        }
        await seedDemoData();
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
        setDbReady(true);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (fontsLoaded && dbReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, dbReady]);

  if (!fontsLoaded || !dbReady) return null;

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
