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
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { router } from 'expo-router';
import { fetchLeaderboard, type LeaderboardEntry, type LeaderboardResponse } from './utils/api';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');

const RANK_COLORS = {
  1: { gradient: ['#FFD700', '#FFA500'] as const, label: 'Gold', medalColor: '#FFD700' },
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

// ── Background Animations ──────────────────────────────────
const BackgroundEffects = () => {
  const circle1 = useRef(new Animated.Value(0)).current;
  const circle2 = useRef(new Animated.Value(0)).current;
  const circle3 = useRef(new Animated.Value(0)).current;
  const circle4 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createAnimation = (anim: Animated.Value, delay: number, duration: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration,
            delay,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animations = [
      createAnimation(circle1, 0, 3000),
      createAnimation(circle2, 1000, 4000),
      createAnimation(circle3, 2000, 3500),
      createAnimation(circle4, 500, 4500),
    ];

    animations.forEach(anim => anim.start());

    return () => animations.forEach(anim => anim.stop());
  }, []);

  const circle1Transform = circle1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 30],
  });

  const circle2Transform = circle2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -25],
  });

  const circle3Transform = circle3.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });

  const circle4Transform = circle4.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -35],
  });

  return (
    <View style={styles.backgroundEffects}>
      <Animated.View 
        style={[
          styles.bgCircle, 
          styles.bgCircle1,
          { transform: [{ translateY: circle1Transform }] }
        ]} 
      />
      <Animated.View 
        style={[
          styles.bgCircle, 
          styles.bgCircle2,
          { transform: [{ translateY: circle2Transform }] }
        ]} 
      />
      <Animated.View 
        style={[
          styles.bgCircle, 
          styles.bgCircle3,
          { transform: [{ translateY: circle3Transform }] }
        ]} 
      />
      <Animated.View 
        style={[
          styles.bgCircle, 
          styles.bgCircle4,
          { transform: [{ translateY: circle4Transform }] }
        ]} 
      />
    </View>
  );
};

