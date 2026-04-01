import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../constants/theme';

interface Props {
  onResult: (text: string) => void;
}

export default function VoiceSearchButton({ onResult }: Props) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  const open = () => {
    setQuery('');
    setVisible(true);
    setTimeout(() => inputRef.current?.focus(), 120);
  };

  const submit = () => {
    const trimmed = query.trim();
    setVisible(false);
    setQuery('');
    if (trimmed) onResult(trimmed);
  };

  const cancel = () => {
    setVisible(false);
    setQuery('');
  };

  return (
    <>
      <TouchableOpacity style={styles.micBtn} onPress={open} activeOpacity={0.7}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
            stroke={colors.teal}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"
            stroke={colors.teal}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>Voice Search</Text>
            <Text style={styles.hint}>
              {Platform.OS === 'ios'
                ? 'Tap the mic on your keyboard to speak, or type below.'
                : 'Use the mic key on your keyboard to dictate, or type below.'}
            </Text>

            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                placeholder="Speak or type…"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={submit}
              />
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={cancel}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.searchBtn, !query.trim() && styles.searchBtnDisabled]}
                onPress={submit}
                disabled={!query.trim()}
              >
                <Text style={styles.searchBtnText}>Search</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${colors.teal}15`,
    borderWidth: 1,
    borderColor: `${colors.teal}30`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    marginHorizontal: 16,
    padding: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  hint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
    lineHeight: 18,
  },
  inputRow: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  input: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
  },
  btnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'Inter_700Bold',
  },
  searchBtn: {
    flex: 1,
    backgroundColor: colors.teal,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  searchBtnDisabled: { opacity: 0.4 },
  searchBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'Inter_700Bold',
  },
});
