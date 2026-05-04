import AsyncStorage from '@react-native-async-storage/async-storage';
import { DashboardData } from './api';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  age?: number;
  weight?: number;
  healthGoals: string[];
  dietaryPreferences: string[];
  createdAt: string;
}

export interface AuthData {
  access_token: string;
  user: {
    id: string;
    email: string;
    username: string;
  };
}

// ── Onboarding ─────────────────────────────────────────────
export async function setOnboardingCompleted(value: boolean) {
  await AsyncStorage.setItem('onboarding_completed', value ? 'true' : 'false');
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  const val = await AsyncStorage.getItem('onboarding_completed');
  return val === 'true';
}

// ── Auth ───────────────────────────────────────────────────
export async function saveAuthData(data: AuthData) {
  await AsyncStorage.setItem('access_token', data.access_token);
  await AsyncStorage.setItem('user', JSON.stringify(data.user));
}

export async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem('access_token');
}

export async function getUser() {
  const raw = await AsyncStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

export async function clearAuthData() {
  await AsyncStorage.multiRemove(['access_token', 'user', 'user_profile', 'cached_dashboard']);
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getAuthToken();
  return !!token;
}

// ── User Profile ───────────────────────────────────────────
export async function saveUserProfile(profile: UserProfile) {
  await AsyncStorage.setItem('user_profile', JSON.stringify(profile));
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const raw = await AsyncStorage.getItem('user_profile');
  return raw ? JSON.parse(raw) : null;
}

// ── Dashboard Cache ────────────────────────────────────────
// Caches the last successful API response so the home screen
// can show real numbers instantly on next open, even before
// the network request completes.
const DASHBOARD_CACHE_KEY = 'cached_dashboard';
const DASHBOARD_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedDashboard {
  data: DashboardData;
  cachedAt: number;
}

export async function saveDashboardCache(data: DashboardData) {
  const payload: CachedDashboard = { data, cachedAt: Date.now() };
  await AsyncStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(payload));
}

export async function getDashboardCache(): Promise<DashboardData | null> {
  try {
    const raw = await AsyncStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const { data, cachedAt }: CachedDashboard = JSON.parse(raw);
    if (Date.now() - cachedAt > DASHBOARD_CACHE_TTL) return null; // expired
    return data;
  } catch {
    return null;
  }
}

export async function clearDashboardCache() {
  await AsyncStorage.removeItem(DASHBOARD_CACHE_KEY);
}

// ── Scans (local offline cache) ────────────────────────────
export interface LocalScan {
  barcode: string;
  name: string;
  brand?: string;
  category?: string;
  image_url?: string;
  score: number;
  date: string;
}

export async function saveLocalScan(scan: LocalScan) {
  const existing = await getLocalScans();
  const updated = [scan, ...existing];
  await AsyncStorage.setItem('local_scans', JSON.stringify(updated));
}

export async function getLocalScans(): Promise<LocalScan[]> {
  const raw = await AsyncStorage.getItem('local_scans');
  return raw ? JSON.parse(raw) : [];
}

// Alias so any old code calling getScans() still works
export const getScans = getLocalScans;

export async function clearLocalScans() {
  await AsyncStorage.removeItem('local_scans');
}