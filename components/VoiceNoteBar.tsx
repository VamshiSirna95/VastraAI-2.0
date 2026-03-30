import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Audio } from 'expo-av';
import { colors } from '../constants/theme';
import { startRecording, stopRecording, playAudio, deleteAudioFile } from '../services/audio';

// ── Waveform bars ─────────────────────────────────────────────────────────────

const BAR_HEIGHTS = [8, 14, 10, 18, 12, 20, 8, 16, 10, 22, 14, 18, 10, 14, 8, 20, 12, 16, 10, 14];

function WaveformBars({ playing }: { playing: boolean }) {
  const anims = useRef(BAR_HEIGHTS.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    if (!playing) {
      anims.forEach((a) => a.setValue(1));
      return;
    }
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(a, {
            toValue: 0.3 + Math.random() * 0.7,
            duration: 200 + i * 30,
            useNativeDriver: true,
          }),
          Animated.timing(a, {
            toValue: 1,
            duration: 200 + i * 30,
            useNativeDriver: true,
          }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [playing, anims]);

  return (
    <View style={styles.waveform}>
      {BAR_HEIGHTS.map((h, i) => (
        <Animated.View
          key={i}
          style={[styles.waveBar, { height: h, transform: [{ scaleY: anims[i] }] }]}
        />
      ))}
    </View>
  );
}

// ── Timer display ─────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  voiceUri?: string;
  duration?: number;
  transcript?: string;
  onRecorded: (uri: string, duration: number) => void;
  onDeleted: () => void;
}

export default function VoiceNoteBar({ voiceUri, duration, transcript, onRecorded, onDeleted }: Props) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for recording dot
  useEffect(() => {
    if (!recording) { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.2, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [recording, pulseAnim]);

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      sound?.unloadAsync().catch(() => {});
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sound]);

  const handleStartRecording = async () => {
    try {
      await startRecording();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      // permission denied or error
    }
  };

  const handleStopRecording = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try {
      const result = await stopRecording();
      setRecording(false);
      onRecorded(result.uri, result.duration);
    } catch {
      setRecording(false);
    }
  };

  const handlePlay = async () => {
    if (playing && sound) {
      await sound.pauseAsync();
      setPlaying(false);
      return;
    }
    try {
      const s = await playAudio(voiceUri!);
      setSound(s);
      setPlaying(true);
      s.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlaying(false);
          setSound(null);
        }
      });
    } catch {
      setPlaying(false);
    }
  };

  const handleDelete = () => {
    sound?.unloadAsync().catch(() => {});
    setSound(null);
    setPlaying(false);
    if (voiceUri) deleteAudioFile(voiceUri).catch(() => {});
    onDeleted();
  };

  // ── No recording ──────────────────────────────────────────────────────────
  if (!voiceUri && !recording) {
    return (
      <TouchableOpacity style={styles.addBtn} onPress={handleStartRecording} activeOpacity={0.7}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"
            stroke={colors.amber} strokeWidth={1.8} />
          <Path d="M19 10v2a7 7 0 01-14 0v-2M12 21v-4"
            stroke={colors.amber} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
        <Text style={styles.addBtnText}>Add voice note</Text>
      </TouchableOpacity>
    );
  }

  // ── Recording ─────────────────────────────────────────────────────────────
  if (recording) {
    return (
      <View style={styles.recordingBar}>
        <Animated.View style={[styles.recDot, { opacity: pulseAnim }]} />
        <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.stopBtn} onPress={handleStopRecording}>
          <Text style={styles.stopBtnText}>Stop</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Playback ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.playbackContainer}>
      <View style={styles.playbackBar}>
        <TouchableOpacity style={styles.playBtn} onPress={handlePlay}>
          {playing ? (
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M6 4h4v16H6zM14 4h4v16h-4z" fill={colors.amber} />
            </Svg>
          ) : (
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M8 5.14v14l11-7-11-7z" fill={colors.amber} />
            </Svg>
          )}
        </TouchableOpacity>
        <WaveformBars playing={playing} />
        <Text style={styles.durationText}>
          {duration != null ? `0:${duration.toString().padStart(2, '0')}` : '--'}
        </Text>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.35)" strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </TouchableOpacity>
      </View>
      {transcript ? (
        <Text style={styles.transcriptText}>{transcript}</Text>
      ) : (
        <Text style={styles.transcriptPlaceholder}>Transcription: connect Ollama server</Text>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(239,159,39,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(239,159,39,0.15)',
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.amber,
    fontFamily: 'Inter_700Bold',
  },

  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: 'rgba(239,159,39,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(239,159,39,0.1)',
    borderRadius: 10,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E24B4A',
  },
  timerText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: colors.amber,
    letterSpacing: 1,
    minWidth: 44,
  },
  stopBtn: {
    backgroundColor: 'rgba(226,75,74,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(226,75,74,0.3)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  stopBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E24B4A',
    fontFamily: 'Inter_700Bold',
  },

  playbackContainer: {
    gap: 6,
  },
  playbackBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: 'rgba(239,159,39,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(239,159,39,0.1)',
    borderRadius: 10,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239,159,39,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,159,39,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 32,
  },
  waveBar: {
    width: 1.5,
    backgroundColor: colors.amber,
    borderRadius: 1,
    opacity: 0.6,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.amber,
    fontFamily: 'Inter_700Bold',
  },
  deleteBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transcriptText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: 2,
  },
  transcriptPlaceholder: {
    fontSize: 12,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.2)',
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: 2,
  },
});
