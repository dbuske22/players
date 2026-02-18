import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { useAuthStore } from '@/lib/store';

const BULLETS = [
  {
    icon: '⚡',
    color: '#FACC15',
    label: 'Verified Meta Builds',
    desc: 'Every build tested and validated by top-ranked players.',
  },
  {
    icon: '🎯',
    color: '#34D399',
    label: 'Personalized Recommendations',
    desc: 'Builds matched to your playstyle, position, and badge priorities.',
  },
  {
    icon: '🔄',
    color: '#60A5FA',
    label: 'Patch-Ready Updates',
    desc: 'Refreshed every patch so you never fall behind the meta.',
  },
];

const STATS = [
  { val: '12K+', lab: 'Builds' },
  { val: '98%', lab: 'Win Rate' },
  { val: 'Live', lab: 'Patch Updates' },
];

export default function LoginScreen() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleLogin = async () => {
    setError('');
    if (!email || !password) { setError('Please fill in all fields'); return; }
    try {
      await login(email.trim().toLowerCase(), password);
      const user = useAuthStore.getState().user;
      if (user && !user.playstyle_vector) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        style={{ backgroundColor: '#0A0A0F' }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero ── */}
        <View style={{ backgroundColor: '#0A0A0F', paddingTop: 56, paddingHorizontal: 24, overflow: 'hidden' }}>

          {/* Glow orbs */}
          <View style={{
            position: 'absolute', top: -80, left: -60,
            width: 340, height: 340,
            backgroundColor: '#7C3AED',
            borderRadius: 170,
            opacity: 0.14,
          }} />
          <View style={{
            position: 'absolute', top: 120, right: -80,
            width: 240, height: 240,
            backgroundColor: '#06B6D4',
            borderRadius: 120,
            opacity: 0.10,
          }} />
          <View style={{
            position: 'absolute', top: 300, left: -40,
            width: 180, height: 180,
            backgroundColor: '#7C3AED',
            borderRadius: 90,
            opacity: 0.08,
          }} />

          {/* Game badge */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 7,
              backgroundColor: 'rgba(124,58,237,0.20)',
              borderWidth: 1, borderColor: 'rgba(124,58,237,0.45)',
              borderRadius: 24, paddingHorizontal: 16, paddingVertical: 6,
            }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#A78BFA' }} />
              <Text style={{
                color: '#C4B5FD',
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 1.8,
                textTransform: 'uppercase',
              }}>
                NBA 2K · Madden · FC25
              </Text>
            </View>
          </View>

          {/* Headline */}
          <Text style={{
            color: '#FFFFFF',
            fontWeight: '900',
            fontSize: 32,
            textAlign: 'center',
            lineHeight: 40,
            letterSpacing: -0.8,
            marginBottom: 4,
          }}>
            Find Winning
          </Text>
          <Text style={{
            color: '#FFFFFF',
            fontWeight: '900',
            fontSize: 32,
            textAlign: 'center',
            lineHeight: 40,
            letterSpacing: -0.8,
            marginBottom: 4,
          }}>
            Player Builds
          </Text>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <View style={{
              backgroundColor: 'rgba(124,58,237,0.25)',
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 2,
            }}>
              <Text style={{
                color: '#A78BFA',
                fontWeight: '900',
                fontSize: 32,
                textAlign: 'center',
                lineHeight: 44,
                letterSpacing: -0.8,
              }}>
                Before You Waste VC.
              </Text>
            </View>
          </View>

          {/* Subheadline */}
          <Text style={{
            color: 'rgba(255,255,255,0.50)',
            fontSize: 14,
            textAlign: 'center',
            lineHeight: 22,
            marginBottom: 36,
            maxWidth: 300,
            alignSelf: 'center',
          }}>
            Verified community builds ranked by real performance and updated every patch.
          </Text>

          {/* Benefit bullets */}
          <View style={{ gap: 10, marginBottom: 28 }}>
            {BULLETS.map((b) => (
              <View key={b.label} style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.07)',
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                gap: 14,
              }}>
                {/* Icon container */}
                <View style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                }}>
                  <Text style={{ fontSize: 16 }}>{b.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13, marginBottom: 3 }}>
                    {b.label}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 12, lineHeight: 17 }}>
                    {b.desc}
                  </Text>
                </View>
                {/* Accent dot */}
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: b.color, opacity: 0.8 }} />
              </View>
            ))}
          </View>

          {/* Stats strip */}
          <View style={{
            flexDirection: 'row',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
            borderRadius: 16, overflow: 'hidden',
            marginBottom: 40,
          }}>
            {STATS.map((s, i) => (
              <View key={s.lab} style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 16,
                backgroundColor: i === 1 ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.03)',
                borderRightWidth: i < 2 ? 1 : 0,
                borderRightColor: 'rgba(255,255,255,0.08)',
              }}>
                <Text style={{
                  color: i === 1 ? '#A78BFA' : '#FFFFFF',
                  fontWeight: '800',
                  fontSize: 20,
                  letterSpacing: -0.5,
                }}>
                  {s.val}
                </Text>
                <Text style={{
                  color: 'rgba(255,255,255,0.35)',
                  fontSize: 10,
                  marginTop: 3,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                }}>
                  {s.lab}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Login Form ── */}
        <View style={{
          backgroundColor: '#111118',
          borderTopWidth: 1,
          borderTopColor: 'rgba(124,58,237,0.25)',
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: 48,
        }}>

          {/* Section header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <Text style={{
              color: 'rgba(255,255,255,0.35)',
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
            }}>
              Sign in to access builds
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          </View>

          {/* Error */}
          {error ? (
            <View style={{
              backgroundColor: 'rgba(239,68,68,0.12)',
              borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
              borderRadius: 10, padding: 12, marginBottom: 20,
            }}>
              <Text style={{ color: '#FCA5A5', fontSize: 13 }}>{error}</Text>
            </View>
          ) : null}

          {/* Email */}
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
            Email
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor="rgba(255,255,255,0.18)"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: 12,
              padding: 15,
              fontSize: 15,
              color: '#FFFFFF',
              marginBottom: 20,
              borderWidth: 1,
              borderColor: focusedField === 'email' ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.09)',
            }}
          />

          {/* Password */}
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
            Password
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(null)}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor="rgba(255,255,255,0.18)"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: 12,
              padding: 15,
              fontSize: 15,
              color: '#FFFFFF',
              marginBottom: 28,
              borderWidth: 1,
              borderColor: focusedField === 'password' ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.09)',
            }}
          />

          {/* CTA */}
          <Pressable
            onPress={handleLogin}
            disabled={isLoading}
            style={({ pressed }) => ({
              borderRadius: 14,
              padding: 17,
              alignItems: 'center',
              backgroundColor: pressed ? '#6D28D9' : '#7C3AED',
              shadowColor: '#7C3AED',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.45,
              shadowRadius: 16,
              elevation: 8,
              opacity: isLoading ? 0.7 : 1,
            })}>
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 }}>
                  Sign In to Access Builds
                </Text>
            }
          </Pressable>

          {/* Sign up */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 22, gap: 6 }}>
            <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>Don't have an account?</Text>
            <Pressable onPress={() => router.push('/auth/signup')}>
              <Text style={{ color: '#A78BFA', fontWeight: '700', fontSize: 14 }}>Sign Up Free</Text>
            </Pressable>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}
