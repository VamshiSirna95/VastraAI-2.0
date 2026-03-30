import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Audio } from 'expo-av';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../constants/theme';

interface VoiceNotePlayerProps {
  uri: string;
  duration?: number;
  label?: string;
  onDelete?: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function VoiceNotePlayer({ uri, duration, label, onDelete }: VoiceNotePlayerProps) {
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const togglePlayback = async () => {
    try {
      if (playing) {
        await soundRef.current?.pauseAsync();
        setPlaying(false);
      } else {
        if (soundRef.current) {
          await soundRef.current.playAsync();
        } else {
          const { sound } = await Audio.Sound.createAsync(
            { uri },
            { shouldPlay: true },
            (status) => {
              if (!status.isLoaded || status.didJustFinish) {
                setPlaying(false);
              }
            }
          );
          soundRef.current = sound;
        }
        setPlaying(true);
      }
    } catch {
      Alert.alert('Playback Error', 'Could not play voice note.');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Note', 'Remove this voice note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await soundRef.current?.unloadAsync().catch(() => {});
          soundRef.current = null;
          onDelete?.();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.playBtn} onPress={togglePlayback}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          {playing
            ? <Path d="M6 19h4V5H6zM14 5v14h4V5z" fill={colors.teal} />
            : <Path d="M8 5l11 7-11 7V5z" fill={colors.teal} />
          }
        </Svg>
      </TouchableOpacity>

      <View style={styles.body}>
        {label ? <Text style={styles.label} numberOfLines={1}>{label}</Text> : null}
        <View style={styles.waveRow}>
          <View style={[styles.waveBar, playing && styles.waveBarActive]} />
          {duration != null && (
            <Text style={styles.duration}>{formatDuration(duration)}</Text>
          )}
        </View>
      </View>

      {onDelete && (
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M18 6L6 18M6 6l12 12" stroke="rgba(226,75,74,0.6)" strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(93,202,165,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(93,202,165,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  playBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(93,202,165,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: { flex: 1 },
  label: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter_400Regular',
    marginBottom: 3,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  waveBar: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(93,202,165,0.25)',
    borderRadius: 2,
  },
  waveBarActive: {
    backgroundColor: colors.teal,
  },
  duration: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.teal,
    fontFamily: 'Inter_700Bold',
  },
  deleteBtn: {
    padding: 4,
  },
});
