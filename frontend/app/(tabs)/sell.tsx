import { useState } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { buildsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { GameType, BuildAttribute } from '@/lib/types';
import { PLAYSTYLE_DIMENSIONS } from '@/lib/compatibility';

const GAME_TYPES: { label: string; value: GameType; icon: string }[] = [
  { label: 'Basketball', value: 'basketball', icon: '🏀' },
  { label: 'Football', value: 'football', icon: '🏈' },
  { label: 'Hockey', value: 'hockey', icon: '🏒' },
];

const BASKETBALL_ATTRS = ['Speed', 'Acceleration', 'Ball Handling', '3-Point Shot', 'Mid-Range Shot', 'Layup', 'Dunk Power', 'Pass Accuracy', 'Interior Defense', 'Perimeter Defense', 'Steal', 'Block', 'Strength', 'Vertical', 'Stamina'];
const FOOTBALL_ATTRS = ['Speed', 'Acceleration', 'Strength', 'Agility', 'Throw Power', 'Throw Accuracy', 'Catch', 'Route Running', 'Ball Carrier Vision', 'Tackle', 'Coverage', 'Stamina'];
const HOCKEY_ATTRS = ['Speed', 'Acceleration', 'Skating', 'Slap Shot Power', 'Wrist Shot Accuracy', 'Stickhandling', 'Passing', 'Checking', 'Defensive Awareness', 'Endurance'];

const ATTR_LISTS: Record<GameType, string[]> = {
  basketball: BASKETBALL_ATTRS,
  football: FOOTBALL_ATTRS,
  hockey: HOCKEY_ATTRS,
};

export default function SellScreen() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const { token, user } = useAuthStore();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [gameType, setGameType] = useState<GameType>('basketball');
  const [title, setTitle] = useState('');
  const [position, setPosition] = useState('');
  const [archetype, setArchetype] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('4.99');
  const [importCode, setImportCode] = useState('');
  const [badges, setBadges] = useState<string[]>([]);
  const [badgeInput, setBadgeInput] = useState('');
  const [attributes, setAttributes] = useState<BuildAttribute[]>([]);
  const [buildVector, setBuildVector] = useState<number[]>(Array(8).fill(5));

  // Performance
  const [winRate, setWinRate] = useState('55');
  const [modePlayed, setModePlayed] = useState('');
  const [avgGrade, setAvgGrade] = useState('A');
  const [shotEfficiency, setShotEfficiency] = useState('48');
  const [patchVersion, setPatchVersion] = useState('1.0');

  const attrList = ATTR_LISTS[gameType];

  const getAttrValue = (key: string) => {
    const found = attributes.find((a) => a.key === key);
    return found ? String(found.value) : '75';
  };

  const setAttrValue = (key: string, value: string) => {
    setAttributes((prev) => {
      const filtered = prev.filter((a) => a.key !== key);
      return [...filtered, { key, value: parseInt(value) || 75 }];
    });
  };

  const addBadge = () => {
    const b = badgeInput.trim();
    if (b && !badges.includes(b)) {
      setBadges((prev) => [...prev, b]);
      setBadgeInput('');
    }
  };

  const removeBadge = (b: string) => setBadges((prev) => prev.filter((x) => x !== b));

  const handleSubmit = async () => {
    if (!token) { router.push('/auth/login'); return; }
    if (!title || !position || !archetype || !price) { setError('Please fill in all required fields'); return; }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 3.99 || priceNum > 7.99) { setError('Price must be between $3.99 and $7.99'); return; }

    // Ensure all attrs are filled
    const finalAttrs: BuildAttribute[] = attrList.map((key) => ({
      key,
      value: parseInt(getAttrValue(key)) || 75,
    }));

    setSubmitting(true);
    setError('');
    try {
      await buildsApi.create(token, {
        title,
        game_type: gameType,
        position,
        archetype,
        description: description || undefined,
        price: priceNum,
        import_code: importCode || undefined,
        build_vector: buildVector,
        attributes: finalAttrs,
        badges,
        performance: {
          win_rate: parseFloat(winRate) || 50,
          mode_played: modePlayed,
          avg_grade: avgGrade,
          shot_efficiency: parseFloat(shotEfficiency) || 48,
          patch_version: patchVersion,
        },
      });
      Alert.alert('Build Submitted!', 'Your build is pending admin review. You\'ll be notified once approved.', [
        { text: 'View My Builds', onPress: () => router.push('/(tabs)/dashboard') },
      ]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit build');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: t.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: t.foreground, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Sign in to sell builds</Text>
        <Pressable onPress={() => router.push('/auth/login')} style={{ backgroundColor: '#7C3AED', borderRadius: 12, padding: 14, paddingHorizontal: 24 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  const steps = ['Game & Info', 'Attributes', 'Performance', 'Build DNA', 'Review'];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: t.background }}>
        {/* Header */}
        <View style={{ backgroundColor: '#7C3AED', paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 24, marginBottom: 4 }}>List a Build</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Earn 70% of every sale</Text>

          {/* Step indicators */}
          <View style={{ flexDirection: 'row', marginTop: 16, gap: 4 }}>
            {steps.map((s, i) => (
              <Pressable key={s} onPress={() => setStep(i + 1)} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ height: 3, borderRadius: 2, backgroundColor: step > i ? '#fff' : 'rgba(255,255,255,0.3)', marginBottom: 4, width: '100%' }} />
                <Text style={{ color: step > i ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '600' }}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ padding: 20 }}>
          {error ? (
            <View style={{ backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: '#DC2626' }}>{error}</Text>
            </View>
          ) : null}

          {/* Step 1: Game & Basic Info */}
          {step === 1 && (
            <View style={{ gap: 16 }}>
              <Text style={{ color: t.foreground, fontWeight: '800', fontSize: 18 }}>Game Type & Details</Text>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                {GAME_TYPES.map((g) => (
                  <Pressable
                    key={g.value}
                    onPress={() => setGameType(g.value)}
                    style={{
                      flex: 1, borderRadius: 12, padding: 14, alignItems: 'center',
                      borderWidth: 2,
                      borderColor: gameType === g.value ? '#7C3AED' : t.border,
                      backgroundColor: gameType === g.value ? '#EDE9FE' : t.card,
                    }}>
                    <Text style={{ fontSize: 24, marginBottom: 4 }}>{g.icon}</Text>
                    <Text style={{ color: gameType === g.value ? '#7C3AED' : t.foreground, fontWeight: '700', fontSize: 13 }}>{g.label}</Text>
                  </Pressable>
                ))}
              </View>

              {[
                { label: 'Build Title *', val: title, set: setTitle, placeholder: 'e.g. Elite Guard Shooter Template' },
                { label: 'Position *', val: position, set: setPosition, placeholder: 'e.g. Point Guard, Wide Receiver...' },
                { label: 'Archetype / Style *', val: archetype, set: setArchetype, placeholder: 'e.g. Pure Shooter, Balanced, Physical...' },
              ].map((f) => (
                <View key={f.label}>
                  <Text style={{ color: t.mutedForeground, fontSize: 13, marginBottom: 6 }}>{f.label}</Text>
                  <TextInput
                    value={f.val}
                    onChangeText={f.set}
                    placeholder={f.placeholder}
                    placeholderTextColor={t.mutedForeground}
                    style={{ backgroundColor: t.muted, borderRadius: 10, padding: 14, color: t.foreground, fontSize: 15, borderWidth: 1, borderColor: t.border }}
                  />
                </View>
              ))}

              <View>
                <Text style={{ color: t.mutedForeground, fontSize: 13, marginBottom: 6 }}>Description</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe your build, playstyle, best use cases..."
                  placeholderTextColor={t.mutedForeground}
                  multiline numberOfLines={4}
                  style={{ backgroundColor: t.muted, borderRadius: 10, padding: 14, color: t.foreground, fontSize: 14, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: t.border }}
                />
              </View>

              <View>
                  <Text style={{ color: t.mutedForeground, fontSize: 13, marginBottom: 6 }}>Price ($3.99 – $7.99) *</Text>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  placeholder="4.99"
                  placeholderTextColor={t.mutedForeground}
                  style={{ backgroundColor: t.muted, borderRadius: 10, padding: 14, color: t.foreground, fontSize: 15, borderWidth: 1, borderColor: t.border }}
                />
              </View>

              <View>
                <Text style={{ color: t.mutedForeground, fontSize: 13, marginBottom: 6 }}>Import Code (JSON)</Text>
                <TextInput
                  value={importCode}
                  onChangeText={setImportCode}
                  placeholder='{"build": {...}}'
                  placeholderTextColor={t.mutedForeground}
                  multiline numberOfLines={3}
                  style={{ backgroundColor: t.muted, borderRadius: 10, padding: 14, color: t.foreground, fontSize: 13, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: t.border, fontFamily: 'monospace' }}
                />
              </View>

              {/* Badges */}
              <View>
                <Text style={{ color: t.mutedForeground, fontSize: 13, marginBottom: 6 }}>Badges</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <TextInput
                    value={badgeInput}
                    onChangeText={setBadgeInput}
                    placeholder="Add a badge..."
                    placeholderTextColor={t.mutedForeground}
                    style={{ flex: 1, backgroundColor: t.muted, borderRadius: 10, padding: 12, color: t.foreground, fontSize: 14, borderWidth: 1, borderColor: t.border }}
                  />
                  <Pressable onPress={addBadge} style={{ backgroundColor: '#7C3AED', borderRadius: 10, padding: 12, justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Add</Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {badges.map((b) => (
                    <Pressable key={b} onPress={() => removeBadge(b)} style={{ backgroundColor: '#EDE9FE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ color: '#7C3AED', fontSize: 13 }}>{b}</Text>
                      <Text style={{ color: '#7C3AED', fontSize: 13 }}>×</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Step 2: Attributes */}
          {step === 2 && (
            <View style={{ gap: 14 }}>
              <Text style={{ color: t.foreground, fontWeight: '800', fontSize: 18, marginBottom: 4 }}>Set Attributes</Text>
              <Text style={{ color: t.mutedForeground, fontSize: 13, marginBottom: 8 }}>Rate each attribute from 25–99</Text>
              {attrList.map((attr) => {
                const val = getAttrValue(attr);
                const numVal = parseInt(val) || 75;
                const barColor = numVal >= 90 ? '#10B981' : numVal >= 75 ? '#3B82F6' : numVal >= 60 ? '#F59E0B' : '#EF4444';
                return (
                  <View key={attr}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: t.foreground, fontSize: 14 }}>{attr}</Text>
                      <TextInput
                        value={val}
                        onChangeText={(v) => setAttrValue(attr, v)}
                        keyboardType="number-pad"
                        maxLength={2}
                        style={{ backgroundColor: t.muted, borderRadius: 6, padding: 4, paddingHorizontal: 8, color: barColor, fontWeight: '700', fontSize: 14, minWidth: 40, textAlign: 'center', borderWidth: 1, borderColor: t.border }}
                      />
                    </View>
                    <View style={{ height: 5, backgroundColor: t.muted, borderRadius: 3 }}>
                      <View style={{ height: 5, backgroundColor: barColor, borderRadius: 3, width: `${Math.min(100, (numVal / 99) * 100)}%` }} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Step 3: Performance */}
          {step === 3 && (
            <View style={{ gap: 16 }}>
              <Text style={{ color: t.foreground, fontWeight: '800', fontSize: 18 }}>Verified Performance Data</Text>
              <View style={{ backgroundColor: '#FEF9C3', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#FDE047' }}>
                <Text style={{ color: '#854D0E', fontSize: 13 }}>
                  📋 Honest data required. Our admin team reviews all submissions. False stats will be rejected.
                </Text>
              </View>
              {[
                { label: 'Win Rate % *', val: winRate, set: setWinRate, placeholder: '55', keyboard: 'decimal-pad' as const },
                { label: 'Mode Played *', val: modePlayed, set: setModePlayed, placeholder: 'Online Ranked, Rec, etc.' },
                { label: 'Average Grade (A/B/C) *', val: avgGrade, set: setAvgGrade, placeholder: 'A' },
                { label: 'Shot / Play Efficiency % *', val: shotEfficiency, set: setShotEfficiency, placeholder: '48', keyboard: 'decimal-pad' as const },
                { label: 'Patch Version *', val: patchVersion, set: setPatchVersion, placeholder: 'e.g. 1.5' },
              ].map((f) => (
                <View key={f.label}>
                  <Text style={{ color: t.mutedForeground, fontSize: 13, marginBottom: 6 }}>{f.label}</Text>
                  <TextInput
                    value={f.val}
                    onChangeText={f.set}
                    placeholder={f.placeholder}
                    placeholderTextColor={t.mutedForeground}
                    keyboardType={f.keyboard}
                    style={{ backgroundColor: t.muted, borderRadius: 10, padding: 14, color: t.foreground, fontSize: 15, borderWidth: 1, borderColor: t.border }}
                  />
                </View>
              ))}
            </View>
          )}

          {/* Step 4: Build DNA (playstyle vector) */}
          {step === 4 && (
            <View style={{ gap: 16 }}>
              <Text style={{ color: t.foreground, fontWeight: '800', fontSize: 18 }}>Build DNA</Text>
              <Text style={{ color: t.mutedForeground, fontSize: 13 }}>
                Rate this build's playstyle. This powers the compatibility matching engine.
              </Text>
              {PLAYSTYLE_DIMENSIONS.map((dim, i) => (
                <View key={dim.key} style={{ backgroundColor: t.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: t.border }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: t.mutedForeground, fontSize: 11, flex: 1 }}>{dim.low}</Text>
                    <Text style={{ color: '#7C3AED', fontWeight: '800', fontSize: 16, marginHorizontal: 12 }}>{buildVector[i]}</Text>
                    <Text style={{ color: t.mutedForeground, fontSize: 11, flex: 1, textAlign: 'right' }}>{dim.high}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                      <Pressable
                        key={v}
                        onPress={() => {
                          const next = [...buildVector];
                          next[i] = v;
                          setBuildVector(next);
                        }}
                        style={{
                          flex: 1, height: 32, borderRadius: 5,
                          backgroundColor: buildVector[i] >= v ? '#7C3AED' : t.muted,
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                        <Text style={{ color: buildVector[i] >= v ? '#fff' : t.mutedForeground, fontSize: 10, fontWeight: '700' }}>{v}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Step 5: Review & Submit */}
          {step === 5 && (
            <View style={{ gap: 14 }}>
              <Text style={{ color: t.foreground, fontWeight: '800', fontSize: 18 }}>Review & Submit</Text>

              <View style={{ backgroundColor: t.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: t.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: t.foreground, fontWeight: '800', fontSize: 16 }}>{title || 'Untitled Build'}</Text>
                  <Text style={{ color: '#7C3AED', fontWeight: '800', fontSize: 18 }}>${price}</Text>
                </View>
                <Text style={{ color: t.mutedForeground, fontSize: 13, marginBottom: 4 }}>{gameType} • {position} • {archetype}</Text>
                <Text style={{ color: t.mutedForeground, fontSize: 12, marginBottom: 12 }}>{badges.length} badges • {attrList.length} attributes</Text>

                <View style={{ backgroundColor: '#EDE9FE', borderRadius: 10, padding: 12 }}>
                  <Text style={{ color: '#7C3AED', fontWeight: '700', fontSize: 14 }}>💰 Your Earnings</Text>
                  <Text style={{ color: '#7C3AED', fontSize: 13, marginTop: 4 }}>
                    You receive 70% = ${(parseFloat(price || '0') * 0.7).toFixed(2)} per sale
                  </Text>
                  <Text style={{ color: '#9CA3AF', fontSize: 11 }}>Platform fee: 30% = ${(parseFloat(price || '0') * 0.3).toFixed(2)}</Text>
                </View>
              </View>

              <View style={{ backgroundColor: '#FEF9C3', borderRadius: 10, padding: 12 }}>
                <Text style={{ color: '#854D0E', fontSize: 12, lineHeight: 18 }}>
                  By submitting, you confirm this build is your original work and the performance data is accurate.
                  Your listing will be live once reviewed by our admin team.
                </Text>
              </View>

              <Pressable
                onPress={handleSubmit}
                disabled={submitting}
                style={{ backgroundColor: '#7C3AED', borderRadius: 14, padding: 18, alignItems: 'center' }}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>Submit for Review</Text>}
              </Pressable>
            </View>
          )}

          {/* Navigation */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 40 }}>
            {step > 1 && (
              <Pressable onPress={() => setStep(step - 1)} style={{ flex: 1, backgroundColor: t.muted, borderRadius: 12, padding: 14, alignItems: 'center' }}>
                <Text style={{ color: t.foreground, fontWeight: '700' }}>← Previous</Text>
              </Pressable>
            )}
            {step < 5 && (
              <Pressable onPress={() => setStep(step + 1)} style={{ flex: 1, backgroundColor: '#7C3AED', borderRadius: 12, padding: 14, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Next →</Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
