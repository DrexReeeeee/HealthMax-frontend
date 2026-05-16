import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Animated,
  Dimensions,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { router } from 'expo-router';
import { fetchLeaderboard, type LeaderboardEntry, type LeaderboardResponse } from './utils/api';

const { width } = Dimensions.get('window');

const RANK_COLORS = {
  1: { gradient: ['#FFD700', '#FFA500'] as const, label: 'Gold',   medalColor: '#FFD700' },
  2: { gradient: ['#C0C0C0', '#A8A8A8'] as const, label: 'Silver', medalColor: '#C0C0C0' },
  3: { gradient: ['#CD7F32', '#A0522D'] as const, label: 'Bronze', medalColor: '#CD7F32' },
};

// ── Level color ────────────────────────────────────────────
function levelColor(level: number): string {
  if (level >= 10) return '#f59e0b';
  if (level >= 7)  return '#8b5cf6';
  if (level >= 5)  return '#3b82f6';
  if (level >= 3)  return '#10b981';
  return '#64748b';
}

// ── Podium Card (top 3) ────────────────────────────────────
const PodiumCard = ({ entry, delay }: { entry: LeaderboardEntry; delay: number }) => {
  const scaleAnim      = useRef(new Animated.Value(0)).current;
  const fadeAnim       = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim,      { toValue: 1, delay, useNativeDriver: true, tension: 100, friction: 8 }),
      Animated.timing(fadeAnim,       { toValue: 1, duration: 600, delay, useNativeDriver: true }),
      Animated.spring(translateYAnim, { toValue: 0, delay, useNativeDriver: true, tension: 80, friction: 10 }),
    ]).start();
  }, []);

  const rankInfo = RANK_COLORS[entry.rank as 1 | 2 | 3];
  const initials = entry.username.slice(0, 2).toUpperCase();
  const isFirst  = entry.rank === 1;

  return (
    <Animated.View style={[
      styles.podiumCard,
      isFirst && styles.podiumFirst,
      { opacity: fadeAnim, transform: [{ scale: scaleAnim }, { translateY: translateYAnim }] },
    ]}>
      <LinearGradient colors={rankInfo.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.podiumGradient}>
        {entry.is_me && (
          <View style={styles.meBadge}>
            <Text style={styles.meBadgeText}>YOU</Text>
          </View>
        )}

        {/* Medal */}
        <View style={[styles.medalIcon, { backgroundColor: rankInfo.medalColor + '30' }]}>
          <Icon name={entry.rank === 1 ? 'crown' : entry.rank === 2 ? 'medal' : 'trophy'} size={28} color={rankInfo.medalColor} />
        </View>

        {/* Avatar */}
        <View style={styles.podiumAvatar}>
          <LinearGradient colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']} style={styles.podiumAvatarGradient}>
            <Text style={styles.podiumAvatarText}>{initials}</Text>
          </LinearGradient>
        </View>

        <Text style={styles.podiumName} numberOfLines={1}>{entry.username}</Text>

        {/* Level badge */}
        <View style={[styles.levelBadge, { backgroundColor: 'rgba(0,0,0,0.2)' }]}>
          <Icon name="star-four-points" size={10} color="#fff" />
          <Text style={styles.levelBadgeText}>Lv.{entry.level} · {entry.level_title}</Text>
        </View>

        {/* Points */}
        <View style={styles.podiumStats}>
          <Text style={styles.podiumPoints}>{entry.total_points.toLocaleString()}</Text>
          <Text style={styles.podiumPtsLabel}>total points</Text>
        </View>

        {/* Weekly points */}
        <View style={styles.weeklyRow}>
          <Icon name="calendar-week" size={11} color="rgba(255,255,255,0.9)" />
          <Text style={styles.weeklyText}>{entry.weekly_points.toLocaleString()} this week</Text>
        </View>

        {/* Streak */}
        {entry.current_streak > 0 && (
          <View style={styles.podiumStreakRow}>
            <Icon name="fire" size={12} color="#FF6B6B" />
            <Text style={styles.podiumStreakText}>{entry.current_streak}d · {entry.streak_label}</Text>
          </View>
        )}

        {/* XP bar */}
        <View style={styles.xpBarWrap}>
          <View style={styles.xpBarTrack}>
            <View style={[styles.xpBarFill, { width: `${entry.level_progress}%` }]} />
          </View>
          <Text style={styles.xpBarLabel}>{entry.level_progress}% to Lv.{entry.level + 1}</Text>
        </View>

        {/* Healthy % bar */}
        <View style={styles.podiumPercentage}>
          <View style={styles.percentageBar}>
            <View style={[styles.percentageFill, { width: `${entry.healthy_percentage}%` }]} />
          </View>
          <Text style={styles.percentageText}>{entry.healthy_percentage}% healthy</Text>
        </View>

        {/* Badge count */}
        {entry.badge_count > 0 && (
          <View style={styles.badgeCountRow}>
            <Icon name="shield-star" size={11} color="rgba(255,255,255,0.9)" />
            <Text style={styles.badgeCountText}>{entry.badge_count} badge{entry.badge_count !== 1 ? 's' : ''}</Text>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
};

// ── Row Card (rank 4+) ─────────────────────────────────────
const RowCard = ({ entry, index }: { entry: LeaderboardEntry; index: number }) => {
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    const delay = index * 50;
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay, useNativeDriver: true, easing: Easing.out(Easing.back(0.5)) }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, delay, useNativeDriver: true, tension: 100, friction: 12 }),
    ]).start();
  }, []);

  const initials  = entry.username.slice(0, 2).toUpperCase();
  const rankColor = entry.rank <= 3 ? RANK_COLORS[entry.rank as 1 | 2 | 3].medalColor : '#64748b';

  return (
    <Animated.View style={[
      styles.rowCard,
      entry.is_me && styles.rowCardMe,
      { opacity: fadeAnim, transform: [{ translateX: slideAnim }, { scale: scaleAnim }] },
    ]}>
      {/* Rank */}
      <View style={styles.rowRankWrapper}>
        <Text style={[styles.rowRank, { color: rankColor }]}>#{entry.rank}</Text>
        {entry.rank <= 3 && <Icon name="star" size={10} color={rankColor} style={styles.rankStar} />}
      </View>

      {/* Avatar */}
      <View style={[styles.rowAvatar, entry.is_me && styles.rowAvatarMe]}>
        <Text style={[styles.rowAvatarText, entry.is_me && { color: '#fff' }]}>{initials}</Text>
      </View>

      {/* Info */}
      <View style={styles.rowInfo}>
        <View style={styles.rowNameRow}>
          <Text style={styles.rowName} numberOfLines={1}>{entry.username}</Text>
          {entry.is_me && (
            <View style={styles.youTag}>
              <Text style={styles.youTagText}>You</Text>
            </View>
          )}
          {/* Level pill */}
          <View style={[styles.levelPill, { backgroundColor: levelColor(entry.level) + '20' }]}>
            <Text style={[styles.levelPillText, { color: levelColor(entry.level) }]}>Lv.{entry.level}</Text>
          </View>
        </View>

        <View style={styles.rowStats}>
          <View style={styles.rowStatChip}>
            <Icon name="fire" size={11} color="#ef4444" />
            <Text style={styles.rowStatText}>{entry.current_streak}d</Text>
          </View>
          <View style={styles.rowStatChip}>
            <Icon name="heart-pulse" size={11} color="#10b981" />
            <Text style={styles.rowStatText}>{entry.healthy_percentage}%</Text>
          </View>
          <View style={styles.rowStatChip}>
            <Icon name="chart-line" size={11} color="#6366f1" />
            <Text style={styles.rowStatText}>avg {entry.avg_score_last10}</Text>
          </View>
          {entry.badge_count > 0 && (
            <View style={styles.rowMetaChip}>
              <Icon name="shield-star" size={11} color="#f59e0b" />
              <Text style={styles.rowStatText}>{entry.badge_count}</Text>
            </View>
          )}
        </View>

        {/* XP progress bar */}
        <View style={styles.miniXpRow}>
          <View style={styles.miniXpTrack}>
            <View style={[styles.miniXpFill, { width: `${entry.level_progress}%`, backgroundColor: levelColor(entry.level) }]} />
          </View>
          <Text style={styles.miniXpLabel}>{entry.level_progress}%</Text>
        </View>
      </View>

      {/* Points */}
      <View style={styles.rowPointsWrap}>
        <Text style={[styles.rowPoints, entry.is_me && styles.rowPointsMe]}>
          {entry.total_points.toLocaleString()}
        </Text>
        <Text style={styles.rowPtsLabel}>pts</Text>
        <Text style={[styles.rowWeeklyPts, entry.is_me && { color: '#10b981' }]}>
          +{entry.weekly_points} wk
        </Text>
      </View>
    </Animated.View>
  );
};

