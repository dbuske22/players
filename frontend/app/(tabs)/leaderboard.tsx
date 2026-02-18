import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { useAuthStore } from '@/lib/store';

const BASE_URL = (() => {
  if (typeof window !== 'undefined') {
    const isVercel = !window.location.hostname.includes('localhost') && !window.location.hostname.includes('orchids.cloud');
    return isVercel ? '/api' : (process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3002');
  }
  return process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3002';
})();

const GAME_FILTERS = [
  { label: 'All Sports', value: '' },
  { label: '🏀 Basketball', value: 'basketball' },
  { label: '🏈 Football', value: 'football' },
  { label: '🏒 Hockey', value: 'hockey' },
];

const GAME_COLORS: Record<string, string> = {
  basketball: '#F97316',
  football: '#10B981',
  hockey: '#3B82F6',
};

const MEDAL = ['🥇', '🥈', '🥉'];

type LeaderboardEntry = {
  id: string;
  rank: number;
  title: string;
  game_type: string;
  position: string;
  archetype: string;
  price: number;
  view_count: number;
  sales_count: number;
  avg_rating: number | null;
  performance: Record<string, number | string>;
  seller: { username: string; avatar_url?: string } | null;
};

export default function LeaderboardScreen() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gameFilter, setGameFilter] = useState('');

  const load = useCallback(async () => {
    try {
      const q = gameFilter ? `?game_type=${gameFilter}` : '';
      const res = await fetch(`${BASE_URL}/leaderboard${q}`);
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gameFilter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      {/* Header */}
      <View style={{ backgroundColor: '#1E1B4B', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20 }}>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 24, marginBottom: 2 }}>🏆 Leaderboard</Text>
        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>Top-ranked builds by sales & popularity</Text>
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}
        style={{ backgroundColor: t.background, borderBottomWidth: 1, borderBottomColor: t.border, maxHeight: 56 }}
      >
        {GAME_FILTERS.map((f) => (
          <Pressable
            key={f.value}
            onPress={() => setGameFilter(f.value)}
            style={{
              borderRadius: 20, paddingHorizontal: 16, height: 36,
              justifyContent: 'center', alignItems: 'center',
              backgroundColor: gameFilter === f.value ? '#1E1B4B' : t.muted,
            }}>
            <Text style={{ color: gameFilter === f.value ? '#fff' : t.mutedForeground, fontWeight: '700', fontSize: 13 }}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#7C3AED" />}
        >
          {entries.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>🏆</Text>
              <Text style={{ color: t.foreground, fontSize: 18, fontWeight: '700' }}>No builds yet</Text>
              <Text style={{ color: t.mutedForeground, fontSize: 14, marginTop: 6 }}>Be the first to list a build!</Text>
              {user && (
                <Pressable
                  onPress={() => router.push('/(tabs)/sell')}
                  style={{ marginTop: 16, backgroundColor: '#7C3AED', borderRadius: 12, padding: 14, paddingHorizontal: 24 }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>List a Build →</Text>
                </Pressable>
              )}
            </View>
          ) : (
            entries.map((entry) => {
              const gameColor = GAME_COLORS[entry.game_type] || '#7C3AED';
              const medal = MEDAL[entry.rank - 1] || null;
              return (
                <Pressable
                  key={entry.id}
                  onPress={() => router.push(`/build/${entry.id}`)}
                  style={{
                    backgroundColor: t.card, borderRadius: 16, marginBottom: 12,
                    borderWidth: 1, borderColor: entry.rank <= 3 ? gameColor + '60' : t.border,
                    overflow: 'hidden',
                    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
                  }}>
                  {/* Color bar */}
                  <View style={{ height: 4, backgroundColor: gameColor }} />

                  <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {/* Rank */}
                    <View style={{ alignItems: 'center', width: 40 }}>
                      {medal ? (
                        <Text style={{ fontSize: 28 }}>{medal}</Text>
                      ) : (
                        <View style={{ backgroundColor: t.muted, borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: t.mutedForeground, fontWeight: '800', fontSize: 14 }}>#{entry.rank}</Text>
                        </View>
                      )}
                    </View>

                    {/* Main info */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <View style={{ backgroundColor: gameColor + '20', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: gameColor, fontSize: 10, fontWeight: '700' }}>
                            {entry.game_type === 'basketball' ? '🏀' : entry.game_type === 'football' ? '🏈' : '🏒'} {entry.position.toUpperCase()}
                          </Text>
                        </View>
                        {entry.avg_rating && (
                          <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: '700' }}>★ {entry.avg_rating}</Text>
                        )}
                      </View>
                      <Text style={{ color: t.foreground, fontWeight: '800', fontSize: 15 }} numberOfLines={1}>
                        {entry.title}
                      </Text>
                      <Text style={{ color: t.mutedForeground, fontSize: 12, marginTop: 2 }}>
                        {entry.archetype} • by {entry.seller?.username ?? 'Unknown'}
                      </Text>
                    </View>

                    {/* Stats */}
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={{ color: '#7C3AED', fontWeight: '900', fontSize: 16 }}>${entry.price.toFixed(2)}</Text>
                      <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '600' }}>{entry.sales_count} sold</Text>
                      <Text style={{ color: t.mutedForeground, fontSize: 11 }}>{entry.view_count} views</Text>
                    </View>
                  </View>

                  {/* Performance mini-bar */}
                  {entry.performance && (
                    <View style={{ paddingHorizontal: 14, paddingBottom: 12, flexDirection: 'row', gap: 6 }}>
                      {(['speed', 'shooting', 'defense', 'playmaking', 'athleticism'] as const).map((key) => {
                        const val = entry.performance[key] as number | undefined;
                        if (!val) return null;
                        const barColor = val >= 85 ? '#10B981' : val >= 70 ? '#3B82F6' : '#F59E0B';
                        return (
                          <View key={key} style={{ flex: 1, alignItems: 'center' }}>
                            <View style={{ height: 3, backgroundColor: t.muted, borderRadius: 2, width: '100%', marginBottom: 3 }}>
                              <View style={{ height: 3, backgroundColor: barColor, borderRadius: 2, width: `${val}%` }} />
                            </View>
                            <Text style={{ color: t.mutedForeground, fontSize: 9 }}>{key.slice(0, 3).toUpperCase()}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}
