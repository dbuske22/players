import { api } from '@/lib/api';
import { THEME } from '@/lib/theme';
import type { BuildAttributes, Position } from '@/lib/types';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

const CURRENT_USER = { id: 'user1', name: 'MyPlayer2K' };

const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

const ARCHETYPES: Record<Position, string[]> = {
  PG: ['Playmaker', 'Pure Sharpshooter', 'Slasher', 'Two-Way Playmaker', 'Athletic Finisher'],
  SG: ['Pure Sharpshooter', 'Slasher', 'Two-Way Sharpshooter', 'Playmaker', 'Athletic Finisher'],
  SF: ['Slasher', 'Two-Way Finisher', 'Sharpshooter', 'Playmaker', 'Athletic Finisher'],
  PF: ['Glass Cleaner', 'Slasher', 'Stretch Four', 'Two-Way Finisher', 'Playmaker'],
  C: ['Glass Cleaner', 'Interior Scorer', 'Stretch Five', 'Two-Way Center', 'Playmaker'],
};

const HEIGHTS: Record<Position, string[]> = {
  PG: ['5\'10"', '5\'11"', '6\'0"', '6\'1"', '6\'2"', '6\'3"'],
  SG: ['6\'2"', '6\'3"', '6\'4"', '6\'5"', '6\'6"', '6\'7"'],
  SF: ['6\'5"', '6\'6"', '6\'7"', '6\'8"', '6\'9"'],
  PF: ['6\'7"', '6\'8"', '6\'9"', '6\'10"', '6\'11"'],
  C: ['6\'10"', '6\'11"', '7\'0"', '7\'1"', '7\'2"', '7\'3"'],
};

const ATTR_GROUPS: { label: string; keys: (keyof BuildAttributes)[] }[] = [
  { label: 'Athleticism', keys: ['speed', 'acceleration', 'verticalLeap', 'strength', 'stamina'] },
  { label: 'Offense', keys: ['ballHandling', 'passAccuracy', 'threePointer', 'midRange', 'layup', 'dunkPower'] },
  { label: 'Defense', keys: ['interiorDefense', 'perimeterDefense', 'steal', 'block'] },
  { label: 'Rebounding', keys: ['offensiveRebound', 'defensiveRebound'] },
];

const ATTR_DISPLAY: Record<keyof BuildAttributes, string> = {
  speed: 'Speed',
  acceleration: 'Acceleration',
  verticalLeap: 'Vertical Leap',
  strength: 'Strength',
  stamina: 'Stamina',
  ballHandling: 'Ball Handling',
  passAccuracy: 'Pass Accuracy',
  threePointer: 'Three Pointer',
  midRange: 'Mid-Range',
  layup: 'Layup',
  dunkPower: 'Dunk Power',
  interiorDefense: 'Interior Defense',
  perimeterDefense: 'Perimeter Defense',
  steal: 'Steal',
  block: 'Block',
  offensiveRebound: 'Off. Rebound',
  defensiveRebound: 'Def. Rebound',
};

const DEFAULT_ATTRS: BuildAttributes = {
  speed: 65, acceleration: 65, verticalLeap: 65, strength: 65, stamina: 65,
  ballHandling: 65, passAccuracy: 65, threePointer: 65, midRange: 65,
  layup: 65, dunkPower: 65, interiorDefense: 65, perimeterDefense: 65,
  steal: 65, block: 65, offensiveRebound: 65, defensiveRebound: 65,
};

function attrColor(v: number) {
  if (v >= 90) return '#22C55E';
  if (v >= 75) return '#3B82F6';
  if (v >= 60) return '#F59E0B';
  return '#EF4444';
}

function AttrRow({
  label, value, onChange, theme,
}: {
  label: string; value: number; onChange: (v: number) => void;
  theme: typeof THEME.light;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <Text style={{ color: theme.foreground, fontSize: 13 }}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Pressable
            onPress={() => onChange(Math.max(25, value - 1))}
            style={{
              backgroundColor: theme.muted, borderRadius: 6,
              width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
            }}>
            <Text style={{ color: theme.foreground, fontWeight: '700', fontSize: 16, lineHeight: 18 }}>−</Text>
          </Pressable>
          <Text style={{ color: attrColor(value), fontWeight: '800', fontSize: 16, minWidth: 26, textAlign: 'center' }}>
            {value}
          </Text>
          <Pressable
            onPress={() => onChange(Math.min(99, value + 1))}
            style={{
              backgroundColor: theme.muted, borderRadius: 6,
              width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
            }}>
            <Text style={{ color: theme.foreground, fontWeight: '700', fontSize: 16, lineHeight: 18 }}>+</Text>
          </Pressable>
        </View>
      </View>
      <View style={{ backgroundColor: theme.muted, borderRadius: 4, height: 5 }}>
        <View
          style={{
            backgroundColor: attrColor(value),
            borderRadius: 4, height: 5,
            width: `${((value - 25) / 74) * 100}%`,
          }}
        />
      </View>
    </View>
  );
}

