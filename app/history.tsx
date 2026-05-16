import { Feather, MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Platform,
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
import { getLocalScans, isLoggedIn } from './utils/storage';

const { height } = Dimensions.get('window');

type Filter     = 'all' | 'healthy' | 'unhealthy';
type DateFilter = 'all' | 'today' | 'week' | 'month';

interface Alternative {
  barcode: string;
  name: string;
  brand?: string;
  image_url?: string;
  score: number;
  grade: string;
  reason?: string;
}

interface ProductNutrients {
  sugar_g?: number;
  saturated_fat_g?: number;
  sodium_mg?: number;
  energy_kcal?: number;
  fiber_g?: number;
  protein_g?: number;
  nova_group?: number | null;
  additives_count?: number;
}

// ── All fields that come back from the API ─────────────────
interface HistoryItem {
  id: string;
  score: number;
  scanned_at: string;
  description?: string;
  warnings?: string[];
  tips?: string[];
  products: {
    barcode: string;
    name: string;
    brand?: string;
    category?: string;
    image_url?: string;
    nutrients?: ProductNutrients;
    base_score?: number;
  };
}

interface ScanDetail extends HistoryItem {
  alternatives: Alternative[];
}

// ── Score helpers ──────────────────────────────────────────

function scoreColor(score: number) {
  const s = score ?? 0;
  if (s >= 75) return '#16a34a';
  if (s >= 60) return '#65a30d';
  if (s >= 45) return '#ca8a04';
  if (s >= 25) return '#ea580c';
  return '#dc2626';
}

function scoreLabel(score: number) {
  const s = score ?? 0;
  if (s >= 75) return 'Great';
  if (s >= 60) return 'Good';
  if (s >= 45) return 'Moderate';
  if (s >= 25) return 'Poor';
  return 'Avoid';
}

function scoreGrade(score: number) {
  const s = score ?? 0;
  if (s >= 75) return 'A';
  if (s >= 60) return 'B';
  if (s >= 45) return 'C';
  if (s >= 25) return 'D';
  return 'E';
}

function stars(score: number) {
  const s = Math.min(5, Math.max(0, Math.round(((score ?? 0) / 100) * 5)));
  return '★'.repeat(s) + '☆'.repeat(5 - s);
}

// ── Date helpers ───────────────────────────────────────────

function formatDate(dateStr: string, style: 'short' | 'long' = 'short') {
  const d = new Date(dateStr);
  if (style === 'long') {
    return d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const item  = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff  = Math.floor((today.getTime() - item.getTime()) / 86400000);
  if (diff === 0) return `Today · ${d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}`;
  if (diff === 1) return `Yesterday · ${d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}`;
  if (diff < 7)  return `${diff} days ago`;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Nutrient Row ───────────────────────────────────────────

const NutrientRow = ({
  label,
  value,
  unit,
}: {
  label: string;
  value?: number | null;
  unit: string;
}) => (
  <View style={styles.nutriRow}>
    <Text style={styles.nutriLabel}>{label}</Text>
    <Text style={styles.nutriValue}>
      {value !== undefined && value !== null && !isNaN(value)
        ? `${value.toFixed(1)} ${unit}`
        : '—'}
    </Text>
  </View>
);

// ── Main Screen ────────────────────────────────────────────

export default function History() {
  const [filter, setFilter]         = useState<Filter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [search, setSearch]         = useState('');
  const [history, setHistory]       = useState<HistoryItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline]     = useState(false);

  const [detail, setDetail]               = useState<ScanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;
  const floatAnim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadHistory();

    const createFloatAnimation = (animValue: Animated.Value, delayTime: number) => {
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
  }, [filter]);

  const loadHistory = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const loggedIn = await isLoggedIn();
      setIsOnline(loggedIn);

      if (loggedIn) {
        const { ok, data } = await apiFetch(
          `/api/history?filter=${filter}`,
          { method: 'GET' },
          true
        );
        setHistory(ok && data.history ? data.history : []);
      } else {
        const localScans = await getLocalScans();
        const converted: HistoryItem[] = localScans
          .filter(s => {
            if (filter === 'healthy')   return (s.score ?? 0) >= 60;
            if (filter === 'unhealthy') return (s.score ?? 0) < 45;
            return true;
          })
          .map((s, i) => ({
            id: `local_${i}`,
            score: s.score,
            scanned_at: s.date,
            products: {
              barcode:   s.barcode,
              name:      s.name,
              brand:     s.brand,
              category:  s.category,
              image_url: s.image_url,
            },
          }));
        setHistory(converted);
      }
    } catch (err) {
      console.error('History load error:', err);
      setHistory([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ── Client-side filtering ──────────────────────────────

  const filteredHistory = history.filter(item => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q ||
      item.products.name?.toLowerCase().includes(q) ||
      item.products.brand?.toLowerCase().includes(q) ||
      item.products.category?.toLowerCase().includes(q);

    const scannedAt = new Date(item.scanned_at);
    const now       = new Date();
    let matchesDate = true;
    if (dateFilter === 'today') {
      matchesDate = scannedAt.toDateString() === now.toDateString();
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      matchesDate = scannedAt >= weekAgo;
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now); monthAgo.setMonth(now.getMonth() - 1);
      matchesDate = scannedAt >= monthAgo;
    }

    return matchesSearch && matchesDate;
  });

  const isFiltering = search.trim().length > 0 || dateFilter !== 'all';

  // ── Detail sheet ───────────────────────────────────────

  const showSheet = () => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const hideSheet = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: height, duration: 280, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 0,      duration: 200, useNativeDriver: true }),
    ]).start(() => setDetail(null));
  };

  const openDetail = async (item: HistoryItem) => {
    // Show immediately with what we already have from the list
    const optimistic: ScanDetail = {
      ...item,
      alternatives: [],
    };

    if (item.id.startsWith('local_')) {
      setDetail(optimistic);
      showSheet();
      return;
    }

    setDetailLoading(true);
    setDetail(optimistic);
    showSheet();

    try {
      const { ok, data } = await apiFetch(`/api/history/${item.id}`, { method: 'GET' }, true);
      if (ok && data.scan) {
        setDetail({
          ...data.scan,
          // Fallback to list-level values if detail response is missing them
          description: data.scan.description ?? item.description,
          warnings:    data.scan.warnings    ?? item.warnings    ?? [],
          tips:        data.scan.tips        ?? item.tips        ?? [],
        });
      }
    } catch (err) {
      console.error('Detail load error:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // ── List item ──────────────────────────────────────────

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const safeScore = item.score ?? 0;
    const color     = scoreColor(safeScore);

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={() => openDetail(item)}>
        <View style={styles.imageBox}>
          {item.products.image_url ? (
            <Image source={{ uri: item.products.image_url }} style={styles.productImage} resizeMode="contain" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Icon name="food-outline" size={28} color="#94a3b8" />
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.productName} numberOfLines={1}>{item.products.name}</Text>
          {item.products.brand && (
            <Text style={styles.productBrand} numberOfLines={1}>{item.products.brand}</Text>
          )}
          <View style={styles.dateRow}>
            <Feather name="clock" size={10} color="#94a3b8" />
            <Text style={styles.dateText}>{formatDate(item.scanned_at)}</Text>
          </View>
          <Text style={[styles.stars, { color }]}>{stars(safeScore)}</Text>
        </View>

        <View style={[styles.scoreBadge, { backgroundColor: color + '15', borderColor: color + '30', borderWidth: 1 }]}>
          <Text style={[styles.scoreGrade,  { color }]}>{scoreGrade(safeScore)}</Text>
          <Text style={[styles.scoreNumber, { color }]}>{safeScore}</Text>
          <Text style={[styles.scoreMax,    { color: color + '99' }]}>/100</Text>
          <Text style={[styles.scoreLabel,  { color }]}>{scoreLabel(safeScore)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const healthFilters: { key: Filter; label: string }[] = [
    { key: 'all',       label: 'All' },
    { key: 'healthy',   label: 'Healthy' },
    { key: 'unhealthy', label: 'Unhealthy' },
  ];

  const dateFilters: { key: DateFilter; label: string }[] = [
    { key: 'all',   label: 'All Time' },
    { key: 'today', label: 'Today' },
    { key: 'week',  label: 'This Week' },
    { key: 'month', label: 'This Month' },
  ];

  const floatTranslate1 = floatAnim1.interpolate({ inputRange: [0, 1], outputRange: [0, -15] });
  const floatTranslate2 = floatAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, -20] });
  const floatTranslate3 = floatAnim3.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });

  // ── Detail sheet content ───────────────────────────────

  const renderDetail = () => {
    if (!detail) return null;
    const safeScore = detail.score ?? 0;
    const color     = scoreColor(safeScore);
    const n         = detail.products.nutrients;

    // Show alternatives whenever backend provides them.
    // Scanner can show alternatives, but history was previously hiding them
    // if the saved `detail.score` wasn't < 60.
    const showAlts  = detail.alternatives.length > 0;
    const date      = formatDate(detail.scanned_at, 'long');

    return (
      <>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={hideSheet} activeOpacity={1} />
        </Animated.View>

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.sheetHandle} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>

            {/* ── Score banner ── */}
            <View style={[styles.scoreBanner, { backgroundColor: color + '12', borderColor: color + '30' }]}>
              <View style={styles.scoreBannerLeft}>
                <View style={styles.scoreLabelRow}>
                  <Text style={[styles.scoreBannerLabel, { color }]}>{scoreLabel(safeScore)}</Text>
                  <View style={[styles.gradePill, { backgroundColor: color }]}>
                    <Text style={styles.gradePillText}>{scoreGrade(safeScore)}</Text>
                  </View>
                </View>
                <Text style={[styles.stars, { color, fontSize: 16 }]}>{stars(safeScore)}</Text>
                <View style={styles.detailDateRow}>
                  <Feather name="calendar" size={11} color="#94a3b8" />
                  <Text style={styles.detailDate}>{date}</Text>
                </View>
              </View>
              <View style={[styles.scoreCircle, { borderColor: color }]}>
                <Text style={[styles.scoreCircleNumber, { color }]}>{safeScore}</Text>
                <Text style={[styles.scoreCircleMax, { color: color + '90' }]}>/100</Text>
              </View>
            </View>

            {/* ── Description ── */}
            {detail.description ? (
              <View style={styles.descriptionBox}>
                <Icon name="information-outline" size={16} color="#6366f1" />
                <Text style={styles.descriptionText}>{detail.description}</Text>
              </View>
            ) : null}

            {/* ── Warnings ── */}
            {detail.warnings && detail.warnings.length > 0 && (
              <View style={styles.warningsBox}>
                {detail.warnings.map((w, i) => (
                  <View key={i} style={styles.warningRow}>
                    <Icon name="alert-circle-outline" size={14} color="#dc2626" />
                    <Text style={styles.warningText}>{w}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* ── Tips ── */}
            {detail.tips && detail.tips.length > 0 && (
              <View style={styles.tipsBox}>
                {detail.tips.map((t, i) => (
                  <View key={i} style={styles.tipRow}>
                    <Icon name="lightbulb-outline" size={14} color="#0369a1" />
                    <Text style={styles.tipText}>{t}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* ── Product header ── */}
            <View style={styles.productHeader}>
              {detail.products.image_url ? (
                <Image source={{ uri: detail.products.image_url }} style={styles.detailImage} resizeMode="contain" />
              ) : (
                <View style={[styles.detailImage, styles.detailImagePlaceholder]}>
                  <Icon name="food-outline" size={32} color="#94a3b8" />
                </View>
              )}
              <View style={styles.productHeaderInfo}>
                <Text style={styles.detailName}>{detail.products.name}</Text>
                {detail.products.brand && (
                  <Text style={styles.detailBrand}>{detail.products.brand}</Text>
                )}
                {detail.products.category && (
                  <Text style={styles.detailCategory}>{detail.products.category}</Text>
                )}
                <View style={styles.barcodeChip}>
                  <Icon name="barcode" size={12} color="#64748b" />
                  <Text style={styles.barcodeText}>{detail.products.barcode}</Text>
                </View>
              </View>
            </View>

            {/* ── Nutrition ── */}
            {n ? (
              <View style={styles.sectionBox}>
                <Text style={styles.sectionTitle}>Nutrition per 100g</Text>
                <NutrientRow label="Calories"      value={n.energy_kcal}                                   unit="kcal" />
                <NutrientRow label="Sugar"         value={n.sugar_g}                                       unit="g" />
                <NutrientRow label="Sodium"        value={n.sodium_mg != null ? n.sodium_mg / 1000 : null} unit="g" />
                <NutrientRow label="Saturated fat" value={n.saturated_fat_g}                               unit="g" />
                <NutrientRow label="Fibre"         value={n.fiber_g}                                       unit="g" />
                <NutrientRow label="Protein"       value={n.protein_g}                                     unit="g" />
                {n.nova_group != null && (
                  <View style={styles.nutriRow}>
                    <Text style={styles.nutriLabel}>NOVA group</Text>
                    <Text style={[styles.nutriValue, {
                      color: n.nova_group === 4 ? '#dc2626'
                           : n.nova_group === 3 ? '#ea580c'
                           : '#16a34a',
                    }]}>
                      {n.nova_group} / 4
                    </Text>
                  </View>
                )}
                {n.additives_count != null && n.additives_count > 0 && (
                  <View style={styles.nutriRow}>
                    <Text style={styles.nutriLabel}>Additives</Text>
                    <Text style={[styles.nutriValue, { color: n.additives_count > 5 ? '#dc2626' : '#ea580c' }]}>
                      {n.additives_count}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.sectionBox}>
                <Text style={styles.sectionTitle}>Nutrition per 100g</Text>
                <Text style={styles.noDataText}>No nutrition data available for this product.</Text>
              </View>
            )}

            {/* ── Alternatives loading ── */}
            {detailLoading && (
              <View style={styles.altLoadingRow}>
                <ActivityIndicator size="small" color="#10b981" />
                <Text style={styles.altLoadingText}>Loading alternatives…</Text>
              </View>
            )}

            {/* ── Alternatives ── */}
            {showAlts && (
              <View style={styles.altSection}>
                <View style={styles.altHeader}>
                  <Icon name="leaf" size={16} color="#10b981" />
                  <Text style={styles.altTitle}>Healthier Alternatives</Text>
                </View>
                <Text style={styles.altSubtitle}>Same category, better score — tap to scan:</Text>
                {detail.alternatives.map(alt => (
                  <TouchableOpacity
                    key={alt.barcode}
                    style={styles.altCard}
                    activeOpacity={0.75}
                    onPress={() => { hideSheet(); router.push(`/scanner?barcode=${alt.barcode}`); }}
                  >
                    {alt.image_url ? (
                      <Image source={{ uri: alt.image_url }} style={styles.altImage} resizeMode="contain" />
                    ) : (
                      <View style={[styles.altImage, styles.altImagePlaceholder]}>
                        <Icon name="food-outline" size={20} color="#94a3b8" />
                      </View>
                    )}
                    <View style={styles.altInfo}>
                      <Text style={styles.altName} numberOfLines={2}>{alt.name}</Text>
                      {alt.brand  && <Text style={styles.altBrand}>{alt.brand}</Text>}
                      {alt.reason && <Text style={styles.altReason} numberOfLines={2}>{alt.reason}</Text>}
                    </View>
                    <View style={styles.altScoreBadge}>
                      <Text style={styles.altGrade}>{alt.grade}</Text>
                      <Text style={styles.altScore}>{alt.score}</Text>
                      <Icon name="chevron-right" size={14} color="#10b981" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={hideSheet} activeOpacity={0.8}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>

          </ScrollView>
        </Animated.View>
      </>
    );
  };

  // ── Render ─────────────────────────────────────────────

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

      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan History</Text>
          <View style={styles.headerRight}>
            {!isOnline && (
              <View style={styles.offlineBadge}>
                <Icon name="wifi-off" size={12} color="#92400e" />
                <Text style={styles.offlineBadgeText}>Offline</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.filterRow}>
          {healthFilters.map(f => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            >
              <Text style={[styles.filterTabText, filter === f.key && styles.filterTabTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Feather name="search" size={16} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products, brands…"
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dateFilterScroll}
          contentContainerStyle={styles.dateFilterContent}
        >
          {dateFilters.map(d => (
            <TouchableOpacity
              key={d.key}
              onPress={() => setDateFilter(d.key)}
              style={[styles.dateChip, dateFilter === d.key && styles.dateChipActive]}
            >
              <Text style={[styles.dateChipText, dateFilter === d.key && styles.dateChipTextActive]}>
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#10b981" />
          </View>
        ) : filteredHistory.length === 0 ? (
          <View style={styles.centered}>
            <Icon name={isFiltering ? 'magnify' : 'history'} size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>
              {isFiltering ? 'No results found' : 'No scans yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {isFiltering
                ? 'Try a different search or date range'
                : 'Scan a product to see your history here'}
            </Text>
            {!isFiltering && (
              <TouchableOpacity style={styles.scanNowBtn} onPress={() => router.push('/scanner')}>
                <LinearGradient colors={['#10b981', '#059669']} style={styles.scanNowGradient}>
                  <Icon name="camera" size={18} color="#fff" />
                  <Text style={styles.scanNowText}>Scan Now</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredHistory}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadHistory(true)}
                tintColor="#10b981"
                colors={['#10b981']}
              />
            }
          />
        )}

        {detail && renderDetail()}
      </SafeAreaView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#f8fafc' },
  absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  container:    { flex: 1 },

  floatingCircle1: { position: 'absolute', width: 250, height: 250, borderRadius: 125, top: '5%', right: -80 },
  floatingCircle2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, bottom: '30%', left: -60 },
  floatingCircle3: { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: '60%', right: -50 },
  floatingCircleGradient: { width: '100%', height: '100%', borderRadius: 125 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingBottom: 12,
    backgroundColor: 'transparent',
  },
  backBtn:          { padding: 4, marginRight: 12 },
  headerTitle:      { flex: 1, fontSize: 18, fontWeight: '700', color: '#0f172a' },
  headerRight:      { width: 60, alignItems: 'flex-end' },
  offlineBadge:     { flexDirection: 'row', backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, gap: 4, alignItems: 'center' },
  offlineBadgeText: { fontSize: 11, fontWeight: '600', color: '#92400e' },

  filterRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 8, backgroundColor: 'transparent' },
  filterTab: { flex: 1, paddingVertical: 8, borderRadius: 99, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, backgroundColor: '#f1f5f9' },
  filterTabActive:     { backgroundColor: '#10b981' },
  filterTabText:       { fontSize: 13, fontWeight: '600', color: '#64748b' },
  filterTabTextActive: { color: '#fff' },

  searchRow: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'transparent' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0f172a', padding: 0 },

  dateFilterScroll:  { backgroundColor: 'transparent', maxHeight: 52 },
  dateFilterContent: { paddingHorizontal: 16, paddingBottom: 12, gap: 8, alignItems: 'center' },
  dateChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1,
  },
  dateChipActive:     { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  dateChipText:       { fontSize: 12, fontWeight: '600', color: '#64748b' },
  dateChipTextActive: { color: '#fff' },

  listContent: { padding: 16, gap: 12 },

  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16, padding: 12, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  imageBox:         { width: 60, height: 60 },
  productImage:     { width: 60, height: 60, borderRadius: 10 },
  imagePlaceholder: { width: 60, height: 60, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },

  cardBody:     { flex: 1 },
  productName:  { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  productBrand: { fontSize: 12, color: '#64748b', marginTop: 2 },
  dateRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  dateText:     { fontSize: 11, color: '#94a3b8' },
  stars:        { fontSize: 13, marginTop: 4, letterSpacing: 1 },

  scoreBadge:  { alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, minWidth: 68 },
  scoreGrade:  { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  scoreNumber: { fontSize: 22, fontWeight: '800', lineHeight: 26 },
  scoreMax:    { fontSize: 10, fontWeight: '600', lineHeight: 12 },
  scoreLabel:  { fontSize: 10, fontWeight: '600', marginTop: 3 },

  centered:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle:      { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 6, marginTop: 12 },
  emptySubtitle:   { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24 },
  scanNowBtn:      { borderRadius: 12, overflow: 'hidden' },
  scanNowGradient: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 28, paddingVertical: 14 },
  scanNowText:     { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Sheet
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: height * 0.92,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 20,
  },
  sheetHandle:  { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Score banner
  scoreBanner:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, padding: 16, marginTop: 12, marginBottom: 8, borderWidth: 1 },
  scoreBannerLeft:  { flex: 1, gap: 6 },
  scoreLabelRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreBannerLabel: { fontSize: 17, fontWeight: '800' },
  gradePill:        { borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10 },
  gradePillText:    { fontSize: 12, fontWeight: '800', color: '#fff' },
  detailDateRow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailDate:       { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  scoreCircle:      { width: 64, height: 64, borderRadius: 32, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  scoreCircleNumber:{ fontSize: 24, fontWeight: '900', lineHeight: 26 },
  scoreCircleMax:   { fontSize: 10, fontWeight: '600' },

  // Description
  descriptionBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#eef2ff', borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#c7d2fe',
  },
  descriptionText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 19, fontWeight: '400' },

  // Warnings
  warningsBox: {
    backgroundColor: '#fef2f2', borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#fecaca', gap: 6,
  },
  warningRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  warningText: { flex: 1, fontSize: 12, color: '#dc2626', fontWeight: '500', lineHeight: 17 },

  // Tips
  tipsBox: {
    backgroundColor: '#eff6ff', borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#bfdbfe', gap: 6,
  },
  tipRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tipText: { flex: 1, fontSize: 12, color: '#0369a1', fontWeight: '500', lineHeight: 17 },

  // Product header
  productHeader:          { flexDirection: 'row', gap: 14, paddingVertical: 16, alignItems: 'flex-start' },
  detailImage:            { width: 80, height: 80, borderRadius: 12, backgroundColor: '#f1f5f9' },
  detailImagePlaceholder: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  productHeaderInfo:      { flex: 1, gap: 4 },
  detailName:     { fontSize: 17, fontWeight: '800', color: '#1e293b', lineHeight: 22 },
  detailBrand:    { fontSize: 13, color: '#64748b', fontWeight: '600' },
  detailCategory: { fontSize: 12, color: '#94a3b8', fontWeight: '500', textTransform: 'capitalize' },
  barcodeChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f1f5f9', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10, alignSelf: 'flex-start', marginTop: 4 },
  barcodeText:    { fontSize: 11, color: '#64748b', fontWeight: '500' },

  // Nutrition
  sectionBox:   { backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginBottom: 12 },
  nutriRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  nutriLabel:   { fontSize: 13, color: '#475569', fontWeight: '500' },
  nutriValue:   { fontSize: 13, color: '#1e293b', fontWeight: '700' },
  noDataText:   { fontSize: 13, color: '#94a3b8', fontStyle: 'italic' },

  altLoadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  altLoadingText: { fontSize: 13, color: '#64748b' },

  // Alternatives
  altSection:  { backgroundColor: '#f0fdf4', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#bbf7d0' },
  altHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  altTitle:    { fontSize: 14, fontWeight: '800', color: '#166534' },
  altSubtitle: { fontSize: 12, color: '#16a34a', marginBottom: 12, fontWeight: '500' },
  altCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#dcfce7' },
  altImage:            { width: 48, height: 48, borderRadius: 8, backgroundColor: '#f1f5f9' },
  altImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  altInfo:   { flex: 1 },
  altName:   { fontSize: 13, fontWeight: '700', color: '#1e293b', lineHeight: 18 },
  altBrand:  { fontSize: 11, color: '#64748b', fontWeight: '500', marginTop: 2 },
  altReason: { fontSize: 11, color: '#16a34a', fontWeight: '500', marginTop: 3, lineHeight: 15 },
  altScoreBadge: { alignItems: 'center', flexDirection: 'row', gap: 2, backgroundColor: '#dcfce7', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 8 },
  altGrade: { fontSize: 11, fontWeight: '800', color: '#16a34a' },
  altScore: { fontSize: 13, fontWeight: '800', color: '#16a34a' },

  closeBtn:     { marginTop: 4, backgroundColor: '#f1f5f9', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  closeBtnText: { fontSize: 15, fontWeight: '700', color: '#475569' },
});