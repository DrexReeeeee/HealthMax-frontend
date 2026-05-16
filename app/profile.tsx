import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiFetch } from './utils/api';
import { isLoggedIn, clearAuth } from './utils/storage';

const { height } = Dimensions.get('window');

// ── Types ──────────────────────────────────────────────────────────────────────

interface BackendProfile {
  username:            string | null;
  age:                 number | null;
  weight:              number | null;
  health_goal:         string | null;
  dietary_preference:  string | null;
  sugar_modifier:      number | null;
  salt_modifier:       number | null;
  fat_modifier:        number | null;
}

interface HydratedBadge {
  id:   string;
  name: string;
  desc: string;
  icon: string;
}

interface GamificationData {
  total_points:        number;
  current_streak:      number;
  longest_streak:      number;
  healthy_percentage:  number;
  total_scans?:        number;
  badges?:             { id: string; name: string; desc: string; icon: string }[]; // ← was string[]
  bonus_points_today?: number;
  streak_status?:      string;
  badges_count?:       number;
  total_badges?:       number;
  days_until_reset?:   number;
  level?:              number;
  level_title?:        string;
}
// ── Constants ──────────────────────────────────────────────────────────────────

const HEALTH_GOALS = [
  { value: 'low-sugar',         label: 'Low Sugar' },
  { value: 'diabetic-friendly', label: 'Diabetic Friendly' },
  { value: 'low-salt',          label: 'Low Salt' },
  { value: 'hypertension',      label: 'Hypertension' },
  { value: 'heart-health',      label: 'Heart Health' },
  { value: 'low-fat',           label: 'Low Fat' },
  { value: 'general-wellness',  label: 'General Wellness' },
];

const DIETARY_PREFS = [
  { value: 'balanced',     label: 'Balanced' },
  { value: 'vegetarian',   label: 'Vegetarian' },
  { value: 'vegan',        label: 'Vegan' },
  { value: 'pescatarian',  label: 'Pescatarian' },
  { value: 'keto',         label: 'Keto' },
  { value: 'halal',        label: 'Halal' },
  { value: 'gluten-free',  label: 'Gluten Free' },
  { value: 'dairy-free',   label: 'Dairy Free' },
];

