import { api } from '@/lib/api';
import { THEME } from '@/lib/theme';
import type { Build, Purchase } from '@/lib/types';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

const CURRENT_USER = { id: 'user1', name: 'MyPlayer2K' };

export default function ProfileScreen() {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const router = useRouter();

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

  const totalEarned = listings
    .filter((b) => b.sold)
    .reduce((sum, b) => sum + b.price, 0);
  const totalSpent = purchases.reduce((sum, p) => sum + p.price, 0);
  const activeListings = listings.filter((b) => !b.sold).length;
  const soldBuilds = listings.filter((b) => b.sold).length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ backgroundColor: '#7C3AED', paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20 }}>
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: 'rgba(255,255,255,0.25)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
            }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 28 }}>
              {CURRENT_USER.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 22 }}>{CURRENT_USER.name}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 }}>2K26 Build Trader</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {loading ? (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <ActivityIndicator size="large" color="#7C3AED" />
          </View>
        ) : (
          <>
            {/* Stats grid */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Active Listings', value: activeListings, color: '#7C3AED' },
                { label: 'Builds Sold', value: soldBuilds, color: '#059669' },
              ].map((s) => (
                <View
                  key={s.label}
                  style={{
                    flex: 1,
                    backgroundColor: theme.card,
                    borderRadius: 14,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: theme.border,
                    alignItems: 'center',
                  }}>
                  <Text style={{ color: s.color, fontWeight: '900', fontSize: 28 }}>{s.value}</Text>
                  <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'VC Earned', value: totalEarned.toLocaleString(), color: '#F59E0B' },
                { label: 'VC Spent', value: totalSpent.toLocaleString(), color: '#DC2626' },
              ].map((s) => (
                <View
                  key={s.label}
                  style={{
                    flex: 1,
                    backgroundColor: theme.card,
                    borderRadius: 14,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: theme.border,
                    alignItems: 'center',
                  }}>
                  <Text style={{ color: s.color, fontWeight: '900', fontSize: 20 }}>{s.value}</Text>
                  <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 4 }}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Recent activity */}
            <Text style={{ color: theme.foreground, fontWeight: '800', fontSize: 18, marginBottom: 14 }}>
              Recent Purchases
            </Text>

            {purchases.length === 0 ? (
              <View
                style={{
                  backgroundColor: theme.muted,
                  borderRadius: 14,
                  padding: 24,
                  alignItems: 'center',
                }}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>🛒</Text>
                <Text style={{ color: theme.mutedForeground, fontSize: 14 }}>No purchases yet</Text>
              </View>
            ) : (
              purchases.slice(0, 5).map((p) => {
                const build = p.build;
                return (
                  <View
                    key={p.id}
                    style={{
                      backgroundColor: theme.card,
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: theme.border,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                    <View>
                      <Text style={{ color: theme.foreground, fontWeight: '700', fontSize: 14 }}>
                        {build?.name ?? 'Build'}
                      </Text>
                      <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
                        {build?.position} · {build?.archetype}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 14 }}>
                        -{p.price.toLocaleString()} VC
                      </Text>
                      <Text style={{ color: theme.mutedForeground, fontSize: 11 }}>
                        {new Date(p.purchasedAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}

            {purchases.length > 5 && (
              <Text
                style={{
                  color: '#7C3AED',
                  fontWeight: '600',
                  fontSize: 13,
                  textAlign: 'center',
                  marginTop: 4,
                }}
                onPress={() => router.push('/(tabs)/my-builds')}>
                View all {purchases.length} purchases →
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
