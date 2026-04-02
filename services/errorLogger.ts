import * as FileSystem from 'expo-file-system';

const LOG_FILE = `${FileSystem.documentDirectory ?? ''}error_log.txt`;
const MAX_ENTRIES = 100;

export async function logError(context: string, error: unknown): Promise<void> {
  const timestamp = new Date().toISOString();
  const message = (error as Error)?.message ?? String(error);
  const stack = (error as Error)?.stack ?? '';
  const entry = `[${timestamp}] ${context}: ${message}\n${stack ? stack + '\n' : ''}---\n`;

  try {
    const existing = await FileSystem.readAsStringAsync(LOG_FILE).catch(() => '');
    const entries = existing.split('---\n').filter(Boolean);
    if (entries.length >= MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES + 1);
    await FileSystem.writeAsStringAsync(LOG_FILE, entries.join('---\n') + entry);
  } catch { /* non-critical — never throw from logger */ }
}

export async function getErrorLog(): Promise<string> {
  try {
    return await FileSystem.readAsStringAsync(LOG_FILE);
  } catch {
    return 'No errors logged';
  }
}

export async function clearErrorLog(): Promise<void> {
  try { await FileSystem.deleteAsync(LOG_FILE); } catch { /* ignore */ }
}

export function getErrorLogPath(): string {
  return LOG_FILE;
}
