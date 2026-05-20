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
  total_scans:         number;
  healthy_scans:       number;
  healthy_percentage:  number;
  current_streak:      number;
  longest_streak:      number;
  total_points:        number;
  total_xp?:           number;
  level?:              number;
  level_title?:        string;
  bonus_points_today?: number;
  streak_status?:      string | null;
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
  success:     boolean;
  leaderboard: LeaderboardEntry[];
  my_rank:     LeaderboardEntry | number | null;
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
  cap_source?:         string;
  nova_cap?:           number;
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
  barcode:       string;
  name:          string;
  brand:         string;
  image_url?:    string | null;
  score:         number;
  grade:         string;
  reason:        string;
  /**
   * NEW: 2-3 sentence human-readable description sourced from Gemini.
   * Present in gemini_ph and ph_fallback alternatives.
   * Null for global (OFF/USDA/FatSecret) alternatives.
   */
  description?:  string | null;
  source:        'open_food_facts' | 'usda' | 'fatsecret' | 'local_cache' | 'openai_ph_alternative'| 'gemini_ph' | 'ph_fallback' ;
  nova_group?:   number | null;
  where_to_buy?: string | null;
  _nutrients?: {
    energy_kcal_100g:     number | null;
    sugars_100g:          number | null;
    'saturated-fat_100g': number | null;
    sodium_100g:          number | null;
    fiber_100g:           number | null;
    proteins_100g:        number | null;
    nova_group:           number | null;
    additives_tags:       string[];
  };
}

export interface AiNutrition {
  estimated: boolean;
  fields:    string[];
}

export interface ProductData {
  barcode:          string;
  name:             string;
  brand:            string;
  category:         string;
  image_url:        string | null;
  nutriscore:       string | null;
  nutrients:        ProductNutrients;
  evaluation:       ProductEvaluation;
  description:      string;
  warnings:         string[];
  tips:             string[];
  alternatives:     Alternative[];
  ai_nutrition:     AiNutrition;
  data_limitations?: (
    | 'nutriscore_unavailable'
    | 'nova_unavailable'
    | 'additives_unavailable'
  )[];
}

export async function fetchProduct(barcode: string): Promise<ProductData> {
  const { ok, data } = await apiFetch(`/api/product/${barcode}`);
  if (!ok || !data.success) throw new Error(data.message || 'Product not found');
  return data.product as ProductData;
}

// ── Nutrient coalesce helper ───────────────────────────────────────────────────
//
// Returns `a` if it is a real positive number; otherwise returns `b`.
// Used throughout buildProductFromAlternative to prefer Gemini nutrient
// values over zeros or nulls that may come from incomplete data sources.
//
function coalesceNutrient(a: number | null | undefined, b: number | null | undefined): number {
  if (a != null && a > 0) return a;
  if (b != null && b > 0) return b;
  return 0;
}

