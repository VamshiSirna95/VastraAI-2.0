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
  status: 'success' | 'failed';
  reason?: 'timeout' | 'error';
  message?: string;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    ),
  ]);
}

async function runDetection(
  imageUri: string,
  apiKey: string | null,
  priority: string,
): Promise<AIDetectionResult> {
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
          status: 'success',
        };
      }
    } catch (e) {
      console.error('Gemini detection failed, falling back:', e);
    }
    return null;
  };

  const tryOllama = async (): Promise<AIDetectionResult | null> => {
    try {
      const r = await tryOllamaDetection(imageUri);
      if (r) return { ...r, source: 'ollama', status: 'success' };
    } catch {}
    return null;
  };

  if (priority === 'ollama_first') {
    const ollamaResult = await tryOllama();
    if (ollamaResult) return ollamaResult;
    const geminiResult = await tryGemini();
    if (geminiResult) return geminiResult;
  } else {
    const geminiResult = await tryGemini();
    if (geminiResult) return geminiResult;
    const ollamaResult = await tryOllama();
    if (ollamaResult) return ollamaResult;
  }

  try {
    const onDeviceResult = await tryOnDeviceDetection(imageUri);
    if (onDeviceResult) return { ...onDeviceResult, source: 'on-device', status: 'success' };
  } catch {}

  return { confidence: 0, source: 'manual', status: 'success' };
}

export async function detectAttributes(imageUri: string): Promise<AIDetectionResult> {
  const [apiKey, priority] = await Promise.all([
    getGeminiApiKey(),
    getAIPriorityOrder(),
  ]);

  const delays = [2000, 4000, 8000];
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`AI detection attempt ${attempt}/3 for ${imageUri.split('/').pop() ?? imageUri}`);
      const result = await withTimeout(runDetection(imageUri, apiKey, priority), 30000);
      return result;
    } catch (e) {
      lastError = e;
      if (attempt < 3) {
        await new Promise((res) => setTimeout(res, delays[attempt - 1]));
      }
    }
  }

  const isTimeout = lastError instanceof Error && lastError.message === 'timeout';
  return {
    confidence: 0,
    source: 'manual',
    status: 'failed',
    reason: isTimeout ? 'timeout' : 'error',
    message: lastError instanceof Error ? lastError.message : 'AI detection failed after 3 attempts',
  };
}
