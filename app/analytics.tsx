//import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getScans, getUserStats, Scan, UserStats } from './utils/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 80;

// ─── Animated Card ────────────────────────────────────────────────────────────
function FadeInCard({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      <View style={styles.card}>{children}</View>
    </Animated.View>
  );
}

// ─── Simple Bar Chart ─────────────────────────────────────────────────────────
function SimpleBarChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const BAR_HEIGHT = 160;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: BAR_HEIGHT + 36 }}>
      {data.map((item, i) => {
        const barH = Math.max((item.value / max) * BAR_HEIGHT, 4);
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
            <Text style={styles.barValue}>{item.value}</Text>
            <View style={[styles.bar, { height: barH, backgroundColor: item.color }]} />
            <Text style={styles.barLabel} numberOfLines={1}>{item.name}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Simple Line Chart ────────────────────────────────────────────────────────
function SimpleLineChart({ data }: { data: { day: string; score: number }[] }) {
  if (data.length === 0) return null;
  const HEIGHT = 160;

  const points = data.map((d, i) => ({
    x: data.length === 1 ? CHART_WIDTH / 2 : (i / (data.length - 1)) * CHART_WIDTH,
    y: HEIGHT - (d.score / 100) * HEIGHT,
    score: d.score,
    day: d.day,
  }));

  return (
    <View style={{ height: HEIGHT + 48 }}>
      {[0, 25, 50, 75, 100].map(v => (
        <View
          key={v}
          style={[styles.gridLine, { bottom: (v / 100) * HEIGHT + 28 }]}
        />
      ))}
      <View style={{ position: 'absolute', bottom: 28, left: 0, width: CHART_WIDTH, height: HEIGHT }}>
        {points.map((pt, i) => {
          if (i === 0) return null;
          const prev = points[i - 1];
          const dx = pt.x - prev.x;
          const dy = pt.y - prev.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          return (
            <View
              key={`line-${i}`}
              style={{
                position: 'absolute',
                left: prev.x,
                top: prev.y,
                width: len,
                height: 3,
                backgroundColor: '#10b981',
                borderRadius: 2,
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: 'left center',
              }}
            />
          );
        })}
        {points.map((pt, i) => (
          <View key={`dot-${i}`} style={[styles.lineDot, { left: pt.x - 7, top: pt.y - 7 }]}>
            <Text style={styles.dotLabel}>{pt.score}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: HEIGHT + 32 }}>
        {data.map((d, i) => (
          <Text key={i} style={styles.axisLabel}>{d.day}</Text>
        ))}
      </View>
    </View>
  );
}

// ─── Simple Distribution Chart ────────────────────────────────────────────────
function SimplePieChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <View>
      {data.map((item, i) => {
        const pct = total === 0 ? 0 : Math.round((item.value / total) * 100);
        return (
          <View key={i} style={styles.pieRow}>
            <View style={[styles.pieSwatch, { backgroundColor: item.color }]} />
            <Text style={styles.pieLabel}>{item.name}</Text>
            <View style={styles.pieBarBg}>
              <View style={[styles.pieBarFill, { width: `${pct}%`, backgroundColor: item.color }]} />
            </View>
            <Text style={styles.pieCount}>{item.value}</Text>
          </View>
        );
      })}
    </View>
  );
}

type Tab = 'trends' | 'nutrients' | 'insights';

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Analytics() {
  const [activeTab, setActiveTab] = useState<Tab>('trends');
  const [scans, setScans] = useState<Scan[]>([]);
  const [stats, setStats] = useState<UserStats>({
    totalScans: 0,
    healthyPercentage: 0,
    currentStreak: 0,
    points: 0,
    badges: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [loadedScans, loadedStats] = await Promise.all([getScans(), getUserStats()]);
      setScans(loadedScans);
      setStats(loadedStats);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (scans.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/home')} style={styles.backBtn}>
            {/* <Feather name="arrow-left" size={20} color="#475569" /> */}
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Analytics</Text>
          <View style={{ width: 64 }} />
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.card}>
              {/* <Feather name="activity" size={48} color="#94a3b8" style={{ alignSelf: 'center', marginBottom: 16 }} /> */}
            <Text style={styles.emptyTitle}>No Data Yet</Text>
            <Text style={styles.emptyBody}>
              Start scanning products to see your personalized analytics and insights.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/scanner')}>
              <Text style={styles.primaryBtnText}>Scan Your First Product</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ─── Derived data ─────────────────────────────────────────────────────────
  const last7Days = scans.slice(0, 7).reverse();
  const scoreData = last7Days.map((scan, index) => ({
    day: `D${index + 1}`,
    score: scan.healthScore,
  }));

  const avg = (key: keyof Scan['nutrients']) =>
    Math.round(scans.reduce((sum, s) => sum + s.nutrients[key], 0) / scans.length) || 0;

  const nutrientAverages = {
    calories: avg('calories'),
    sugar: avg('sugar'),
    sodium: avg('sodium'),
    protein: avg('protein'),
    fiber: avg('fiber'),
    fat: avg('fat'),
  };

  const nutrientData = [
    { name: 'Cals',    value: nutrientAverages.calories,                color: '#f59e0b' },
    { name: 'Sugar',   value: nutrientAverages.sugar,                   color: '#ef4444' },
    { name: 'Na÷10',   value: Math.round(nutrientAverages.sodium / 10), color: '#8b5cf6' },
    { name: 'Protein', value: nutrientAverages.protein,                 color: '#10b981' },
    { name: 'Fiber',   value: nutrientAverages.fiber,                   color: '#06b6d4' },
    { name: 'Fat',     value: nutrientAverages.fat,                     color: '#f97316' },
  ];

  const healthDistribution = [
    { name: 'Excellent (80+)', value: scans.filter(s => s.healthScore >= 80).length,                         color: '#10b981' },
    { name: 'Good (60–79)',    value: scans.filter(s => s.healthScore >= 60 && s.healthScore < 80).length,   color: '#84cc16' },
    { name: 'Fair (40–59)',    value: scans.filter(s => s.healthScore >= 40 && s.healthScore < 60).length,   color: '#f59e0b' },
    { name: 'Poor (<40)',      value: scans.filter(s => s.healthScore < 40).length,                          color: '#ef4444' },
  ];

  const avgScore = Math.round(scans.reduce((sum, s) => sum + s.healthScore, 0) / scans.length) || 0;

  const insights = [
    {
      title: 'Sugar Intake',
      value: nutrientAverages.sugar > 10 ? 'High' : 'Good',
      isPositive: nutrientAverages.sugar <= 10,
      description: nutrientAverages.sugar > 10
        ? 'Your average sugar intake is above recommended levels. Try choosing products with less added sugar.'
        : 'Great job! Your sugar intake is within healthy limits.',
    },
    {
      title: 'Sodium Levels',
      value: nutrientAverages.sodium > 200 ? 'High' : 'Good',
      isPositive: nutrientAverages.sodium <= 200,
      description: nutrientAverages.sodium > 200
        ? 'Consider reducing sodium intake by choosing low-sodium alternatives.'
        : 'Excellent! Your sodium levels are well-controlled.',
    },
    {
      title: 'Protein Intake',
      value: nutrientAverages.protein >= 5 ? 'Good' : 'Low',
      isPositive: nutrientAverages.protein >= 5,
      description: nutrientAverages.protein >= 5
        ? "You're getting adequate protein from your choices."
        : 'Try to include more protein-rich foods in your diet.',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/home')} style={styles.backBtn}>
          {/* <Feather name="arrow-left" size={20} color="#475569" /> */}
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <FadeInCard delay={0} style={{ flex: 1 }}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Avg Score</Text>
              {/* <Feather name="activity" size={18} color="#10b981" /> */}
            </View>
            <Text style={styles.summaryValue}>{avgScore}</Text>
            <Text style={styles.summaryMeta}>Last 7 days</Text>
          </FadeInCard>

          <FadeInCard delay={100} style={{ flex: 1 }}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Healthy</Text>
              {/* <Feather name="trending-up" size={18} color="#10b981" /> */}
            </View>
            <Text style={styles.summaryValue}>{stats.healthyPercentage}%</Text>
            <Text style={styles.summaryMeta}>{scans.filter(s => s.healthScore >= 70).length} products</Text>
          </FadeInCard>

          <FadeInCard delay={200} style={{ flex: 1 }}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Streak</Text>
              {/* <Feather name="calendar" size={18} color="#f97316" /> */}
            </View>
            <Text style={styles.summaryValue}>{stats.currentStreak}</Text>
            <Text style={styles.summaryMeta}>days</Text>
          </FadeInCard>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {(['trends', 'nutrients', 'insights'] as Tab[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Trends */}
        {activeTab === 'trends' && (
          <View>
            <FadeInCard>
              <Text style={styles.cardTitle}>Health Score Trend</Text>
              <SimpleLineChart data={scoreData} />
            </FadeInCard>
            <FadeInCard delay={100} style={{ marginTop: 12 }}>
              <Text style={styles.cardTitle}>Health Distribution</Text>
              <SimplePieChart data={healthDistribution} />
            </FadeInCard>
          </View>
        )}

        {/* Nutrients */}
        {activeTab === 'nutrients' && (
          <View>
            <FadeInCard>
              <Text style={styles.cardTitle}>Average Nutrient Intake</Text>
              <SimpleBarChart data={nutrientData} />
            </FadeInCard>
            <FadeInCard delay={100} style={{ marginTop: 12 }}>
              <Text style={styles.cardTitle}>Nutrient Breakdown</Text>
              {Object.entries(nutrientAverages).map(([key, value]) => (
                <View key={key} style={styles.nutrientRow}>
                  <Text style={styles.nutrientKey}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                  <Text style={styles.nutrientVal}>
                    {value}{key === 'calories' ? ' kcal' : key === 'sodium' ? ' mg' : ' g'}
                  </Text>
                </View>
              ))}
            </FadeInCard>
          </View>
        )}

        {/* Insights */}
        {activeTab === 'insights' && (
          <View>
            {insights.map((insight, index) => (
              <FadeInCard key={index} delay={index * 100} style={index > 0 ? { marginTop: 12 } : {}}>
                <View style={styles.insightHeader}>
                  <View>
                    <Text style={styles.insightTitle}>{insight.title}</Text>
                    <Text style={[styles.insightValue, { color: insight.isPositive ? '#10b981' : '#ef4444' }]}>
                      {insight.value}
                    </Text>
                  </View>
                
                </View>
                <Text style={styles.insightDescription}>{insight.description}</Text>
              </FadeInCard>
            ))}

            <View style={[styles.card, styles.recommendationCard, { marginTop: 12 }]}>
              <Text style={styles.recommendationTitle}>Personalized Recommendations</Text>
              {[
                'Focus on products with higher fiber content (3g or more)',
                'Aim for products with less than 10g of sugar per serving',
                'Keep sodium intake below 200mg per serving',
              ].map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <View style={styles.tipBullet} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backText: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
  },
  scrollContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,
    flexWrap: 'wrap',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  summaryMeta: {
    fontSize: 11,
    color: '#10b981',
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  tabLabelActive: {
    color: '#0f172a',
    fontWeight: '600',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  barValue: {
    fontSize: 9,
    color: '#475569',
    fontWeight: '600',
    marginBottom: 2,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  lineDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotLabel: {
    fontSize: 8,
    color: '#fff',
    fontWeight: '700',
  },
  axisLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  pieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  pieSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  pieLabel: {
    fontSize: 13,
    color: '#475569',
    width: 120,
  },
  pieBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 99,
    overflow: 'hidden',
  },
  pieBarFill: {
    height: 8,
    borderRadius: 99,
  },
  pieCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    width: 24,
    textAlign: 'right',
  },
  nutrientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  nutrientKey: {
    fontSize: 14,
    color: '#475569',
    textTransform: 'capitalize',
  },
  nutrientVal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  insightValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  insightDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 19,
  },
  recommendationCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  recommendationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#14532d',
    marginBottom: 12,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginTop: 5,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: '#166534',
    lineHeight: 19,
  },
});
