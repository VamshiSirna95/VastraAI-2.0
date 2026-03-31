import * as FileSystem from 'expo-file-system';
import { getOllamaUrl } from './ollama';

export interface DetectedAttributes {
  garment_type: string;
  primary_color: string;
  secondary_color?: string;
  pattern: string;
  fabric_guess: string;
  occasion: string;
  confidence: number;
  raw_description: string;
}

const DETECTION_TIMEOUT = 15000;

const EMPTY_RESULT: DetectedAttributes = {
  garment_type: 'Unknown',
  primary_color: 'Unknown',
  pattern: 'Unknown',
  fabric_guess: 'Unknown',
  occasion: 'Unknown',
  confidence: 0,
  raw_description: '',
};

const PROMPT = `You are a fashion merchandise expert. Analyze this garment photograph and return ONLY a JSON object with these fields: garment_type (one of: Kurta, Saree, Lehenga, Salwar Set, Dupatta, Shirt, T-Shirt, Jeans, Trouser/Pant, Palazzo, Skirt, Dress, Blazer, Jacket, Sherwani, Fabric), primary_color (specific color name), secondary_color (if any, otherwise null), pattern (one of: Solid, Checks, Stripes, Printed, Floral, Geometric, Abstract, Embroidered, Woven, Plain), fabric_guess (best guess of fabric type), occasion (one of: Casual, Formal, Festive, Party, Wedding, Daily). Return ONLY valid JSON, no other text.`;

export async function detectAttributes(
  imageUri: string,
  ollamaUrl?: string,
): Promise<DetectedAttributes> {
  try {
    const url = ollamaUrl ?? (await getOllamaUrl());
    if (!url) return EMPTY_RESULT;

    // Convert image to base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Probe Ollama availability
    const probeController = new AbortController();
    const probeTimeout = setTimeout(() => probeController.abort(), 5000);
    let visionModel: string | null = null;
    try {
      const probeRes = await fetch(`${url}/api/tags`, { signal: probeController.signal });
      clearTimeout(probeTimeout);
      const probeData = await probeRes.json() as { models?: { name: string }[] };
      const models = probeData.models ?? [];
      const vision = models.find(
        (m) => m.name.includes('llava') || m.name.includes('vision') || m.name.includes('qwen')
      );
      visionModel = vision?.name ?? models[0]?.name ?? null;
    } catch {
      clearTimeout(probeTimeout);
      return EMPTY_RESULT;
    }

    if (!visionModel) return EMPTY_RESULT;

    // Run detection
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DETECTION_TIMEOUT);
    try {
      const res = await fetch(`${url}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: visionModel,
          prompt: PROMPT,
          images: [base64],
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json() as { response?: string };
      const text = data.response ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return EMPTY_RESULT;

      const parsed = JSON.parse(jsonMatch[0]) as Partial<DetectedAttributes>;
      return {
        garment_type: parsed.garment_type ?? 'Unknown',
        primary_color: parsed.primary_color ?? 'Unknown',
        secondary_color: parsed.secondary_color ?? undefined,
        pattern: parsed.pattern ?? 'Unknown',
        fabric_guess: parsed.fabric_guess ?? 'Unknown',
        occasion: parsed.occasion ?? 'Unknown',
        confidence: 0.85,
        raw_description: text,
      };
    } catch {
      clearTimeout(timeout);
      return EMPTY_RESULT;
    }
  } catch {
    return EMPTY_RESULT;
  }
}

export async function detectAttributesBatch(
  imageUris: string[],
  ollamaUrl?: string,
): Promise<DetectedAttributes[]> {
  const url = ollamaUrl ?? (await getOllamaUrl());
  return Promise.all(imageUris.map((uri) => detectAttributes(uri, url)));
}
