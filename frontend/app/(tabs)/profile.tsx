import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { purchasesApi, buildsApi, stripeApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { PLAYSTYLE_DIMENSIONS } from '@/lib/compatibility';
import type { Build } from '@/lib/types';

export default function ProfileScreen() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const { token, user, logout } = useAuthStore();

  const [myBuilds, setMyBuilds] = useState<Build[]>([]);
  const [earnings, setEarnings] = useState(0);
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const [builds, earningsData, purchases] = await Promise.all([
        purchasesApi.myBuilds(token),
        purchasesApi.myEarnings(token),
        purchasesApi.myPurchases(token),
      ]);
      setMyBuilds(builds);
      setEarnings(earningsData.total_earned);
      setPurchaseCount(purchases.length);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleStripeConnect = async () => {
    if (!token) return;
    setStripeLoading(true);
    try {
      const { url, error } = await stripeApi.connect(token);
      if (error) {
        // Stripe not configured yet
        alert('Stripe Connect requires a valid Stripe secret key. Add STRIPE_SECRET_KEY to backend .env');
      } else if (url) {
        // In web, open the URL
        if (typeof window !== 'undefined') window.open(url, '_blank');
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Could not connect Stripe');
    } finally {
      setStripeLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/login');
  };

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: t.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>👤</Text>
        <Text style={{ color: t.foreground, fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' }}>Sign in to view your profile</Text>
        <Pressable onPress={() => router.push('/auth/login')} style={{ backgroundColor: '#7C3AED', borderRadius: 12, padding: 14, paddingHorizontal: 24 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  const activeListing = myBuilds.filter((b) => b.status === 'active').length;
  const soldCount = myBuilds.filter((b) => b.status === 'sold').length;
  const pendingCount = myBuilds.filter((b) => b.status === 'pending').length;

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      {/* Header */}
      <View style={{ backgroundColor: '#7C3AED', paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20, alignItems: 'center' }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 28 }}>{user.username.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 22 }}>{user.username}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 }}>{user.email}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>{user.role}</Text>
          </View>
          {user.stripe_onboarded && (
            <View style={{ backgroundColor: '#10B981', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓ Stripe Connected</Text>
            </View>
          )}
          {user.role === 'admin' && (
            <View style={{ backgroundColor: '#FFD700', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
              <Text style={{ color: '#000', fontSize: 12, fontWeight: '700' }}>⚙ Admin</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#7C3AED" />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        {loading ? (
          <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Stats grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Active Listings', val: activeListing, color: '#7C3AED', icon: '📦' },
                { label: 'Builds Sold', val: soldCount, color: '#10B981', icon: '✅' },
                { label: 'Pending Review', val: pendingCount, color: '#F59E0B', icon: '⏳' },
                { label: 'Purchases', val: purchaseCount, color: '#3B82F6', icon: '🛒' },
              ].map((s) => (
                <View key={s.label} style={{ width: '47%', backgroundColor: t.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: t.border, alignItems: 'center' }}>
                  <Text style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</Text>
                  <Text style={{ color: s.color, fontWeight: '900', fontSize: 26 }}>{s.val}</Text>
                  <Text style={{ color: t.mutedForeground, fontSize: 12, marginTop: 2, textAlign: 'center' }}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Earnings */}
            <View style={{ backgroundColor: '#EDE9FE', borderRadius: 14, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#7C3AED', fontSize: 13 }}>Total Earnings</Text>
                <Text style={{ color: '#5B21B6', fontWeight: '900', fontSize: 28 }}>${earnings.toFixed(2)}</Text>
                <Text style={{ color: '#9CA3AF', fontSize: 11 }}>70% of each sale</Text>
              </View>
              <Text style={{ fontSize: 36 }}>💰</Text>
            </View>

            {/* Seller Stripe banner */}
            {user.role === 'seller' && !user.stripe_onboarded && (
              <Pressable
                onPress={handleStripeConnect}
                disabled={stripeLoading}
                style={{ backgroundColor: '#1E40AF', borderRadius: 14, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {stripeLoading
                  ? <ActivityIndicator color="#fff" />
                  : <>
                    <Text style={{ fontSize: 28 }}>💳</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Connect Stripe to Get Paid</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>Receive 70% of every sale directly to your bank</Text>
                    </View>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>→</Text>
                  </>
                }
              </Pressable>
            )}

            {/* Playstyle snapshot */}
            {user.playstyle_vector && (
              <View style={{ backgroundColor: t.card, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: t.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ color: t.foreground, fontWeight: '800', fontSize: 15 }}>⚡ My Playstyle DNA</Text>
                  <Pressable onPress={() => router.push('/onboarding')}>
                    <Text style={{ color: '#7C3AED', fontSize: 13, fontWeight: '600' }}>Edit</Text>
                  </Pressable>
                </View>
                {PLAYSTYLE_DIMENSIONS.slice(0, 4).map((dim, i) => {
                  const val = user.playstyle_vector![i];
                  return (
                    <View key={dim.key} style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                        <Text style={{ color: t.mutedForeground, fontSize: 11 }} numberOfLines={1}>
                          {val >= 5 ? dim.high : dim.low}
                        </Text>
                        <Text style={{ color: '#7C3AED', fontWeight: '700', fontSize: 11 }}>{val}/10</Text>
                      </View>
                      <View style={{ height: 5, backgroundColor: t.muted, borderRadius: 3 }}>
                        <View style={{ height: 5, backgroundColor: '#7C3AED', borderRadius: 3, width: `${(val / 10) * 100}%` }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Quick links */}
            <View style={{ gap: 10, marginBottom: 16 }}>
              {[
                { label: '🛒 Browse Marketplace', onPress: () => router.push('/(tabs)') },
                { label: '💰 Sell a Build', onPress: () => router.push('/(tabs)/sell') },
                { label: '📊 Dashboard', onPress: () => router.push('/(tabs)/dashboard') },
                { label: '📋 Terms of Service', onPress: () => router.push('/tos') },
                ...(user.role === 'admin' ? [{ label: '⚙ Admin Panel', onPress: () => router.push('/admin') }] : []),
              ].map((link) => (
                <Pressable
                  key={link.label}
                  onPress={link.onPress}
                  style={{ backgroundColor: t.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: t.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: t.foreground, fontWeight: '600', fontSize: 14 }}>{link.label}</Text>
                  <Text style={{ color: t.mutedForeground }}>›</Text>
                </Pressable>
              ))}
            </View>

            {/* Sign out */}
            <Pressable
              onPress={handleLogout}
              style={{ backgroundColor: '#FEE2E2', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 15 }}>Sign Out</Text>
            </Pressable>

            <Text style={{ color: t.mutedForeground, fontSize: 11, textAlign: 'center', lineHeight: 16, paddingHorizontal: 16, marginBottom: 20 }}>
              Templates are user-generated; no affiliation with game publishers.{'\n'}Predictions are estimates only. Users assume risk.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}