export default function SellScreen() {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const router = useRouter();

  const [name, setName] = useState('');
  const [position, setPosition] = useState<Position>('PG');
  const [archetype, setArchetype] = useState(ARCHETYPES['PG'][0]);
  const [height, setHeight] = useState(HEIGHTS['PG'][2]);
  const [weight, setWeight] = useState('185');
  const [price, setPrice] = useState('10000');
  const [description, setDescription] = useState('');
  const [attributes, setAttributes] = useState<BuildAttributes>({ ...DEFAULT_ATTRS });
  const [submitting, setSubmitting] = useState(false);

  const setAttr = (key: keyof BuildAttributes, val: number) => {
    setAttributes((prev) => ({ ...prev, [key]: val }));
  };

  const handlePositionChange = (p: Position) => {
    setPosition(p);
    setArchetype(ARCHETYPES[p][0]);
    setHeight(HEIGHTS[p][Math.floor(HEIGHTS[p].length / 2)]);
  };

  const validate = (): string | null => {
    if (!name.trim()) return 'Build name is required';
    if (!description.trim()) return 'Description is required';
    const w = parseInt(weight);
    if (isNaN(w) || w < 100 || w > 350) return 'Weight must be between 100-350 lbs';
    const p = parseInt(price);
    if (isNaN(p) || p < 1000) return 'Price must be at least 1,000 VC';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { Alert.alert('Validation Error', err); return; }

    setSubmitting(true);
    try {
      await api.createBuild({
        sellerId: CURRENT_USER.id,
        sellerName: CURRENT_USER.name,
        name: name.trim(),
        position,
        archetype,
        height,
        weight: parseInt(weight),
        price: parseInt(price),
        description: description.trim(),
        attributes,
      });
      Alert.alert('Listed!', 'Your build is now on the marketplace.', [
        { text: 'View Marketplace', onPress: () => router.replace('/(tabs)') },
      ]);
      setName('');
      setDescription('');
      setWeight('185');
      setPrice('10000');
      setAttributes({ ...DEFAULT_ATTRS });
      setPosition('PG');
      setArchetype(ARCHETYPES['PG'][0]);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    backgroundColor: theme.muted,
    borderRadius: 10,
    padding: 12,
    color: theme.foreground,
    fontSize: 15,
    borderWidth: 1,
    borderColor: theme.border,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={{ backgroundColor: '#7C3AED', paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 }}>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 26 }}>List a Build</Text>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 }}>
          Set up your 2K26 build for sale
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        {/* Build Name */}
        <Text style={{ color: theme.mutedForeground, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
          BUILD NAME
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Elite Sharpshooter"
          placeholderTextColor={theme.mutedForeground}
          style={[inputStyle, { marginBottom: 20 }]}
        />

        {/* Position */}
        <Text style={{ color: theme.mutedForeground, fontSize: 11, fontWeight: '700', marginBottom: 8 }}>
          POSITION
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {POSITIONS.map((p) => (
            <Pressable
              key={p}
              onPress={() => handlePositionChange(p)}
              style={{
                flex: 1,
                backgroundColor: position === p ? '#7C3AED' : theme.muted,
                borderRadius: 10,
                paddingVertical: 10,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: position === p ? '#7C3AED' : theme.border,
              }}>
              <Text style={{ color: position === p ? '#fff' : theme.foreground, fontWeight: '700', fontSize: 13 }}>
                {p}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Archetype */}
        <Text style={{ color: theme.mutedForeground, fontSize: 11, fontWeight: '700', marginBottom: 8 }}>
          ARCHETYPE
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
          {ARCHETYPES[position].map((a) => (
            <Pressable
              key={a}
              onPress={() => setArchetype(a)}
              style={{
                backgroundColor: archetype === a ? '#1E1B4B' : theme.muted,
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderWidth: 1,
                borderColor: archetype === a ? '#7C3AED' : theme.border,
              }}>
              <Text style={{ color: archetype === a ? '#fff' : theme.foreground, fontWeight: '600', fontSize: 13 }}>
                {a}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Height */}
        <Text style={{ color: theme.mutedForeground, fontSize: 11, fontWeight: '700', marginBottom: 8 }}>
          HEIGHT
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
          {HEIGHTS[position].map((h) => (
            <Pressable
              key={h}
              onPress={() => setHeight(h)}
              style={{
                backgroundColor: height === h ? '#7C3AED' : theme.muted,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderWidth: 1,
                borderColor: height === h ? '#7C3AED' : theme.border,
              }}>
              <Text style={{ color: height === h ? '#fff' : theme.foreground, fontWeight: '600', fontSize: 13 }}>
                {h}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Weight & Price */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.mutedForeground, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
              WEIGHT (lbs)
            </Text>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
              placeholder="185"
              placeholderTextColor={theme.mutedForeground}
              style={inputStyle}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.mutedForeground, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
              PRICE (VC)
            </Text>
            <TextInput
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              placeholder="10000"
              placeholderTextColor={theme.mutedForeground}
              style={inputStyle}
            />
          </View>
        </View>

        {/* Description */}
        <Text style={{ color: theme.mutedForeground, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
          DESCRIPTION
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Describe your build's strengths and playstyle..."
          placeholderTextColor={theme.mutedForeground}
          multiline
          numberOfLines={3}
          style={[inputStyle, { marginBottom: 24, minHeight: 80, textAlignVertical: 'top' }]}
        />

        {/* Attributes */}
        <Text style={{ color: theme.foreground, fontWeight: '800', fontSize: 18, marginBottom: 16 }}>
          Attributes
        </Text>

        {ATTR_GROUPS.map((group) => (
          <View
            key={group.label}
            style={{
              backgroundColor: theme.card,
              borderRadius: 14,
              padding: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: theme.border,
            }}>
            <Text style={{ color: '#7C3AED', fontWeight: '700', fontSize: 13, marginBottom: 14, letterSpacing: 0.5 }}>
              {group.label.toUpperCase()}
            </Text>
            {group.keys.map((key) => (
              <AttrRow
                key={key}
                label={ATTR_DISPLAY[key]}
                value={attributes[key]}
                onChange={(v) => setAttr(key, v)}
                theme={theme}
              />
            ))}
          </View>
        ))}

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={{
            backgroundColor: submitting ? theme.muted : '#7C3AED',
            borderRadius: 14,
            paddingVertical: 18,
            alignItems: 'center',
            marginTop: 8,
          }}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>
              List Build for {parseInt(price || '0').toLocaleString()} VC
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
