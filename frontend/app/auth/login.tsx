import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { useAuthStore } from '@/lib/store';

export default function LoginScreen() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

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
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} style={{ backgroundColor: t.background }}>
        {/* Hero */}
        <View style={{ backgroundColor: '#7C3AED', paddingTop: 80, paddingBottom: 40, paddingHorizontal: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>🏆</Text>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 28, textAlign: 'center' }}>Sports Builds Market</Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 4, textAlign: 'center' }}>
            Buy & sell elite player build templates
          </Text>
        </View>

        <View style={{ padding: 24 }}>
          <Text style={{ color: t.foreground, fontWeight: '800', fontSize: 22, marginBottom: 24 }}>Welcome back</Text>

          {error ? (
            <View style={{ backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: '#DC2626', fontSize: 14 }}>{error}</Text>
            </View>
          ) : null}

          <Text style={{ color: t.mutedForeground, fontSize: 13, marginBottom: 6 }}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={t.mutedForeground}
            style={{
              backgroundColor: t.muted, borderRadius: 10, padding: 14, fontSize: 15,
              color: t.foreground, marginBottom: 16, borderWidth: 1, borderColor: t.border,
            }}
          />

          <Text style={{ color: t.mutedForeground, fontSize: 13, marginBottom: 6 }}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={t.mutedForeground}
            style={{
              backgroundColor: t.muted, borderRadius: 10, padding: 14, fontSize: 15,
              color: t.foreground, marginBottom: 24, borderWidth: 1, borderColor: t.border,
            }}
          />

          <Pressable
            onPress={handleLogin}
            disabled={isLoading}
            style={{ backgroundColor: '#7C3AED', borderRadius: 12, padding: 16, alignItems: 'center' }}>
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Sign In</Text>
            }
          </Pressable>

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 6 }}>
            <Text style={{ color: t.mutedForeground, fontSize: 14 }}>Don't have an account?</Text>
            <Pressable onPress={() => router.push('/auth/signup')}>
              <Text style={{ color: '#7C3AED', fontWeight: '700', fontSize: 14 }}>Sign Up</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
