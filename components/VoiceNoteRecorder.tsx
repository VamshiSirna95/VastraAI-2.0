import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '../constants/theme';

type RecorderState = 'idle' | 'recording' | 'recorded';

interface VoiceNoteRecorderProps {
  onSave: (fileUri: string, durationSeconds: number) => void;
  onCancel: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function VoiceNoteRecorder({ onSave, onCancel }: VoiceNoteRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [playback, setPlayback] = useState<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      playback?.unloadAsync().catch(() => {});
    };
  }, [playback]);

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Microphone access is needed to record voice notes.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setState('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } catch {
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      const status = await recordingRef.current.getStatusAsync();
      const duration = status.isRecording ? elapsed : Math.round((status.durationMillis ?? elapsed * 1000) / 1000);
      recordingRef.current = null;
      if (uri) {
        setRecordedUri(uri);
        setRecordedDuration(duration || elapsed);
        setState('recorded');
      }
    } catch {
      Alert.alert('Error', 'Could not stop recording.');
    }
  };

  const togglePlayback = async () => {
    if (!recordedUri) return;
    if (playing) {
      await playback?.pauseAsync();
      setPlaying(false);
    } else {
      if (playback) {
        await playback.playAsync();
      } else {
        const { sound } = await Audio.Sound.createAsync(
          { uri: recordedUri },
          { shouldPlay: true },
          (status) => {
            if (!status.isLoaded || status.didJustFinish) setPlaying(false);
          }
        );
        setPlayback(sound);
      }
      setPlaying(true);
    }
  };

  const retake = async () => {
    if (playback) { await playback.unloadAsync(); setPlayback(null); }
    setPlaying(false);
    setRecordedUri(null);
    setRecordedDuration(0);
    setElapsed(0);
    setState('idle');
  };

  const handleSave = () => {
    if (!recordedUri) return;
    onSave(recordedUri, recordedDuration);
  };

  return (
    <View style={styles.container}>
      {state === 'idle' && (
        <View style={styles.idleRow}>
          <TouchableOpacity style={styles.micBtn} onPress={startRecording}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke={colors.amber} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke={colors.amber} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.micBtnText}>Record Note</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {state === 'recording' && (
        <View style={styles.recordingRow}>
          <View style={styles.recordingIndicator}>
            <View style={styles.pulseDot} />
            <Text style={styles.recordingTimer}>{formatDuration(elapsed)}</Text>
          </View>
          <TouchableOpacity style={styles.stopBtn} onPress={stopRecording}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M6 6h12v12H6z" fill={colors.red} stroke={colors.red} strokeWidth={1} />
            </Svg>
            <Text style={styles.stopBtnText}>Stop</Text>
          </TouchableOpacity>
        </View>
      )}

      {state === 'recorded' && recordedUri && (
        <View style={styles.recordedContainer}>
          <View style={styles.recordedPreview}>
            <TouchableOpacity style={styles.playBtn} onPress={togglePlayback}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                {playing
                  ? <Path d="M6 19h4V5H6zM14 5v14h4V5z" fill={colors.teal} />
                  : <Path d="M8 5l11 7-11 7V5z" fill={colors.teal} />
                }
              </Svg>
            </TouchableOpacity>
            <View style={styles.waveformBar} />
            <Text style={styles.durationText}>{formatDuration(recordedDuration)}</Text>
          </View>
          <View style={styles.recordedActions}>
            <TouchableOpacity style={styles.retakeBtn} onPress={retake}>
              <Text style={styles.retakeBtnText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save Note</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  idleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  micBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,159,39,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,159,39,0.25)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  micBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.amber,
    fontFamily: 'Inter_700Bold',
  },
  cancelBtn: { padding: 8 },
  cancelText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
  },

  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.red,
  },
  recordingTimer: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(226,75,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(226,75,74,0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  stopBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.red,
    fontFamily: 'Inter_700Bold',
  },

  recordedContainer: { gap: 10 },
  recordedPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(93,202,165,0.06)',
    borderRadius: 8,
    padding: 10,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(93,202,165,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveformBar: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(93,202,165,0.3)',
    borderRadius: 2,
  },
  durationText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.teal,
    fontFamily: 'Inter_700Bold',
  },
  recordedActions: {
    flexDirection: 'row',
    gap: 8,
  },
  retakeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  retakeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter_700Bold',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.teal,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'Inter_700Bold',
  },
});
