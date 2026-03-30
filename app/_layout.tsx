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
import { initDatabase } from '../db/database';
import { seedDemoData } from '../db/seed';
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

  useEffect(() => {
    initDatabase()
      .then(() => seedDemoData())
      .then(() => setDbReady(true))
      .catch((err) => {
        console.error('DB init failed:', err);
        setDbReady(true); // still show app
      });
  }, []);

  useEffect(() => {
    if (fontsLoaded && dbReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, dbReady]);

  if (!fontsLoaded || !dbReady) return null;

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
      <StatusBar style="light" />
    </View>
  );
}
