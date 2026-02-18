import { api } from '@/lib/api';
import { THEME } from '@/lib/theme';
import type { Build, Position, Purchase } from '@/lib/types';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';

const CURRENT_USER = { id: 'user1', name: 'MyPlayer2K' };

const POSITION_COLORS: Record<Position, string> = {
  PG: '#7C3AED', SG: '#2563EB', SF: '#059669', PF: '#D97706', C: '#DC2626',
};

function ratingColor(r: number) {
  if (r >= 95) return '#FFD700';
  if (r >= 90) return '#22C55E';
  if (r >= 85) return '#3B82F6';
  return '#94A3B8';
}

function ListingCard({
  build,
  theme,
  onDelete,
}: {
  build: Build;
  theme: typeof THEME.light;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/build/${build.id}`)}
      style={{
        backgroundColor: theme.card,
        borderRadius: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.border,
        overflow: 'hidden',
      }}>
      <View
        style={{
          backgroundColor: POSITION_COLORS[build.position],
          paddingHorizontal: 14,
          paddingVertical: 10,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.25)',
              borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
            }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{build.position}</Text>
          </View>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{build.name}</Text>
        </View>
        <View
          style={{
            backgroundColor: ratingColor(build.overallRating),
            borderRadius: 20, width: 36, height: 36,
            alignItems: 'center', justifyContent: 'center',
          }}>
          <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>{build.overallRating}</Text>
        </View>
      </View>

      <View style={{ padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>{build.archetype}</Text>
          <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
            {build.height} · {build.weight} lbs
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <Text style={{ color: '#7C3AED', fontWeight: '800', fontSize: 16 }}>
            {build.price.toLocaleString()} VC
          </Text>
          {build.sold ? (
            <View
              style={{
                backgroundColor: '#FEF3C7',
                borderRadius: 6,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}>
              <Text style={{ color: '#92400E', fontWeight: '700', fontSize: 11 }}>SOLD</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                Alert.alert('Remove Listing', `Remove "${build.name}" from the marketplace?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => onDelete(build.id) },
                ]);
              }}
              style={{
                backgroundColor: '#FEE2E2',
                borderRadius: 6,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}>
              <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 11 }}>REMOVE</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function PurchaseCard({ purchase, theme }: { purchase: Purchase; theme: typeof THEME.light }) {
  const router = useRouter();
  const build = purchase.build;
  if (!build) return null;
  return (
    <Pressable
      onPress={() => router.push(`/build/${build.id}`)}
      style={{
        backgroundColor: theme.card,
        borderRadius: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.border,
        overflow: 'hidden',
      }}>
      <View
        style={{
          backgroundColor: POSITION_COLORS[build.position],
          paddingHorizontal: 14,
          paddingVertical: 10,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.25)',
              borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
            }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{build.position}</Text>
          </View>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{build.name}</Text>
        </View>
        <View
          style={{
            backgroundColor: ratingColor(build.overallRating),
            borderRadius: 20, width: 36, height: 36,
            alignItems: 'center', justifyContent: 'center',
          }}>
          <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>{build.overallRating}</Text>
        </View>
      </View>
      <View style={{ padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>{build.archetype}</Text>
          <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>by {build.sellerName}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: theme.foreground, fontWeight: '700', fontSize: 14 }}>
            Paid {purchase.price.toLocaleString()} VC
          </Text>
          <Text style={{ color: theme.mutedForeground, fontSize: 11, marginTop: 2 }}>
            {new Date(purchase.purchasedAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function MyBuildsScreen() {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];

  const [tab, setTab] = useState<'listings' | 'purchases'>('listings');
  const [listings, setListings] = useState<Build[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [myListings, myPurchases] = await Promise.all([
        api.getMyListings(CURRENT_USER.id),
        api.getMyPurchases(CURRENT_USER.id),
      ]);
      setListings(myListings);
      setPurchases(myPurchases);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteBuild(id);
      setListings((prev) => prev.filter((b) => b.id !== id));
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to remove listing');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ backgroundColor: '#7C3AED', paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 }}>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 26 }}>My Builds</Text>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 }}>
          Your listings and purchases
        </Text>

        {/* Tab switcher */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: 10,
            marginTop: 14,
            padding: 4,
          }}>
          {(['listings', 'purchases'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={{
                flex: 1,
                backgroundColor: tab === t ? '#fff' : 'transparent',
                borderRadius: 8,
                paddingVertical: 8,
                alignItems: 'center',
              }}>
              <Text
                style={{
                  color: tab === t ? '#7C3AED' : 'rgba(255,255,255,0.8)',
                  fontWeight: '700',
                  fontSize: 14,
                }}>
                {t === 'listings' ? `My Listings (${listings.length})` : `Purchased (${purchases.length})`}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : tab === 'listings' ? (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ListingCard build={item} theme={theme} onDelete={handleDelete} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
              <Text style={{ color: theme.foreground, fontSize: 18, fontWeight: '700' }}>No listings yet</Text>
              <Text style={{ color: theme.mutedForeground, fontSize: 14, marginTop: 6, textAlign: 'center' }}>
                Head to Sell Build to list your first build
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={purchases}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PurchaseCard purchase={item} theme={theme} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🛒</Text>
              <Text style={{ color: theme.foreground, fontSize: 18, fontWeight: '700' }}>No purchases yet</Text>
              <Text style={{ color: theme.mutedForeground, fontSize: 14, marginTop: 6, textAlign: 'center' }}>
                Browse the marketplace to find builds
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
