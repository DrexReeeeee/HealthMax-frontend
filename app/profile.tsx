import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getUserProfile, getUserStats, UserProfile, UserStats } from './utils/storage';

// ─── Icon replacements (emoji) ────────────────────────────────────────────────
const ICONS: Record<string, string> = {
  'arrow-left':   '←',
  'cog':          '⚙️',
  'account':      '👤',
  'email':        '✉️',
  'trophy':       '🏆',
  'fire':         '🔥',
  'trending-up':  '📈',
  'target':       '🎯',
  'star':         '⭐',
  'crown':        '👑',
  'arm-flex':     '💪',
  'medal':        '🥇',
  'chart-line':   '📊',
  'logout':       '🚪',
  'chevron-right':'›',
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <Text style={{ fontSize: size, lineHeight: size * 1.3 }}>
      {ICONS[name] ?? '●'}
    </Text>
  );
}

// ─── Gradient replacement ─────────────────────────────────────────────────────
function FakeGradient({
  color,
  style,
  children,
}: {
  color: string;
  style?: object;
  children: React.ReactNode;
}) {
  return <View style={[{ backgroundColor: color }, style]}>{children}</View>;
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats>({
    totalScans: 0,
    healthyPercentage: 0,
    currentStreak: 0,
    points: 0,
    badges: [],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const userProfile = await getUserProfile();
    const userStats = await getUserStats();
    setProfile(userProfile);
    setStats(userStats);
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => router.replace('/index'),
        },
      ]
    );
  };

  const getRank = () => {
    if (stats.points >= 1000) return { name: 'Gold',   color: '#f59e0b' };
    if (stats.points >= 500)  return { name: 'Silver', color: '#94a3b8' };
    return                           { name: 'Bronze', color: '#d97706' };
  };

  const rank = getRank();

  const badges = [
    {
      id: 'first-scan',
      name: 'First Scan',
      description: 'Complete your first scan',
      icon: 'target',
      earned: stats.badges.includes('first-scan'),
    },
    {
      id: 'scan-master',
      name: 'Scan Master',
      description: 'Scan 10 products',
      icon: 'star',
      earned: stats.badges.includes('scan-master'),
    },
    {
      id: 'scan-legend',
      name: 'Scan Legend',
      description: 'Scan 50 products',
      icon: 'crown',
      earned: stats.badges.includes('scan-legend'),
    },
    {
      id: 'week-warrior',
      name: 'Week Warrior',
      description: '7-day streak',
      icon: 'fire',
      earned: stats.badges.includes('week-warrior'),
    },
    {
      id: 'health-champion',
      name: 'Health Champion',
      description: '80% healthy choices',
      icon: 'arm-flex',
      earned: stats.badges.includes('health-champion'),
    },
    {
      id: 'dedication',
      name: 'Dedication',
      description: '30-day streak',
      icon: 'medal',
      earned: stats.badges.includes('dedication'),
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <FakeGradient color="#10b981" style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Icon name="arrow-left" size={24} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsButton}>
              <Icon name="cog" size={24} />
            </TouchableOpacity>
          </View>

          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <Icon name="account" size={48} />
            </View>
            <Text style={styles.profileName}>
              {profile?.name || 'Guest User'}
            </Text>
            {profile?.email && (
              <View style={styles.emailContainer}>
                <Icon name="email" size={16} />
                <Text style={styles.emailText}>{profile.email}</Text>
              </View>
            )}
          </View>
        </FakeGradient>

        <View style={styles.content}>

          {/* Points Card */}
          <FakeGradient color="#fef3c7" style={[styles.pointsCard, styles.pointsGradient]}>
            <View style={styles.pointsRow}>
              <View style={styles.pointsLeft}>
                <View style={styles.trophyIcon}>
                  <Icon name="trophy" size={24} />
                </View>
                <View>
                  <Text style={styles.pointsLabel}>Total Points</Text>
                  <Text style={styles.pointsValue}>{stats.points}</Text>
                </View>
              </View>
              <View style={styles.rankContainer}>
                <Text style={styles.rankLabel}>Rank</Text>
                <Text style={[styles.rankValue, { color: rank.color }]}>{rank.name}</Text>
              </View>
            </View>
          </FakeGradient>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <FakeGradient color="#f97316" style={styles.statIconContainer}>
                <Icon name="fire" size={20} />
              </FakeGradient>
              <Text style={styles.statValue}>{stats.currentStreak}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>

            <View style={styles.statCard}>
              <FakeGradient color="#10b981" style={styles.statIconContainer}>
                <Icon name="trending-up" size={20} />
              </FakeGradient>
              <Text style={styles.statValue}>{stats.healthyPercentage}%</Text>
              <Text style={styles.statLabel}>Healthy</Text>
            </View>

            <View style={styles.statCard}>
              <FakeGradient color="#3b82f6" style={styles.statIconContainer}>
                <Icon name="target" size={20} />
              </FakeGradient>
              <Text style={styles.statValue}>{stats.totalScans}</Text>
              <Text style={styles.statLabel}>Total Scans</Text>
            </View>

            <View style={styles.statCard}>
              <FakeGradient color="#a855f7" style={styles.statIconContainer}>
                <Icon name="trophy" size={20} />
              </FakeGradient>
              <Text style={styles.statValue}>{stats.badges.length}</Text>
              <Text style={styles.statLabel}>Badges</Text>
            </View>
          </View>

          {/* Health Goals */}
          {profile?.healthGoals && profile.healthGoals.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Health Goals</Text>
              <View style={styles.goalsCard}>
                <View style={styles.goalsContainer}>
                  {profile.healthGoals.map((goal, index) => (
                    <View key={index} style={styles.goalChip}>
                      <Text style={styles.goalChipText}>
                        {goal.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Dietary Preferences */}
          {profile?.dietaryPreferences && profile.dietaryPreferences.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dietary Preferences</Text>
              <View style={styles.goalsCard}>
                <View style={styles.goalsContainer}>
                  {profile.dietaryPreferences.map((pref, index) => (
                    <View key={index} style={styles.dietChip}>
                      <Text style={styles.dietChipText}>
                        {pref.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Achievements */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <View style={styles.badgesCard}>
              <View style={styles.badgesGrid}>
                {badges.map((badge) => (
                  <View
                    key={badge.id}
                    style={[styles.badgeItem, !badge.earned && styles.badgeItemLocked]}
                  >
                    <View
                      style={[
                        styles.badgeIconContainer,
                        badge.earned ? styles.badgeEarned : styles.badgeLocked,
                      ]}
                    >
                      <Icon name={badge.icon} size={32} />
                    </View>
                    <Text style={styles.badgeName}>{badge.name}</Text>
                    <Text style={styles.badgeDescription}>{badge.description}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => router.push('/analytics')}
              style={styles.actionButton}
            >
              <Icon name="chart-line" size={20} />
              <Text style={styles.actionButtonText}>View Detailed Analytics</Text>
              <Icon name="chevron-right" size={20} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogout}
              style={[styles.actionButton, styles.logoutButton]}
            >
              <Icon name="logout" size={20} />
              <Text style={styles.logoutButtonText}>Log Out</Text>
              <Icon name="chevron-right" size={20} />
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 80,
    paddingHorizontal: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileSection: {
    alignItems: 'center',
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emailText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  content: {
    marginTop: -60,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  pointsCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  pointsGradient: {
    padding: 20,
  },
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trophyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointsLabel: {
    fontSize: 14,
    color: '#78716c',
  },
  pointsValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  rankContainer: {
    alignItems: 'flex-end',
  },
  rankLabel: {
    fontSize: 14,
    color: '#78716c',
  },
  rankValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  goalsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  goalsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalChip: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  goalChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#065f46',
  },
  dietChip: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  dietChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e40af',
  },
  badgesCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  badgeItem: {
    width: '30%',
    alignItems: 'center',
  },
  badgeItemLocked: {
    opacity: 0.4,
  },
  badgeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeEarned: {
    backgroundColor: '#fef3c7',
  },
  badgeLocked: {
    backgroundColor: '#f1f5f9',
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 2,
  },
  badgeDescription: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
  },
  logoutButton: {
    borderColor: '#fee2e2',
    backgroundColor: '#fef2f2',
  },
  logoutButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#ef4444',
  },
});
