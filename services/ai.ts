import { tryOllamaDetection } from './ollama';
import { tryOnDeviceDetection } from './ondevice';
import {
  detectAttributesWithGemini,
  getGeminiApiKey,
  getAIPriorityOrder,
} from './geminiAI';

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
  source: 'gemini' | 'ollama' | 'on-device' | 'manual';
}

export async function detectAttributes(imageUri: string): Promise<AIDetectionResult> {
  const [apiKey, priority] = await Promise.all([
    getGeminiApiKey(),
    getAIPriorityOrder(),
  ]);

  const tryGemini = async (): Promise<AIDetectionResult | null> => {
    if (!apiKey) return null;
    try {
      const r = await detectAttributesWithGemini(imageUri, apiKey);
      if (r.confidence > 0) {
        return {
          garment_type: r.garment_type || undefined,
          primary_color: r.primary_color || undefined,
          secondary_color: r.secondary_color || undefined,
          pattern: r.pattern || undefined,
          fabric: r.fabric_guess || undefined,
          work_type: r.work_type || undefined,
          occasion: r.occasion || undefined,
          confidence: r.confidence,
          source: 'gemini',
        };
      }
    } catch (e) {
      console.log('Gemini detection failed, falling back:', e);
    }
    return null;
  };

  const tryOllama = async (): Promise<AIDetectionResult | null> => {
    try {
      const r = await tryOllamaDetection(imageUri);
      if (r) return { ...r, source: 'ollama' };
    } catch {}
    return null;
  };

  if (priority === 'ollama_first') {
    const ollamaResult = await tryOllama();
    if (ollamaResult) return ollamaResult;
    const geminiResult = await tryGemini();
    if (geminiResult) return geminiResult;
  } else {
    // gemini_first (default)
    const geminiResult = await tryGemini();
    if (geminiResult) return geminiResult;
    const ollamaResult = await tryOllama();
    if (ollamaResult) return ollamaResult;
  }

  try {
    const onDeviceResult = await tryOnDeviceDetection(imageUri);
    if (onDeviceResult) return { ...onDeviceResult, source: 'on-device' };
  } catch {}

  return { confidence: 0, source: 'manual' };
}
