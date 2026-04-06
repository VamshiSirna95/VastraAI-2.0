import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../constants/theme';
import { createUser, createStore } from '../db/database';
import GlassInput from '../components/ui/GlassInput';
import PinInput from '../components/PinInput';

const { width } = Dimensions.get('window');

const SEED_STORES = [
  'KMF Main', 'KMF Kukatpally', 'KMF Dilsukhnagar',
  'KMF Ameerpet', 'KMF Secunderabad', 'KMF Malakpet', 'KMF KPHB',
];

function PageDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i === current && styles.dotActive]}
        />
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  // Page 2 — Business
  const [bizName, setBizName] = useState('K.M. Fashions');
  const [bizCity, setBizCity] = useState('Hyderabad');
  const [numStores, setNumStores] = useState('7');

  // Page 3 — Owner Account
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const [pinStep, setPinStep] = useState<'set' | 'confirm'>('set');
  const [pinError, setPinError] = useState('');

  // Page 4 — Stores
  const [stores, setStores] = useState<string[]>([...SEED_STORES]);

  // Completion
  const [completing, setCompleting] = useState(false);

  const goTo = (p: number) => {
    setPage(p);
    scrollRef.current?.scrollTo({ x: p * width, animated: true });
  };

  const handleNextPage2 = () => {
    if (!bizName.trim()) { Alert.alert('Required', 'Please enter your business name'); return; }
    goTo(2);
  };

  const handleNextPage3 = () => {
    if (!ownerName.trim()) { Alert.alert('Required', 'Please enter your name'); return; }
    if (!ownerPhone.trim() || ownerPhone.length < 10) { Alert.alert('Required', 'Please enter a valid 10-digit phone number'); return; }
    if (pinStep === 'set') { Alert.alert('Required', 'Please set your 4-digit PIN'); return; }
    if (!pin1) { Alert.alert('Required', 'Please complete PIN setup'); return; }
    goTo(3);
  };

  const handlePinComplete = (val: string) => {
    if (pinStep === 'set') {
      setPin1(val);
      setPin2('');
      setPinStep('confirm');
      setPinError('');
    } else {
      if (val !== pin1) {
        setPinError('PINs do not match — try again');
        setPin1('');
        setPin2('');
        setPinStep('set');
      } else {
        setPinError('');
        setPin2(val);
      }
    }
  };

  const updateStore = (idx: number, val: string) => {
    const next = [...stores];
    next[idx] = val;
    setStores(next);
  };

  const removeStore = (idx: number) => {
    setStores(stores.filter((_, i) => i !== idx));
  };

  const addStore = () => {
    setStores([...stores, '']);
  };

  const handleLaunch = async () => {
    if (completing) return;
    setCompleting(true);
    try {
      // Save business name
      await AsyncStorage.setItem('business_name', bizName.trim());

      // Create owner user
      const phone = ownerPhone.trim().replace(/\D/g, '');
      await createUser({
        name: ownerName.trim(),
        role: 'admin',
        phone,
        pin: pin1,
        is_active: 1,
      });

      // Create stores (filter empty names)
      const validStores = stores.filter((s) => s.trim().length > 0);
      for (const storeName of validStores) {
        await createStore({ name: storeName.trim(), code: '', is_active: 1 });
      }

      // Mark onboarding complete
      await AsyncStorage.setItem('onboarding_complete', 'true');

      // Navigate to login
      router.replace('/login' as never);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Setup failed. Please try again.');
      setCompleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={styles.flex}
        >

          {/* ── Page 1: Welcome ─── */}
          <View style={[styles.page, { width }]}>
            <View style={styles.welcomeCenter}>
              <View style={styles.tealGlow} />
              <Text style={styles.vastraLogo}>VASTRA</Text>
              <Text style={styles.vastraTagline}>Merchandise Intelligence</Text>
              <Text style={styles.welcomeDesc}>
                Your all-in-one platform for product cataloguing, purchasing, inventory and vendor management.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => goTo(1)}>
                <Text style={styles.primaryBtnText}>Get Started →</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Page 2: Business Setup ─── */}
          <View style={[styles.page, { width }]}>
            <ScrollView contentContainerStyle={styles.pageScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.pageTitle}>Your Business</Text>
              <Text style={styles.pageSubtitle}>Tell us about your store so we can personalise VASTRA for you.</Text>
              <View style={styles.formCard}>
                <GlassInput
                  label="Business Name"
                  value={bizName}
                  onChangeText={setBizName}
                  placeholder="K.M. Fashions"
                  autoCapitalize="words"
                />
                <View style={styles.formGap} />
                <GlassInput
                  label="City"
                  value={bizCity}
                  onChangeText={setBizCity}
                  placeholder="Hyderabad"
                  autoCapitalize="words"
                />
                <View style={styles.formGap} />
                <GlassInput
                  label="Number of Stores"
                  value={numStores}
                  onChangeText={setNumStores}
                  placeholder="7"
                  keyboardType="number-pad"
                />
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleNextPage2}>
                <Text style={styles.primaryBtnText}>Next →</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* ── Page 3: Owner Account ─── */}
          <View style={[styles.page, { width }]}>
            <ScrollView contentContainerStyle={styles.pageScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.pageTitle}>Create Owner Account</Text>
              <Text style={styles.pageSubtitle}>This will be the administrator account for VASTRA.</Text>
              <View style={styles.formCard}>
                <GlassInput
                  label="Your Name"
                  value={ownerName}
                  onChangeText={setOwnerName}
                  placeholder="Full name"
                  autoCapitalize="words"
                />
                <View style={styles.formGap} />
                <View>
                  <Text style={styles.phoneLabel}>+91 Phone Number</Text>
                  <View style={styles.phoneRow}>
                    <View style={styles.phonePrefix}>
                      <Text style={styles.phonePrefixText}>+91</Text>
                    </View>
                    <GlassInput
                      style={styles.phoneInput}
                      value={ownerPhone}
                      onChangeText={(v) => setOwnerPhone(v.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit number"
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.pinSection}>
                <Text style={styles.pinLabel}>
                  {pinStep === 'set' ? 'Set 4-Digit PIN' : 'Confirm PIN'}
                </Text>
                {!!pinError && <Text style={styles.pinError}>{pinError}</Text>}
                {pin1 && pinStep === 'confirm' && !pin2 && (
                  <Text style={styles.pinSuccess}>PIN set — now confirm it</Text>
                )}
                {pin1 && pin2 && (
                  <Text style={styles.pinSuccess}>✓ PIN confirmed</Text>
                )}
                {(!pin1 || (pin1 && !pin2)) && (
                  <PinInput
                    value={pinStep === 'set' ? '' : ''}
                    onChange={() => {}}
                    onComplete={handlePinComplete}
                    error={!!pinError}
                  />
                )}
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleNextPage3}>
                <Text style={styles.primaryBtnText}>Next →</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* ── Page 4: Store Setup ─── */}
          <View style={[styles.page, { width }]}>
            <ScrollView contentContainerStyle={styles.pageScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.pageTitle}>Add Your Stores</Text>
              <Text style={styles.pageSubtitle}>Pre-filled with KMF locations — edit or add your own.</Text>

              {stores.map((s, i) => (
                <View key={i} style={styles.storeRow}>
                  <GlassInput
                    style={styles.storeInput}
                    value={s}
                    onChangeText={(v) => updateStore(i, v)}
                    placeholder={`Store ${i + 1}`}
                    autoCapitalize="words"
                  />
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeStore(i)}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.addStoreBtn} onPress={addStore}>
                <Text style={styles.addStoreBtnText}>+ Add Store</Text>
              </TouchableOpacity>

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.skipBtn} onPress={() => goTo(4)}>
                  <Text style={styles.skipBtnText}>Skip — I'll add later</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => goTo(4)}>
                  <Text style={styles.primaryBtnText}>Next →</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>

          {/* ── Page 5: Launch ─── */}
          <View style={[styles.page, { width }]}>
            <ScrollView contentContainerStyle={styles.pageScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.pageTitle}>You're all set!</Text>
              <Text style={styles.pageSubtitle}>
                VASTRA is ready. Add your Gemini API key in Settings → AI Engine for automatic garment detection.
              </Text>
              <View style={styles.aiInfoCard}>
                <Text style={styles.aiInfoText}>
                  Add a free Google Gemini API key from aistudio.google.com to enable AI-powered garment detection.
                </Text>
              </View>

              {completing ? (
                <View style={styles.launchLoader}>
                  <ActivityIndicator color={colors.teal} size="large" />
                  <Text style={styles.launchingText}>Setting up VASTRA…</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.launchBtn} onPress={handleLaunch}>
                  <Text style={styles.launchBtnText}>Launch VASTRA →</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

        </ScrollView>

        <PageDots current={page} total={5} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  flex: { flex: 1 },

  dots: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' },
  dotActive: { width: 20, backgroundColor: colors.teal },

  page: { flex: 1, paddingHorizontal: 24 },
  pageScroll: { paddingTop: 40, paddingBottom: 40 },

  // Welcome page
  welcomeCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
  tealGlow: {
    position: 'absolute',
    width: 300, height: 300,
    borderRadius: 150,
    backgroundColor: `${colors.teal}10`,
    top: '20%',
  },
  vastraLogo: {
    fontSize: 56, fontWeight: '900', color: colors.teal,
    fontFamily: 'Inter_900Black', letterSpacing: 8, marginBottom: 8,
  },
  vastraTagline: {
    fontSize: 18, color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter_400Regular', letterSpacing: 3, marginBottom: 32,
  },
  welcomeDesc: {
    fontSize: 15, color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22,
    marginBottom: 48, paddingHorizontal: 16,
  },

  pageTitle: {
    fontSize: 26, fontWeight: '900', color: '#FFFFFF',
    fontFamily: 'Inter_900Black', marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 14, color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular', lineHeight: 20, marginBottom: 28,
  },

  formCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, padding: 16, marginBottom: 24,
  },
  formGap: { height: 12 },

  phoneLabel: {
    fontSize: 12, color: 'rgba(255,255,255,0.45)',
    fontFamily: 'Inter_700Bold', marginBottom: 6,
  },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phonePrefix: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 14,
  },
  phonePrefixText: { fontSize: 15, color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  phoneInput: { flex: 1 },

  pinSection: { marginBottom: 24, alignItems: 'center' },
  pinLabel: {
    fontSize: 14, color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Inter_700Bold', marginBottom: 12, textAlign: 'center',
  },
  pinError: {
    fontSize: 13, color: colors.red,
    fontFamily: 'Inter_400Regular', marginBottom: 8, textAlign: 'center',
  },
  pinSuccess: {
    fontSize: 13, color: colors.teal,
    fontFamily: 'Inter_700Bold', marginBottom: 8, textAlign: 'center',
  },

  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  storeInput: { flex: 1 },
  removeBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: `${colors.red}15`, borderWidth: 1, borderColor: `${colors.red}25`,
    justifyContent: 'center', alignItems: 'center',
  },
  removeBtnText: { fontSize: 14, color: colors.red, fontFamily: 'Inter_700Bold' },
  addStoreBtn: {
    borderWidth: 1, borderColor: `${colors.teal}30`, borderStyle: 'dashed',
    borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 24,
  },
  addStoreBtnText: { fontSize: 14, color: colors.teal, fontFamily: 'Inter_700Bold' },

  aiInfoCard: {
    backgroundColor: `${colors.blue}10`, borderWidth: 1, borderColor: `${colors.blue}25`,
    borderRadius: 12, padding: 14, marginBottom: 20,
  },
  aiInfoText: {
    fontSize: 13, color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter_400Regular', lineHeight: 18,
  },
  testBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginBottom: 16,
  },
  testBtnText: { fontSize: 14, color: colors.teal, fontFamily: 'Inter_700Bold' },

  launchLoader: { alignItems: 'center', paddingTop: 24, gap: 12 },
  launchingText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular' },

  // Buttons
  btnRow: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' },
  primaryBtn: {
    backgroundColor: colors.teal, borderRadius: 12,
    paddingVertical: 15, paddingHorizontal: 28, alignItems: 'center',
  },
  primaryBtnText: { fontSize: 15, color: '#000000', fontFamily: 'Inter_800ExtraBold' },
  skipBtn: { paddingVertical: 12, paddingHorizontal: 8 },
  skipBtnText: { fontSize: 13, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular' },
  launchBtn: {
    backgroundColor: colors.teal, borderRadius: 12,
    paddingVertical: 15, paddingHorizontal: 24, alignItems: 'center',
  },
  launchBtnText: { fontSize: 15, color: '#000000', fontFamily: 'Inter_800ExtraBold' },
});
