import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AIDetectionResult } from './ai';
import { logError } from './errorLogger';

const DEFAULT_URL = 'http://192.168.1.100:11434';
const TIMEOUT = 10000;

export async function getOllamaUrl(): Promise<string> {
  return (await AsyncStorage.getItem('ollama_url')) ?? DEFAULT_URL;
}

export async function setOllamaUrl(url: string): Promise<void> {
  await AsyncStorage.setItem('ollama_url', url);
}

export async function testConnection(): Promise<{
  connected: boolean;
  model?: string;
  error?: string;
}> {
  try {
    const url = await getOllamaUrl();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT);
    const res = await fetch(`${url}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json() as { models?: { name: string }[] };
    const visionModels = data.models?.filter(
      (m) =>
        m.name.includes('llava') ||
        m.name.includes('qwen') ||
        m.name.includes('vision')
    );
    return {
      connected: true,
      model:
        visionModels?.[0]?.name ?? data.models?.[0]?.name ?? 'unknown',
    };
  } catch (e: unknown) {
    logError('testOllamaConnection', e);
    return {
      connected: false,
      error: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

export async function tryOllamaDetection(
  imageUri: string
): Promise<Omit<AIDetectionResult, 'source'> | null> {
  const url = await getOllamaUrl();
  const test = await testConnection();
  if (!test.connected || !test.model) return null;

  // Read image as base64
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const FileSystem = require('expo-file-system') as {
    readAsStringAsync: (uri: string, options: { encoding: string }) => Promise<string>;
  };
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: 'base64',
  });

  const prompt = `Analyze this garment image. Return ONLY a JSON object with these fields:
{
  "garment_type": "one of: Shirt, Kurta, Saree, Salwar Set, Lehenga, Trouser/Pant, T-Shirt, Jeans, Jacket, Dupatta, Kurti, Other",
  "primary_color": "main color name (e.g. Maroon, Navy, Red, Black)",
  "secondary_color": "secondary color or null",
  "pattern": "one of: Solid, Checks, Stripes, Paisley, Floral, Geometric, Abstract, Bandhani, Ikat, Block Print, Other",
  "fabric": "one of: Cotton, Silk, Georgette, Chiffon, Polyester, Linen, Denim, Other",
  "work_type": "one of: None/Plain, Embroidered, Zari, Chikankari, Mirror Work, Sequin, Block Print, Screen Print, Digital Print, Other",
  "occasion": "one of: Daily Wear, Casual, Formal, Party, Wedding, Festival",
  "sleeve": "e.g. Full, 3/4, Half, Sleeveless",
  "neck": "e.g. Round, V-Neck, Mandarin, Collar"
}
Return ONLY the JSON, no explanation.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(`${url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: test.model,
        prompt,
        images: [base64],
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json() as { response?: string };
    const text = data.response ?? '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Omit<AIDetectionResult, 'source' | 'confidence'>;
    return { ...parsed, confidence: 85 };
  } catch {
    return null;
  }
}