// ── Build a ProductData locally from a PH alternative ─────────────────────────
//
// Used when the user taps a gemini_ph / ph_fallback card — these have fake
// barcodes so we never hit the API. Instead we reconstruct a full ProductData
// from the _nutrients already embedded in the Alternative object.
//
// Gemini nutrient values are treated as authoritative.  Any value that is
// 0, null, or undefined is replaced by the Gemini estimate (coalesceNutrient).
//
// The returned object is structurally identical to what fetchProduct() returns,
// so the scanner sheet renders it exactly the same way as a real scan.
//
export function buildProductFromAlternative(alt: Alternative): ProductData {
  const n = alt._nutrients;

  // ── Use Gemini values; fall back to 0 only for truly absent nutrients ─────
  const energy_kcal     = coalesceNutrient(n?.energy_kcal_100g,     null);
  const sugar_g         = coalesceNutrient(n?.sugars_100g,           null);
  const saturated_fat_g = coalesceNutrient(n?.['saturated-fat_100g'], null);
  // sodium: stored in grams by Gemini/backend; multiply ×1000 for display (mg)
  const sodium_mg       = n?.sodium_100g != null && n.sodium_100g > 0
    ? n.sodium_100g * 1000
    : 0;
  const fiber_g         = coalesceNutrient(n?.fiber_100g,            null);
  const protein_g       = coalesceNutrient(n?.proteins_100g,         null);
  const nova_group      = n?.nova_group  ?? null;
  const additives_tags  = n?.additives_tags ?? [];

  // ── Score — mirrors backend scoring logic ─────────────────────────────────
  const penaltySugar      = Math.min(30, (sugar_g / 10) * 15);
  const penaltySatFat     = Math.min(20, (saturated_fat_g / 5) * 10);
  const penaltySodium     = Math.min(20, (sodium_mg / 400) * 10);
  const penaltyEnergy     = Math.min(10, (energy_kcal / 200) * 5);
  const penaltyProcessing = nova_group === 4 ? 15 : nova_group === 3 ? 5 : 0;
  const penaltyAdditives  = Math.min(10, additives_tags.length * 1.5);

  const bonusFiber   = Math.min(10, (fiber_g / 3) * 5);
  const bonusProtein = Math.min(10, (protein_g / 10) * 5);

  const uncapped = 100
    - penaltySugar
    - penaltySatFat
    - penaltySodium
    - penaltyEnergy
    - penaltyProcessing
    - penaltyAdditives
    + bonusFiber
    + bonusProtein;

  const nova4Cap = nova_group === 4 ? 45 : 100;
  const score    = Math.max(0, Math.min(nova4Cap, Math.round(uncapped)));

  const grade =
    score >= 75 ? 'A' :
    score >= 60 ? 'B' :
    score >= 45 ? 'C' :
    score >= 30 ? 'D' : 'E';

  const scoreColor =
    score >= 75 ? '#16a34a' :
    score >= 60 ? '#65a30d' :
    score >= 45 ? '#ca8a04' :
    score >= 30 ? '#ea580c' : '#dc2626';

  const nutrients: ProductNutrients = {
    energy_kcal,
    sugar_g,
    saturated_fat_g,
    sodium_mg,
    fiber_g,
    protein_g,
    nova_group,
    additives_count: additives_tags.length,
  };

  const breakdown: ScoreBreakdown = {
    penalties: {
      sugar:         penaltySugar,
      saturated_fat: penaltySatFat,
      sodium:        penaltySodium,
      energy:        penaltyEnergy,
      processing:    penaltyProcessing,
      additives:     penaltyAdditives,
    },
    bonuses: {
      fiber:           bonusFiber,
      protein:         bonusProtein,
      goal_adjustment: 0,
    },
    effective_nutrients: nutrients,
    nova_cap_applied:    nova_group === 4,
    cap_source:          nova_group === 4 ? 'nova_4' : undefined,
    nova_cap:            nova_group === 4 ? 45 : undefined,
    uncapped_score:      Math.round(uncapped),
  };

  // ── Warnings ─────────────────────────────────────────────────────────────
  const warnings: string[] = [];
  if (sugar_g > 15)            warnings.push(`High sugar: ${sugar_g.toFixed(1)}g per 100g`);
  if (saturated_fat_g > 5)     warnings.push(`High saturated fat: ${saturated_fat_g.toFixed(1)}g per 100g`);
  if (sodium_mg > 600)         warnings.push(`High sodium: ${sodium_mg.toFixed(0)}mg per 100g`);
  if (nova_group === 4)        warnings.push('Ultra-processed food (NOVA 4)');
  if (additives_tags.length > 5) warnings.push(`${additives_tags.length} additives detected`);

  // ── Tips ─────────────────────────────────────────────────────────────────
  const tips: string[] = [];
  if (fiber_g > 3)    tips.push(`Good source of fibre (${fiber_g.toFixed(1)}g per 100g).`);
  if (protein_g > 10) tips.push(`High in protein (${protein_g.toFixed(1)}g per 100g).`);
  if (alt.where_to_buy) tips.push(`Available at: ${alt.where_to_buy}`);

  // ── Description ───────────────────────────────────────────────────────────
  // Prefer the dedicated `description` field from Gemini (2-3 sentences);
  // fall back to the `reason` field if description is absent.
  const description = alt.description ?? alt.reason ?? 'Locally available healthier alternative.';

  return {
    barcode:    alt.barcode,
    name:       alt.name,
    brand:      alt.brand,
    category:   'ph_alternative',
    image_url:  alt.image_url ?? null,
    nutriscore: null,
    nutrients,
    evaluation: {
      score,
      grade,
      color:   scoreColor,
      display: `${score}/100`,
      breakdown,
    },
    description,
    warnings,
    tips,
    alternatives: [],
    ai_nutrition: {
      estimated: true,
      fields: [
        'energy_kcal_100g',
        'sugars_100g',
        'saturated-fat_100g',
        'sodium_100g',
        'fiber_100g',
        'proteins_100g',
      ],
    },
    data_limitations: ['nutriscore_unavailable', 'nova_unavailable', 'additives_unavailable'],
  };
}

// ── Save Scan ──────────────────────────────────────────────
export async function saveScan(
  barcode:       string,
  score:         number,
  product?:      ProductData,
  alternatives?: Alternative[],
  description?:  string,
  warnings?:     string[],
  tips?:         string[]
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
  level_progress: number;
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
  points_earned?:     number;
  xp_earned?:         number;
  bonus_points_today: number;

  // Streak
  current_streak:     number;
  longest_streak:     number;
  streak_broken?:     boolean;
  streak_label:       string;
  streak_status?:     string;
  multiplier?:        number;

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
  score_tier?:        string;
  total_scans?:       number;
  healthy_scans?:     number;
  healthy_threshold?: number;

  // Achievements
  badges:             Badge[];
  new_badges?:        Badge[];
  bonus_events?:      BonusEvent[];
  badges_count?:      number;
  total_badges?:      number;

  // Extra
  next_badges?:        Badge[];
  days_until_reset?:   number;
  next_reset_date?:    string;
  weekly_reset_stale?: boolean;
  levels?:             { level: number; xpRequired: number; title: string }[];
  last_scan_date?:     string | null;
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

// ── Healthy score threshold ────────────────────────────────
export const HEALTHY_SCORE_THRESHOLD = 60;

// ── Alternative source helpers ─────────────────────────────
export function isPHAlternative(alt: Alternative): boolean {
  return alt.source === 'openai_ph_alternative' || alt.source === 'gemini_ph' || alt.source === 'ph_fallback';
}