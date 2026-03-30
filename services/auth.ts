import * as SecureStore from 'expo-secure-store';
import { getUserByPhone, verifyPin, updateLastLogin } from '../db/database';
import type { User } from '../db/types';

const SESSION_KEY = 'vastra_session';

interface Session {
  userId: number;
  name: string;
  role: string;
  phone: string;
}

export async function login(phone: string, pin: string): Promise<{ success: boolean; user?: User }> {
  const user = await getUserByPhone(phone);
  if (!user) return { success: false };
  const ok = await verifyPin(user.id, pin);
  if (!ok) return { success: false };
  await updateLastLogin(user.id);
  const session: Session = { userId: user.id, name: user.name, role: user.role, phone: user.phone };
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  return { success: true, user };
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function getCurrentUser(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as Session; } catch { return null; }
}

export async function isLoggedIn(): Promise<boolean> {
  const session = await getCurrentUser();
  return session !== null;
}
