import type { AIDetectionResult } from './ai';

export async function tryOnDeviceDetection(
  imageUri: string
): Promise<Omit<AIDetectionResult, 'source'> | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const FileSystem = require('expo-file-system/legacy') as {
      getInfoAsync: (uri: string) => Promise<{ exists: boolean }>;
    };
    const info = await FileSystem.getInfoAsync(imageUri);

    if (!info.exists) return null;

    // Placeholder: return a low-confidence result prompting user to verify
    // Real implementation will use TFLite in Sprint V5
    return {
      confidence: 25,
      garment_type: undefined,
      primary_color: undefined,
      pattern: undefined,
      fabric: undefined,
      work_type: undefined,
    };
  } catch {
    return null;
  }
}
