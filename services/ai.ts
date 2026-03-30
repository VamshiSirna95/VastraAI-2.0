import { tryOllamaDetection } from './ollama';
import { tryOnDeviceDetection } from './ondevice';

export interface AIDetectionResult {
  garment_type?: string;
  primary_color?: string;
  secondary_color?: string;
  pattern?: string;
  fabric?: string;
  work_type?: string;
  occasion?: string;
  sleeve?: string;
  neck?: string;
  confidence: number;
  source: 'ollama' | 'on-device' | 'manual';
}

export async function detectAttributes(imageUri: string): Promise<AIDetectionResult> {
  try {
    const ollamaResult = await tryOllamaDetection(imageUri);
    if (ollamaResult) return { ...ollamaResult, source: 'ollama' };
  } catch {}

  try {
    const onDeviceResult = await tryOnDeviceDetection(imageUri);
    if (onDeviceResult) return { ...onDeviceResult, source: 'on-device' };
  } catch {}

  return { confidence: 0, source: 'manual' };
}
