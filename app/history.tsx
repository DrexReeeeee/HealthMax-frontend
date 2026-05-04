import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { apiFetch } from './utils/api';
import { getLocalScans, isLoggedIn, LocalScan } from './utils/storage';

type Filter = 'all' | 'healthy' | 'unhealthy';

interface HistoryItem {
  id: string;
  score: number;
  scanned_at: string;
  products: {
    barcode: string;
    name: string;
    brand?: string;
    category?: string;
    image_url?: string;
  };
}

function scoreColor(score: number) {
  if (score >= 4) return '#10b981';
  if (score === 3) return '#f59e0b';
  return '#ef4444';
}

function scoreLabel(score: number) {
  if (score >= 4) return 'Healthy';
  if (score === 3) return 'Moderate';
  return 'Unhealthy';
}

function stars(score: number) {
  return '★'.repeat(score) + '☆'.repeat(5 - score);
}

export default function History() {
  const [filter, setFilter] = useState<Filter>('all');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [filter]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const loggedIn = await isLoggedIn();
      setIsOnline(loggedIn);

      if (loggedIn) {
        // ── Online: fetch from backend ──
        const { ok, data } = await apiFetch(
          `/api/history?filter=${filter}`,
          { method: 'GET' },
          true
        );

        if (ok && data.history) {
          setHistory(data.history);
        } else {
          setHistory([]);
        }
      } else {
        // ── Offline: read from local storage ──
        const localScans = await getLocalScans();

        // Convert local scan format to match HistoryItem shape
        const converted: HistoryItem[] = localScans
          .filter(s => {
            if (filter === 'healthy') return s.score >= 4;
            if (filter === 'unhealthy') return s.score <= 2;
            return true;
          })
          .map((s, i) => ({
            id: `local_${i}`,
            score: s.score,
            scanned_at: s.date,
            products: {
              barcode: s.barcode,
              name: s.name,
              brand: s.brand,
              category: s.category,
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
    }
  };

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const color = scoreColor(item.score);
    const date = new Date(item.scanned_at).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return (
      <View style={styles.card}>
        {/* Product Image */}
        <View style={styles.imageBox}>
          {item.products.image_url ? (
            <Image
              source={{ uri: item.products.image_url }}
              style={styles.productImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>📦</Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.cardBody}>
          <Text style={styles.productName} numberOfLines={1}>
            {item.products.name}
          </Text>
          {item.products.brand ? (
            <Text style={styles.productBrand} numberOfLines={1}>
              {item.products.brand}
            </Text>
          ) : null}
          <Text style={styles.dateText}>{date}</Text>

          {/* Stars */}
          <Text style={[styles.stars, { color }]}>{stars(item.score)}</Text>
        </View>

        {/* Score Badge */}
        <View style={[styles.scoreBadge, { backgroundColor: color + '18' }]}>
          <Text style={[styles.scoreNumber, { color }]}>{item.score}</Text>
          <Text style={[styles.scoreLabel, { color }]}>{scoreLabel(item.score)}</Text>
        </View>
      </View>
    );
  };

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'healthy', label: '✅ Healthy' },
    { key: 'unhealthy', label: '❌ Unhealthy' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan History</Text>
        <View style={styles.headerRight}>
          {!isOnline && (
            <View style={styles.offlineBadge}>
              <Text style={styles.offlineBadgeText}>Offline</Text>
            </View>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === f.key && styles.filterTabTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      ) : history.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🕐</Text>
          <Text style={styles.emptyTitle}>No scans yet</Text>
          <Text style={styles.emptySubtitle}>
            Scan a product to see your history here
          </Text>
          <TouchableOpacity
            style={styles.scanNowBtn}
            onPress={() => router.push('/scanner')}
          >
            <Text style={styles.scanNowText}>Scan Now</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#0f172a' },
  headerRight: { width: 60, alignItems: 'flex-end' },
  offlineBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  offlineBadgeText: { fontSize: 11, fontWeight: '600', color: '#92400e' },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#fff',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 99,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  filterTabActive: { backgroundColor: '#10b981' },
  filterTabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  filterTabTextActive: { color: '#fff' },

  listContent: { padding: 16, gap: 12 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  imageBox: { width: 60, height: 60 },
  productImage: { width: 60, height: 60, borderRadius: 10 },
  imagePlaceholder: {
    width: 60, height: 60, borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
  },
  imagePlaceholderText: { fontSize: 28 },
  cardBody: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  productBrand: { fontSize: 12, color: '#64748b', marginTop: 2 },
  dateText: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  stars: { fontSize: 14, marginTop: 4, letterSpacing: 1 },
  scoreBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 64,
  },
  scoreNumber: { fontSize: 22, fontWeight: '800' },
  scoreLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24 },
  scanNowBtn: {
    backgroundColor: '#10b981', borderRadius: 12,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  scanNowText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});