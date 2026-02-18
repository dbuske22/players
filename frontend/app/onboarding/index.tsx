import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { useAuthStore } from '@/lib/store';
import { playstyleApi } from '@/lib/api';
import { PLAYSTYLE_DIMENSIONS } from '@/lib/compatibility';
import type { PlaystyleLabels } from '@/lib/types';

export default function OnboardingScreen() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const { token, user, setUser } = useAuthStore();

  const [values, setValues] = useState<number[]>(Array(8).fill(5));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const labels: PlaystyleLabels = {
        shootVsDrive: values[0],
        soloVsSquad: values[1],
        defenseSkill: values[2],
        reactionTiming: values[3],
        offensiveStyle: values[4],
        physicalPlay: values[5],
        pacePreference: values[6],
        consistencyVsHighRisk: values[7],
      };
      await playstyleApi.save(token, values, labels);
      if (user) setUser({ ...user, playstyle_vector: values, playstyle_labels: labels });
      router.replace('/(tabs)');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }}>
      {/* Header */}
      <View style={{ backgroundColor: '#7C3AED', paddingTop: 60, paddingBottom: 30, paddingHorizontal: 24 }}>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 26, marginBottom: 8 }}>Playstyle Scan</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 }}>
          Tell us how you play so we can find builds that match your exact style. Takes about 60 seconds.
        </Text>
      </View>

      <View style={{ padding: 20, gap: 24 }}>
        {error ? (
          <View style={{ backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12 }}>
            <Text style={{ color: '#DC2626' }}>{error}</Text>
          </View>
        ) : null}

        {PLAYSTYLE_DIMENSIONS.map((dim, i) => (
          <View key={dim.key} style={{ backgroundColor: t.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: t.border }}>
            <Text style={{ color: t.mutedForeground, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Question {i + 1} of 8
            </Text>
            <Text style={{ color: t.foreground, fontWeight: '700', fontSize: 15, marginBottom: 16, lineHeight: 22 }}>
              {dim.question}
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: t.mutedForeground, fontSize: 11, flex: 1 }}>{dim.low}</Text>
              <Text style={{ color: '#7C3AED', fontWeight: '700', fontSize: 16, marginHorizontal: 12 }}>
                {values[i]}
              </Text>
              <Text style={{ color: t.mutedForeground, fontSize: 11, flex: 1, textAlign: 'right' }}>{dim.high}</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 4 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                <Pressable
                  key={v}
                  onPress={() => {
                    const next = [...values];
                    next[i] = v;
                    setValues(next);
                  }}
                  style={{
                    flex: 1,
                    height: 36,
                    borderRadius: 6,
                    backgroundColor: values[i] >= v
                      ? v <= 3 ? '#3B82F6' : v <= 7 ? '#7C3AED' : '#10B981'
                      : t.muted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text style={{
                    color: values[i] >= v ? '#fff' : t.mutedForeground,
                    fontSize: 11,
                    fontWeight: '700',
                  }}>{v}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Pressable
          onPress={handleSave}
          disabled={loading}
          style={{
            backgroundColor: '#7C3AED', borderRadius: 14, padding: 18,
            alignItems: 'center', marginTop: 8, marginBottom: 40,
          }}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>Save My Playstyle →</Text>
          }
        </Pressable>
      </View>
    </ScrollView>
  );
}
