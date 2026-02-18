import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, ScrollView,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { purchasesApi, buildsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { Build, Purchase } from '@/lib/types';

const TABS = ['Purchases', 'My Listings', 'Earnings'] as const;
type Tab = typeof TABS[number];

const STATUS_COLORS: Record<string, string> = {
  active: '#10B981',
  pending: '#F59E0B',
  rejected: '#EF4444',
  sold: '#6B7280',
};

export default function DashboardScreen() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const { token, user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<Tab>('Purchases');
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [myBuilds, setMyBuilds] = useState<Build[]>([]);
  const [earnings, setEarnings] = useState<{ sales: Purchase[]; total_earned: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const [p, b, e] = await Promise.all([
        purchasesApi.myPurchases(token),
        purchasesApi.myBuilds(token),
        purchasesApi.myEarnings(token),
      ]);
      setPurchases(p);
      setMyBuilds(b);
      setEarnings(e);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleDeleteBuild = (build: Build) => {
    Alert.alert('Delete Listing', `Remove "${build.title}" from marketplace?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await buildsApi.delete(token!, build.id);
            setMyBuilds((prev) => prev.filter((b) => b.id !== build.id));
          } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete');
          }
        },
      },
    ]);
  };

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: t.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🔐</Text>
        <Text style={{ color: t.foreground, fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>Sign in to view your dashboard</Text>
        <Pressable onPress={() => router.push('/auth/login')} style={{ backgroundColor: '#7C3AED', borderRadius: 12, padding: 14, paddingHorizontal: 24, marginTop: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  const totalSpent = purchases.reduce((s, p) => s + p.amount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      {/* Header */}
      <View style={{ backgroundColor: '#7C3AED', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <View>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 24 }}>Dashboard</Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 }}>Welcome, {user.username}</Text>
          </View>
          {user.role === 'admin' && (
            <Pressable onPress={() => router.push('/admin')} style={{ backgroundColor: '#FFD700', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: '#000', fontWeight: '800', fontSize: 12 }}>⚙ Admin</Text>
            </Pressable>
          )}
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            { label: 'Purchases', val: purchases.length, icon: '🛒' },
            { label: 'Listings', val: myBuilds.length, icon: '📦' },
            { label: 'Earned', val: `$${(earnings?.total_earned || 0).toFixed(2)}`, icon: '💰' },
            { label: 'Spent', val: `$${totalSpent.toFixed(2)}`, icon: '💳' },
          ].map((s) => (
            <View key={s.label} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, marginBottom: 2 }}>{s.icon}</Text>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{s.val}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: t.card, borderBottomWidth: 1, borderBottomColor: t.border }}>
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: 13, alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab ? '#7C3AED' : 'transparent',
            }}>
            <Text style={{ color: activeTab === tab ? '#7C3AED' : t.mutedForeground, fontWeight: '700', fontSize: 12 }}>
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#7C3AED" />}>

          {/* ── Purchases ── */}
          {activeTab === 'Purchases' && (
            purchases.length === 0
              ? <EmptyState icon="🛒" title="No purchases yet" sub="Browse the marketplace to find your perfect build" />
              : purchases.map((p) => {
                const b = p.build as Build | undefined;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => p.build_id && router.push(`/build/${p.build_id}`)}
                    style={{ backgroundColor: t.card, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: t.border }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: t.foreground, fontWeight: '700', fontSize: 15, flex: 1 }} numberOfLines={1}>
                        {b?.title ?? 'Unknown Build'}
                      </Text>
                      <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 14 }}>${p.amount.toFixed(2)}</Text>
                    </View>
                    <Text style={{ color: t.mutedForeground, fontSize: 12, marginBottom: 8 }}>
                      {b?.game_type} • {b?.position} • {b?.archetype}
                    </Text>
                    {b?.import_code && (
                      <View style={{ backgroundColor: '#DCFCE7', borderRadius: 8, padding: 8, marginBottom: 6 }}>
                        <Text style={{ color: '#6B7280', fontSize: 10, marginBottom: 2 }}>IMPORT CODE</Text>
                        <Text style={{ color: '#111', fontSize: 12, fontFamily: 'monospace' }} selectable>{b.import_code}</Text>
                      </View>
                    )}
                    <Text style={{ color: t.mutedForeground, fontSize: 11 }}>
                      Purchased {new Date(p.created_at).toLocaleDateString()}
                    </Text>
                  </Pressable>
                );
              })
          )}

          {/* ── My Listings ── */}
          {activeTab === 'My Listings' && (
            <>
              {user.role === 'seller' && !user.stripe_onboarded && (
                <Pressable
                  onPress={() => router.push('/seller/onboarding')}
                  style={{ backgroundColor: '#FEF9C3', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#FDE047', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 24 }}>💳</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#854D0E', fontWeight: '700', fontSize: 14 }}>Connect Stripe to Get Paid</Text>
                    <Text style={{ color: '#92400E', fontSize: 12 }}>Set up your payout account to receive 70% of each sale</Text>
                  </View>
                  <Text style={{ color: '#854D0E', fontWeight: '700' }}>→</Text>
                </Pressable>
              )}

              {myBuilds.length === 0
                ? <EmptyState icon="📦" title="No listings yet" sub="Go to the Sell tab to list your first build" />
                : myBuilds.map((b) => (
                  <Pressable
                    key={b.id}
                    onPress={() => router.push(`/build/${b.id}`)}
                    style={{ backgroundColor: t.card, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: t.border }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: t.foreground, fontWeight: '700', fontSize: 15, flex: 1 }} numberOfLines={1}>{b.title}</Text>
                      <Text style={{ color: '#7C3AED', fontWeight: '700' }}>${b.price.toFixed(2)}</Text>
                    </View>
                    <Text style={{ color: t.mutedForeground, fontSize: 12, marginBottom: 8 }}>{b.game_type} • {b.position} • {b.archetype}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ backgroundColor: `${STATUS_COLORS[b.status]}20`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ color: STATUS_COLORS[b.status], fontWeight: '700', fontSize: 11, textTransform: 'uppercase' }}>{b.status}</Text>
                        </View>
                        {b.featured && (
                          <View style={{ backgroundColor: '#FEF9C3', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                            <Text style={{ color: '#854D0E', fontWeight: '700', fontSize: 11 }}>⭐ FEATURED</Text>
                          </View>
                        )}
                      </View>
                      {b.status !== 'sold' && (
                        <Pressable
                          onPress={() => handleDeleteBuild(b)}
                          style={{ backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Text style={{ color: '#DC2626', fontWeight: '600', fontSize: 12 }}>Delete</Text>
                        </Pressable>
                      )}
                    </View>
                    <Text style={{ color: t.mutedForeground, fontSize: 11, marginTop: 6 }}>
                      {b.view_count} views • Listed {new Date(b.created_at).toLocaleDateString()}
                    </Text>
                  </Pressable>
                ))
              }
            </>
          )}

          {/* ── Earnings ── */}
          {activeTab === 'Earnings' && (
            <>
              <View style={{ backgroundColor: '#EDE9FE', borderRadius: 14, padding: 16, marginBottom: 16, alignItems: 'center' }}>
                <Text style={{ color: '#7C3AED', fontSize: 13, marginBottom: 4 }}>Total Earnings (70% of sales)</Text>
                <Text style={{ color: '#5B21B6', fontWeight: '900', fontSize: 32 }}>${(earnings?.total_earned || 0).toFixed(2)}</Text>
                <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 4 }}>Payouts via Stripe Connect</Text>
                {!user.stripe_onboarded && (
                  <Pressable
                    onPress={() => router.push('/seller/onboarding')}
                    style={{ marginTop: 10, backgroundColor: '#7C3AED', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Connect Stripe →</Text>
                  </Pressable>
                )}
              </View>

              {!earnings?.sales?.length
                ? <EmptyState icon="💰" title="No sales yet" sub="Once your builds sell, earnings will appear here" />
                : earnings.sales.map((sale, i) => (
                  <View key={i} style={{ backgroundColor: t.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: t.border }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                      <Text style={{ color: t.foreground, fontWeight: '700', fontSize: 14, flex: 1 }} numberOfLines={1}>
                        {(sale as { build?: { title?: string } }).build?.title ?? 'Build'}
                      </Text>
                      <Text style={{ color: '#10B981', fontWeight: '700' }}>+${sale.seller_payout.toFixed(2)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: t.mutedForeground, fontSize: 12 }}>Sale: ${sale.amount.toFixed(2)} • Fee: ${sale.platform_fee.toFixed(2)}</Text>
                      <Text style={{ color: t.mutedForeground, fontSize: 11 }}>{new Date(sale.created_at).toLocaleDateString()}</Text>
                    </View>
                  </View>
                ))
              }
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <View style={{ alignItems: 'center', marginTop: 60, padding: 20 }}>
      <Text style={{ fontSize: 48, marginBottom: 12 }}>{icon}</Text>
      <Text style={{ color: '#111', fontSize: 17, fontWeight: '700', marginBottom: 6, textAlign: 'center' }}>{title}</Text>
      <Text style={{ color: '#6B7280', fontSize: 13, textAlign: 'center' }}>{sub}</Text>
    </View>
  );
}
