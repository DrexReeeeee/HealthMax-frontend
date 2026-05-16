import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE_URL = 'http://192.168.2.142:3000';

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
  total_scans:        number;
  healthy_scans:      number;
  healthy_percentage: number;
  current_streak:     number;
  longest_streak:     number;
  total_points:       number;
  total_xp?:          number;        // ← NEW: added XP to dashboard
  level?:             number;        // ← NEW: added level to dashboard
  level_title?:       string;        // ← NEW: added level title
  bonus_points_today?: number;       // ← NEW: added daily bonus
  streak_status?:     string | null;        // ← NEW: added streak status
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

// ── Leaderboard ────────────────────────────────────────────
export interface LeaderboardEntry {
  rank:               number;
  user_id:            string;
  username:           string;
  avatar_url?:        string | null;
  is_me:              boolean;

  // Points
  total_points:       number;
  weekly_points:      number;

  // Level
  level:              number;
  level_title:        string;
  level_progress:     number;
  total_xp:           number;

  // Streak
  current_streak:     number;
  longest_streak:     number;
  streak_label:       string;

  // Health stats
  healthy_percentage: number;
  avg_score_last10:   number;

  // Badges
  badge_count:        number;
}

export interface LeaderboardResponse {
  success:    boolean;
  leaderboard: LeaderboardEntry[];
  my_rank:    LeaderboardEntry | number | null; // full entry if outside top 50
}

export async function fetchLeaderboard(): Promise<LeaderboardResponse> {
  const { ok, data } = await apiFetch('/api/leaderboard');
  if (!ok || !data.success) throw new Error(data.message || 'Failed to load leaderboard');
  return data as LeaderboardResponse;
}

// ── Products / Scanning ────────────────────────────────────

export interface ProductNutrients {
  sugar_g:         number;
  saturated_fat_g: number;
  sodium_mg:       number;
  energy_kcal:     number;
  fiber_g:         number;
  protein_g:       number;
  nova_group:      number | null;
  additives_count: number;
}

export interface ScoreBreakdown {
  penalties: {
    sugar:         number;
    saturated_fat: number;
    sodium:        number;
    energy:        number;
    processing:    number;
    additives:     number;
  };
  bonuses: {
    fiber:           number;
    protein:         number;
    goal_adjustment: number;
  };
  effective_nutrients: ProductNutrients;
  nova_cap_applied:    boolean;
  cap_source?:         string;           // ← NEW: 'nova_4', 'nova_3', 'implicit_processing'
  nova_cap?:           number;           // ← NEW: the cap value applied
  uncapped_score:      number;
}

export interface ProductEvaluation {
  score:     number;   // 0–100
  grade:     string;   // A–E
  color:     string;
  display:   string;   // e.g. "72/100"
  breakdown: ScoreBreakdown;
}

export interface Alternative {
  barcode:    string;
  name:       string;
  brand:      string;
  image_url?: string;
  score:      number;  // 0–100
  grade:      string;  // A–E
  reason:     string;
  source:     'open_food_facts' | 'usda' | 'local_cache';  // ← FIX: added 'usda'
  nova_group?: number | null;  // ← NEW
}

export interface ProductData {
  barcode:    string;
  name:       string;
  brand:      string;
  category:   string;
  image_url:  string;
  nutriscore: string | null;
  nutrients:  ProductNutrients;
  evaluation: ProductEvaluation;
  description: string;
  warnings:   string[];
  tips:       string[];
  alternatives: Alternative[];
}

export async function fetchProduct(barcode: string): Promise<ProductData> {
  const { ok, data } = await apiFetch(`/api/product/${barcode}`);
  if (!ok || !data.success) throw new Error(data.message || 'Product not found');
  return data.product as ProductData;
}

// ── Save Scan ──────────────────────────────────────────────
export async function saveScan(
  barcode:      string,
  score:        number,
  product?:     ProductData,
  alternatives?: Alternative[],
  description?: string,
  warnings?:    string[],
  tips?:        string[]
): Promise<{ gamification: GamificationData }> {
  const { ok, data } = await apiFetch('/api/history', {
    method: 'POST',
    body: JSON.stringify({ barcode, score, product, alternatives, description, warnings, tips }),
  });
  if (!ok || !data.success) throw new Error(data.message || 'Failed to save scan');
  return data;
}

// ── History ────────────────────────────────────────────────
export async function fetchHistory(
  page   = 1,
  limit  = 20,
  filter: 'all' | 'healthy' | 'unhealthy' = 'all'
) {
  const { ok, data } = await apiFetch(
    `/api/history?page=${page}&limit=${limit}&filter=${filter}`
  );
  if (!ok || !data.success) throw new Error(data.message || 'Failed to load history');
  return data;
}

// ── Gamification ───────────────────────────────────────────

export interface Badge {
  id:   string;
  name: string;
  desc: string;
  icon: string;
}

export interface LevelInfo {
  level:          number;
  title:          string;
  total_xp:       number;
  xp_into_level:  number;
  xp_for_next:    number | null;
  level_progress: number;   // 0–100 percentage
  next_title:     string | null;
}

export interface BonusEvent {
  type:   string;
  points: number;
  label:  string;
}

export interface GamificationData {
  // Points
  total_points:       number;
  weekly_points:      number;
  points_earned?:     number;           // ← CHANGED: only from saveScan, not getGamification
  xp_earned?:         number;           // ← CHANGED: only from saveScan
  bonus_points_today: number;           // ← NEW

  // Streak
  current_streak:     number;
  longest_streak:     number;
  streak_broken?:     boolean;          // ← CHANGED: only from saveScan
  streak_label:       string;
  streak_status?:     string;           // ← NEW: 'scanned_today' | 'active' | 'broken' | 'none'
  multiplier?:        number;           // ← CHANGED: only from saveScan

  // Level
  level:              number;
  level_title:        string;
  level_progress:     number;
  xp_into_level:      number;
  xp_for_next:        number | null;
  total_xp:           number;
  next_level_title:   string | null;

  // Stats
  healthy_percentage: number;
  avg_score_last10:   number;
  score_tier?:        string;           // ← CHANGED: only from saveScan
  total_scans?:       number;           // ← NEW
  healthy_scans?:     number;           // ← NEW
  healthy_threshold?: number;           // ← NEW: tells frontend what score counts as "healthy"

  // Achievements
  badges:             Badge[];
  new_badges?:        Badge[];          // ← CHANGED: only from saveScan
  bonus_events?:      BonusEvent[];     // ← CHANGED: only from saveScan
  badges_count?:      number;           // ← NEW
  total_badges?:      number;           // ← NEW

  // Extra (from getGamification endpoint)
  next_badges?:       Badge[];
  days_until_reset?:  number;
  next_reset_date?:   string;           // ← NEW
  weekly_reset_stale?: boolean;         // ← NEW
  levels?:            { level: number; xpRequired: number; title: string }[];
  last_scan_date?:    string | null;
}

export async function fetchGamification(): Promise<{ success: boolean; gamification: GamificationData }> {
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

// ── Scan Detail ────────────────────────────────────────────
export async function getScanDetail(scanId: string) {
  const { ok, data } = await apiFetch(`/api/history/${scanId}`, { method: 'GET' }, true);
  if (!ok || !data.success) throw new Error(data.message || 'Failed to load scan detail');
  return data.scan;
}

// ── NEW: Healthy score threshold constant ─────────────────
export const HEALTHY_SCORE_THRESHOLD = 60;