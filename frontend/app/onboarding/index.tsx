import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { useAuthStore } from '@/lib/store';
import { playstyleApi } from '@/lib/api';
import { PLAYSTYLE_DIMENSIONS } from '@/lib/compatibility';
import type { PlaystyleLabels, GameType } from '@/lib/types';

const SPORTS: { label: string; value: GameType; emoji: string; description: string; color: string }[] = [
  { label: 'Basketball', value: 'basketball', emoji: '🏀', description: 'NBA 2K, MyTeam, Pro-Am builds', color: '#F97316' },
  { label: 'Football', value: 'football', emoji: '🏈', description: 'Madden, Ultimate Team builds', color: '#10B981' },
  { label: 'Hockey', value: 'hockey', emoji: '🏒', description: 'NHL HUT, EASHL builds', color: '#3B82F6' },
];

export default function OnboardingScreen() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const { token, user, setUser } = useAuthStore();

  const [sport, setSport] = useState<GameType | null>(null);
  const [step, setStep] = useState<'sport' | 'playstyle'>('sport');
  const [values, setValues] = useState<number[]>(Array(8).fill(5));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSportNext = () => {
    if (!sport) { setError('Please select a sport to continue'); return; }
    setError('');
    setStep('playstyle');
  };

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
      await playstyleApi.save(token, values, labels, sport ?? undefined);
      if (user) setUser({ ...user, playstyle_vector: values, playstyle_labels: labels, preferred_sport: sport });
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
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 26, marginBottom: 6 }}>
          {step === 'sport' ? 'What sport do you play?' : 'Playstyle Scan'}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 }}>
          {step === 'sport'
            ? 'We\'ll show you builds for the game you play.'
            : 'Tell us how you play so we can match you to elite builds.'}
        </Text>

        {/* Step dots */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          {['Sport', 'Playstyle'].map((s, i) => (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{
                width: 24, height: 24, borderRadius: 12,
                backgroundColor: (step === 'sport' ? 0 : 1) >= i ? '#fff' : 'rgba(255,255,255,0.3)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: (step === 'sport' ? 0 : 1) >= i ? '#7C3AED' : 'rgba(255,255,255,0.5)', fontWeight: '800', fontSize: 12 }}>{i + 1}</Text>
              </View>
              <Text style={{ color: (step === 'sport' ? 0 : 1) >= i ? '#fff' : 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 12 }}>{s}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ padding: 20, gap: 16 }}>
        {error ? (
          <View style={{ backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12 }}>
            <Text style={{ color: '#DC2626' }}>{error}</Text>
          </View>
        ) : null}

        {/* ── Sport Selection ── */}
        {step === 'sport' && (
          <View style={{ gap: 14 }}>
            {SPORTS.map((s) => {
              const selected = sport === s.value;
              return (
                <Pressable
                  key={s.value}
                  onPress={() => { setSport(s.value); setError(''); }}
                  style={{
                    borderRadius: 18,
                    borderWidth: 3,
                    borderColor: selected ? s.color : t.border,
                    backgroundColor: selected ? s.color + '18' : t.card,
                    padding: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 16,
                    shadowColor: selected ? s.color : '#000',
                    shadowOpacity: selected ? 0.18 : 0.04,
                    shadowRadius: 10,
                    elevation: selected ? 4 : 1,
                  }}>
                  <Text style={{ fontSize: 48 }}>{s.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.foreground, fontWeight: '800', fontSize: 20, marginBottom: 4 }}>
                      {s.label}
                    </Text>
                    <Text style={{ color: t.mutedForeground, fontSize: 13 }}>{s.description}</Text>
                  </View>
                  <View style={{
                    width: 28, height: 28, borderRadius: 14,
                    borderWidth: 2,
                    borderColor: selected ? s.color : t.border,
                    backgroundColor: selected ? s.color : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selected && <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>✓</Text>}
                  </View>
                </Pressable>
              );
            })}

            <Pressable
              onPress={handleSportNext}
              style={{
                backgroundColor: sport ? '#7C3AED' : t.muted,
                borderRadius: 14, padding: 18,
                alignItems: 'center', marginTop: 8,
              }}>
              <Text style={{ color: sport ? '#fff' : t.mutedForeground, fontWeight: '800', fontSize: 17 }}>
                Continue →
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Playstyle Questions ── */}
        {step === 'playstyle' && (
          <View style={{ gap: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: t.border }}>
              <Text style={{ fontSize: 28 }}>{SPORTS.find(s => s.value === sport)?.emoji}</Text>
              <View>
                <Text style={{ color: t.mutedForeground, fontSize: 11, fontWeight: '600' }}>SELECTED SPORT</Text>
                <Text style={{ color: t.foreground, fontWeight: '800', fontSize: 15 }}>{SPORTS.find(s => s.value === sport)?.label}</Text>
              </View>
              <Pressable
                onPress={() => setStep('sport')}
                style={{ marginLeft: 'auto', backgroundColor: t.muted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ color: t.mutedForeground, fontSize: 12, fontWeight: '600' }}>Change</Text>
              </Pressable>
            </View>

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
        )}
      </View>
    </ScrollView>
  );
}
