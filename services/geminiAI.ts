import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logError } from './errorLogger';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export interface GeminiDetectedAttributes {
  garment_type: string;
  primary_color: string;
  secondary_color: string;
  pattern: string;
  fabric_guess: string;
  work_type: string;
  occasion: string;
  confidence: number;
  raw_description?: string;
}

export interface GeminiComparisonResult {
  color_match: number;
  pattern_match: number;
  work_match: number;
  overall_match: number;
  discrepancies: string[];
}

// ── Settings helpers ──────────────────────────────────────────────────────────

export async function getGeminiApiKey(): Promise<string | null> {
  return AsyncStorage.getItem('gemini_api_key');
}

export async function setGeminiApiKey(key: string): Promise<void> {
  await AsyncStorage.setItem('gemini_api_key', key);
}

export async function getAIPriorityOrder(): Promise<'gemini_first' | 'ollama_first'> {
  const val = await AsyncStorage.getItem('ai_priority_order');
  return val === 'ollama_first' ? 'ollama_first' : 'gemini_first';
}

export async function setAIPriorityOrder(
  order: 'gemini_first' | 'ollama_first',
): Promise<void> {
  await AsyncStorage.setItem('ai_priority_order', order);
}

// ── Core API call ─────────────────────────────────────────────────────────────

export async function callGemini(
  imageBase64: string,
  prompt: string,
  apiKey: string,
): Promise<string> {
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} — ${err}`);
  }

  const data = await response.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ── Attribute detection ───────────────────────────────────────────────────────

const DETECT_PROMPT = `You are a fashion merchandise expert analyzing garment photographs for an Indian retail business.

Analyze this garment image and return ONLY a valid JSON object (no markdown, no backticks, no extra text) with these exact fields:
{
  "garment_type": "one of: Kurta, Saree, Lehenga, Salwar, Dupatta, Shirt, T-shirt, Jeans, Trousers, Palazzo, Skirt, Dress, Blazer, Jacket, Sherwani, Fabric, Stole, Shawl",
  "primary_color": "specific color name like Navy Blue, Maroon, Rani Pink, Bottle Green, Mustard, Rust, Teal",
  "secondary_color": "if visible, otherwise empty string",
  "pattern": "one of: Solid, Checks, Stripes, Printed, Floral, Geometric, Abstract, Embroidered, Woven, Paisley, Bandhani, Ikat, Block Print, Kalamkari, Ajrakh, Self-textured",
  "fabric_guess": "one of: Cotton, Silk, Georgette, Chiffon, Crepe, Linen, Polyester, Rayon, Velvet, Satin, Net, Organza, Chanderi, Banarasi, Tussar, Khadi, Denim, Lycra",
  "work_type": "one of: Plain, Machine Embroidered, Hand Embroidered, Zari, Chikankari, Mirror Work, Sequence, Stone Work, Thread Work, Patch Work, Applique, None",
  "occasion": "one of: Casual, Formal, Festive, Party, Wedding, Daily, Office, Sports",
  "confidence": 0.0 to 1.0 based on image clarity and your certainty
}

If the image does not show a garment or is unclear, return all fields as empty strings with confidence 0.`;

export async function detectAttributesWithGemini(
  imageUri: string,
  apiKey: string,
): Promise<GeminiDetectedAttributes> {
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const responseText = await callGemini(base64, DETECT_PROMPT, apiKey);

  try {
    const cleaned = responseText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned) as Partial<GeminiDetectedAttributes>;
    return {
      garment_type: parsed.garment_type ?? '',
      primary_color: parsed.primary_color ?? '',
      secondary_color: parsed.secondary_color ?? '',
      pattern: parsed.pattern ?? '',
      fabric_guess: parsed.fabric_guess ?? '',
      work_type: parsed.work_type ?? '',
      occasion: parsed.occasion ?? '',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      raw_description: responseText,
    };
  } catch {
    return {
      garment_type: '', primary_color: '', secondary_color: '',
      pattern: '', fabric_guess: '', work_type: '', occasion: '',
      confidence: 0, raw_description: responseText,
    };
  }
}

// ── Image comparison (for GRN QC) ─────────────────────────────────────────────

const COMPARE_PROMPT = `Compare these two garment images. The first is what was ORDERED and the second is what was RECEIVED.

Return ONLY a valid JSON object:
{
  "color_match": 0-100,
  "pattern_match": 0-100,
  "work_match": 0-100,
  "overall_match": 0-100,
  "discrepancies": ["list any differences found"]
}`;

export async function compareImagesWithGemini(
  orderedImageUri: string,
  receivedImageUri: string,
  apiKey: string,
): Promise<GeminiComparisonResult> {
  const [ordered64, received64] = await Promise.all([
    FileSystem.readAsStringAsync(orderedImageUri, { encoding: FileSystem.EncodingType.Base64 }),
    FileSystem.readAsStringAsync(receivedImageUri, { encoding: FileSystem.EncodingType.Base64 }),
  ]);

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: ordered64 } },
            { inlineData: { mimeType: 'image/jpeg', data: received64 } },
            { text: COMPARE_PROMPT },
          ],
        },
      ],
    }),
  });

  const data = await response.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim()) as Partial<GeminiComparisonResult>;
    return {
      color_match: parsed.color_match ?? 0,
      pattern_match: parsed.pattern_match ?? 0,
      work_match: parsed.work_match ?? 0,
      overall_match: parsed.overall_match ?? 0,
      discrepancies: Array.isArray(parsed.discrepancies) ? parsed.discrepancies : ['Could not analyze'],
    };
  } catch {
    return { color_match: 0, pattern_match: 0, work_match: 0, overall_match: 0, discrepancies: ['Could not analyze'] };
  }
}

// ── Natural language query ────────────────────────────────────────────────────

export async function askGemini(
  question: string,
  context: string,
  apiKey: string,
): Promise<string> {
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `Context about the business:\n${context}\n\nQuestion: ${question}\n\nAnswer concisely and helpfully.`,
            },
          ],
        },
      ],
    }),
  });
  const data = await response.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Could not process query';
}

// ── Test connection ───────────────────────────────────────────────────────────

export async function testGeminiConnection(apiKey: string): Promise<{
  connected: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with the word "ok" only.' }] }],
        generationConfig: { maxOutputTokens: 8 },
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      return { connected: false, error: `HTTP ${response.status}: ${err.slice(0, 120)}` };
    }
    return { connected: true };
  } catch (e: unknown) {
    logError('testGeminiConnection', e);
    return { connected: false, error: e instanceof Error ? e.message : 'Connection failed' };
  }
}
