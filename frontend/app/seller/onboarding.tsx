import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { stripeApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function SellerOnboardingScreen() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const params = useLocalSearchParams<{ success?: string; refresh?: string }>();
  const { token, user, setUser } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(!!params.success);
  const [status, setStatus] = useState<{ onboarded: boolean; account_id?: string } | null>(null);
  const [error, setError] = useState('');

  // Check stripe status on return from Stripe
  useEffect(() => {
    if ((params.success || params.refresh) && token) {
      setCheckingStatus(true);
      stripeApi.status(token).then((s) => {
        setStatus(s);
        if (s.onboarded && user) {
          setUser({ ...user, stripe_onboarded: true, stripe_account_id: s.account_id });
        }
      }).catch(() => {}).finally(() => setCheckingStatus(false));
    }
  }, [params.success, params.refresh, token]);

  const handleConnect = async () => {
    if (!token) { router.push('/auth/login'); return; }
    setLoading(true);
    setError('');
    try {
      const { url, error: stripeError } = await stripeApi.connect(token);
      if (stripeError) {
        setError(stripeError);
      } else if (url) {
        if (typeof window !== 'undefined') {
          window.location.href = url;
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to connect Stripe');
    } finally {
      setLoading(false);
    }
  };

  const isOnboarded = user?.stripe_onboarded || status?.onboarded;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }}>
      {/* Header */}
      <View style={{ backgroundColor: '#1E40AF', paddingTop: 56, paddingBottom: 30, paddingHorizontal: 24 }}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: 16 }}>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>← Back</Text>
        </Pressable>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 28, marginBottom: 6 }}>Seller Payouts</Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 20 }}>
          Connect Stripe to receive 70% of every build sale directly to your bank account.
        </Text>
      </View>

      <View style={{ padding: 24, gap: 16 }}>

        {checkingStatus ? (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={{ color: t.mutedForeground, marginTop: 12, fontSize: 14 }}>Checking Stripe status...</Text>
          </View>
        ) : isOnboarded ? (
          /* Already connected */
          <View>
            <View style={{ backgroundColor: '#DCFCE7', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#86EFAC' }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>✅</Text>
              <Text style={{ color: '#15803D', fontWeight: '900', fontSize: 20, marginBottom: 6 }}>Stripe Connected!</Text>
              <Text style={{ color: '#166534', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
                You're set up to receive payouts. Earnings are sent automatically after each sale.
              </Text>
            </View>

            <View style={{ backgroundColor: t.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: t.border, gap: 12 }}>
              {[
                { icon: '💰', title: '70% of every sale', desc: 'You keep 70%; 30% goes to platform operations.' },
                { icon: '⚡', title: 'Instant transfer', desc: 'Funds sent to your Stripe account after each purchase.' },
                { icon: '🏦', title: 'Bank payouts', desc: 'Transfer from Stripe to your bank on your schedule.' },
              ].map((item) => (
                <View key={item.title} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                  <Text style={{ fontSize: 22 }}>{item.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.foreground, fontWeight: '700', fontSize: 14 }}>{item.title}</Text>
                    <Text style={{ color: t.mutedForeground, fontSize: 13, marginTop: 2 }}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Pressable
              onPress={() => router.push('/(tabs)/sell')}
              style={{ backgroundColor: '#7C3AED', borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Start Selling →</Text>
            </Pressable>
          </View>
        ) : (
          /* Not yet connected */
          <View>
            {params.refresh && (
              <View style={{ backgroundColor: '#FEF9C3', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#FDE047' }}>
                <Text style={{ color: '#854D0E', fontWeight: '700', fontSize: 14, marginBottom: 4 }}>Onboarding incomplete</Text>
                <Text style={{ color: '#92400E', fontSize: 13 }}>
                  Please complete all steps in the Stripe onboarding to start receiving payments.
                </Text>
              </View>
            )}

            {error ? (
              <View style={{ backgroundColor: '#FEE2E2', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#FECACA' }}>
                <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>⚠ {error}</Text>
                <Text style={{ color: '#7F1D1D', fontSize: 12, marginTop: 4 }}>
                  To enable Stripe, add a valid STRIPE_SECRET_KEY to backend environment variables.
                </Text>
              </View>
            ) : null}

            {/* How it works */}
            <View style={{ backgroundColor: t.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: t.border, marginBottom: 16 }}>
              <Text style={{ color: t.foreground, fontWeight: '800', fontSize: 16, marginBottom: 12 }}>How Payouts Work</Text>
              {[
                { step: '1', title: 'Connect Stripe', desc: 'Verify your identity with Stripe Express (takes ~5 minutes).' },
                { step: '2', title: 'List Your Builds', desc: 'Upload builds to the marketplace for buyers to find.' },
                { step: '3', title: 'Get Paid', desc: 'Receive 70% of each sale automatically — no manual steps.' },
              ].map((item) => (
                <View key={item.step} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>{item.step}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.foreground, fontWeight: '700', fontSize: 14 }}>{item.title}</Text>
                    <Text style={{ color: t.mutedForeground, fontSize: 13, marginTop: 2 }}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Revenue split */}
            <View style={{ backgroundColor: '#EDE9FE', borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <Text style={{ color: '#5B21B6', fontWeight: '800', fontSize: 16, marginBottom: 10 }}>Revenue Split</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 7, backgroundColor: '#7C3AED', borderRadius: 10, padding: 14, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 28 }}>70%</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>You (Seller)</Text>
                </View>
                <View style={{ flex: 3, backgroundColor: 'rgba(124,58,237,0.15)', borderRadius: 10, padding: 14, alignItems: 'center' }}>
                  <Text style={{ color: '#7C3AED', fontWeight: '900', fontSize: 28 }}>30%</Text>
                  <Text style={{ color: '#9CA3AF', fontSize: 12 }}>Platform</Text>
                </View>
              </View>
              <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 10, textAlign: 'center' }}>
                On a $4.99 sale: you receive $3.49 · Platform fee: $1.50
              </Text>
            </View>

            <Pressable
              onPress={handleConnect}
              disabled={loading}
              style={{ backgroundColor: '#1E40AF', borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 12 }}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Connect Stripe →</Text>
              }
            </Pressable>

            <Text style={{ color: t.mutedForeground, fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
              By connecting Stripe, you agree to Stripe's Terms of Service.{'\n'}
              Stripe is a third-party payment processor; Sports Builds Market does not store your financial details.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
