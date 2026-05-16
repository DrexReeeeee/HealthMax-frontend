import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { apiFetch, GamificationData } from './utils/api';
import { isLoggedIn } from './utils/storage';

const { width: SW, height: SH } = Dimensions.get('window');
const CHART_W = SW - 80;

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProductNutrients {
  sugar_g?:         number | null;
  saturated_fat_g?: number | null;
  sodium_mg?:       number | null;
  energy_kcal?:     number | null;
  fiber_g?:         number | null;
  protein_g?:       number | null;
  nova_group?:      number | null;
  additives_count?: number | null;
}

interface HistoryItem {
  id:         string;
  score:      number;
  scanned_at: string;
  products: {
    barcode:    string;
    name:       string;
    brand?:     string;
    category?:  string;
    nutrients?: ProductNutrients;
  };
}

interface DashboardData {
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
}

// GamificationData is now imported from api.ts — local declaration removed.

type ChartType = 'line' | 'bar' | 'area' | 'radar';

// ── Helpers ────────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 75) return '#16a34a';
  if (s >= 60) return '#65a30d';
  if (s >= 45) return '#ca8a04';
  if (s >= 25) return '#ea580c';
  return '#dc2626';
}

function avg(arr: number[]) {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round1(n: number) { return Math.round(n * 10) / 10; }

function groupByDay(items: HistoryItem[], days = 14): { label: string; score: number; count: number; date: Date }[] {
  const now = Date.now();
  const cutoff = now - days * 86400000;
  const recent = items.filter(i => new Date(i.scanned_at).getTime() >= cutoff);

  const map: Record<string, { scores: number[]; count: number; date: Date }> = {};
  recent.forEach(item => {
    const d = new Date(item.scanned_at);
    const key = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    if (!map[key]) map[key] = { scores: [], count: 0, date: d };
    map[key].scores.push(item.score ?? 0);
    map[key].count++;
  });

  return Object.entries(map)
    .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
    .map(([label, { scores, count, date }]) => ({
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      score: Math.round(avg(scores)),
      count,
      date,
    }));
}

function groupByWeek(items: HistoryItem[]): { label: string; score: number; count: number; week: number }[] {
  const map: Record<string, { scores: number[]; count: number; week: number }> = {};
  
  items.forEach(item => {
    const d = new Date(item.scanned_at);
    const weekKey = `${d.getFullYear()}-W${Math.ceil((d.getDate() - d.getDay() + 1) / 7)}`;
    const weekNum = Math.ceil((d.getDate() - d.getDay() + 1) / 7);
    
    if (!map[weekKey]) map[weekKey] = { scores: [], count: 0, week: weekNum };
    map[weekKey].scores.push(item.score ?? 0);
    map[weekKey].count++;
  });

  return Object.entries(map)
    .slice(-8)
    .map(([label, { scores, count, week }]) => ({
      label: `Week ${week}`,
      score: Math.round(avg(scores)),
      count,
      week,
    }));
}

function groupByMonth(items: HistoryItem[]): { label: string; score: number; count: number; month: number }[] {
  const map: Record<string, { scores: number[]; count: number; month: number }> = {};
  
  items.forEach(item => {
    const d = new Date(item.scanned_at);
    const monthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
    
    if (!map[monthKey]) map[monthKey] = { scores: [], count: 0, month: d.getMonth() + 1 };
    map[monthKey].scores.push(item.score ?? 0);
    map[monthKey].count++;
  });

  return Object.entries(map)
    .slice(-6)
    .map(([label, { scores, count, month }]) => ({
      label: new Date(2024, month - 1, 1).toLocaleString('default', { month: 'short' }),
      score: Math.round(avg(scores)),
      count,
      month,
    }));
}

function getWeeklyComparison(items: HistoryItem[]) {
  const now = Date.now();
  const thisWeek  = items.filter(i => now - new Date(i.scanned_at).getTime() < 7  * 86400000);
  const lastWeek  = items.filter(i => {
    const age = now - new Date(i.scanned_at).getTime();
    return age >= 7 * 86400000 && age < 14 * 86400000;
  });
  const thisAvg = Math.round(avg(thisWeek.map(i => i.score ?? 0)));
  const lastAvg = Math.round(avg(lastWeek.map(i => i.score ?? 0)));
  return { thisAvg, lastAvg, diff: thisAvg - lastAvg, thisCount: thisWeek.length, lastCount: lastWeek.length };
}

function getMonthlyComparison(items: HistoryItem[]) {
  const now = new Date();
  const thisMonth = items.filter(i => {
    const d = new Date(i.scanned_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const lastMonth = items.filter(i => {
    const d = new Date(i.scanned_at);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
  });
  const thisAvg = Math.round(avg(thisMonth.map(i => i.score ?? 0)));
  const lastAvg = Math.round(avg(lastMonth.map(i => i.score ?? 0)));
  return { thisAvg, lastAvg, diff: thisAvg - lastAvg, thisCount: thisMonth.length, lastCount: lastMonth.length };
}

function getTopBrands(items: HistoryItem[], n = 5) {
  const map: Record<string, { count: number; totalScore: number }> = {};
  items.forEach(item => {
    const brand = item.products.brand ?? 'Unknown';
    if (!map[brand]) map[brand] = { count: 0, totalScore: 0 };
    map[brand].count++;
    map[brand].totalScore += item.score ?? 0;
  });
  return Object.entries(map)
    .map(([brand, { count, totalScore }]) => ({ brand, count, avgScore: Math.round(totalScore / count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

function getTopCategories(items: HistoryItem[], n = 5) {
  const map: Record<string, { count: number; totalScore: number }> = {};
  items.forEach(item => {
    const category = item.products.category ?? 'Uncategorized';
    if (!map[category]) map[category] = { count: 0, totalScore: 0 };
    map[category].count++;
    map[category].totalScore += item.score ?? 0;
  });
  return Object.entries(map)
    .map(([category, { count, totalScore }]) => ({ category, count, avgScore: Math.round(totalScore / count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

function getNovaDistribution(items: HistoryItem[]) {
  const counts = [0, 0, 0, 0];
  let total = 0;
  items.forEach(item => {
    const ng = item.products.nutrients?.nova_group;
    if (ng != null && ng >= 1 && ng <= 4) {
      counts[ng - 1]++;
      total++;
    }
  });
  const labels = ['Unprocessed', 'Processed culinary', 'Processed', 'Ultra-processed'];
  const colors = ['#16a34a', '#65a30d', '#ca8a04', '#dc2626'];
  return labels.map((label, i) => ({ label, count: counts[i], pct: total === 0 ? 0 : Math.round((counts[i] / total) * 100), color: colors[i] }));
}

function getNutrientAverages(items: HistoryItem[]) {
  const collect = (key: keyof ProductNutrients) =>
    items.map(i => i.products.nutrients?.[key]).filter((v): v is number => v != null && !isNaN(Number(v))).map(Number);

  return {
    energy_kcal:     round1(avg(collect('energy_kcal'))),
    sugar_g:         round1(avg(collect('sugar_g'))),
    sodium_mg:       round1(avg(collect('sodium_mg'))),
    saturated_fat_g: round1(avg(collect('saturated_fat_g'))),
    fiber_g:         round1(avg(collect('fiber_g'))),
    protein_g:       round1(avg(collect('protein_g'))),
    additives_count: round1(avg(collect('additives_count'))),
  };
}

function getTimeOfDayAnalysis(items: HistoryItem[]) {
  const morning:   number[] = [];
  const afternoon: number[] = [];
  const evening:   number[] = [];
  const night:     number[] = [];

  items.forEach(item => {
    // Convert UTC timestamp to Philippine time (UTC+8)
    const utcDate = new Date(item.scanned_at);
    const phTime  = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
    const hour    = phTime.getUTCHours(); // use getUTCHours() since we manually shifted
    const score   = item.score ?? 0;

    if (hour >= 5  && hour < 12) morning.push(score);
    else if (hour >= 12 && hour < 17) afternoon.push(score);
    else if (hour >= 17 && hour < 21) evening.push(score);
    else night.push(score);
  });

  return {
    morning:   { avg: Math.round(avg(morning)),   count: morning.length },
    afternoon: { avg: Math.round(avg(afternoon)), count: afternoon.length },
    evening:   { avg: Math.round(avg(evening)),   count: evening.length },
    night:     { avg: Math.round(avg(night)),     count: night.length },
  };
}

function getDayOfWeekAnalysis(items: HistoryItem[]) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayData: { day: string; scores: number[]; count: number }[] = days.map(day => ({ day, scores: [], count: 0 }));

  items.forEach(item => {
    // Convert UTC to Philippine time (UTC+8)
    const utcDate  = new Date(item.scanned_at);
    const phTime   = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
    const dayIndex = phTime.getUTCDay(); // use getUTCDay() after manual shift
    const score    = item.score ?? 0;

    if (dayIndex >= 0 && dayIndex < dayData.length) {
      dayData[dayIndex].scores.push(score);
      dayData[dayIndex].count++;
    }
  });

  return dayData.map(d => ({
    day:      d.day,
    avgScore: d.scores.length > 0 ? Math.round(avg(d.scores)) : 0,
    count:    d.count,
  }));
}

// ── Animated Components ─────────────────────────────────────────────────────────

const FadeIn = ({ children, delay = 0, style }: any) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
};

const ScaleIn = ({ children, delay = 0, style }: any) => {
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        delay,
        useNativeDriver: true,
        tension: 80,
        friction: 8,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ scale }] }, style]}>
      {children}
    </Animated.View>
  );
};

// ── Chart Components ───────────────────────────────────────────────────────────

function LineChart({ data, height = 140 }: { data: { label: string; score: number }[]; height?: number }) {
  if (data.length === 0) return <Text style={styles.noDataText}>No data for this period.</Text>;
  
  const points = data.map((d, i) => ({
    x: data.length === 1 ? CHART_W / 2 : (i / (data.length - 1)) * CHART_W,
    y: height - (Math.max(0, Math.min(100, d.score)) / 100) * height,
    ...d,
  }));

  return (
    <View style={{ height: height + 52 }}>
      {[0, 25, 50, 75, 100].map(v => (
        <View key={v} style={[styles.gridLine, { bottom: (v / 100) * height + 28 }]} />
      ))}
      {[0, 25, 50, 75, 100].map(v => (
        <Text key={`l${v}`} style={[styles.gridLabel, { bottom: (v / 100) * height + 22 }]}>{v}</Text>
      ))}
      <View style={{ position: 'absolute', bottom: 28, left: 32, width: CHART_W - 32, height }}>
        {points.map((pt, i) => {
          if (i === 0) return null;
          const prev = points[i - 1];
          const dx = pt.x - prev.x, dy = pt.y - prev.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          return (
            <View key={`seg${i}`} style={{
              position: 'absolute', left: prev.x, top: prev.y,
              width: len, height: 3, backgroundColor: scoreColor(pt.score),
              borderRadius: 2, transform: [{ rotate: `${angle}deg` }],
              transformOrigin: 'left center',
            }} />
          );
        })}
        {points.map((pt, i) => (
          <TouchableOpacity key={`dot${i}`} style={[styles.dot, { left: pt.x - 8, top: pt.y - 8, backgroundColor: scoreColor(pt.score) }]}>
            <Text style={styles.dotText}>{pt.score}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: height + 32, paddingLeft: 32 }}>
        {data.map((d, i) => (
          <Text key={i} style={styles.axisLabel}>{d.label}</Text>
        ))}
      </View>
    </View>
  );
}

function BarChart({ data, height = 200 }: { data: { label: string; score: number; color?: string }[]; height?: number }) {
  if (data.length === 0) return <Text style={styles.noDataText}>No data available</Text>;
  
  const maxScore = Math.max(...data.map(d => d.score), 100);
  const barWidth = (CHART_W - 40) / data.length - 8;
  
  return (
    <View style={{ height: height + 60 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', height, paddingTop: 20 }}>
        {data.map((item, index) => {
          const barHeight = (item.score / maxScore) * (height - 40);
          const barColor = item.color || scoreColor(item.score);
          
          return (
            <View key={index} style={{ alignItems: 'center', width: barWidth + 8 }}>
              <View style={[styles.barContainer, { height: height - 40 }]}>
                <Animated.View 
                  style={[styles.bar, { 
                    height: barHeight, 
                    backgroundColor: barColor,
                    width: barWidth,
                  }]} 
                />
              </View>
              <Text style={styles.barLabel}>{item.label}</Text>
              <Text style={styles.barValue}>{item.score}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function AreaChart({ data, height = 140 }: { data: { label: string; score: number }[]; height?: number }) {
  if (data.length === 0) return <Text style={styles.noDataText}>No data for this period.</Text>;
  
  const points = data.map((d, i) => ({
    x: data.length === 1 ? CHART_W / 2 : (i / (data.length - 1)) * CHART_W,
    y: height - (Math.max(0, Math.min(100, d.score)) / 100) * height,
    score: d.score,
  }));

  return (
    <View style={{ height: height + 52 }}>
      {[0, 25, 50, 75, 100].map(v => (
        <View key={v} style={[styles.gridLine, { bottom: (v / 100) * height + 28 }]} />
      ))}
      <View style={{ position: 'absolute', bottom: 28, left: 32, width: CHART_W - 32, height, overflow: 'hidden' }}>
        {points.map((pt, i) => {
          if (i === 0) return null;
          const prev = points[i - 1];
          const width = pt.x - prev.x;
          const avgScore = (pt.score + prev.score) / 2;
          const fillHeight = height - (avgScore / 100) * height;
          
          return (
            <View key={`area${i}`} style={{
              position: 'absolute',
              left: prev.x,
              bottom: 0,
              width,
              height: fillHeight,
              backgroundColor: scoreColor(pt.score) + '30',
            }} />
          );
        })}
        {points.map((pt, i) => {
          if (i === 0) return null;
          const prev = points[i - 1];
          const dx = pt.x - prev.x, dy = pt.y - prev.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          return (
            <View key={`seg${i}`} style={{
              position: 'absolute', left: prev.x, top: prev.y,
              width: len, height: 3, backgroundColor: scoreColor(pt.score),
              borderRadius: 2, transform: [{ rotate: `${angle}deg` }],
              transformOrigin: 'left center',
            }} />
          );
        })}
        {points.map((pt, i) => (
          <View key={`dot${i}`} style={[styles.dot, { left: pt.x - 6, top: pt.y - 6, backgroundColor: scoreColor(pt.score) }]}>
            <Text style={styles.dotText}>{pt.score}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: height + 32, paddingLeft: 32 }}>
        {data.map((d, i) => (
          <Text key={i} style={styles.axisLabel}>{d.label}</Text>
        ))}
      </View>
    </View>
  );
}

function RadarChart({ data }: { data: { label: string; value: number; max: number }[] }) {
  const size = Math.min(CHART_W - 40, 250);
  const center = size / 2;
  const radius = size / 2 - 20;
  const angles = data.map((_, i) => (i * 2 * Math.PI) / data.length - Math.PI / 2);
  
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 20 }}>
      <View style={{ width: size, height: size, position: 'relative' }}>
        {[0.2, 0.4, 0.6, 0.8, 1].map(level => (
          <View
            key={level}
            style={{
              position: 'absolute',
              width: radius * 2 * level,
              height: radius * 2 * level,
              borderRadius: radius * level,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              top: center - radius * level,
              left: center - radius * level,
            }}
          />
        ))}
        
        {data.map((_, i) => {
          const angle = angles[i];
          return (
            <View
              key={`axis${i}`}
              style={{
                position: 'absolute',
                width: 1,
                height: radius,
                backgroundColor: '#cbd5e1',
                left: center,
                top: center,
                transform: [{ rotate: `${angle + Math.PI / 2}rad` }],
                transformOrigin: 'center top',
              }}
            />
          );
        })}
        
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          {data.map((item, i) => {
            const ratio = Math.min(1, item.value / item.max);
            const angle = angles[i];
            const x = center + radius * ratio * Math.cos(angle);
            const y = center + radius * ratio * Math.sin(angle);
            
            return (
              <View
                key={`poly${i}`}
                style={{
                  position: 'absolute',
                  left: x - 3,
                  top: y - 3,
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#10b981',
                }}
              />
            );
          })}
        </View>
        
        {data.map((item, i) => {
          const angle = angles[i];
          const x = center + (radius + 20) * Math.cos(angle);
          const y = center + (radius + 20) * Math.sin(angle);
          return (
            <Text key={`label${i}`} style={[styles.radarLabel, { left: x - 25, top: y - 8 }]}>
              {item.label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

// ── Section Components ─────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Feather name={icon as any} size={18} color="#10b981" />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function MetricCard({ title, value, subtitle, color }: { title: string; value: string | number; subtitle?: string; color?: string }) {
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View 
      style={[
        styles.metricCard, 
        { borderTopColor: color || '#10b981', borderTopWidth: 3, opacity: opacityAnim, transform: [{ scale: scaleAnim }] }
      ]}
    >
      <Text style={[styles.metricValue, { color: color || '#0f172a' }]}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
      {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
    </Animated.View>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

type Tab = 'overview' | 'trends' | 'nutrients' | 'insights' | 'timeline';

export default function Analytics() {
  const [tab, setTab] = useState<Tab>('overview');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [gamification, setGamification] = useState<GamificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const online = await isLoggedIn();
      setIsOnline(online);
      if (!online) return;

      const [dashRes, histRes, gamRes] = await Promise.all([
        apiFetch('/api/dashboard', { method: 'GET' }, true),
        apiFetch('/api/history?filter=all', { method: 'GET' }, true),
        apiFetch('/api/gamification', { method: 'GET' }, true),
      ]);

      if (dashRes.ok && dashRes.data?.dashboard) setDashboard(dashRes.data.dashboard);
      if (histRes.ok && histRes.data?.history) setHistory(histRes.data.history);
      if (gamRes.ok && gamRes.data?.gamification) setGamification(gamRes.data.gamification);
    } catch (err) {
      console.error('Analytics load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const headerTranslateY = headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] });
  const headerOpacity = headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  // Derived data
  const dailyData = groupByDay(history, timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 90);
  const weeklyData = groupByWeek(history);
  const monthlyData = groupByMonth(history);
  const weeklyComp = getWeeklyComparison(history);
  const monthlyComp = getMonthlyComparison(history);
  const topBrands = getTopBrands(history);
  const topCategories = getTopCategories(history);
  const nova = getNovaDistribution(history);
  const nutrients = getNutrientAverages(history);
  const timeOfDay = getTimeOfDayAnalysis(history);
  const dayOfWeek = getDayOfWeekAnalysis(history);
  
  const totalScans  = gamification?.total_scans ?? dashboard?.total_scans ?? history.length;
const healthyScans = dashboard?.healthy_scans ?? history.filter(i => (i.score ?? 0) >= 60).length;

// Compute live from actual counts — never stale
const healthyPct  = totalScans > 0 ? Math.round((healthyScans / totalScans) * 100) : 0;
  const streak          = gamification?.current_streak ?? dashboard?.current_streak ?? 0;
  const longestStreak   = gamification?.longest_streak ?? dashboard?.longest_streak ?? 0;
  // Prefer server-computed avg_score_last10 over locally computed average
  const avgScoreAll     = gamification?.avg_score_last10 ?? Math.round(avg(history.map(i => i.score ?? 0)));
  const totalPoints     = gamification?.total_points ?? dashboard?.total_points ?? 0;
  const weeklyPoints    = gamification?.weekly_points ?? 0;
  const badgeCount      = gamification?.badges_count ?? gamification?.badges?.length ?? 0;
  const streakLabel     = gamification?.streak_label;
  const level           = gamification?.level;
  const levelTitle      = gamification?.level_title;
  
  const bestProduct = [...history].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const worstProduct = [...history].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];

  const trendData = timeRange === 'week' ? dailyData.slice(-7) : timeRange === 'month' ? dailyData.slice(-30) : weeklyData;
  
  const getChartComponent = () => {
    const chartData = trendData.map(d => ({ label: d.label, score: d.score }));
    switch (chartType) {
      case 'bar': return <BarChart data={chartData} height={200} />;
      case 'area': return <AreaChart data={chartData} height={140} />;
      default: return <LineChart data={chartData} height={140} />;
    }
  };

  const radarData = [
    { label: 'Nutrition', value: nutrients.protein_g * 10, max: 100 },
    { label: 'Low Sugar', value: Math.max(0, 100 - nutrients.sugar_g * 5), max: 100 },
    { label: 'Low Salt', value: Math.max(0, 100 - nutrients.sodium_mg / 10), max: 100 },
    { label: 'Low Fat', value: Math.max(0, 100 - nutrients.saturated_fat_g * 5), max: 100 },
    { label: 'High Fibre', value: nutrients.fiber_g * 10, max: 100 },
    { label: 'Clean', value: Math.max(0, 100 - nutrients.additives_count * 10), max: 100 },
  ];

  const scoreDistribution = [
    { label: 'Great (75+)', count: history.filter(i => (i.score ?? 0) >= 75).length, color: '#16a34a' },
    { label: 'Good (60–74)', count: history.filter(i => (i.score ?? 0) >= 60 && (i.score ?? 0) < 75).length, color: '#65a30d' },
    { label: 'Moderate (45–59)', count: history.filter(i => (i.score ?? 0) >= 45 && (i.score ?? 0) < 60).length, color: '#ca8a04' },
    { label: 'Poor (25–44)', count: history.filter(i => (i.score ?? 0) >= 25 && (i.score ?? 0) < 45).length, color: '#ea580c' },
    { label: 'Avoid (<25)', count: history.filter(i => (i.score ?? 0) < 25).length, color: '#dc2626' },
  ];

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading analytics…</Text>
      </View>
    );
  }

  if (!isOnline) {
    return (
      <View style={styles.root}>
        <SafeAreaView>
          <View style={styles.headerBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="arrow-left" size={22} color="#0f172a" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Analytics</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
        <View style={styles.centered}>
          <Feather name="wifi-off" size={64} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>Offline</Text>
          <Text style={styles.emptyBody}>Analytics require a connection. Sign in to view your data.</Text>
        </View>
      </View>
    );
  }

  if (history.length === 0) {
    return (
      <View style={styles.root}>
        <SafeAreaView>
          <View style={styles.headerBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="arrow-left" size={22} color="#0f172a" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Analytics</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
        <View style={styles.centered}>
          <Feather name="bar-chart-2" size={64} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No scans yet</Text>
          <Text style={styles.emptyBody}>Scan your first product to start seeing analytics.</Text>
          <TouchableOpacity style={styles.scanBtn} onPress={() => router.push('/scanner')}>
            <LinearGradient colors={['#10b981', '#059669']} style={styles.scanBtnGradient}>
              <Feather name="camera" size={18} color="#fff" />
              <Text style={styles.scanBtnText}>Scan Now</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      <SafeAreaView style={styles.safeHeader}>
        <Animated.View style={[styles.headerBar, { opacity: headerOpacity, transform: [{ translateY: headerTranslateY }] }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Analytics</Text>
          <TouchableOpacity onPress={() => load(true)} style={styles.refreshBtn}>
            <Feather name="refresh-cw" size={18} color="#64748b" />
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#10b981" colors={['#10b981']} />}
      >
        {/* Key Metrics Row */}
        <FadeIn delay={50}>
          <View style={styles.metricsGrid}>
            <MetricCard title="Total Scans" value={totalScans} color="#3b82f6" />
            <MetricCard title="Avg Score" value={avgScoreAll} color={scoreColor(avgScoreAll)} />
            <MetricCard title="Healthy" value={`${Math.round(healthyPct)}%`} color="#10b981" />
            <MetricCard 
              title="Streak" 
              value={`${streak}d`} 
              subtitle={
                gamification?.streak_status === 'broken'
                  ? 'Missed a day — reset!'
                  : gamification?.streak_status === 'scanned_today'
                  ? 'Already scanned today ✓'
                  : streakLabel && streak > 0
                  ? `${streakLabel} · Best: ${longestStreak}d`
                  : `Best: ${longestStreak}d`
              }
              color={
                gamification?.streak_status === 'broken'
                  ? '#f59e0b'
                  : '#ef4444'
              }
            />
            <MetricCard
              title="Points"
              value={totalPoints}
              subtitle={weeklyPoints > 0 ? `${weeklyPoints} this week` : undefined}
              color="#f59e0b"
            />
            <MetricCard 
              title="Badges" 
              value={badgeCount}
              subtitle={
                gamification?.total_badges 
                  ? `of ${gamification.total_badges}` 
                  : undefined
              }
              color="#a855f7" 
            />
            {level != null && (
              <MetricCard
                title="Level"
                value={level}
                subtitle={levelTitle ?? undefined}
                color="#0ea5e9"
              />
            )}
          </View>
        </FadeIn>

        {/* Week/Month Comparison Cards */}
        <FadeIn delay={100}>
          <View style={styles.comparisonContainer}>
            <ScaleIn delay={100} style={styles.comparisonCard}>
              <View style={styles.comparisonHeader}>
                <Feather name="calendar" size={14} color="#64748b" />
                <Text style={styles.comparisonTitle}>Week Over Week</Text>
              </View>
              <View style={styles.comparisonRow}>
                <View>
                  <Text style={styles.comparisonLabel}>This Week</Text>
                  <Text style={[styles.comparisonValue, { color: scoreColor(weeklyComp.thisAvg) }]}>{weeklyComp.thisAvg}</Text>
                  <Text style={styles.comparisonSub}>{weeklyComp.thisCount} scans</Text>
                </View>
                <View style={styles.comparisonDivider} />
                <View>
                  <Text style={styles.comparisonLabel}>Last Week</Text>
                  <Text style={[styles.comparisonValue, { color: scoreColor(weeklyComp.lastAvg) }]}>{weeklyComp.lastAvg}</Text>
                  <Text style={styles.comparisonSub}>{weeklyComp.lastCount} scans</Text>
                </View>
              </View>
              <View style={[styles.comparisonDiff, { backgroundColor: weeklyComp.diff >= 0 ? '#d1fae5' : '#fee2e2' }]}>
                <Feather name={weeklyComp.diff >= 0 ? "trending-up" : "trending-down"} size={12} color={weeklyComp.diff >= 0 ? '#059669' : '#dc2626'} />
                <Text style={{ color: weeklyComp.diff >= 0 ? '#059669' : '#dc2626', fontWeight: '700', fontSize: 12 }}>
                  {weeklyComp.diff >= 0 ? '+' : ''}{weeklyComp.diff} points
                </Text>
              </View>
            </ScaleIn>

            <ScaleIn delay={150} style={styles.comparisonCard}>
              <View style={styles.comparisonHeader}>
                <Feather name="calendar" size={14} color="#64748b" />
                <Text style={styles.comparisonTitle}>Month Over Month</Text>
              </View>
              <View style={styles.comparisonRow}>
                <View>
                  <Text style={styles.comparisonLabel}>This Month</Text>
                  <Text style={[styles.comparisonValue, { color: scoreColor(monthlyComp.thisAvg) }]}>{monthlyComp.thisAvg}</Text>
                  <Text style={styles.comparisonSub}>{monthlyComp.thisCount} scans</Text>
                </View>
                <View style={styles.comparisonDivider} />
                <View>
                  <Text style={styles.comparisonLabel}>Last Month</Text>
                  <Text style={[styles.comparisonValue, { color: scoreColor(monthlyComp.lastAvg) }]}>{monthlyComp.lastAvg}</Text>
                  <Text style={styles.comparisonSub}>{monthlyComp.lastCount} scans</Text>
                </View>
              </View>
              <View style={[styles.comparisonDiff, { backgroundColor: monthlyComp.diff >= 0 ? '#d1fae5' : '#fee2e2' }]}>
                <Feather name={monthlyComp.diff >= 0 ? "trending-up" : "trending-down"} size={12} color={monthlyComp.diff >= 0 ? '#059669' : '#dc2626'} />
                <Text style={{ color: monthlyComp.diff >= 0 ? '#059669' : '#dc2626', fontWeight: '700', fontSize: 12 }}>
                  {monthlyComp.diff >= 0 ? '+' : ''}{Math.abs(monthlyComp.diff)} points
                </Text>
              </View>
            </ScaleIn>
          </View>
        </FadeIn>

        {/* Tab Bar */}
        <FadeIn delay={200}>
          <View style={styles.tabBar}>
            {(['overview', 'trends', 'nutrients', 'timeline', 'insights'] as Tab[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </FadeIn>

        {/* Overview Tab */}
        {tab === 'overview' && (
          <>
            <FadeIn delay={250}>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxValue}>{healthyPct}%</Text>
                  <Text style={styles.statBoxLabel}>Healthy Choices</Text>
                  <View style={styles.progressBarTrack}>
                    <Animated.View style={[styles.progressBarFill, { width: `${healthyPct}%`, backgroundColor: '#10b981' }]} />
                  </View>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxValue}>{Math.round(avgScoreAll)}</Text>
                  <Text style={styles.statBoxLabel}>Average Score</Text>
                  <View style={styles.scoreDistribution}>
                    {[0, 25, 50, 75, 100].map(level => (
                      <View key={level} style={[styles.scoreLevel, { backgroundColor: avgScoreAll >= level ? scoreColor(avgScoreAll) : '#e2e8f0' }]} />
                    ))}
                  </View>
                </View>
              </View>
            </FadeIn>

            <FadeIn delay={300}>
              <View style={styles.card}>
                <SectionHeader icon="pie-chart" title="Score Distribution" />
                {scoreDistribution.map((d, i) => (
                  <ScaleIn key={d.label} delay={300 + i * 50}>
                    <View style={styles.distRow}>
                      <View style={[styles.distSwatch, { backgroundColor: d.color }]} />
                      <Text style={styles.distLabel}>{d.label}</Text>
                      <View style={styles.distTrack}>
                        <Animated.View style={[styles.distFill, { backgroundColor: d.color, width: `${(d.count / totalScans) * 100}%` }]} />
                      </View>
                      <Text style={styles.distCount}>{d.count}</Text>
                    </View>
                  </ScaleIn>
                ))}
              </View>
            </FadeIn>

            {/* Top Categories & Brands */}
            <View style={styles.twoColumnRow}>
              {topCategories.length > 0 && (
                <FadeIn delay={350} style={[styles.card, styles.halfCard]}>
                  <SectionHeader icon="folder" title="Top Categories" />
                  {topCategories.map((cat, i) => (
                    <View key={cat.category} style={styles.categoryRow}>
                      <Text style={styles.categoryName}>{cat.category}</Text>
                      <Text style={[styles.categoryScore, { color: scoreColor(cat.avgScore) }]}>{cat.avgScore}</Text>
                    </View>
                  ))}
                </FadeIn>
              )}
              
              {topBrands.length > 0 && (
                <FadeIn delay={400} style={[styles.card, styles.halfCard]}>
                  <SectionHeader icon="tag" title="Top Brands" />
                  {topBrands.map((brand, i) => (
                    <View key={brand.brand} style={styles.categoryRow}>
                      <Text style={styles.categoryName}>{brand.brand}</Text>
                      <Text style={[styles.categoryScore, { color: scoreColor(brand.avgScore) }]}>{brand.avgScore}</Text>
                    </View>
                  ))}
                </FadeIn>
              )}
            </View>

            {/* Time of Day Analysis */}
            <FadeIn delay={450}>
              <View style={styles.card}>
                <SectionHeader icon="clock" title="Best Time to Scan" />
                <View style={styles.timeGrid}>
                  {[
                    { period: 'Morning', data: timeOfDay.morning },
                    { period: 'Afternoon', data: timeOfDay.afternoon },
                    { period: 'Evening', data: timeOfDay.evening },
                    { period: 'Night', data: timeOfDay.night },
                  ].map(({ period, data }) => (
                    <View key={period} style={styles.timeCard}>
                      <Text style={styles.timePeriod}>{period}</Text>
                      <Text style={[styles.timeScore, { color: scoreColor(data.avg) }]}>{data.avg || 0}</Text>
                      <Text style={styles.timeCount}>{data.count} scans</Text>
                    </View>
                  ))}
                </View>
              </View>
            </FadeIn>

            {/* Day of Week Analysis */}
            <FadeIn delay={500}>
              <View style={styles.card}>
                <SectionHeader icon="calendar" title="Performance by Day" />
                <BarChart 
                  data={dayOfWeek.map(d => ({ label: d.day.slice(0, 3), score: d.avgScore, color: scoreColor(d.avgScore) }))}
                  height={180}
                />
              </View>
            </FadeIn>
          </>
        )}

        {/* Trends Tab */}
        {tab === 'trends' && (
          <>
            <FadeIn delay={250}>
              <View style={styles.chartControls}>
                <Text style={styles.controlLabel}>Chart Type</Text>
                <View style={styles.chartTypeBar}>
                  {(['line', 'bar', 'area'] as ChartType[]).map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.chartTypeBtn, chartType === type && styles.chartTypeBtnActive]}
                      onPress={() => setChartType(type)}
                    >
                      <Feather name={type === 'line' ? "trending-up" : type === 'bar' ? "bar-chart-2" : "activity"} size={14} color={chartType === type ? '#fff' : '#64748b'} />
                      <Text style={[styles.chartTypeText, chartType === type && styles.chartTypeTextActive]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </FadeIn>

            <FadeIn delay={300}>
              <View style={styles.timeRangeBar}>
                {(['week', 'month', 'year'] as const).map(range => (
                  <TouchableOpacity
                    key={range}
                    style={[styles.timeRangeBtn, timeRange === range && styles.timeRangeBtnActive]}
                    onPress={() => setTimeRange(range)}
                  >
                    <Text style={[styles.timeRangeText, timeRange === range && styles.timeRangeTextActive]}>
                      {range === 'week' ? '7 Days' : range === 'month' ? '30 Days' : '90 Days'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FadeIn>

            <FadeIn delay={350}>
              <View style={styles.card}>
                <SectionHeader icon="trending-up" title="Score Trend" />
                {getChartComponent()}
              </View>
            </FadeIn>

            {/* Best & Worst Products */}
            {(bestProduct || worstProduct) && (
              <FadeIn delay={400}>
                <View style={styles.card}>
                  <SectionHeader icon="award" title="Best & Worst Products" />
                  {bestProduct && (
                    <ScaleIn delay={400}>
                      <View style={styles.extremeRow}>
                        <View style={[styles.extremeIcon, { backgroundColor: '#d1fae5' }]}>
                          <Feather name="award" size={18} color="#059669" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.extremeLabel}>Best Product</Text>
                          <Text style={styles.extremeName}>{bestProduct.products.name}</Text>
                          <Text style={styles.extremeBrand}>{bestProduct.products.brand}</Text>
                        </View>
                        <Text style={[styles.extremeScore, { color: scoreColor(bestProduct.score ?? 0) }]}>
                          {bestProduct.score}
                        </Text>
                      </View>
                    </ScaleIn>
                  )}
                  {worstProduct && bestProduct?.id !== worstProduct.id && (
                    <ScaleIn delay={450}>
                      <View style={[styles.extremeRow, { marginTop: 12 }]}>
                        <View style={[styles.extremeIcon, { backgroundColor: '#fee2e2' }]}>
                          <Feather name="alert-triangle" size={18} color="#dc2626" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.extremeLabel}>Needs Improvement</Text>
                          <Text style={styles.extremeName}>{worstProduct.products.name}</Text>
                          <Text style={styles.extremeBrand}>{worstProduct.products.brand}</Text>
                        </View>
                        <Text style={[styles.extremeScore, { color: scoreColor(worstProduct.score ?? 0) }]}>
                          {worstProduct.score}
                        </Text>
                      </View>
                    </ScaleIn>
                  )}
                </View>
              </FadeIn>
            )}

            {/* Radar Chart */}
            <FadeIn delay={450}>
              <View style={styles.card}>
                <SectionHeader icon="activity" title="Health Radar" />
                <RadarChart data={radarData} />
              </View>
            </FadeIn>
          </>
        )}

        {/* Nutrients Tab */}
        {tab === 'nutrients' && (
          <>
            <FadeIn delay={250}>
              <View style={styles.card}>
                <SectionHeader icon="droplet" title="Average per 100g" />
                {[
                  { label: 'Calories', value: nutrients.energy_kcal, max: 500, color: '#f59e0b', unit: ' kcal', warning: nutrients.energy_kcal > 300 },
                  { label: 'Sugar', value: nutrients.sugar_g, max: 30, color: '#ef4444', unit: ' g', warning: nutrients.sugar_g > 10 },
                  { label: 'Sodium', value: nutrients.sodium_mg, max: 1000, color: '#8b5cf6', unit: ' mg', warning: nutrients.sodium_mg > 500 },
                  { label: 'Sat Fat', value: nutrients.saturated_fat_g, max: 20, color: '#f97316', unit: ' g', warning: nutrients.saturated_fat_g > 10 },
                  { label: 'Fiber', value: nutrients.fiber_g, max: 10, color: '#10b981', unit: ' g', warning: nutrients.fiber_g < 3, inverse: true },
                  { label: 'Protein', value: nutrients.protein_g, max: 30, color: '#3b82f6', unit: ' g', warning: nutrients.protein_g < 5, inverse: true },
                ].map((n, i) => (
                  <ScaleIn key={n.label} delay={250 + i * 50}>
                    <View>
                      <View style={styles.nutrientHeader}>
                        <Text style={styles.nutrientLabel}>{n.label}</Text>
                        {n.warning && (
                          <Feather name="alert-circle" size={12} color="#dc2626" />
                        )}
                      </View>
                      <View style={styles.hbarRow}>
                        <View style={styles.hbarTrack}>
                          <Animated.View style={[styles.hbarFill, { backgroundColor: n.color, width: `${Math.min(100, (n.value / n.max) * 100)}%` }]} />
                        </View>
                        <Text style={[styles.hbarValue, { color: n.warning ? '#dc2626' : '#0f172a' }]}>{n.value}{n.unit}</Text>
                      </View>
                    </View>
                  </ScaleIn>
                ))}
              </View>
            </FadeIn>

            <FadeIn delay={550}>
              <View style={styles.card}>
                <SectionHeader icon="cpu" title="Processing Level (NOVA)" />
                {nova.map((n, i) => (
                  <ScaleIn key={n.label} delay={550 + i * 50}>
                    <View style={styles.distRow}>
                      <View style={[styles.distSwatch, { backgroundColor: n.color }]} />
                      <Text style={styles.distLabel}>{n.label}</Text>
                      <View style={styles.distTrack}>
                        <Animated.View style={[styles.distFill, { backgroundColor: n.color, width: `${n.pct}%` }]} />
                      </View>
                      <Text style={styles.distCount}>{n.pct}%</Text>
                    </View>
                  </ScaleIn>
                ))}
                <View style={styles.novaLegend}>
                  <Feather name="info" size={12} color="#64748b" />
                  <Text style={styles.novaLegendText}>NOVA 1 = Unprocessed · NOVA 4 = Ultra-processed</Text>
                </View>
              </View>
            </FadeIn>

            <FadeIn delay={700}>
              <View style={styles.card}>
                <SectionHeader icon="flask" title="Additives Analysis" />
                <View style={styles.additivesContainer}>
                  <View style={[styles.additivesCircle, {
                    borderColor: nutrients.additives_count <= 2 ? '#16a34a' : nutrients.additives_count <= 5 ? '#ca8a04' : '#dc2626',
                  }]}>
                    <Text style={[styles.additivesNumber, {
                      color: nutrients.additives_count <= 2 ? '#16a34a' : nutrients.additives_count <= 5 ? '#ca8a04' : '#dc2626',
                    }]}>{round1(nutrients.additives_count)}</Text>
                    <Text style={styles.additivesLabel}>avg</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.additivesDesc}>
                      {nutrients.additives_count <= 2
                        ? 'Excellent! Your choices are largely free from additives.'
                        : nutrients.additives_count <= 5
                        ? 'Moderate additive presence. Consider products with shorter ingredient lists.'
                        : 'High additive content. Look for whole food alternatives.'}
                    </Text>
                  </View>
                </View>
              </View>
            </FadeIn>
          </>
        )}

        {/* Timeline Tab */}
        {tab === 'timeline' && (
          <>
            <FadeIn delay={250}>
              <View style={styles.card}>
                <SectionHeader icon="calendar" title="Weekly Trend" />
                <BarChart data={weeklyData.map(w => ({ label: w.label, score: w.score }))} height={200} />
              </View>
            </FadeIn>

            <FadeIn delay={350}>
              <View style={styles.card}>
                <SectionHeader icon="calendar" title="Monthly Trend" />
                <BarChart data={monthlyData.map(m => ({ label: m.label, score: m.score }))} height={200} />
              </View>
            </FadeIn>

            <FadeIn delay={450}>
              <View style={styles.card}>
                <SectionHeader icon="clock" title="Recent Activity" />
                {dailyData.slice(-7).reverse().map((day, i) => (
                  <ScaleIn key={i} delay={450 + i * 30}>
                    <View style={styles.timelineItem}>
                      <View style={styles.timelineDate}>
                        <Text style={styles.timelineDay}>{day.label}</Text>
                        <Text style={styles.timelineCount}>{day.count} scans</Text>
                      </View>
                      <View style={styles.timelineBar}>
                        <Animated.View style={[styles.timelineFill, { width: `${day.score}%`, backgroundColor: scoreColor(day.score) }]} />
                      </View>
                      <Text style={[styles.timelineScore, { color: scoreColor(day.score) }]}>{day.score}</Text>
                    </View>
                  </ScaleIn>
                ))}
              </View>
            </FadeIn>
          </>
        )}

        {/* Insights Tab */}
        {tab === 'insights' && (
          <>
            <FadeIn delay={250}>
              <View style={styles.card}>
                <SectionHeader icon="target" title="Key Insights" />
                {[
                  { icon: "droplet", title: "Sugar Intake", value: nutrients.sugar_g, unit: "g/100g", good: nutrients.sugar_g <= 10, threshold: 10, message: nutrients.sugar_g > 10 ? "High sugar average. Consider reducing sugary snacks." : "Good sugar control. Keep it up!" },
                  { icon: "wind", title: "Sodium", value: nutrients.sodium_mg, unit: "mg/100g", good: nutrients.sodium_mg <= 500, threshold: 500, message: nutrients.sodium_mg > 500 ? "High sodium. Look for low-sodium options." : "Sodium levels are well controlled." },
                  { icon: "feather", title: "Fiber", value: nutrients.fiber_g, unit: "g/100g", good: nutrients.fiber_g >= 3, threshold: 3, message: nutrients.fiber_g < 3 ? "Low fiber intake. Add more whole grains and vegetables." : "Good fiber intake." },
                  { icon: "activity", title: "Protein", value: nutrients.protein_g, unit: "g/100g", good: nutrients.protein_g >= 5, threshold: 5, message: nutrients.protein_g < 5 ? "Low protein. Include more protein-rich foods." : "Good protein intake." },
                ].map((insight, i) => (
                  <ScaleIn key={insight.title} delay={250 + i * 80}>
                    <View style={styles.insightItem}>
                      <View style={[styles.insightIconCircle, { backgroundColor: insight.good ? '#d1fae5' : '#fee2e2' }]}>
                        <Feather name={insight.icon as any} size={18} color={insight.good ? '#059669' : '#dc2626'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.insightTitle}>{insight.title}</Text>
                        <Text style={styles.insightText}>{insight.message}</Text>
                      </View>
                      <View style={styles.insightValue}>
                        <Text style={[styles.insightValueNumber, { color: insight.good ? '#059669' : '#dc2626' }]}>{insight.value}</Text>
                        <Text style={styles.insightValueUnit}>{insight.unit}</Text>
                      </View>
                    </View>
                  </ScaleIn>
                ))}
              </View>
            </FadeIn>

            {/* Recommendations */}
              <FadeIn delay={550}>
                <View style={[styles.card, styles.recommendationCard]}>
                  <SectionHeader icon="lightbulb" title="Recommendations" />
                  {[
                    nutrients.sugar_g > 10 && "Replace sugary snacks with fresh fruit or yogurt",
                    nutrients.sodium_mg > 500 && "Choose fresh ingredients over processed foods",
                    nutrients.fiber_g < 3 && "Add beans, oats, or whole grains to your diet",
                    nutrients.protein_g < 5 && "Include eggs, legumes, or lean meats in meals",
                    (() => {
                      const ultraProcessed = nova.find(n => n.label === 'Ultra-processed');
                      return ultraProcessed && ultraProcessed.pct > 30 ? "Reduce ultra-processed foods by cooking more meals at home" : null;
                    })(),
                    timeOfDay.morning.avg < 50 && "Your morning choices need improvement - start the day healthy!",
                    (() => {
                      const sundayData = dayOfWeek.find(d => d.day === 'Sunday');
                      return sundayData && sundayData.avgScore < 50 ? "Weekends show lower scores - plan ahead for better choices" : null;
                    })(),
                  ].filter(Boolean).map((tip, i) => (
                    <View key={i} style={styles.tipRow}>
                      <Feather name="check-circle" size={14} color="#10b981" />
                      <Text style={styles.tipText}>{tip as string}</Text>
                    </View>
                  ))}
                  
                  {[
                    nutrients.sugar_g > 10,
                    nutrients.sodium_mg > 500,
                    nutrients.fiber_g < 3,
                    nutrients.protein_g < 5,
                  ].every(v => !v) && (
                    <View style={styles.allGoodContainer}>
                      <Feather name="check-circle" size={20} color="#10b981" />
                      <Text style={styles.allGoodText}>Excellent work! You're making great food choices!</Text>
                    </View>
                  )}
                </View>
              </FadeIn>

            {/* Optimal Scanning Times */}
            <FadeIn delay={650}>
              <View style={styles.card}>
                <SectionHeader icon="clock" title="Optimal Scanning Times" />
                <View style={styles.optimalTimeContainer}>
                  <Feather name="clock" size={20} color="#10b981" />
                  <Text style={styles.optimalTimeText}>
                    {(() => {
                      const bestTime = Object.entries(timeOfDay).reduce((best, [time, data]) =>
                        data.avg > best.avg ? { time, avg: data.avg } : best,
                        { time: 'morning', avg: 0 }
                      );

                      // Replace the time key with a readable label
                      const timeLabels: Record<string, string> = {
                        morning:   'morning (5am–12pm)',
                        afternoon: 'afternoon (12pm–5pm)',
                        evening:   'evening (5pm–9pm)',
                        night:     'night (9pm–5am)',
                      };

                      return `Your best scores come from ${timeLabels[bestTime.time] ?? bestTime.time} scans (avg ${bestTime.avg}). Try to scan more during this time for better results!`;
                                          })()}
                  </Text>
                </View>
              </View>
            </FadeIn>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  loadingText: { fontSize: 14, color: '#64748b' },

  safeHeader: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },

  scroll: { padding: 16, gap: 12 },

  // Metrics Grid
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  metricCard: {
    width: '31%', backgroundColor: '#fff', borderRadius: 16, padding: 12,
    alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 3,
  },
  metricValue: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  metricTitle: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  metricSubtitle: { fontSize: 9, color: '#94a3b8', marginTop: 2 },

  // Comparison
  comparisonContainer: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  comparisonCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14 },
  comparisonHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  comparisonTitle: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  comparisonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  comparisonLabel: { fontSize: 9, color: '#94a3b8' },
  comparisonValue: { fontSize: 22, fontWeight: '800' },
  comparisonSub: { fontSize: 8, color: '#94a3b8' },
  comparisonDivider: { width: 1, height: 30, backgroundColor: '#e2e8f0' },
  comparisonDiff: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4, borderRadius: 6 },

  // Tab Bar
  tabBar: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 14, padding: 4, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11 },
  tabBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  tabText: { fontSize: 12, fontWeight: '500', color: '#64748b' },
  tabTextActive: { fontWeight: '700', color: '#0f172a' },

  // Cards
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 3 },
  halfCard: { flex: 1 },
  twoColumnRow: { flexDirection: 'row', gap: 12, marginTop: 12 },

  // Section Header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statBox: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  statBoxValue: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  statBoxLabel: { fontSize: 12, color: '#64748b', marginTop: 2, marginBottom: 8 },
  progressBarTrack: { height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: 4, borderRadius: 2 },
  scoreDistribution: { flexDirection: 'row', gap: 3, marginTop: 8 },
  scoreLevel: { height: 4, borderRadius: 2, flex: 1 },

  // Chart Controls
  chartControls: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  controlLabel: { fontSize: 12, fontWeight: '500', color: '#64748b' },
  chartTypeBar: { flexDirection: 'row', gap: 8, backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4 },
  chartTypeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  chartTypeBtnActive: { backgroundColor: '#10b981' },
  chartTypeText: { fontSize: 11, fontWeight: '500', color: '#64748b' },
  chartTypeTextActive: { color: '#fff' },

  timeRangeBar: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  timeRangeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10, backgroundColor: '#f1f5f9' },
  timeRangeBtnActive: { backgroundColor: '#10b981' },
  timeRangeText: { fontSize: 11, fontWeight: '500', color: '#64748b' },
  timeRangeTextActive: { color: '#fff' },

  // Chart Elements
  gridLine: { position: 'absolute', left: 32, right: 0, height: 1, backgroundColor: '#f1f5f9' },
  gridLabel: { position: 'absolute', left: 0, fontSize: 8, color: '#cbd5e1', width: 28, textAlign: 'right' },
  dot: { position: 'absolute', width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  dotText: { fontSize: 7, color: '#fff', fontWeight: '700' },
  axisLabel: { fontSize: 9, color: '#94a3b8' },
  
  barContainer: { justifyContent: 'flex-end' },
  bar: { borderRadius: 4, marginHorizontal: 2 },
  barLabel: { fontSize: 9, color: '#64748b', marginTop: 4 },
  barValue: { fontSize: 10, fontWeight: '600', color: '#0f172a' },

  radarLabel: { position: 'absolute', fontSize: 9, color: '#64748b', fontWeight: '500' },

  // Distribution
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  distSwatch: { width: 10, height: 10, borderRadius: 3 },
  distLabel: { width: 95, fontSize: 11, color: '#475569', fontWeight: '500' },
  distTrack: { flex: 1, height: 6, backgroundColor: '#f1f5f9', borderRadius: 99, overflow: 'hidden' },
  distFill: { height: 6, borderRadius: 99 },
  distCount: { fontSize: 11, fontWeight: '600', color: '#0f172a', width: 35, textAlign: 'right' },

  // Categories
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  categoryName: { fontSize: 12, color: '#475569', flex: 1 },
  categoryScore: { fontSize: 14, fontWeight: '700' },

  // Time Analysis
  timeGrid: { flexDirection: 'row', gap: 8 },
  timeCard: { flex: 1, alignItems: 'center', padding: 10, backgroundColor: '#f8fafc', borderRadius: 12 },
  timePeriod: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  timeScore: { fontSize: 20, fontWeight: '800', marginTop: 5 },
  timeCount: { fontSize: 9, color: '#94a3b8', marginTop: 2 },

  // Nutrients
  nutrientHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  nutrientLabel: { fontSize: 12, fontWeight: '500', color: '#475569' },

  hbarRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  hbarTrack: { flex: 1, height: 8, backgroundColor: '#f1f5f9', borderRadius: 99, overflow: 'hidden' },
  hbarFill: { height: 8, borderRadius: 99 },
  hbarValue: { width: 48, fontSize: 11, fontWeight: '700', textAlign: 'right' },

  // Extremes
  extremeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  extremeIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  extremeLabel: { fontSize: 9, color: '#94a3b8', fontWeight: '500' },
  extremeName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  extremeBrand: { fontSize: 10, color: '#94a3b8' },
  extremeScore: { fontSize: 24, fontWeight: '900' },

  // NOVA
  novaLegend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  novaLegendText: { fontSize: 10, color: '#64748b' },

  // Additives
  additivesContainer: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  additivesCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  additivesNumber: { fontSize: 28, fontWeight: '900' },
  additivesLabel: { fontSize: 9, color: '#94a3b8', fontWeight: '500' },
  additivesDesc: { fontSize: 12, color: '#475569', lineHeight: 18, flex: 1 },

  // Timeline
  timelineItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  timelineDate: { width: 55 },
  timelineDay: { fontSize: 11, fontWeight: '600', color: '#0f172a' },
  timelineCount: { fontSize: 8, color: '#94a3b8' },
  timelineBar: { flex: 1, height: 8, backgroundColor: '#f1f5f9', borderRadius: 99, overflow: 'hidden' },
  timelineFill: { height: 8, borderRadius: 99 },
  timelineScore: { fontSize: 13, fontWeight: '700', width: 30, textAlign: 'right' },

  // Insights
  insightItem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  insightIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  insightTitle: { fontSize: 13, fontWeight: '600', color: '#0f172a', marginBottom: 2 },
  insightText: { fontSize: 11, color: '#64748b', lineHeight: 16 },
  insightValue: { alignItems: 'flex-end' },
  insightValueNumber: { fontSize: 16, fontWeight: '800' },
  insightValueUnit: { fontSize: 9, color: '#94a3b8' },

  // Tips
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  tipText: { flex: 1, fontSize: 12, color: '#166534', lineHeight: 18 },
  
  recommendationCard: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' },
  allGoodContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 8 },
  allGoodText: { fontSize: 12, color: '#166534', textAlign: 'center' },
  
  optimalTimeContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optimalTimeText: { fontSize: 13, color: '#475569', lineHeight: 19, flex: 1 },

  // Empty States
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginTop: 16 },
  emptyBody: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  scanBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 16 },
  scanBtnGradient: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 28, paddingVertical: 14 },
  scanBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  noDataText: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },
});