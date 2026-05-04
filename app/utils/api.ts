import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE_URL = 'http://10.71.3.195:3000'; // change to your local IP

/**
 * Safe fetch wrapper.
 * Reads body as text first so a non-JSON response (HTML 404/500 page)
 * never causes a JSON.parse crash.
 */
export async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
  requiresAuth = true
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (requiresAuth) {
    const token = await AsyncStorage.getItem('access_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  let data: any = {};
  try {
    const text = await response.text();
    if (text) data = JSON.parse(text);
  } catch {
    data = {
      success: false,
      message: `Server returned a non-JSON response (HTTP ${response.status})`,
    };
  }

  return { ok: response.ok, status: response.status, data };
}

// ── Dashboard ──────────────────────────────────────────────
export interface DashboardData {
  total_scans: number;
  healthy_scans: number;
  healthy_percentage: number;
  current_streak: number;
  longest_streak: number;
  total_points: number;
}

export async function fetchDashboard(): Promise<DashboardData> {
  const { ok, data } = await apiFetch('/api/dashboard');
  if (!ok || !data.success) throw new Error(data.message || 'Failed to load dashboard');
  return data.dashboard as DashboardData;
}

// ── Auth ───────────────────────────────────────────────────
export async function apiLogin(email: string, password: string) {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, false);
}

export async function apiRegister(email: string, password: string, username: string) {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, username }),
  }, false);
}

export async function apiLogout() {
  return apiFetch('/api/auth/logout', { method: 'POST' });
}

// ── Profile ────────────────────────────────────────────────
export async function fetchProfile() {
  const { ok, data } = await apiFetch('/api/profile');
  if (!ok || !data.success) throw new Error(data.message || 'Failed to load profile');
  return data.profile;
}

export async function updateProfile(updates: Record<string, unknown>) {
  return apiFetch('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

// ── Products / Scanning ────────────────────────────────────
export async function fetchProduct(barcode: string) {
  const { ok, data } = await apiFetch(`/api/product/${barcode}`);
  if (!ok || !data.success) throw new Error(data.message || 'Product not found');
  return data.product;
}

// ── Save Scan ──────────────────────────────────────────────
// ⚠️  ROUTE: check your routes file and update this path if needed.
//
//  Common patterns:
//    router.post('/',     saveScan)  → registered as app.use('/api/history', router)  → POST /api/history
//    router.post('/save', saveScan)  → registered as app.use('/api/history', router)  → POST /api/history/save
//    router.post('/scans',saveScan)  → registered as app.use('/api',         router)  → POST /api/scans
//
//  The safest way to confirm: look at your routes/history.js (or equivalent)
//  and the app.use() call in app.js / index.js.
export async function saveScan(
  barcode: string,
  score: number
): Promise<{ gamification: unknown }> {
  const { ok, data } = await apiFetch('/api/history', {   // ← adjust if needed
    method: 'POST',
    body: JSON.stringify({ barcode, score }),
  });
  if (!ok || !data.success) throw new Error(data.message || 'Failed to save scan');
  return data;
}

// ── History ────────────────────────────────────────────────
export async function fetchHistory(page = 1, limit = 20) {
  const { ok, data } = await apiFetch(`/api/history?page=${page}&limit=${limit}`);
  if (!ok || !data.success) throw new Error(data.message || 'Failed to load history');
  return data;
}

// ── Gamification ───────────────────────────────────────────
export async function fetchGamification() {
  const { ok, data } = await apiFetch('/api/gamification');
  if (!ok || !data.success) throw new Error(data.message || 'Failed to load gamification');
  return data;
}

// ── Sync ───────────────────────────────────────────────────
export async function syncLocalScans(scans: unknown[]) {
  return apiFetch('/api/sync', {
    method: 'POST',
    body: JSON.stringify({ scans }),
  });
}