import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput,
  FlatList, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { buildsApi, statsApi } from '@/lib/api';
import { calcCompatibility, getMatchColor } from '@/lib/compatibility';
import { useAuthStore } from '@/lib/store';
import type { Build, GameType } from '@/lib/types';

const GAME_TYPES: { label: string; value: GameType | 'all'; icon: string }[] = [
  { label: 'All', value: 'all', icon: '🏆' },
  { label: 'Basketball', value: 'basketball', icon: '🏀' },
  { label: 'Football', value: 'football', icon: '🏈' },
  { label: 'Hockey', value: 'hockey', icon: '🏒' },
];

const SORTS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Popular', value: 'popular' },
  { label: 'Price ↑', value: 'price_asc' },
  { label: 'Price ↓', value: 'price_desc' },
];

const GAME_COLORS: Record<string, string> = {
  basketball: '#F97316',
  football: '#10B981',
  hockey: '#3B82F6',
};

function BuildCard({ build, user }: { build: Build; user: ReturnType<typeof useAuthStore.getState>['user'] }) {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme ?? 'light'];
  const router = useRouter();

  const compat = user && user.playstyle_vector ? calcCompatibility(user, build) : null;
  const matchColor = compat ? getMatchColor(compat.score) : '#94A3B8';
  const gameColor = GAME_COLORS[build.game_type] || '#7C3AED';

  return (
    <Pressable
      onPress={() => router.push(`/build/${build.id}`)}
      style={{
        backgroundColor: t.card, borderRadius: 16, marginBottom: 14,
        borderWidth: 1, borderColor: t.border,
        shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
        overflow: 'hidden',
      }}>
      {/* Top bar */}
      <View style={{ backgroundColor: gameColor, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            {build.featured && (
              <View style={{ backgroundColor: '#FFD700', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ color: '#000', fontSize: 10, fontWeight: '800' }}>FEATURED</Text>
              </View>
            )}
            <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{build.position.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }} numberOfLines={1}>{build.title}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{build.archetype} • by {build.seller?.username}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 20 }}>${build.price.toFixed(2)}</Text>
          {build.avg_rating && (
            <Text style={{ color: '#FFD700', fontSize: 12 }}>{'★'.repeat(Math.round(build.avg_rating))} {build.avg_rating}</Text>
          )}
        </View>
      </View>

      {/* Body */}
      <View style={{ padding: 12 }}>
        {/* Performance stats */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          {[
            { label: 'Win Rate', val: `${build.performance?.win_rate || 0}%` },
            { label: 'Efficiency', val: `${build.performance?.shot_efficiency || 0}%` },
            { label: 'Avg Grade', val: build.performance?.avg_grade || 'N/A' },
            { label: 'Mode', val: build.performance?.mode_played || 'N/A' },
          ].map((s) => (
            <View key={s.label} style={{ flex: 1, backgroundColor: t.muted, borderRadius: 8, padding: 7, alignItems: 'center' }}>
              <Text style={{ color: t.mutedForeground, fontSize: 9, marginBottom: 2 }}>{s.label.toUpperCase()}</Text>
              <Text style={{ color: t.foreground, fontWeight: '700', fontSize: 12 }} numberOfLines={1}>{s.val}</Text>
            </View>
          ))}
        </View>

        {/* Badges */}
        {build.badges?.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {build.badges.slice(0, 4).map((badge) => (
              <View key={badge} style={{ backgroundColor: '#EDE9FE', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: '#7C3AED', fontSize: 11, fontWeight: '600' }}>{badge}</Text>
              </View>
            ))}
            {build.badges.length > 4 && (
              <View style={{ backgroundColor: t.muted, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: t.mutedForeground, fontSize: 11 }}>+{build.badges.length - 4} more</Text>
              </View>
            )}
          </View>
        )}

        {/* Compatibility */}
        {compat && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: t.border }}>
            <View style={{ flex: 1 }}>
              <View style={{ height: 5, backgroundColor: t.muted, borderRadius: 3 }}>
                <View style={{ height: 5, backgroundColor: matchColor, borderRadius: 3, width: `${compat.score}%` }} />
              </View>
            </View>
            <Text style={{ color: matchColor, fontWeight: '800', fontSize: 13 }}>⭐ {compat.score}% Match</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function MarketplaceScreen() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme ?? 'light'];
  const user = useAuthStore((s) => s.user);

  const [builds, setBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gameType, setGameType] = useState<GameType | 'all'>('all');
  const [sort, setSort] = useState('newest');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<{ total_builds: number; total_users: number; total_sales: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const [data, s] = await Promise.all([
        buildsApi.list({
          game_type: gameType === 'all' ? undefined : gameType,
          sort,
          search: search || undefined,
        }),
        statsApi.get(),
      ]);
      setBuilds(data);
      setStats(s);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gameType, sort, search]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      {/* Header */}
      <View style={{ backgroundColor: '#7C3AED', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <View>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 24 }}>Sports Builds Market</Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 }}>
              {stats ? `${stats.total_builds} builds • ${stats.total_sales} sold` : 'Elite templates for every sport'}
            </Text>
          </View>
          {user?.playstyle_vector && (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>⚡ Scan Active</Text>
            </View>
          )}
        </View>
        {/* Search */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, marginRight: 6 }}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search builds, positions..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            style={{ flex: 1, color: '#fff', paddingVertical: 10, fontSize: 14 }}
          />
        </View>
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}>
        {GAME_TYPES.map((g) => (
          <Pressable
            key={g.value}
            onPress={() => setGameType(g.value)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: gameType === g.value ? '#7C3AED' : t.muted,
              borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
            }}>
            <Text style={{ fontSize: 13 }}>{g.icon}</Text>
            <Text style={{ color: gameType === g.value ? '#fff' : t.mutedForeground, fontWeight: '700', fontSize: 13 }}>{g.label}</Text>
          </Pressable>
        ))}
        <View style={{ width: 1, backgroundColor: t.border, marginHorizontal: 4 }} />
        {SORTS.map((s) => (
          <Pressable
            key={s.value}
            onPress={() => setSort(s.value)}
            style={{
              backgroundColor: sort === s.value ? '#1E1B4B' : t.muted,
              borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
            }}>
            <Text style={{ color: sort === s.value ? '#fff' : t.mutedForeground, fontWeight: '600', fontSize: 12 }}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <FlatList
          data={builds}
          keyExtractor={(b) => b.id}
          renderItem={({ item }) => <BuildCard build={item} user={user} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#7C3AED" />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>🏆</Text>
              <Text style={{ color: t.foreground, fontSize: 18, fontWeight: '700' }}>No builds found</Text>
              <Text style={{ color: t.mutedForeground, fontSize: 14, marginTop: 6 }}>Try adjusting your filters</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
