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
import { initDatabase } from '../db/database';
import { seedDemoData } from '../db/seed';
import { isLoggedIn } from '../services/auth';
import { generateAutoNotifications } from '../services/notifications';
import AuroraBackground from '../components/AuroraBackground';

SplashScreen.preventAutoHideAsync();

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
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    initDatabase()
      .then(() => seedDemoData())
      .then(() => generateAutoNotifications().catch(() => {}))
      .then(async () => {
        const loggedIn = await isLoggedIn();
        setAuthed(loggedIn);
        setDbReady(true);
      })
      .catch((err) => {
        console.error('DB init failed:', err);
        setAuthed(false);
        setDbReady(true);
      });
  }, []);

  useEffect(() => {
    if (!fontsLoaded || !dbReady || authed === null) return;
    SplashScreen.hideAsync();
    const inLogin = segments[0] === 'login';
    if (!authed && !inLogin) {
      router.replace('/login');
    } else if (authed && inLogin) {
      router.replace('/(tabs)');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsLoaded, dbReady, authed]);

  if (!fontsLoaded || !dbReady || authed === null) return null;

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
      <StatusBar style="light" />
    </View>
  );
}
