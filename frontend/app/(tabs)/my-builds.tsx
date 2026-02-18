import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, FlatList,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { purchasesApi, buildsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { Build, Purchase } from '@/lib/types';

const GAME_COLORS: Record<string, string> = {
  basketball: '#F97316',
  football: '#10B981',
  hockey: '#3B82F6',
};

const STATUS_COLORS: Record<string, string> = {
  active: '#10B981', pending: '#F59E0B', rejected: '#EF4444', sold: '#6B7280',
};

export default function MyBuildsScreen() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const { token, user } = useAuthStore();

  const [tab, setTab] = useState<'listings' | 'purchases'>('listings');
  const [myBuilds, setMyBuilds] = useState<Build[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const [b, p] = await Promise.all([
        purchasesApi.myBuilds(token),
        purchasesApi.myPurchases(token),
      ]);
      setMyBuilds(b);
      setPurchases(p);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (build: Build) => {
    Alert.alert('Remove Listing', `Remove "${build.title}" from marketplace?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await buildsApi.delete(token!, build.id);
            setMyBuilds((prev) => prev.filter((b) => b.id !== build.id));
          } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
          }
        },
      },
    ]);
  };

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: t.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: t.foreground, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Sign in to view your builds</Text>
        <Pressable onPress={() => router.push('/auth/login')} style={{ backgroundColor: '#7C3AED', borderRadius: 12, padding: 14, paddingHorizontal: 24 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      {/* Header */}
      <View style={{ backgroundColor: '#7C3AED', paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 }}>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 26 }}>My Builds</Text>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 }}>Your listings and purchases</Text>
        <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, marginTop: 14, padding: 4 }}>
          {(['listings', 'purchases'] as const).map((tb) => (
            <Pressable
              key={tb}
              onPress={() => setTab(tb)}
              style={{ flex: 1, backgroundColor: tab === tb ? '#fff' : 'transparent', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}>
              <Text style={{ color: tab === tb ? '#7C3AED' : 'rgba(255,255,255,0.8)', fontWeight: '700', fontSize: 13 }}>
                {tb === 'listings' ? `Listings (${myBuilds.length})` : `Purchased (${purchases.length})`}
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
          data={myBuilds}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#7C3AED" />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
              <Text style={{ color: t.foreground, fontSize: 18, fontWeight: '700' }}>No listings yet</Text>
              <Text style={{ color: t.mutedForeground, fontSize: 14, marginTop: 6, textAlign: 'center' }}>Head to the Sell tab to list your first build</Text>
              <Pressable onPress={() => router.push('/(tabs)/sell')} style={{ marginTop: 16, backgroundColor: '#7C3AED', borderRadius: 10, padding: 12, paddingHorizontal: 20 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Sell a Build →</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item: b }) => (
            <Pressable
              onPress={() => router.push(`/build/${b.id}`)}
              style={{ backgroundColor: t.card, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: t.border, overflow: 'hidden' }}>
              <View style={{ backgroundColor: GAME_COLORS[b.game_type] || '#7C3AED', padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }} numberOfLines={1}>{b.title}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{b.position} • {b.archetype}</Text>
                </View>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>${b.price.toFixed(2)}</Text>
              </View>
              <View style={{ padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ gap: 4 }}>
                  <View style={{ backgroundColor: `${STATUS_COLORS[b.status]}20`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
                    <Text style={{ color: STATUS_COLORS[b.status], fontWeight: '700', fontSize: 11, textTransform: 'uppercase' }}>{b.status}</Text>
                  </View>
                  <Text style={{ color: t.mutedForeground, fontSize: 11 }}>{b.view_count} views • {new Date(b.created_at).toLocaleDateString()}</Text>
                </View>
                {b.status !== 'sold' && (
                  <Pressable
                    onPress={() => handleDelete(b)}
                    style={{ backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 12 }}>Remove</Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={purchases}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#7C3AED" />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🛒</Text>
              <Text style={{ color: t.foreground, fontSize: 18, fontWeight: '700' }}>No purchases yet</Text>
              <Text style={{ color: t.mutedForeground, fontSize: 14, marginTop: 6, textAlign: 'center' }}>Browse the marketplace to find builds</Text>
            </View>
          }
          renderItem={({ item: p }) => {
            const b = p.build as Build | undefined;
            return (
              <Pressable
                onPress={() => b && router.push(`/build/${b.id}`)}
                style={{ backgroundColor: t.card, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: t.border, overflow: 'hidden' }}>
                <View style={{ backgroundColor: GAME_COLORS[b?.game_type ?? ''] || '#7C3AED', padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }} numberOfLines={1}>{b?.title ?? 'Unknown Build'}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{b?.position} • {b?.archetype}</Text>
                  </View>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>${p.amount.toFixed(2)}</Text>
                </View>
                <View style={{ padding: 12 }}>
                  {b?.import_code && (
                    <View style={{ backgroundColor: '#DCFCE7', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                      <Text style={{ color: '#6B7280', fontSize: 10, marginBottom: 2 }}>IMPORT CODE</Text>
                      <Text style={{ color: '#111', fontSize: 12, fontFamily: 'monospace' }} selectable>{b.import_code}</Text>
                    </View>
                  )}
                  <Text style={{ color: t.mutedForeground, fontSize: 11 }}>
                    Purchased {new Date(p.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
