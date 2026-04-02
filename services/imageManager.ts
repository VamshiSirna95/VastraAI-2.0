import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { getDb } from '../db/database';

export async function compressImage(uri: string, maxWidth: number = 1200): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

export async function createThumbnail(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 200 } }],
    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
  );
  const thumbPath = uri.replace(/\.\w+$/, '_thumb.jpg');
  await FileSystem.moveAsync({ from: result.uri, to: thumbPath });
  return thumbPath;
}

export async function getStorageStats(): Promise<{
  totalPhotos: number;
  totalSizeMB: number;
  byCategory: Record<string, { count: number; sizeMB: number }>;
}> {
  const docDir = FileSystem.documentDirectory ?? '';
  const categories = ['products', 'grn', 'lr', 'demands', 'voicenotes'];
  const stats: Record<string, { count: number; sizeMB: number }> = {};
  let totalPhotos = 0;
  let totalSize = 0;

  for (const cat of categories) {
    const dir = `${docDir}${cat}/`;
    try {
      const files = await FileSystem.readDirectoryAsync(dir);
      let catSize = 0;
      for (const f of files) {
        const info = await FileSystem.getInfoAsync(`${dir}${f}`);
        if (info.exists && (info as { size?: number }).size) {
          catSize += (info as { size?: number }).size ?? 0;
        }
      }
      stats[cat] = { count: files.length, sizeMB: Math.round(catSize / 1024 / 1024 * 10) / 10 };
      totalPhotos += files.length;
      totalSize += catSize;
    } catch {
      stats[cat] = { count: 0, sizeMB: 0 };
    }
  }

  return {
    totalPhotos,
    totalSizeMB: Math.round(totalSize / 1024 / 1024 * 10) / 10,
    byCategory: stats,
  };
}

export async function cleanupOldPhotos(daysOld: number = 90): Promise<number> {
  const db = getDb();
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  const oldPhotos = await db.getAllAsync<{ id: number; photo_uri: string }>(
    `SELECT gp.id, gp.photo_uri FROM grn_photos gp
     JOIN grn_items gi ON gi.id = gp.grn_item_id
     JOIN grn_records gr ON gr.id = gi.grn_id
     WHERE gr.overall_status IN ('accepted', 'partial') AND gr.created_at < ?`,
    [cutoff.toISOString()]
  );

  let cleaned = 0;
  for (const photo of oldPhotos) {
    try {
      const info = await FileSystem.getInfoAsync(photo.photo_uri);
      if (info.exists) {
        await FileSystem.deleteAsync(photo.photo_uri);
        await db.runAsync(`DELETE FROM grn_photos WHERE id = ?`, [photo.id]);
        cleaned++;
      }
    } catch { /* skip unreadable files */ }
  }
  return cleaned;
}