// ── My Rank Card (shown when user is outside top 50) ───────
const MyRankCard = ({ entry }: { entry: LeaderboardEntry }) => (
  <View style={styles.myRankCard}>
    <LinearGradient colors={['#10b981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.myRankGradient}>
      <Icon name="account-circle" size={18} color="#fff" />
      <Text style={styles.myRankLabel}>Your Rank</Text>
      <Text style={styles.myRankNumber}>#{entry.rank}</Text>
      <View style={styles.myRankDivider} />
      <Text style={styles.myRankPoints}>{entry.total_points.toLocaleString()} pts</Text>
      <Text style={styles.myRankLevel}>Lv.{entry.level} · {entry.level_title}</Text>
      <View style={styles.myRankDivider} />
      <Icon name="fire" size={14} color="#FF6B6B" />
      <Text style={styles.myRankStreak}>{entry.current_streak}d streak</Text>
    </LinearGradient>
  </View>
);

// ── Leaderboard Screen ─────────────────────────────────────
export default function LeaderboardScreen() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank]           = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'all' | 'weekly' | 'top'>('all');

  const headerAnim = useRef(new Animated.Value(0)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      const res: LeaderboardResponse = await fetchLeaderboard();
      setLeaderboard(res.leaderboard);

      // my_rank is either a full LeaderboardEntry object (outside top 50)
      // or already inside leaderboard array (inside top 50)
      if (res.my_rank && typeof res.my_rank === 'object') {
        const alreadyIn = res.leaderboard.some(e => e.is_me);
        if (!alreadyIn) setMyRank(res.my_rank as LeaderboardEntry);
      }
    } catch (err: any) {
      setError('Could not load leaderboard — tap to retry');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    Animated.parallel([
      Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.timing(fadeInAnim, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
    ]).start();
  }, []);

  // ── Tab filtering ────────────────────────────────────────
  const sortedEntries = selectedTab === 'weekly'
    ? [...leaderboard].sort((a, b) => b.weekly_points - a.weekly_points).map((e, i) => ({ ...e, rank: i + 1 }))
    : leaderboard;

  const top3 = sortedEntries.filter(e => e.rank <= 3);
  const rest = sortedEntries.filter(e => e.rank > 3);

  const headerTranslateY = headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] });
  const headerOpacity    = headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#059669" />

      {/* Header */}
      <LinearGradient colors={['#10b981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <Animated.View style={[styles.headerInner, { opacity: headerOpacity, transform: [{ translateY: headerTranslateY }] }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Leaderboard</Text>
            <Text style={styles.headerSubtitle}>{leaderboard.length} active participants</Text>
          </View>
          <View style={styles.headerIconWrap}>
            <Icon name="trophy" size={28} color="#FFD700" />
          </View>
        </Animated.View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#10b981" colors={['#10b981']} />
        }
      >
        {/* Error */}
        {error && (
          <Animated.View style={[styles.errorBanner, { opacity: fadeInAnim }]}>
            <TouchableOpacity style={styles.errorContent} onPress={() => load()} activeOpacity={0.8}>
              <Icon name="alert-circle-outline" size={20} color="#dc2626" />
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.retryText}>Tap to retry</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Empty */}
        {!loading && leaderboard.length === 0 && !error && (
          <Animated.View style={[styles.emptyWrap, { opacity: fadeInAnim }]}>
            <View style={styles.emptyIcon}>
              <Icon name="trophy-outline" size={80} color="#cbd5e1" />
            </View>
            <Text style={styles.emptyTitle}>No Data Yet</Text>
            <Text style={styles.emptyText}>Start scanning products to appear on the leaderboard!</Text>
            <TouchableOpacity style={styles.scanBtn} onPress={() => router.push('/scanner')}>
              <LinearGradient colors={['#10b981', '#059669']} style={styles.scanBtnGradient}>
                <Icon name="camera" size={18} color="#fff" />
                <Text style={styles.scanBtnText}>Start Scanning</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Tab Bar */}
        {leaderboard.length > 0 && (
          <Animated.View style={[styles.tabBar, { opacity: fadeInAnim }]}>
            {(['all', 'weekly', 'top'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, selectedTab === tab && styles.tabActive]}
                onPress={() => setSelectedTab(tab)}
              >
                <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
                  {tab === 'all' ? 'All Time' : tab === 'weekly' ? 'This Week' : 'Top 3'}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}

        {/* My Rank Card (outside top 50) */}
        {myRank && (
          <Animated.View style={{ opacity: fadeInAnim, marginHorizontal: 20, marginTop: 16 }}>
            <MyRankCard entry={myRank} />
          </Animated.View>
        )}

        {/* Podium */}
        {top3.length > 0 && selectedTab !== 'top' && (
          <Animated.View style={{ opacity: fadeInAnim }}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Icon name="crown" size={20} color="#f59e0b" />
                <Text style={styles.sectionTitle}>Top Performers</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                {selectedTab === 'weekly' ? 'Best this week 📅' : 'Elite tier 👑'}
              </Text>
            </View>
            <View style={styles.podiumRow}>
              {top3[1] && (
                <View style={styles.podiumPosition}>
                  <Text style={styles.podiumPositionLabel}>2nd</Text>
                  <PodiumCard entry={top3[1]} delay={150} />
                </View>
              )}
              {top3[0] && (
                <View style={[styles.podiumPosition, styles.podiumCenter]}>
                  <Text style={[styles.podiumPositionLabel, styles.podiumCenterLabel]}>1st</Text>
                  <PodiumCard entry={top3[0]} delay={0} />
                </View>
              )}
              {top3[2] && (
                <View style={styles.podiumPosition}>
                  <Text style={styles.podiumPositionLabel}>3rd</Text>
                  <PodiumCard entry={top3[2]} delay={300} />
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* Top 3 only tab */}
        {selectedTab === 'top' && top3.length > 0 && (
          <Animated.View style={{ opacity: fadeInAnim }}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Icon name="crown" size={20} color="#f59e0b" />
                <Text style={styles.sectionTitle}>Top 3</Text>
              </View>
            </View>
            <View style={styles.podiumRow}>
              {top3[1] && <View style={styles.podiumPosition}><Text style={styles.podiumPositionLabel}>2nd</Text><PodiumCard entry={top3[1]} delay={150} /></View>}
              {top3[0] && <View style={[styles.podiumPosition, styles.podiumCenter]}><Text style={[styles.podiumPositionLabel, styles.podiumCenterLabel]}>1st</Text><PodiumCard entry={top3[0]} delay={0} /></View>}
              {top3[2] && <View style={styles.podiumPosition}><Text style={styles.podiumPositionLabel}>3rd</Text><PodiumCard entry={top3[2]} delay={300} /></View>}
            </View>
          </Animated.View>
        )}

        {/* Rankings list */}
        {rest.length > 0 && selectedTab !== 'top' && (
          <Animated.View style={{ opacity: fadeInAnim }}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Icon name="medal" size={20} color="#64748b" />
                <Text style={styles.sectionTitle}>Rankings</Text>
              </View>
              <Text style={styles.sectionSubtitle}>Positions 4–{sortedEntries.length}</Text>
            </View>
            <View style={styles.rowList}>
              {rest.map((entry, i) => (
                <RowCard key={entry.user_id} entry={entry} index={i} />
              ))}
            </View>
          </Animated.View>
        )}

        {/* Loading skeletons */}
        {loading && (
          <View style={styles.rowList}>
            {[...Array(8)].map((_, i) => (
              <Animated.View key={i} style={[styles.skeletonCard, { opacity: 1 - i * 0.08 }]}>
                <View style={styles.skeletonContent}>
                  <View style={styles.skeletonAvatar} />
                  <View style={styles.skeletonText}>
                    <View style={styles.skeletonName} />
                    <View style={styles.skeletonStats} />
                    <View style={styles.skeletonXp} />
                  </View>
                  <View style={styles.skeletonPoints} />
                </View>
              </Animated.View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: '#f8fafc' },
  scroll:          { flex: 1 },
  scrollContent:   { paddingBottom: 20 },

  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  headerInner:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:        { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTextWrap: { flex: 1 },
  headerTitle:    { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 2 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
  headerIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

  errorBanner:  { margin: 20, borderRadius: 16, overflow: 'hidden' },
  errorContent: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16 },
  errorText:    { fontSize: 13, color: '#dc2626', fontWeight: '500', flex: 1 },
  retryText:    { fontSize: 12, color: '#ef4444', fontWeight: '600' },

  emptyWrap:       { alignItems: 'center', paddingTop: 100, paddingHorizontal: 32, gap: 16 },
  emptyIcon:       { width: 120, height: 120, borderRadius: 60, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle:      { fontSize: 24, fontWeight: '800', color: '#475569' },
  emptyText:       { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  scanBtn:         { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  scanBtnGradient: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 12 },
  scanBtnText:     { fontSize: 15, fontWeight: '700', color: '#fff' },

  tabBar:          { flexDirection: 'row', marginHorizontal: 20, marginTop: 20, marginBottom: 20, backgroundColor: '#fff', borderRadius: 14, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  tab:             { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive:       { backgroundColor: '#10b981' },
  tabText:         { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabTextActive:   { color: '#fff' },

  sectionHeader:   { marginHorizontal: 20, marginTop: 16, marginBottom: 16 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionTitle:    { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  sectionSubtitle: { fontSize: 12, color: '#94a3b8', marginLeft: 28 },

  podiumRow:           { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 12, gap: 8 },
  podiumPosition:      { flex: 1, alignItems: 'center' },
  podiumCenter:        { transform: [{ translateY: -8 }] },
  podiumPositionLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginBottom: 8 },
  podiumCenterLabel:   { color: '#f59e0b', fontSize: 14 },

  podiumCard:    { width: '100%', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  podiumFirst:   { shadowOpacity: 0.2, elevation: 12 },
  podiumGradient:{ alignItems: 'center', paddingVertical: 20, paddingHorizontal: 10, gap: 6 },

  medalIcon:             { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  podiumAvatar:          { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', marginVertical: 6 },
  podiumAvatarGradient:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  podiumAvatarText:      { fontSize: 20, fontWeight: '800', color: '#fff' },
  podiumName:            { fontSize: 14, fontWeight: '700', color: '#fff', textAlign: 'center' },

  levelBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  levelBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  podiumStats:    { alignItems: 'center', marginVertical: 2 },
  podiumPoints:   { fontSize: 24, fontWeight: '900', color: '#fff' },
  podiumPtsLabel: { fontSize: 10, color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginTop: -2 },

  weeklyRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weeklyText: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },

  podiumStreakRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  podiumStreakText: { fontSize: 10, color: '#fff', fontWeight: '600' },

  xpBarWrap:  { width: '100%', gap: 3 },
  xpBarTrack: { height: 4, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 2, overflow: 'hidden' },
  xpBarFill:  { height: 4, backgroundColor: '#fff', borderRadius: 2 },
  xpBarLabel: { fontSize: 9, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },

  podiumPercentage: { width: '100%', gap: 3 },
  percentageBar:    { height: 4, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 2, overflow: 'hidden' },
  percentageFill:   { height: 4, backgroundColor: '#fff', borderRadius: 2 },
  percentageText:   { fontSize: 9, color: 'rgba(255,255,255,0.9)', textAlign: 'center' },

  badgeCountRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeCountText: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },

  meBadge:     { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  meBadgeText: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },

  // My rank card
  myRankCard:     { borderRadius: 16, overflow: 'hidden', shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  myRankGradient: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16 },
  myRankLabel:    { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  myRankNumber:   { fontSize: 20, fontWeight: '900', color: '#fff' },
  myRankDivider:  { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 4 },
  myRankPoints:   { fontSize: 14, fontWeight: '800', color: '#fff' },
  myRankLevel:    { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)', flex: 1 },
  myRankStreak:   { fontSize: 12, fontWeight: '600', color: '#fff' },

  // Row cards
  rowList:      { marginHorizontal: 20, gap: 10 },
  rowCard:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 12, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 3, borderWidth: 1, borderColor: '#f1f5f9' },
  rowCardMe:    { borderColor: '#10b981', borderWidth: 2, backgroundColor: '#f0fdf4', shadowOpacity: 0.1, shadowColor: '#10b981', elevation: 4 },
  rowRankWrapper:{ alignItems: 'center', gap: 2 },
  rowRank:      { fontSize: 14, fontWeight: '800', width: 32 },
  rankStar:     { marginTop: -2 },

  rowAvatar:    { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  rowAvatarMe:  { backgroundColor: '#10b981' },
  rowAvatarText:{ fontSize: 15, fontWeight: '800', color: '#475569' },

  rowInfo:     { flex: 1, gap: 4 },
  rowNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowName:     { fontSize: 14, fontWeight: '700', color: '#1e293b', flex: 1 },
  youTag:      { backgroundColor: '#10b981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  youTagText:  { fontSize: 9, fontWeight: '700', color: '#fff' },
  levelPill:   { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  levelPillText:{ fontSize: 10, fontWeight: '700' },

  rowStats:    { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  rowStatChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#f8fafc', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  rowMetaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fef3c7', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  rowStatText: { fontSize: 10, color: '#64748b', fontWeight: '600' },

  miniXpRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniXpTrack: { flex: 1, height: 3, backgroundColor: '#e2e8f0', borderRadius: 2, overflow: 'hidden' },
  miniXpFill:  { height: 3, borderRadius: 2 },
  miniXpLabel: { fontSize: 9, color: '#94a3b8', fontWeight: '600', width: 28 },

  rowPointsWrap: { alignItems: 'flex-end', gap: 2 },
  rowPoints:     { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  rowPointsMe:   { color: '#10b981' },
  rowPtsLabel:   { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  rowWeeklyPts:  { fontSize: 9, color: '#64748b', fontWeight: '500' },

  // Skeleton
  skeletonCard:    { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f1f5f9' },
  skeletonContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  skeletonAvatar:  { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e2e8f0' },
  skeletonText:    { flex: 1, gap: 8 },
  skeletonName:    { height: 14, width: '60%', backgroundColor: '#e2e8f0', borderRadius: 7 },
  skeletonStats:   { height: 11, width: '40%', backgroundColor: '#f1f5f9', borderRadius: 6 },
  skeletonXp:      { height: 3, width: '80%', backgroundColor: '#f1f5f9', borderRadius: 2 },
  skeletonPoints:  { height: 20, width: 48, backgroundColor: '#e2e8f0', borderRadius: 8 },
});