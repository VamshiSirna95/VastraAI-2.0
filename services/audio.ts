import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

async function ensureVoiceNotesDir(): Promise<string> {
  const dir = `${FileSystem.documentDirectory}voicenotes/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

let activeRecording: Audio.Recording | null = null;

export async function startRecording(): Promise<void> {
  const { granted } = await Audio.requestPermissionsAsync();
  if (!granted) throw new Error('Microphone permission denied');

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  await recording.startAsync();
  activeRecording = recording;
}

export async function stopRecording(): Promise<{ uri: string; duration: number }> {
  if (!activeRecording) throw new Error('No active recording');

  const status = await activeRecording.getStatusAsync();
  await activeRecording.stopAndUnloadAsync();
  const tempUri = activeRecording.getURI();
  activeRecording = null;

  if (!tempUri) throw new Error('Recording URI unavailable');

  const dir = await ensureVoiceNotesDir();
  const filename = `voice_${Date.now()}.m4a`;
  const destUri = `${dir}${filename}`;
  await FileSystem.copyAsync({ from: tempUri, to: destUri });

  const duration = (status as { durationMillis?: number }).durationMillis
    ? Math.round(((status as { durationMillis: number }).durationMillis) / 1000)
    : 0;

  return { uri: destUri, duration };
}

export async function playAudio(uri: string): Promise<Audio.Sound> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
  });
  const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
  return sound;
}

export async function deleteAudioFile(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}