const BADGES = [
  { id: 'first_scan',       name: 'First Scan',           desc: 'Scanned your first product',              color: '#10b981', icon: '🔍' },
  { id: 'scan_10',          name: 'Getting Started',       desc: 'Scanned 10 products',                     color: '#f59e0b', icon: '📦' },
  { id: 'scan_50',          name: 'Dedicated Scanner',     desc: 'Scanned 50 products',                     color: '#8b5cf6', icon: '🏅' },
  { id: 'scan_100',         name: 'Century Scanner',       desc: 'Scanned 100 products',                    color: '#06b6d4', icon: '💯' },
  { id: 'scan_500',         name: 'Product Encyclopedia',  desc: 'Scanned 500 products',                    color: '#ec4899', icon: '📚' },
  { id: 'streak_3',         name: 'On a Roll',             desc: '3-day scanning streak',                   color: '#f97316', icon: '🔥' },
  { id: 'streak_7',         name: 'Week Warrior',          desc: '7-day scanning streak',                   color: '#ef4444', icon: '⚡' },
  { id: 'streak_14',        name: 'Two Week Titan',        desc: '14-day scanning streak',                  color: '#3b82f6', icon: '💪' },
  { id: 'streak_30',        name: 'Monthly Master',        desc: '30-day scanning streak',                  color: '#a855f7', icon: '🌟' },
  { id: 'streak_90',        name: 'Quarter Champion',      desc: '90-day scanning streak',                  color: '#f59e0b', icon: '👑' },
  { id: 'first_great',      name: 'Green Light',           desc: 'First product scoring 75+',               color: '#10b981', icon: '🥗' },
  { id: 'perfect_week',     name: 'Perfect Week',          desc: 'All scans score 60+ in a week',           color: '#06b6d4', icon: '🎯' },
  { id: 'health_conscious', name: 'Health Conscious',      desc: '70%+ healthy scans overall',              color: '#10b981', icon: '💚' },
  { id: 'health_master',    name: 'Health Master',         desc: '85%+ healthy scans overall',              color: '#f59e0b', icon: '🏆' },
  { id: 'improving',        name: 'Improving',             desc: 'Avg score improved 10+ pts over last 10', color: '#3b82f6', icon: '📈' },
  { id: 'level_5',          name: 'Level 5',               desc: 'Reached Level 5',                         color: '#a855f7', icon: '⭐' },
  { id: 'level_10',         name: 'Level 10',              desc: 'Reached Level 10',                        color: '#ec4899', icon: '🌠' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Rank is based on leaderboard position, not points.
 * 1st = Gold, 2nd = Silver, 3rd = Bronze, anything else = Black.
 */
function getRank(position: number | null) {
  if (position === 1) return { name: 'Gold',   color: '#f59e0b', bg: '#fef3c7', emoji: '🥇' };
  if (position === 2) return { name: 'Silver', color: '#64748b', bg: '#f1f5f9', emoji: '🥈' };
  if (position === 3) return { name: 'Bronze', color: '#d97706', bg: '#fef9c3', emoji: '🥉' };
  return                     { name: 'Ranked', color: '#1e293b', bg: '#f8fafc', emoji: '🏅' };
}

function formatOption(val: string) {
  return val.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Option Picker Sheet ────────────────────────────────────────────────────────

interface PickerSheetProps {
  visible:   boolean;
  title:     string;
  options:   { value: string; label: string }[];
  selected:  string | null;
  onSelect:  (val: string | null) => void;
  onClose:   () => void;
}

function PickerSheet({ visible, title, options, selected, onSelect, onClose }: PickerSheetProps) {
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 13 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: height, duration: 260, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <Animated.View style={[styles.pickerSheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.pickerHandle} />
          <Text style={styles.pickerTitle}>{title}</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.pickerOption, selected === null && styles.pickerOptionActive]}
              onPress={() => { onSelect(null); onClose(); }}
              activeOpacity={0.7}
            >
              <View style={styles.pickerOptionLeft}>
                <View style={[styles.pickerOptionIcon, selected === null && styles.pickerOptionIconActive]}>
                  <Text style={{ fontSize: 18, color: selected === null ? '#fff' : '#94a3b8' }}>✖</Text>
                </View>
                <Text style={[styles.pickerOptionLabel, selected === null && styles.pickerOptionLabelActive]}>
                  None / Clear
                </Text>
              </View>
              {selected === null && <Text style={{ fontSize: 16, color: '#10b981' }}>✓</Text>}
            </TouchableOpacity>

            {options.map(opt => {
              const isActive = selected === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.pickerOption, isActive && styles.pickerOptionActive]}
                  onPress={() => { onSelect(opt.value); onClose(); }}
                  activeOpacity={0.7}
                >
                  <View style={styles.pickerOptionLeft}>
                    <View style={[styles.pickerOptionIcon, isActive && styles.pickerOptionIconActive]}>
                      <Text style={{ fontSize: 18, color: isActive ? '#fff' : '#94a3b8' }}>●</Text>
                    </View>
                    <Text style={[styles.pickerOptionLabel, isActive && styles.pickerOptionLabelActive]}>
                      {opt.label}
                    </Text>
                  </View>
                  {isActive && <Text style={{ fontSize: 16, color: '#10b981' }}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 32 }} />
          </ScrollView>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const [profile,          setProfile]          = useState<BackendProfile | null>(null);
  const [gamification,     setGamification]     = useState<GamificationData | null>(null);
  const [leaderboardRank,  setLeaderboardRank]  = useState<number | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);
  const [saving,           setSaving]           = useState(false);
  const [loggedIn,         setLoggedIn]         = useState(false);

  // Edit state
  const [editUsername,    setEditUsername]    = useState<string | null>(null);
  const [editGoal,        setEditGoal]        = useState<string | null>(null);
  const [editDiet,        setEditDiet]        = useState<string | null>(null);
  const [showGoalPicker,  setShowGoalPicker]  = useState(false);
  const [showDietPicker,  setShowDietPicker]  = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);

  // ── Load data ──────────────────────────────────────────────────────

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const online = await isLoggedIn();
      setLoggedIn(online);

      if (!online) return;

      const [profileRes, gamRes, lbRes] = await Promise.all([
        apiFetch('/api/profile',              { method: 'GET' }, true),
        apiFetch('/api/gamification',         { method: 'GET' }, true),
        apiFetch('/api/leaderboard?limit=50', { method: 'GET' }, true),
      ]);

      if (profileRes.ok && profileRes.data?.profile) {
        const p: BackendProfile = profileRes.data.profile;
        setProfile(p);
        setEditUsername(p.username ?? null);
        setEditGoal(p.health_goal ?? null);
        setEditDiet(p.dietary_preference ?? null);
      }

      if (gamRes.ok && gamRes.data?.gamification) {
        setGamification(gamRes.data.gamification);
      } else if (gamRes.ok && gamRes.data?.stats) {
        setGamification(gamRes.data.stats);
      }

      // Prefer the top-50 entry; fall back to my_rank for users outside top 50
      if (lbRes.ok) {
        const me = lbRes.data?.leaderboard?.find((e: any) => e.is_me);
        if (me) {
          setLeaderboardRank(me.rank);
        } else if (lbRes.data?.my_rank?.rank) {
          setLeaderboardRank(lbRes.data.my_rank.rank);
        }
      }
    } catch (err) {
      console.error('Profile load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  // ── Save changes ───────────────────────────────────────────────────

  const hasChanges =
    editUsername !== (profile?.username ?? null) ||
    editGoal     !== (profile?.health_goal ?? null) ||
    editDiet     !== (profile?.dietary_preference ?? null);

  const saveChanges = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const body: Record<string, string | undefined> = {};
      if (editUsername !== null && editUsername !== profile?.username) body.username = editUsername || undefined;
      if (editGoal !== null) body.health_goal = editGoal;
      if (editDiet !== null) body.dietary_preference = editDiet;

      const { ok, data } = await apiFetch('/api/profile', {
        method: 'POST',
        body: JSON.stringify(body),
      }, true);

      if (!ok) {
        Alert.alert('Save failed', data?.message ?? 'Could not save profile.');
        return;
      }

      setProfile(prev => prev
        ? { ...prev, username: editUsername, health_goal: editGoal, dietary_preference: editDiet }
        : prev
      );

      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
      setEditingUsername(false);
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out', style: 'destructive',
        onPress: async () => {
          await apiFetch('/api/auth/logout', { method: 'POST' }, true).catch(() => {});
          await clearAuth();
          router.replace('/');
        },
      },
    ]);
  };

  // ── Derived display values ─────────────────────────────────────────

  const points      = gamification?.total_points      ?? 0;
  const streak      = gamification?.current_streak    ?? 0;
  const healthy     = Math.round(gamification?.healthy_percentage ?? 0);
  const totalScan   = gamification?.total_scans       ?? 0;
  const badges      = gamification?.badges            ?? [];
  const badgesCount = gamification?.badges_count      ?? badges.length;

  // Rank is now derived from leaderboard position, not points
  const rank = getRank(leaderboardRank);

  const displayName  = profile?.username ?? 'Guest User';
  const displayGoal  = editGoal ? formatOption(editGoal) : null;
  const displayDiet  = editDiet ? formatOption(editDiet) : null;
  const goalChanged  = editGoal !== (profile?.health_goal ?? null);
  const dietChanged  = editDiet !== (profile?.dietary_preference ?? null);

  const getBadgeEmoji = (badgeId: string) => {
  return BADGES.find(b => b.id === badgeId)?.icon || '🏆';
};

  // ── Streak status helper ───────────────────────────────────────────
  const getStreakSubtitle = () => {
    const status  = gamification?.streak_status;
    const longest = gamification?.longest_streak ?? 0;
    if (status === 'broken')        return 'Missed a day — reset!';
    if (status === 'scanned_today') return 'Already scanned today ✓';
    if (streak >= longest && longest > 0) return 'New record! 🎉';
    return `Best: ${longest}d`;
  };

  // ── Loading state ──────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor="#10b981"
            colors={['#10b981']}
          />
        }
      >
        {/* ── Header gradient ── */}
        <LinearGradient
          colors={['#059669', '#10b981', '#34d399']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <SafeAreaView>
            <View style={styles.headerNav}>
              <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
                <Text style={{ fontSize: 22, color: '#fff' }}>←</Text>
              </TouchableOpacity>
              {!loggedIn && (
                <View style={styles.offlinePill}>
                  <Text style={{ fontSize: 12, color: '#92400e' }}>📡</Text>
                  <Text style={styles.offlinePillText}>Offline</Text>
                </View>
              )}
            </View>

            <View style={styles.avatarSection}>
              <View style={styles.avatarRing}>
                <View style={styles.avatar}>
                  <Text style={{ fontSize: 52, color: '#10b981' }}>👤</Text>
                </View>
              </View>

              {editingUsername ? (
                <View style={styles.usernameEditContainer}>
                  <TextInput
                    style={styles.usernameInput}
                    value={editUsername || ''}
                    onChangeText={setEditUsername}
                    placeholder="Enter username"
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    autoFocus
                    maxLength={30}
                  />
                  <TouchableOpacity
                    style={styles.usernameSaveBtn}
                    onPress={() => setEditingUsername(false)}
                  >
                    <Text style={styles.usernameSaveBtnText}>✓</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.usernameDisplay}
                  onPress={() => setEditingUsername(true)}
                >
                  <Text style={styles.displayName}>{displayName}</Text>
                  <Text style={styles.editIcon}>✎</Text>
                </TouchableOpacity>
              )}

              {profile?.age || profile?.weight ? (
                <View style={styles.metaRow}>
                  {profile?.age ? (
                    <View style={styles.metaChip}>
                      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>🎂</Text>
                      <Text style={styles.metaChipText}>{profile.age} yrs</Text>
                    </View>
                  ) : null}
                  {profile?.weight ? (
                    <View style={styles.metaChip}>
                      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>⚖️</Text>
                      <Text style={styles.metaChipText}>{profile.weight} kg</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.body}>

          {/* ── Points / rank card ── */}
          <View style={[styles.rankCard, { backgroundColor: rank.bg }]}>
            <View style={styles.rankLeft}>
              <View style={[styles.trophyCircle, { backgroundColor: rank.color + '22' }]}>
                <Text style={{ fontSize: 26 }}>🏆</Text>
              </View>
              <View>
                <Text style={styles.pointsLabel}>Total Points</Text>
                <Text style={[styles.pointsValue, { color: rank.color }]}>{points.toLocaleString()}</Text>
              </View>
            </View>

            <View style={styles.rankRight}>
              <View style={[styles.rankBadge, { backgroundColor: rank.color }]}>
                <Text style={{ fontSize: 14, color: '#fff' }}>{rank.emoji}</Text>
                <Text style={styles.rankBadgeText}>{rank.name}</Text>
              </View>
              {leaderboardRank !== null && (
                <View style={styles.lbRankChip}>
                  <Text style={styles.lbRankIcon}>📊</Text>
                  <Text style={styles.lbRankText}>#{leaderboardRank} Leaderboard</Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Stats grid ── */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#ef444418' }]}>
                <Text style={{ fontSize: 20 }}>🔥</Text>
              </View>
              <Text style={styles.statValue}>{streak}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
              <Text style={styles.statSubtitle}>{getStreakSubtitle()}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#10b98118' }]}>
                <Text style={{ fontSize: 20 }}>📈</Text>
              </View>
              <Text style={styles.statValue}>{healthy}%</Text>
              <Text style={styles.statLabel}>Healthy</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#3b82f618' }]}>
                <Text style={{ fontSize: 20 }}>📱</Text>
              </View>
              <Text style={styles.statValue}>{totalScan}</Text>
              <Text style={styles.statLabel}>Total Scans</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#a855f718' }]}>
                <Text style={{ fontSize: 20 }}>🏅</Text>
              </View>
              <Text style={styles.statValue}>{badgesCount}</Text>
              <Text style={styles.statLabel}>Badges</Text>
            </View>
          </View>

          {/* ── Health goal selector ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={{ fontSize: 16, color: '#10b981' }}>🎯</Text>
              <Text style={styles.sectionTitle}>Health Goal</Text>
              {goalChanged && <View style={styles.changedDot} />}
            </View>
            <TouchableOpacity
              style={styles.selectorBtn}
              onPress={() => setShowGoalPicker(true)}
              activeOpacity={0.75}
            >
              <View style={styles.selectorLeft}>
                <View style={[styles.selectorIcon, { backgroundColor: editGoal ? '#d1fae5' : '#f1f5f9' }]}>
                  <Text style={{ fontSize: 18, color: editGoal ? '#059669' : '#94a3b8' }}>🎯</Text>
                </View>
                <Text style={[styles.selectorText, !editGoal && styles.selectorPlaceholder]}>
                  {displayGoal ?? 'Select a health goal'}
                </Text>
              </View>
              <Text style={{ fontSize: 18, color: '#94a3b8' }}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* ── Dietary preference selector ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={{ fontSize: 16, color: '#10b981' }}>🍎</Text>
              <Text style={styles.sectionTitle}>Dietary Preference</Text>
              {dietChanged && <View style={styles.changedDot} />}
            </View>
            <TouchableOpacity
              style={styles.selectorBtn}
              onPress={() => setShowDietPicker(true)}
              activeOpacity={0.75}
            >
              <View style={styles.selectorLeft}>
                <View style={[styles.selectorIcon, { backgroundColor: editDiet ? '#dbeafe' : '#f1f5f9' }]}>
                  <Text style={{ fontSize: 18, color: editDiet ? '#2563eb' : '#94a3b8' }}>🍎</Text>
                </View>
                <Text style={[styles.selectorText, !editDiet && styles.selectorPlaceholder]}>
                  {displayDiet ?? 'Select dietary preference'}
                </Text>
              </View>
              <Text style={{ fontSize: 18, color: '#94a3b8' }}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* ── Save button (only when changes exist) ── */}
          {hasChanges && (
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={saveChanges}
              activeOpacity={0.8}
              disabled={saving}
            >
              <LinearGradient colors={['#10b981', '#059669']} style={styles.saveBtnGradient}>
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <>
                      <Text style={{ fontSize: 18, color: '#fff' }}>✓</Text>
                      <Text style={styles.saveBtnText}>Save Changes</Text>
                    </>
                }
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* ── Achievements ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={{ fontSize: 16, color: '#10b981' }}>🏅</Text>
              <Text style={styles.sectionTitle}>Achievements</Text>
            </View>
            <View style={styles.badgesGrid}>
              {BADGES.map(badge => {
                // badges is now HydratedBadge[] — check by id
                const earned = Array.isArray(badges) && badges.some((b: any) =>
                  typeof b === 'string' ? b === badge.id : b.id === badge.id
                );
                return (
                  <View key={badge.id} style={[styles.badgeCard, !earned && styles.badgeCardLocked]}>
                    <View style={[styles.badgeIconWrap, { backgroundColor: earned ? badge.color + '22' : '#f1f5f9' }]}>
                      <Text style={{ fontSize: 28, color: earned ? badge.color : '#cbd5e1' }}>
                        {badge.icon}  {/* Use badge.icon directly, which is already an emoji */}
                      </Text>
                    </View>
                    <Text style={[styles.badgeName, !earned && styles.badgeNameLocked]}>{badge.name}</Text>
                    <Text style={styles.badgeDesc}>{badge.desc}</Text>
                    {earned && (
                      <View style={[styles.earnedPill, { backgroundColor: badge.color + '22' }]}>
                        <Text style={[styles.earnedPillText, { color: badge.color }]}>Earned</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* ── Actions ── */}
          <View style={styles.actionsSection}>
            <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/analytics')} activeOpacity={0.75}>
              <View style={[styles.actionIcon, { backgroundColor: '#ede9fe' }]}>
                <Text style={{ fontSize: 18, color: '#7c3aed' }}>📊</Text>
              </View>
              <Text style={styles.actionLabel}>Detailed Analytics</Text>
              <Text style={{ fontSize: 18, color: '#94a3b8' }}>►</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionRow, styles.actionRowDanger]} onPress={handleLogout} activeOpacity={0.75}>
              <View style={[styles.actionIcon, { backgroundColor: '#fee2e2' }]}>
                <Text style={{ fontSize: 18, color: '#ef4444' }}>🚪</Text>
              </View>
              <Text style={[styles.actionLabel, { color: '#ef4444' }]}>Log Out</Text>
              <Text style={{ fontSize: 18, color: '#fca5a5' }}>►</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* ── Pickers ── */}
      <PickerSheet
        visible={showGoalPicker}
        title="Health Goal"
        options={HEALTH_GOALS}
        selected={editGoal}
        onSelect={setEditGoal}
        onClose={() => setShowGoalPicker(false)}
      />
      <PickerSheet
        visible={showDietPicker}
        title="Dietary Preference"
        options={DIETARY_PREFS}
        selected={editDiet}
        onSelect={setEditDiet}
        onClose={() => setShowDietPicker(false)}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:      { fontSize: 14, color: '#64748b' },

  // Header
  header:    { paddingBottom: 32 },
  headerNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 16 : 8, paddingBottom: 12,
  },
  navBtn:          { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  offlinePill:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  offlinePillText: { fontSize: 11, fontWeight: '600', color: '#92400e' },

  avatarSection: { alignItems: 'center', paddingVertical: 16 },
  avatarRing:    { width: 104, height: 104, borderRadius: 52, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)', padding: 4, marginBottom: 14 },
  avatar:        { flex: 1, borderRadius: 50, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },

  usernameDisplay:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  displayName:           { fontSize: 22, fontWeight: '800', color: '#fff' },
  editIcon:              { fontSize: 16, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  usernameEditContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  usernameInput:         { fontSize: 20, fontWeight: '600', color: '#1e293b', minWidth: 150, paddingVertical: 8 },
  usernameSaveBtn:       { width: 32, height: 32, borderRadius: 16, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  usernameSaveBtnText:   { fontSize: 18, color: '#fff', fontWeight: '700' },

  metaRow:      { flexDirection: 'row', gap: 8, marginTop: 8 },
  metaChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  metaChipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },

  // Body
  body: { paddingHorizontal: 16, marginTop: -8 },

  // Rank card
  rankCard:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 18, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  rankLeft:      { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rankRight:     { alignItems: 'flex-end', gap: 6 },
  trophyCircle:  { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  pointsLabel:   { fontSize: 12, color: '#78716c', fontWeight: '500', marginBottom: 2 },
  pointsValue:   { fontSize: 28, fontWeight: '800', lineHeight: 32 },
  rankBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  rankBadgeText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  lbRankChip:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.07)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  lbRankIcon:    { fontSize: 11 },
  lbRankText:    { fontSize: 11, fontWeight: '700', color: '#475569' },

  // Stats grid
  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  statCard:     { width: '47.5%', backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  statIcon:     { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue:    { fontSize: 22, fontWeight: '800', color: '#0f172a', lineHeight: 26 },
  statLabel:    { fontSize: 11, color: '#64748b', fontWeight: '500', marginTop: 2 },
  statSubtitle: { fontSize: 9, color: '#94a3b8', fontWeight: '500', marginTop: 4, textAlign: 'center' },

  // Section
  section:       { marginTop: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: '#1e293b', flex: 1 },
  changedDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: '#f59e0b' },

  // Selector
  selectorBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  selectorLeft:        { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  selectorIcon:        { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  selectorText:        { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  selectorPlaceholder: { color: '#94a3b8', fontWeight: '400' },

  // Save button
  saveBtn:         { marginTop: 20, borderRadius: 14, overflow: 'hidden' },
  saveBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  saveBtnText:     { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Badges
  badgesGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCard:       { width: '31%', backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  badgeCardLocked: { opacity: 0.45 },
  badgeIconWrap:   { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  badgeName:       { fontSize: 11, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
  badgeNameLocked: { color: '#94a3b8' },
  badgeDesc:       { fontSize: 9, color: '#94a3b8', textAlign: 'center', lineHeight: 13 },
  earnedPill:      { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  earnedPillText:  { fontSize: 9, fontWeight: '700' },

  // Actions
  actionsSection:  { marginTop: 24, gap: 10 },
  actionRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  actionRowDanger: { borderColor: '#fee2e2', backgroundColor: '#fff5f5' },
  actionIcon:      { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionLabel:     { flex: 1, fontSize: 15, fontWeight: '600', color: '#1e293b' },

  // Picker sheet
  pickerBackdrop:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet:             { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: height * 0.75 },
  pickerHandle:            { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  pickerTitle:             { fontSize: 17, fontWeight: '800', color: '#1e293b', marginBottom: 16 },
  pickerOption:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, marginBottom: 6, backgroundColor: '#f8fafc' },
  pickerOptionActive:      { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' },
  pickerOptionLeft:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pickerOptionIcon:        { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  pickerOptionIconActive:  { backgroundColor: '#10b981' },
  pickerOptionLabel:       { fontSize: 14, fontWeight: '500', color: '#475569' },
  pickerOptionLabelActive: { fontWeight: '700', color: '#065f46' },
});