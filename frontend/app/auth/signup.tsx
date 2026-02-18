import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { useAuthStore } from '@/lib/store';

export default function SignupScreen() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const { signup, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [error, setError] = useState('');

  const handleSignup = async () => {
    setError('');
    if (!email || !password || !username) { setError('Please fill in all fields'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    try {
      await signup(email.trim().toLowerCase(), password, username.trim(), role);
      router.replace('/onboarding');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Signup failed');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} style={{ backgroundColor: t.background }}>
        {/* Header */}
        <View style={{ backgroundColor: '#7C3AED', paddingTop: 60, paddingBottom: 30, paddingHorizontal: 24 }}>
          <Pressable onPress={() => router.back()} style={{ marginBottom: 16 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>← Back</Text>
          </Pressable>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 26 }}>Create Account</Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 4 }}>
            Join Players1 — Sim Sports Build Marketplace
          </Text>
        </View>

        <View style={{ padding: 24 }}>
          {error ? (
            <View style={{ backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: '#DC2626', fontSize: 14 }}>{error}</Text>
            </View>
          ) : null}

          {/* Role selector */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: t.mutedForeground, fontSize: 13, marginBottom: 8, fontWeight: '600' }}>I want to...</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {([
                { val: 'buyer' as const, icon: '🛒', label: 'Buy Builds', desc: 'Browse & purchase templates' },
                { val: 'seller' as const, icon: '💰', label: 'Sell Builds', desc: 'List builds & earn 70%' },
              ]).map((r) => (
                <Pressable
                  key={r.val}
                  onPress={() => setRole(r.val)}
                  style={{
                    flex: 1, borderRadius: 12, padding: 14, alignItems: 'center',
                    borderWidth: 2,
                    borderColor: role === r.val ? '#7C3AED' : t.border,
                    backgroundColor: role === r.val ? '#EDE9FE' : t.muted,
                  }}>
                  <Text style={{ fontSize: 22, marginBottom: 4 }}>{r.icon}</Text>
                  <Text style={{ color: role === r.val ? '#7C3AED' : t.foreground, fontWeight: '700', fontSize: 13 }}>{r.label}</Text>
                  <Text style={{ color: t.mutedForeground, fontSize: 11, textAlign: 'center', marginTop: 2 }}>{r.desc}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {[
            { label: 'Username', value: username, setter: setUsername, placeholder: 'ProGamer99', type: 'default' as const },
            { label: 'Email', value: email, setter: setEmail, placeholder: 'you@example.com', type: 'email-address' as const },
            { label: 'Password (min 8 chars)', value: password, setter: setPassword, placeholder: '••••••••', type: 'default' as const, secure: true },
          ].map((field) => (
            <View key={field.label} style={{ marginBottom: 16 }}>
              <Text style={{ color: t.mutedForeground, fontSize: 13, marginBottom: 6 }}>{field.label}</Text>
              <TextInput
                value={field.value}
                onChangeText={field.setter}
                autoCapitalize="none"
                keyboardType={field.type}
                placeholder={field.placeholder}
                placeholderTextColor={t.mutedForeground}
                secureTextEntry={field.secure}
                style={{
                  backgroundColor: t.muted, borderRadius: 10, padding: 14, fontSize: 15,
                  color: t.foreground, borderWidth: 1, borderColor: t.border,
                }}
              />
            </View>
          ))}

          <Pressable
            onPress={handleSignup}
            disabled={isLoading}
            style={{ backgroundColor: '#7C3AED', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 }}>
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                  {role === 'seller' ? 'Create Seller Account' : 'Create Account'}
                </Text>
            }
          </Pressable>

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 6 }}>
            <Text style={{ color: t.mutedForeground, fontSize: 14 }}>Already have an account?</Text>
            <Pressable onPress={() => router.replace('/auth/login')}>
              <Text style={{ color: '#7C3AED', fontWeight: '700', fontSize: 14 }}>Sign In</Text>
            </Pressable>
          </View>

          <Text style={{ color: t.mutedForeground, fontSize: 11, textAlign: 'center', marginTop: 20, lineHeight: 16 }}>
            Templates are user-generated; no affiliation with game publishers.{'\n'}
            By signing up you agree to our Terms of Service.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
