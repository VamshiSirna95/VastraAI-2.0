import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '../constants/theme';
import { login } from '../services/auth';
import PinInput from '../components/PinInput';

type Step = 'phone' | 'pin';

export default function LoginScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePhoneNext = () => {
    if (phone.trim().length < 10) {
      setErrorMsg('Enter a valid phone number');
      return;
    }
    setErrorMsg('');
    setStep('pin');
  };

  const handlePinComplete = async (entered: string) => {
    if (loading) return;
    setLoading(true);
    setError(false);
    const result = await login(phone.trim(), entered);
    setLoading(false);
    if (result.success) {
      router.replace('/(tabs)');
    } else {
      setError(true);
      setErrorMsg('Incorrect PIN');
      setTimeout(() => {
        setPin('');
        setError(false);
      }, 700);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>

        {/* Hero */}
        <View style={styles.heroSection}>
          <Text style={styles.brand}>VASTRA</Text>
          <Text style={styles.tagline}>Merchandise Intelligence</Text>
        </View>

        {step === 'phone' ? (
          <View style={styles.form}>
            <Text style={styles.stepLabel}>Enter your phone number</Text>
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={(v) => { setPhone(v); setErrorMsg(''); }}
              placeholder="9XXXXXXXXX"
              placeholderTextColor="rgba(255,255,255,0.2)"
              keyboardType="phone-pad"
              maxLength={10}
              autoFocus
            />
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
            <TouchableOpacity style={styles.nextBtn} onPress={handlePhoneNext}>
              <Text style={styles.nextBtnText}>Continue →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.stepLabel}>Enter your 4-digit PIN</Text>
            <Text style={styles.phoneDisplay}>{phone}</Text>
            <PinInput
              value={pin}
              onChange={setPin}
              onComplete={handlePinComplete}
              error={error}
            />
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
            <TouchableOpacity onPress={() => { setStep('phone'); setPin(''); setError(false); setErrorMsg(''); }}>
              <Text style={styles.backLink}>← Change number</Text>
            </TouchableOpacity>
          </View>
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  inner: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 32, paddingVertical: 24 },

  heroSection: { alignItems: 'center', paddingTop: 40 },
  brand: {
    fontSize: 48, fontWeight: '900', color: '#FFFFFF',
    fontFamily: 'Inter_900Black', letterSpacing: 8,
  },
  tagline: {
    fontSize: 13, color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Inter_400Regular', letterSpacing: 2, marginTop: 6,
  },

  form: { alignItems: 'center', gap: 20, paddingBottom: 32 },
  stepLabel: {
    fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_700Bold', textAlign: 'center',
  },
  phoneInput: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    letterSpacing: 2,
  },
  phoneDisplay: {
    fontSize: 14, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_400Regular',
  },
  errorText: {
    fontSize: 13, color: colors.red, fontFamily: 'Inter_400Regular',
  },
  nextBtn: {
    width: '100%',
    backgroundColor: colors.teal,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#000', fontFamily: 'Inter_700Bold' },
  backLink: {
    fontSize: 13, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular', marginTop: 8,
  },
});