// ── Expandable Podium Card (top 3) ────────────────────────
const PodiumCard = ({ entry, delay }: { entry: LeaderboardEntry; delay: number }) => {
  const [expanded, setExpanded] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay,
        tension: 120,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: 0,
        delay,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for gold medal
    if (entry.rank === 1) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, []);

  const rankInfo = RANK_COLORS[entry.rank as 1 | 2 | 3];
  const initials = entry.username.slice(0, 2).toUpperCase();
  const isFirst = entry.rank === 1;

  const toggleExpand = () => {
    LayoutAnimation.configureNext({
      ...LayoutAnimation.Presets.easeInEaseOut,
      duration: 400,
    });
    setExpanded(!expanded);
  };

  return (
    <Animated.View style={[
      styles.podiumCard,
      isFirst && styles.podiumFirst,
      { 
        opacity: fadeAnim, 
        transform: [
          { scale: scaleAnim }, 
          { translateY: translateYAnim }
        ] 
      },
    ]}>
      <TouchableOpacity 
        onPress={toggleExpand} 
        activeOpacity={0.7}
        style={styles.podiumTouchable}
      >
        <LinearGradient colors={rankInfo.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.podiumGradient}>
          {entry.is_me && (
            <View style={styles.meBadge}>
              <Text style={styles.meBadgeText}>YOU</Text>
            </View>
          )}

          {/* Medal with pulse */}
          <Animated.View 
            style={[
              styles.medalIcon, 
              { 
                backgroundColor: rankInfo.medalColor + '30',
                transform: [{ scale: isFirst ? pulseAnim : 1 }]
              }
            ]}
          >
            <Icon name={entry.rank === 1 ? 'crown' : entry.rank === 2 ? 'medal' : 'trophy'} size={32} color={rankInfo.medalColor} />
          </Animated.View>

          {/* Avatar */}
          <View style={styles.podiumAvatar}>
            <LinearGradient colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']} style={styles.podiumAvatarGradient}>
              <Text style={styles.podiumAvatarText}>{initials}</Text>
            </LinearGradient>
          </View>

          <Text style={styles.podiumName} numberOfLines={1}>{entry.username}</Text>

          {/* Show points before clicking */}
          <View style={styles.podiumPointsDisplay}>
            <Icon name="star" size={12} color="#fff" />
            <Text style={styles.podiumPointsText}>{entry.total_points.toLocaleString()} pts</Text>
          </View>

          {/* Expand indicator with rotation */}
          <Animated.View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
            <Icon 
              name="chevron-down" 
              size={24} 
              color="rgba(255,255,255,0.8)" 
              style={styles.expandIcon}
            />
          </Animated.View>

          {/* Expanded details */}
          {expanded && (
            <Animated.View style={styles.expandedContent}>
              {/* Level badge */}
              <View style={[styles.levelBadge, { backgroundColor: 'rgba(0,0,0,0.2)' }]}>
                <Icon name="star-four-points" size={10} color="#fff" />
                <Text style={styles.levelBadgeText}>Lv.{entry.level} · {entry.level_title}</Text>
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
            </Animated.View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Expandable Row Card (rank 4+) ─────────────────────────
const RowCard = ({ entry, index }: { entry: LeaderboardEntry; index: number }) => {
  const [expanded, setExpanded] = useState(false);
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    const delay = index * 50;
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay,
        easing: Easing.out(Easing.back(0.5)),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay,
        tension: 100,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const initials = entry.username.slice(0, 2).toUpperCase();
  const rankColor = entry.rank <= 3 ? RANK_COLORS[entry.rank as 1 | 2 | 3].medalColor : '#64748b';

  const toggleExpand = () => {
    LayoutAnimation.configureNext({
      ...LayoutAnimation.Presets.easeInEaseOut,
      duration: 350,
    });
    setExpanded(!expanded);
  };

  return (
    <Animated.View style={[
      styles.rowCard,
      entry.is_me && styles.rowCardMe,
      { opacity: fadeAnim, transform: [{ translateX: slideAnim }, { scale: scaleAnim }] },
    ]}>
      <TouchableOpacity 
        onPress={toggleExpand} 
        activeOpacity={0.7} 
        style={styles.rowTouchable}
      >
        <View style={styles.rowHeader}>
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
            </View>
            {/* Show points before clicking */}
            <View style={styles.rowPointsPreview}>
              <Icon name="star" size={10} color="#f59e0b" />
              <Text style={styles.rowPointsPreviewText}>{entry.total_points.toLocaleString()} pts</Text>
            </View>
          </View>

          {/* Expand indicator with rotation */}
          <Animated.View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
            <Icon 
              name="chevron-down" 
              size={20} 
              color="#94a3b8" 
            />
          </Animated.View>
        </View>

        {/* Expanded details */}
        {expanded && (
          <Animated.View style={styles.rowExpandedContent}>
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

            {/* Level pill */}
            <View style={[styles.levelPill, { backgroundColor: levelColor(entry.level) + '20', alignSelf: 'flex-start' }]}>
              <Text style={[styles.levelPillText, { color: levelColor(entry.level) }]}>Lv.{entry.level} · {entry.level_title}</Text>
            </View>

            {/* XP progress bar */}
            <View style={styles.miniXpRow}>
              <View style={styles.miniXpTrack}>
                <View style={[styles.miniXpFill, { width: `${entry.level_progress}%`, backgroundColor: levelColor(entry.level) }]} />
              </View>
              <Text style={styles.miniXpLabel}>{entry.level_progress}%</Text>
            </View>

            {/* Weekly points */}
            <View style={styles.rowWeeklyWrap}>
              <Icon name="calendar-week" size={12} color="#64748b" />
              <Text style={[styles.rowWeeklyPts, entry.is_me && { color: '#10b981' }]}>
                +{entry.weekly_points} this week
              </Text>
            </View>
          </Animated.View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── My Rank Card (shown when user is outside top 50) ───────
const MyRankCard = ({ entry }: { entry: LeaderboardEntry }) => {
  const [expanded, setExpanded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
    }).start();
  }, []);

  const toggleExpand = () => {
    LayoutAnimation.configureNext({
      ...LayoutAnimation.Presets.easeInEaseOut,
      duration: 350,
    });
    setExpanded(!expanded);
  };

  return (
    <Animated.View style={[styles.myRankCard, { opacity: fadeAnim }]}>
      <TouchableOpacity onPress={toggleExpand} activeOpacity={0.7}>
        <LinearGradient colors={['#10b981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.myRankGradient}>
          <View style={styles.myRankHeader}>
            <Icon name="account-circle" size={18} color="#fff" />
            <Text style={styles.myRankLabel}>Your Rank</Text>
            <Text style={styles.myRankNumber}>#{entry.rank}</Text>
            <Animated.View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
              <Icon 
                name="chevron-down" 
                size={20} 
                color="rgba(255,255,255,0.8)" 
                style={styles.myRankExpandIcon}
              />
            </Animated.View>
          </View>
          
          {/* Show points before clicking */}
          <View style={styles.myRankPointsPreview}>
            <Icon name="star" size={12} color="#fff" />
            <Text style={styles.myRankPointsPreviewText}>{entry.total_points.toLocaleString()} pts</Text>
          </View>
          
          {expanded && (
            <View style={styles.myRankExpanded}>
              <View style={styles.myRankDivider} />
              <Text style={styles.myRankLevel}>Lv.{entry.level} · {entry.level_title}</Text>
              <View style={styles.myRankDivider} />
              <Icon name="fire" size={14} color="#FF6B6B" />
              <Text style={styles.myRankStreak}>{entry.current_streak}d streak</Text>
              <Text style={styles.myRankWeekly}>📅 {entry.weekly_points} pts this week</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Leaderboard Screen ─────────────────────────────────────
export default function LeaderboardScreen() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'all' | 'weekly' | 'top'>('all');

  const headerAnim = useRef(new Animated.Value(0)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      const res: LeaderboardResponse = await fetchLeaderboard();
      setLeaderboard(res.leaderboard);

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
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fadeInAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const sortedEntries = selectedTab === 'weekly'
    ? [...leaderboard].sort((a, b) => b.weekly_points - a.weekly_points).map((e, i) => ({ ...e, rank: i + 1 }))
    : leaderboard;

  const top3 = sortedEntries.filter(e => e.rank <= 3);
  const rest = sortedEntries.filter(e => e.rank > 3);

  const headerTranslateY = headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] });
  const headerOpacity = headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#059669" />
      
      {/* Background Effects */}
      <BackgroundEffects />

      {/* Stadium-themed Header with Original Colors */}
      <LinearGradient 
        colors={['#10b981', '#059669']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }} 
        style={styles.header}
      >
        <Animated.View style={[styles.headerInner, { opacity: headerOpacity, transform: [{ translateY: headerTranslateY }] }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <View style={styles.stadiumTitleRow}>
              <Icon name="stadium" size={24} color="#FFD700" />
              <Text style={styles.headerTitle}>Champions Arena</Text>
            </View>
            <Text style={styles.headerSubtitle}>🏟️ {leaderboard.length} competitors · {selectedTab === 'weekly' ? 'This Week' : 'All Time'}</Text>
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
              <Icon name="trophy-outline" size={80} color="#10b981" />
            </View>
            <Text style={styles.emptyTitle}>No Champions Yet</Text>
            <Text style={styles.emptyText}>Start your journey to become a champion!</Text>
            <TouchableOpacity style={styles.scanBtn} onPress={() => router.push('/scanner')}>
              <LinearGradient colors={['#10b981', '#059669']} style={styles.scanBtnGradient}>
                <Icon name="camera" size={18} color="#fff" />
                <Text style={styles.scanBtnText}>Start Scanning</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Tab Bar - Stadium themed with original colors */}
        {leaderboard.length > 0 && (
          <Animated.View style={[styles.tabBar, { opacity: fadeInAnim }]}>
            <LinearGradient colors={['#10b981', '#059669']} style={styles.tabBarGradient}>
              {(['all', 'weekly', 'top'] as const).map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, selectedTab === tab && styles.tabActive]}
                  onPress={() => setSelectedTab(tab)}
                >
                  <Icon 
                    name={tab === 'all' ? 'trophy' : tab === 'weekly' ? 'calendar-star' : 'crown'} 
                    size={14} 
                    color={selectedTab === tab ? '#fff' : 'rgba(255,255,255,0.6)'} 
                    style={styles.tabIcon}
                  />
                  <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
                    {tab === 'all' ? 'All Time' : tab === 'weekly' ? 'This Week' : 'Top 3'}
                  </Text>
                </TouchableOpacity>
              ))}
            </LinearGradient>
          </Animated.View>
        )}

        {/* My Rank Card (outside top 50) */}
        {myRank && (
          <Animated.View style={{ opacity: fadeInAnim, marginHorizontal: 20, marginTop: 16 }}>
            <MyRankCard entry={myRank} />
          </Animated.View>
        )}

        {/* Podium - Stadium themed */}
        {top3.length > 0 && selectedTab !== 'top' && (
          <Animated.View style={{ opacity: fadeInAnim }}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Icon name="crown" size={24} color="#f59e0b" />
                <Text style={styles.sectionTitle}>🏆 Champions Podium</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                {selectedTab === 'weekly' ? 'Best of the week' : 'Elite competitors'}
              </Text>
            </View>
            <View style={styles.podiumRow}>
              {top3[1] && (
                <View style={styles.podiumPosition}>
                  <LinearGradient colors={['#64748b', '#475569']} style={[styles.podiumBase, styles.silverBase]}>
                    <Text style={styles.podiumPositionLabel}>2nd Place</Text>
                    <Icon name="medal" size={16} color="#C0C0C0" />
                  </LinearGradient>
                  <PodiumCard entry={top3[1]} delay={150} />
                </View>
              )}
              {top3[0] && (
                <View style={[styles.podiumPosition, styles.podiumCenter]}>
                  <LinearGradient colors={['#FFD700', '#FFA500']} style={[styles.podiumBase, styles.goldBase]}>
                    <Text style={[styles.podiumPositionLabel, styles.podiumCenterLabel]}>1st Place</Text>
                    <Icon name="crown" size={20} color="#FFD700" />
                  </LinearGradient>
                  <PodiumCard entry={top3[0]} delay={0} />
                </View>
              )}
              {top3[2] && (
                <View style={styles.podiumPosition}>
                  <LinearGradient colors={['#CD7F32', '#A0522D']} style={[styles.podiumBase, styles.bronzeBase]}>
                    <Text style={styles.podiumPositionLabel}>3rd Place</Text>
                    <Icon name="trophy" size={14} color="#CD7F32" />
                  </LinearGradient>
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
                <Icon name="crown" size={24} color="#f59e0b" />
                <Text style={styles.sectionTitle}>🏆 Top 3 Champions</Text>
              </View>
            </View>
            <View style={styles.podiumRow}>
              {top3[1] && (
                <View style={styles.podiumPosition}>
                  <LinearGradient colors={['#64748b', '#475569']} style={[styles.podiumBase, styles.silverBase]}>
                    <Text style={styles.podiumPositionLabel}>2nd</Text>
                    <Icon name="medal" size={16} color="#C0C0C0" />
                  </LinearGradient>
                  <PodiumCard entry={top3[1]} delay={150} />
                </View>
              )}
              {top3[0] && (
                <View style={[styles.podiumPosition, styles.podiumCenter]}>
                  <LinearGradient colors={['#FFD700', '#FFA500']} style={[styles.podiumBase, styles.goldBase]}>
                    <Text style={[styles.podiumPositionLabel, styles.podiumCenterLabel]}>1st</Text>
                    <Icon name="crown" size={20} color="#FFD700" />
                  </LinearGradient>
                  <PodiumCard entry={top3[0]} delay={0} />
                </View>
              )}
              {top3[2] && (
                <View style={styles.podiumPosition}>
                  <LinearGradient colors={['#CD7F32', '#A0522D']} style={[styles.podiumBase, styles.bronzeBase]}>
                    <Text style={styles.podiumPositionLabel}>3rd</Text>
                    <Icon name="trophy" size={14} color="#CD7F32" />
                  </LinearGradient>
                  <PodiumCard entry={top3[2]} delay={300} />
                </View>
              )}
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
  root: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Background Effects
  backgroundEffects: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  bgCircle: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.05,
  },
  bgCircle1: {
    width: 300,
    height: 300,
    top: -100,
    right: -50,
    backgroundColor: '#10b981',
  },
  bgCircle2: {
    width: 200,
    height: 200,
    bottom: 100,
    left: -50,
    backgroundColor: '#f59e0b',
  },
  bgCircle3: {
    width: 150,
    height: 150,
    top: 300,
    right: -30,
    backgroundColor: '#3b82f6',
  },
  bgCircle4: {
    width: 250,
    height: 250,
    bottom: -80,
    right: -60,
    backgroundColor: '#8b5cf6',
  },

  // Stadium-themed header with original colors
  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    position: 'relative',
    zIndex: 10,
  },
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTextWrap: { flex: 1 },
  stadiumTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '500', marginTop: 2 },
  headerIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,215,0,0.2)', alignItems: 'center', justifyContent: 'center' },

  errorBanner: { margin: 20, borderRadius: 16, overflow: 'hidden' },
  errorContent: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16 },
  errorText: { fontSize: 13, color: '#dc2626', fontWeight: '500', flex: 1 },
  retryText: { fontSize: 12, color: '#ef4444', fontWeight: '600' },

  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 16 },
  emptyIcon: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 2, borderColor: '#10b981' },
  emptyTitle: { fontSize: 24, fontWeight: '800', color: '#475569' },
  emptyText: { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  scanBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  scanBtnGradient: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 12 },
  scanBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Tab Bar
  tabBar: { marginHorizontal: 20, marginTop: 20, marginBottom: 20, borderRadius: 14, overflow: 'hidden', shadowColor: '#10b981', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  tabBarGradient: { flexDirection: 'row', padding: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  tabIcon: { marginRight: 2 },
  tabText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  tabTextActive: { color: '#fff' },

  sectionHeader: { marginHorizontal: 20, marginTop: 16, marginBottom: 16 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  sectionSubtitle: { fontSize: 12, color: '#94a3b8', marginLeft: 32 },

  // Stadium podium
  podiumRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 12, gap: 8 },
  podiumPosition: { flex: 1, alignItems: 'center' },
  podiumCenter: { transform: [{ translateY: -8 }] },
  podiumBase: { width: '90%', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, marginBottom: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  goldBase: { backgroundColor: 'rgba(255,215,0,0.2)', borderWidth: 1, borderColor: '#FFD700' },
  silverBase: { backgroundColor: 'rgba(192,192,192,0.15)', borderWidth: 1, borderColor: '#C0C0C0' },
  bronzeBase: { backgroundColor: 'rgba(205,127,50,0.15)', borderWidth: 1, borderColor: '#CD7F32' },
  podiumPositionLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8' },
  podiumCenterLabel: { color: '#FFD700', fontSize: 13 },

  // Podium card
  podiumCard: { width: '100%', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  podiumFirst: { shadowOpacity: 0.25, elevation: 12 },
  podiumTouchable: { width: '100%' },
  podiumGradient: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 10, gap: 4 },

  medalIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  podiumAvatar: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', marginVertical: 4 },
  podiumAvatarGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  podiumAvatarText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  podiumName: { fontSize: 14, fontWeight: '700', color: '#fff', textAlign: 'center' },

  podiumPointsDisplay: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  podiumPointsText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  expandIcon: { marginTop: 2 },

  expandedContent: { width: '100%', gap: 5, paddingTop: 6 },

  levelBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  levelBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  weeklyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weeklyText: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },

  podiumStreakRow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  podiumStreakText: { fontSize: 10, color: '#fff', fontWeight: '600' },

  xpBarWrap: { width: '100%', gap: 2 },
  xpBarTrack: { height: 4, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 2, overflow: 'hidden' },
  xpBarFill: { height: 4, backgroundColor: '#fff', borderRadius: 2 },
  xpBarLabel: { fontSize: 9, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },

  podiumPercentage: { width: '100%', gap: 2 },
  percentageBar: { height: 4, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 2, overflow: 'hidden' },
  percentageFill: { height: 4, backgroundColor: '#fff', borderRadius: 2 },
  percentageText: { fontSize: 9, color: 'rgba(255,255,255,0.9)', textAlign: 'center' },

  badgeCountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeCountText: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },

  meBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  meBadgeText: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },

  // My rank card
  myRankCard: { borderRadius: 16, overflow: 'hidden', shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  myRankGradient: { paddingVertical: 14, paddingHorizontal: 16 },
  myRankHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  myRankLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  myRankNumber: { fontSize: 20, fontWeight: '900', color: '#fff', flex: 1 },
  myRankExpandIcon: { marginLeft: 'auto' },
  myRankPointsPreview: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  myRankPointsPreviewText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  myRankDivider: { width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 6 },
  myRankLevel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  myRankStreak: { fontSize: 12, fontWeight: '600', color: '#fff', textAlign: 'center' },
  myRankWeekly: { fontSize: 11, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  myRankExpanded: { gap: 4, marginTop: 6 },

  // Row cards - original light theme
  rowList: { marginHorizontal: 20, gap: 10 },
  rowCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 3 },
  rowCardMe: { borderColor: '#10b981', borderWidth: 2, backgroundColor: '#f0fdf4' },
  rowTouchable: { flex: 1, padding: 12 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowRankWrapper: { alignItems: 'center', gap: 2, width: 32 },
  rowRank: { fontSize: 14, fontWeight: '800' },
  rankStar: { marginTop: -2 },

  rowAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  rowAvatarMe: { backgroundColor: '#10b981' },
  rowAvatarText: { fontSize: 15, fontWeight: '800', color: '#475569' },

  rowInfo: { flex: 1, gap: 2 },
  rowNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowName: { fontSize: 14, fontWeight: '700', color: '#1e293b', flex: 1 },
  youTag: { backgroundColor: '#10b981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  youTagText: { fontSize: 9, fontWeight: '700', color: '#fff' },

  rowPointsPreview: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowPointsPreviewText: { fontSize: 11, color: '#64748b', fontWeight: '600' },

  rowExpandedContent: { marginTop: 12, gap: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  rowStats: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  rowStatChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#f8fafc', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  rowMetaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fef3c7', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  rowStatText: { fontSize: 10, color: '#64748b', fontWeight: '600' },

  levelPill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  levelPillText: { fontSize: 10, fontWeight: '700' },

  miniXpRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniXpTrack: { flex: 1, height: 3, backgroundColor: '#e2e8f0', borderRadius: 2, overflow: 'hidden' },
  miniXpFill: { height: 3, borderRadius: 2 },
  miniXpLabel: { fontSize: 9, color: '#94a3b8', fontWeight: '600', width: 28 },

  rowWeeklyWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowWeeklyPts: { fontSize: 10, color: '#64748b', fontWeight: '500' },

  // Skeleton
  skeletonCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f1f5f9' },
  skeletonContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  skeletonAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e2e8f0' },
  skeletonText: { flex: 1, gap: 8 },
  skeletonName: { height: 14, width: '60%', backgroundColor: '#e2e8f0', borderRadius: 7 },
  skeletonStats: { height: 11, width: '40%', backgroundColor: '#f1f5f9', borderRadius: 6 },
  skeletonXp: { height: 3, width: '80%', backgroundColor: '#f1f5f9', borderRadius: 2 },
  skeletonPoints: { height: 20, width: 48, backgroundColor: '#e2e8f0', borderRadius: 8 },
});