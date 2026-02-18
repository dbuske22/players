import { api } from '@/lib/api';
import { THEME } from '@/lib/theme';
import type { Build, Position } from '@/lib/types';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

const POSITIONS: (Position | 'ALL')[] = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C'];
const SORTS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Top Rated', value: 'rating' },
  { label: 'Price ↑', value: 'price_asc' },
  { label: 'Price ↓', value: 'price_desc' },
];

const POSITION_COLORS: Record<Position, string> = {
  PG: '#7C3AED',
  SG: '#2563EB',
  SF: '#059669',
  PF: '#D97706',
  C:  '#DC2626',
};

function ratingColor(r: number) {
  if (r >= 95) return '#FFD700';
  if (r >= 90) return '#22C55E';
  if (r >= 85) return '#3B82F6';
  return '#94A3B8';
}

function BuildCard({ build, theme }: { build: Build; theme: typeof THEME.light }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/build/${build.id}`)}
      style={{
        backgroundColor: theme.card,
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.border,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}>
      {/* Header bar */}
      <View
        style={{
          backgroundColor: POSITION_COLORS[build.position],
          paddingHorizontal: 16,
          paddingVertical: 10,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.25)',
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{build.position}</Text>
          </View>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{build.name}</Text>
        </View>
        <View
          style={{
            backgroundColor: ratingColor(build.overallRating),
            borderRadius: 20,
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ color: '#000', fontWeight: '900', fontSize: 15 }}>{build.overallRating}</Text>
        </View>
      </View>

      {/* Body */}
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <View>
            <Text style={{ color: theme.mutedForeground, fontSize: 11, marginBottom: 2 }}>ARCHETYPE</Text>
            <Text style={{ color: theme.foreground, fontWeight: '600', fontSize: 13 }}>{build.archetype}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: theme.mutedForeground, fontSize: 11, marginBottom: 2 }}>HEIGHT / WT</Text>
            <Text style={{ color: theme.foreground, fontWeight: '600', fontSize: 13 }}>
              {build.height} · {build.weight} lbs
            </Text>
          </View>
        </View>

        {/* Key stats */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          {[
            { label: '3PT', val: build.attributes.threePointer },
            { label: 'BH', val: build.attributes.ballHandling },
            { label: 'SPD', val: build.attributes.speed },
            { label: 'DEF', val: build.attributes.perimeterDefense },
            { label: 'BLK', val: build.attributes.block },
          ].map((s) => (
            <View
              key={s.label}
              style={{
                flex: 1,
                backgroundColor: theme.muted,
                borderRadius: 8,
                alignItems: 'center',
                paddingVertical: 6,
              }}>
              <Text style={{ color: theme.mutedForeground, fontSize: 10, marginBottom: 2 }}>{s.label}</Text>
              <Text style={{ color: theme.foreground, fontWeight: '700', fontSize: 14 }}>{s.val}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>by {build.sellerName}</Text>
          <Text style={{ color: '#7C3AED', fontWeight: '800', fontSize: 18 }}>
            {build.price.toLocaleString()} VC
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function MarketplaceScreen() {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];

  const [builds, setBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [position, setPosition] = useState<Position | 'ALL'>('ALL');
  const [sort, setSort] = useState('newest');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.getBuilds({
        position: position === 'ALL' ? undefined : position,
        sort,
      });
      setBuilds(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [position, sort]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const filtered = search.trim()
    ? builds.filter(
        (b) =>
          b.name.toLowerCase().includes(search.toLowerCase()) ||
          b.archetype.toLowerCase().includes(search.toLowerCase()) ||
          b.sellerName.toLowerCase().includes(search.toLowerCase())
      )
    : builds;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: '#7C3AED',
          paddingTop: 56,
          paddingBottom: 16,
          paddingHorizontal: 20,
        }}>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 26 }}>2K26 Marketplace</Text>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 }}>
          Buy & sell elite builds
        </Text>

        {/* Search */}
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: 12,
            marginTop: 14,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
          }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, marginRight: 6 }}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search builds, archetypes..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            style={{ flex: 1, color: '#fff', paddingVertical: 10, fontSize: 14 }}
          />
        </View>
      </View>

      {/* Position filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
        {POSITIONS.map((p) => (
          <Pressable
            key={p}
            onPress={() => setPosition(p)}
            style={{
              backgroundColor: position === p ? '#7C3AED' : theme.muted,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 7,
            }}>
            <Text
              style={{
                color: position === p ? '#fff' : theme.mutedForeground,
                fontWeight: '700',
                fontSize: 13,
              }}>
              {p}
            </Text>
          </Pressable>
        ))}
        <View style={{ width: 1, backgroundColor: theme.border, marginHorizontal: 4 }} />
        {SORTS.map((s) => (
          <Pressable
            key={s.value}
            onPress={() => setSort(s.value)}
            style={{
              backgroundColor: sort === s.value ? '#1E1B4B' : theme.muted,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 7,
            }}>
            <Text
              style={{
                color: sort === s.value ? '#fff' : theme.mutedForeground,
                fontWeight: '600',
                fontSize: 12,
              }}>
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
          data={filtered}
          keyExtractor={(b) => b.id}
          renderItem={({ item }) => <BuildCard build={item} theme={theme} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🏀</Text>
              <Text style={{ color: theme.foreground, fontSize: 18, fontWeight: '700' }}>No builds found</Text>
              <Text style={{ color: theme.mutedForeground, fontSize: 14, marginTop: 6 }}>
                Try adjusting your filters
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
