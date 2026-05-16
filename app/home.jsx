import { useEffect, useRef, useState, useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';

import {
  Animated,
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Easing,
  Platform,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { getUserProfile, saveDashboardCache, getDashboardCache, getUser } from './utils/storage';
import { fetchDashboard, apiFetch } from './utils/api';

const { width } = Dimensions.get('window');

const DEFAULT_DASHBOARD = {
  total_scans: 0,
  healthy_scans: 0,
  healthy_percentage: 0,
  current_streak: 0,
  longest_streak: 0,
  total_points: 0,
  streak_status: null,
};

// ── Stat Card ──────────────────────────────────────────────
const StatCard = ({ icon, value, label, delay = 0, color = '#10b981', loading = false }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, delay, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, delay, useNativeDriver: true, tension: 80, friction: 8 }),
    ]).start();
  }, [delay, fadeAnim, slideAnim, scaleAnim]);

  return (
    <Animated.View
      style={[
        styles.statCard,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] },
      ]}
    >
      <View style={styles.statIconBg}>
        <Icon name={icon} size={24} color={color} />
      </View>
      <Text style={[styles.statValue, loading && styles.loadingText]}>
        {loading ? '—' : value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
};

// ── Metric Card ────────────────────────────────────────────
const MetricCard = ({ icon, value, label, gradientColors, iconColor = '#fff', delay = 0, loading = false }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, delay, useNativeDriver: true, tension: 80, friction: 8 }),
    ]).start();

    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, [delay, fadeAnim, scaleAnim, rotateAnim]);

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      style={[styles.metricCard, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
    >
      <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.metricGradient}>
        <Animated.View style={[styles.metricBlob, { transform: [{ rotate }] }]} />
        <View style={styles.metricContent}>
          <View style={styles.metricIconWrap}>
            <Icon name={icon} size={28} color={iconColor} />
          </View>
          <View style={styles.metricTextGroup}>
            <Text style={[styles.metricValue, { color: iconColor }, loading && styles.loadingText]}>
              {loading ? '—' : value}
            </Text>
            <Text style={[styles.metricLabel, { color: iconColor, opacity: 0.9 }]}>{label}</Text>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

// ── Home Screen ────────────────────────────────────────────
export default function HomeScreen() {
  const [username, setUsername] = useState('Guest User');
  const [dashboard, setDashboard] = useState(DEFAULT_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;
  const floatAnim3 = useRef(new Animated.Value(0)).current;

  const loadDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        const cached = await getDashboardCache();
        if (cached) {
          setDashboard(cached);
          setLoading(false);
        }
      }

      setError(null);
      const data = await fetchDashboard();
      setDashboard(data);
      await saveDashboardCache(data);
    } catch (err) {
      setError('Could not load dashboard — tap to retry');
      console.log('Dashboard error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadUserProfile = useCallback(async () => {
    try {
      const user = await getUser();
      if (user?.username) {
        setUsername(user.username);
        return;
      }

      const { ok, data } = await apiFetch('/api/profile', { method: 'GET' }, true);
      if (ok && data?.profile?.username) {
        setUsername(data.profile.username);
      }
    } catch (err) {
      console.log('Profile error:', err);
    }
  }, []);

  // ── Reload data every time this screen comes into focus ──
  useFocusEffect(
    useCallback(() => {
      loadUserProfile();
      loadDashboard();
    }, [loadUserProfile, loadDashboard])
  );

  // ── Animations run once on mount only ───────────────────
  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();

    const createFloatAnimation = (animValue, delayTime) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delayTime),
          Animated.timing(animValue, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(animValue, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start();
    };

    createFloatAnimation(floatAnim1, 0);
    createFloatAnimation(floatAnim2, 1000);
    createFloatAnimation(floatAnim3, 2000);
  }, []);

  const floatTranslate1 = floatAnim1.interpolate({ inputRange: [0, 1], outputRange: [0, -15] });
  const floatTranslate2 = floatAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, -20] });
  const floatTranslate3 = floatAnim3.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const headerTranslateY = headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] });

  // ── Streak: show 0 if streak was broken ─────────────────
  const displayStreak = dashboard.streak_status === 'broken' ? 0 : dashboard.current_streak;
  const streakLabel   = `${displayStreak} day${displayStreak !== 1 ? 's' : ''}`;
  const healthScore   = `${Math.round(dashboard.healthy_percentage)}%`;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      <LinearGradient
        colors={['#f8fafc', '#ffffff', '#f0fdf4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.absoluteFill}
      />

      <Animated.View style={[styles.floatingCircle1, { transform: [{ translateY: floatTranslate1 }] }]}>
        <LinearGradient colors={['rgba(16, 185, 129, 0.08)', 'rgba(16, 185, 129, 0.02)']} style={styles.floatingCircleGradient} />
      </Animated.View>
      <Animated.View style={[styles.floatingCircle2, { transform: [{ translateY: floatTranslate2 }] }]}>
        <LinearGradient colors={['rgba(139, 92, 246, 0.08)', 'rgba(139, 92, 246, 0.02)']} style={styles.floatingCircleGradient} />
      </Animated.View>
      <Animated.View style={[styles.floatingCircle3, { transform: [{ translateY: floatTranslate3 }] }]}>
        <LinearGradient colors={['rgba(249, 115, 22, 0.06)', 'rgba(249, 115, 22, 0.01)']} style={styles.floatingCircleGradient} />
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDashboard(true)}
            tintColor="#10b981"
            colors={['#10b981']}
          />
        }
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Animated.View
            style={[styles.heroTop, { opacity: headerAnim, transform: [{ translateY: headerTranslateY }] }]}
          >
            <View>
              <Text style={styles.greeting}>Hello, {username}!</Text>
              <View style={styles.subtitleRow}>
                <Icon name="lightning-bolt" size={14} color="#10b981" />
                <Text style={styles.subtitle}>Track your health journey</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.avatarBtn} activeOpacity={0.7} onPress={() => router.push('/profile')}>
              <LinearGradient colors={['#10b981', '#059669']} style={styles.avatarGradient}>
                <Icon name="account-circle" size={28} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Error Banner */}
          {error && (
            <TouchableOpacity style={styles.errorBanner} activeOpacity={0.8} onPress={() => loadDashboard()}>
              <Icon name="alert-circle-outline" size={16} color="#dc2626" />
              <Text style={styles.errorText}>{error}</Text>
            </TouchableOpacity>
          )}

          {/* Welcome Card */}
          <View style={styles.welcomeCard}>
            <LinearGradient
              colors={['#10b981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.welcomeGradient}
            />
            <Text style={styles.welcomeTitle}>Ready to scan?</Text>
            <Text style={styles.welcomeText}>
              Scan any product to get instant health scores and personalized recommendations
            </Text>
          </View>

          {/* Stat Cards */}
          <View style={styles.statRow}>
            <StatCard icon="barcode-scan"  value={String(dashboard.total_scans)} label="Total Scans"  delay={100} loading={loading} />
            <StatCard icon="heart-pulse"   value={healthScore}                   label="Health Score" delay={180} loading={loading} />
            <StatCard icon="fire"          value={String(displayStreak)}         label="Day Streak"   delay={260} loading={loading} />
          </View>
        </View>

        {/* Scan Button */}
        <TouchableOpacity style={styles.scanBtn} activeOpacity={0.88} onPress={() => router.push('/scanner')}>
          <LinearGradient colors={['#10b981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.scanBtnGradient}>
            <Icon name="camera" size={28} color="#fff" />
            <Text style={styles.scanBtnText}>Scan Product</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Daily Tip */}
        <View style={styles.tipCard}>
          <View style={styles.tipHeader}>
            <View style={styles.tipIconBg}>
              <Icon name="lightbulb-outline" size={20} color="#10b981" />
            </View>
            <Text style={styles.tipTitle}>Daily Health Tip</Text>
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          </View>
          <Text style={styles.tipBody}>
            "Start your day with a glass of water! Hydration boosts metabolism and energy levels." 💪
          </Text>
        </View>

        {/* Metrics Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Progress</Text>
          <Text style={styles.sectionSubtitle}>Track your achievements</Text>
        </View>

        <View style={styles.metricsGrid}>
          <MetricCard icon="fire"      value={streakLabel}                      label="Current Streak"  gradientColors={['#ef4444', '#dc2626']} iconColor="#fff" delay={200} loading={loading} />
          <MetricCard icon="trophy"    value={String(dashboard.total_points)}   label="Total Points"    gradientColors={['#f59e0b', '#d97706']} iconColor="#fff" delay={260} loading={loading} />
          <MetricCard icon="trending-up" value={healthScore}                    label="Healthy Choices" gradientColors={['#10b981', '#059669']} iconColor="#fff" delay={320} loading={loading} />
          <MetricCard icon="medal"     value={String(dashboard.healthy_scans)}  label="Healthy Scans"   gradientColors={['#8b5cf6', '#7c3aed']} iconColor="#fff" delay={380} loading={loading} />
        </View>

        {/* Insights */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Insights</Text>
          <Text style={styles.sectionSubtitle}>Review your activity</Text>
        </View>

        <View style={styles.utilRow}>
          <TouchableOpacity style={styles.utilCard} activeOpacity={0.75} onPress={() => router.push('/history')}>
            <LinearGradient colors={['#8b5cf6', '#7c3aed']} style={styles.utilIconBg}>
              <Icon name="history" size={28} color="#fff" />
            </LinearGradient>
            <Text style={styles.utilLabel}>History</Text>
            <Text style={styles.utilDesc}>View scan history</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.utilCard} activeOpacity={0.75} onPress={() => router.push('/analytics')}>
            <LinearGradient colors={['#f59e0b', '#d97706']} style={styles.utilIconBg}>
              <Icon name="chart-line" size={28} color="#fff" />
            </LinearGradient>
            <Text style={styles.utilLabel}>Analytics</Text>
            <Text style={styles.utilDesc}>See your trends</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.utilCard} activeOpacity={0.75} onPress={() => router.push('/leaderboard')}>
            <LinearGradient colors={['#10b981', '#059669']} style={styles.utilIconBg}>
              <Icon name="trophy" size={28} color="#fff" />
            </LinearGradient>
            <Text style={styles.utilLabel}>Leaderboard</Text>
            <Text style={styles.utilDesc}>See top scanners</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  floatingCircle1: { position: 'absolute', width: 250, height: 250, borderRadius: 125, top: '5%', right: -80 },
  floatingCircle2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, bottom: '30%', left: -60 },
  floatingCircle3: { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: '60%', right: -50 },
  floatingCircleGradient: { width: '100%', height: '100%', borderRadius: 125 },
  hero: { paddingTop: Platform.OS === 'ios' ? 20 : 20, paddingHorizontal: 20, paddingBottom: 20 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 28, fontWeight: '800', color: '#1e293b', letterSpacing: -0.5, marginBottom: 4 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subtitle: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  avatarBtn: {
    width: 48, height: 48, borderRadius: 24, overflow: 'hidden',
    shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5,
  },
  avatarGradient: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1,
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 16,
  },
  errorText: { fontSize: 13, color: '#dc2626', fontWeight: '500', flex: 1 },
  welcomeCard: {
    borderRadius: 20, overflow: 'hidden', marginBottom: 24, padding: 20,
    shadowColor: '#10b981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  welcomeGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  welcomeTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8 },
  welcomeText: { fontSize: 14, color: 'rgba(255,255,255,0.95)', lineHeight: 20, fontWeight: '500' },
  statRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  statIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#1e293b', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', textAlign: 'center' },
  loadingText: { color: '#cbd5e1' },
  scanBtn: {
    marginHorizontal: 20, marginBottom: 20, borderRadius: 24, overflow: 'hidden',
    shadowColor: '#10b981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 10,
  },
  scanBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 12 },
  scanBtnText: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  tipCard: {
    marginHorizontal: 20, marginBottom: 24, backgroundColor: '#fff', borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  tipHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  tipIconBg: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' },
  tipTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', flex: 1 },
  newBadge: { backgroundColor: '#10b981', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  newBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  tipBody: { fontSize: 14, color: '#475569', lineHeight: 20, fontWeight: '500' },
  sectionHeader: { marginHorizontal: 20, marginBottom: 16, marginTop: 8 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 20, gap: 12 },
  metricCard: {
    width: (width - 52) / 2, borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  metricGradient: { padding: 18, position: 'relative', overflow: 'hidden' },
  metricBlob: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.15)', right: -30, bottom: -30 },
  metricContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metricIconWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  metricTextGroup: { flex: 1 },
  metricValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5, marginBottom: 2 },
  metricLabel: { fontSize: 11, fontWeight: '600' },
  utilRow: { flexDirection: 'row', marginHorizontal: 20, gap: 12 },
  utilCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 20, paddingVertical: 20, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
    gap: 8, borderWidth: 1, borderColor: '#e2e8f0',
  },
  utilIconBg: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  utilLabel: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  utilDesc: { fontSize: 12, color: '#64748b', fontWeight: '500' },
});