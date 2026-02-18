import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, ScrollView,
  ActivityIndicator, TextInput, Alert, Image, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { buildsApi, purchasesApi, reviewsApi } from '@/lib/api';
import { calcCompatibility, getMatchColor } from '@/lib/compatibility';
import { useAuthStore } from '@/lib/store';
import type { Build, Purchase } from '@/lib/types';

const GAME_LABEL: Record<string, string> = {
  basketball: 'Basketball Sim',
  football: 'Football Sim',
  hockey: 'Hockey Sim',
};

function fmtHeight(inches: number | null | undefined) {
  if (!inches) return null;
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

function StarRating({ rating, onRate }: { rating: number; onRate?: (r: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Pressable key={s} onPress={() => onRate?.(s)}>
          <Text style={{ fontSize: 20, color: s <= rating ? '#F59E0B' : '#D1D5DB' }}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function BuildDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const { token, user } = useAuthStore();

  const [build, setBuild] = useState<Build | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [myPurchase, setMyPurchase] = useState<Purchase | null>(null);
  const [qr, setQr] = useState<{ qr: string; import_code: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [showFlag, setShowFlag] = useState(false);
  const [tooltip, setTooltip] = useState<{ label: string; desc: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    buildsApi.get(id).then(setBuild).catch(() => {}).finally(() => setLoading(false));
    if (token) {
      purchasesApi.myPurchases(token).then((purchases) => {
        const match = purchases.find((p) => p.build_id === id);
        if (match) setMyPurchase(match);
      }).catch(() => {});
    }
  }, [id, token]);

  const handlePurchase = async () => {
    if (!token) { router.push('/auth/login'); return; }
    if (!build) return;
    Alert.alert(
      'Confirm Purchase',
      `Buy "${build.title}" for $${build.price.toFixed(2)}?\n\nYou'll receive the import code instantly after payment.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy Now', onPress: async () => {
            setPurchasing(true);
            try {
              const result = await purchasesApi.checkout(token, build.id);
              if (result.demo) {
                // Demo mode
                const confirmed = await purchasesApi.confirm(token, build.id, 'demo_' + Date.now());
                setMyPurchase(confirmed);
                setBuild((b) => b ? { ...b, status: 'sold' } : b);
                Alert.alert('Purchase Complete!', 'This is a demo purchase. In production, Stripe handles real payments.\n\nYour import code is now available below.');
              } else if (result.client_secret) {
                // In real mode - Stripe web would handle this
                const confirmed = await purchasesApi.confirm(token, build.id, result.payment_intent_id!);
                setMyPurchase(confirmed);
                setBuild((b) => b ? { ...b, status: 'sold' } : b);
                Alert.alert('Purchase Complete!', 'Your import code is available below.');
              }
            } catch (e: unknown) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Purchase failed');
            } finally {
              setPurchasing(false);
            }
          },
        },
      ]
    );
  };

  const handleGetQR = async () => {
    if (!token || !build) return;
    setQrLoading(true);
    try {
      const data = await buildsApi.getQR(token, build.id);
      setQr(data);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not load QR');
    } finally {
      setQrLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!token || !myPurchase) return;
    setSubmittingReview(true);
    try {
      await reviewsApi.create(token, build!.id, {
        rating: reviewRating,
        comment: reviewComment || undefined,
        purchase_id: myPurchase.id,
      });
      const updated = await buildsApi.get(id!);
      setBuild(updated);
      setShowReviewForm(false);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleFlag = async () => {
    if (!token) return;
    try {
      await buildsApi.flag(token, build!.id, flagReason);
      Alert.alert('Flagged', 'Thank you for your report. Our team will review it.');
      setShowFlag(false);
    } catch {
      Alert.alert('Error', 'Could not submit report');
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  if (!build) {
    return (
      <View style={{ flex: 1, backgroundColor: t.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: t.foreground, fontSize: 18, fontWeight: '700' }}>Build not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: '#7C3AED' }}>← Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const compat = user && user.playstyle_vector ? calcCompatibility(user, build) : null;
  const matchColor = compat ? getMatchColor(compat.score) : '#7C3AED';
  const isOwner = user?.id === build.seller_id;
  const isSold = build.status === 'sold';
  const alreadyBought = !!myPurchase;
  const gameColor = build.game_type === 'basketball' ? '#F97316' : build.game_type === 'football' ? '#10B981' : '#3B82F6';
  const hasReviewed = build.reviews?.some((r) => r.buyer_id === user?.id);

    return (
      <ScrollView style={{ flex: 1, backgroundColor: t.background }}>
        {/* Tooltip Modal */}
        <Modal visible={!!tooltip} transparent animationType="fade" onRequestClose={() => setTooltip(null)}>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 32 }}
            onPress={() => setTooltip(null)}
          >
            <View style={{ backgroundColor: t.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 }}>
              <Text style={{ color: t.foreground, fontWeight: '800', fontSize: 17, marginBottom: 10 }}>{tooltip?.label}</Text>
              <Text style={{ color: t.foreground, fontSize: 14, lineHeight: 22 }}>{tooltip?.desc}</Text>
              <Pressable
                onPress={() => setTooltip(null)}
                style={{ marginTop: 18, backgroundColor: '#7C3AED', borderRadius: 10, padding: 12, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Got it</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      {/* Header */}
      <View style={{ backgroundColor: gameColor, paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 }}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: 12 }}>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>← Back to Marketplace</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            {build.featured && (
              <View style={{ backgroundColor: '#FFD700', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 6 }}>
                <Text style={{ color: '#000', fontSize: 11, fontWeight: '800' }}>⭐ FEATURED</Text>
              </View>
            )}
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 22, marginBottom: 4 }}>{build.title}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
              {build.position} • {build.archetype} • {GAME_LABEL[build.game_type] || build.game_type}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 }}>
              by {build.seller?.username || 'Unknown'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 28 }}>${build.price.toFixed(2)}</Text>
            {build.avg_rating && (
              <Text style={{ color: '#FFD700', fontSize: 14 }}>★ {build.avg_rating} ({build.reviews?.length} reviews)</Text>
            )}
          </View>
        </View>
      </View>

      <View style={{ padding: 16, gap: 14 }}>
        {/* Compatibility Card */}
        {compat && (
          <View style={{ backgroundColor: t.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: t.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ color: t.foreground, fontWeight: '800', fontSize: 16 }}>Your Compatibility</Text>
              <View style={{ backgroundColor: matchColor + '20', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: matchColor, fontWeight: '800', fontSize: 15 }}>⭐ {compat.score}% {compat.label}</Text>
              </View>
            </View>
            <View style={{ height: 8, backgroundColor: t.muted, borderRadius: 4, marginBottom: 12 }}>
              <View style={{ height: 8, backgroundColor: matchColor, borderRadius: 4, width: `${compat.score}%` }} />
            </View>

            {/* Predicted win boost */}
            <View style={{ backgroundColor: compat.predictedWinBoost >= 0 ? '#DCFCE7' : '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <Text style={{ color: compat.predictedWinBoost >= 0 ? '#15803D' : '#DC2626', fontWeight: '700', fontSize: 14 }}>
                📊 Predicted Win Rate Boost: {compat.predictedWinBoost >= 0 ? '+' : ''}{compat.predictedWinBoost}% for your playstyle
              </Text>
              <Text style={{ color: t.mutedForeground, fontSize: 11, marginTop: 3 }}>
                Estimate based on your scan and this build's performance data. Not guaranteed.
              </Text>
            </View>

            {compat.strengths.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 13, marginBottom: 4 }}>✓ Strengths</Text>
                {compat.strengths.map((s) => (
                  <Text key={s} style={{ color: t.foreground, fontSize: 13, marginBottom: 2 }}>• {s}</Text>
                ))}
              </View>
            )}
            {compat.weaknesses.length > 0 && (
              <View>
                <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 13, marginBottom: 4 }}>⚠ Considerations</Text>
                {compat.weaknesses.map((w) => (
                  <Text key={w} style={{ color: t.foreground, fontSize: 13, marginBottom: 2 }}>• {w}</Text>
                ))}
              </View>
            )}
          </View>
        )}

          {/* Performance Stats */}
          <View style={{ backgroundColor: t.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: t.border }}>
            <Text style={{ color: t.foreground, fontWeight: '800', fontSize: 16, marginBottom: 12 }}>Verified Performance</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[
                {
                  label: 'Speed',
                  val: build.performance?.speed != null ? `${build.performance.speed}%` : '—',
                  icon: '⚡',
                  desc: 'How fast the character moves on the court/field. Higher speed means quicker bursts, better transition play, and ability to blow past defenders.',
                },
                {
                  label: 'Shooting',
                  val: build.performance?.shooting != null ? `${build.performance.shooting}%` : '—',
                  icon: '🎯',
                  desc: 'Overall scoring ability from range and mid-range. A high shooting rating means reliable jump shots, deep threes, and consistent scoring.',
                },
                {
                  label: 'Defense',
                  val: build.performance?.defense != null ? `${build.performance.defense}%` : '—',
                  icon: '🛡️',
                  desc: 'How well the build stops opponents — perimeter defense, on-ball pressure, steal attempts, and contest quality.',
                },
                {
                  label: 'Playmaking',
                  val: build.performance?.playmaking != null ? `${build.performance.playmaking}%` : '—',
                  icon: '🧠',
                  desc: 'Ball-handling, passing vision, and ability to create for yourself and teammates. Elite playmaking means consistent dimes and tight dribble combos.',
                },
                {
                  label: 'Athleticism',
                  val: build.performance?.athleticism != null ? `${build.performance.athleticism}%` : '—',
                  icon: '💪',
                  desc: 'Physical tools: vertical jump, strength, stamina, and body control. High athleticism helps with dunks, rebounding, and winning 50/50 battles.',
                },


              ].map((s) => (
                <Pressable
                  key={s.label}
                  onPress={() => setTooltip({ label: s.label, desc: s.desc })}
                  style={{ width: '47%', backgroundColor: t.muted, borderRadius: 10, padding: 12 }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</Text>
                    <Text style={{ color: t.mutedForeground, fontSize: 10, marginTop: 2 }}>ⓘ</Text>
                  </View>
                  <Text style={{ color: t.mutedForeground, fontSize: 11 }}>{s.label}</Text>
                  <Text style={{ color: t.foreground, fontWeight: '700', fontSize: 15 }}>{s.val}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Attributes — locked until purchased */}
          {build.attributes?.length > 0 && (
            <View style={{ backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.border, overflow: 'hidden' }}>
              <View style={{ padding: 16 }}>
                <Text style={{ color: t.foreground, fontWeight: '800', fontSize: 16, marginBottom: 12 }}>Attributes</Text>
                {alreadyBought ? (
                  <View style={{ gap: 8 }}>
                    {build.attributes.map((attr) => {
                      const numVal = typeof attr.value === 'number' ? attr.value : parseInt(String(attr.value)) || 0;
                      const pct = Math.min(100, (numVal / 99) * 100);
                      const barColor = pct >= 90 ? '#10B981' : pct >= 75 ? '#3B82F6' : pct >= 60 ? '#F59E0B' : '#EF4444';
                      return (
                        <View key={attr.key}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                            <Text style={{ color: t.foreground, fontSize: 13 }}>{attr.key}</Text>
                            <Text style={{ color: barColor, fontWeight: '700', fontSize: 13 }}>{attr.value}</Text>
                          </View>
                          <View style={{ height: 5, backgroundColor: t.muted, borderRadius: 3 }}>
                            <View style={{ height: 5, backgroundColor: barColor, borderRadius: 3, width: `${pct}%` }} />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View>
                    {/* Blurred preview rows */}
                    {build.attributes.slice(0, 4).map((attr) => (
                      <View key={attr.key} style={{ marginBottom: 10, opacity: 0.18 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                          <Text style={{ color: t.foreground, fontSize: 13 }}>{attr.key}</Text>
                          <Text style={{ color: '#7C3AED', fontWeight: '700', fontSize: 13 }}>??</Text>
                        </View>
                        <View style={{ height: 5, backgroundColor: t.muted, borderRadius: 3 }}>
                          <View style={{ height: 5, backgroundColor: '#7C3AED', borderRadius: 3, width: '65%' }} />
                        </View>
                      </View>
                    ))}
                    {/* Lock overlay */}
                    <View style={{ backgroundColor: '#EDE9FE', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4 }}>
                      <Text style={{ fontSize: 24, marginBottom: 6 }}>🔒</Text>
                      <Text style={{ color: '#7C3AED', fontWeight: '800', fontSize: 14, textAlign: 'center' }}>
                        Full attribute breakdown unlocks after purchase
                      </Text>
                      <Text style={{ color: '#6D28D9', fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                        {(build as Build & { attribute_count?: number }).attribute_count ?? build.attributes.length} attributes included
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

        {/* Badges — locked until purchased */}
        {build.badges?.length > 0 && (
          <View style={{ backgroundColor: t.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: t.border }}>
            <Text style={{ color: t.foreground, fontWeight: '800', fontSize: 16, marginBottom: 12 }}>Badges</Text>
            {alreadyBought ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {build.badges.map((b) => (
                  <View key={b} style={{ backgroundColor: '#EDE9FE', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ color: '#7C3AED', fontWeight: '600', fontSize: 13 }}>{b}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {build.badges.slice(0, 3).map((b) => (
                  <View key={b} style={{ backgroundColor: '#EDE9FE', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, opacity: 0.3 }}>
                    <Text style={{ color: '#7C3AED', fontWeight: '600', fontSize: 13 }}>{b}</Text>
                  </View>
                ))}
                <View style={{ backgroundColor: '#EDE9FE', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ color: '#7C3AED', fontWeight: '700', fontSize: 13 }}>🔒 +{build.badges.length - 3 > 0 ? build.badges.length - 3 : '?'} more after purchase</Text>
                </View>
              </View>
            )}
          </View>
        )}

          {/* Import Code / QR + Description (purchased users only) */}
            {alreadyBought && (
                <View style={{ backgroundColor: '#DCFCE7', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#86EFAC' }}>
                  <Text style={{ color: '#15803D', fontWeight: '800', fontSize: 16, marginBottom: 12 }}>✓ You Own This Build</Text>
                  {build.description && (
                    <View style={{ backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                      <Text style={{ color: '#15803D', fontWeight: '700', fontSize: 12, marginBottom: 4 }}>ABOUT THIS BUILD</Text>
                      <Text style={{ color: '#111', fontSize: 14, lineHeight: 22 }}>{build.description}</Text>
                    </View>
                  )}

                {/* Character Body Visualization */}
                {(build.height_in || build.weight_lbs) && (
                  <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, alignItems: 'center' }}>
                    <Text style={{ color: '#15803D', fontWeight: '700', fontSize: 13, marginBottom: 12 }}>YOUR CHARACTER</Text>
                    {/* SVG-based body silhouette scaled to height/weight */}
                    {(() => {
                      const h = build.height_in ?? 78;
                      const w = build.weight_lbs ?? 220;
                      // Normalize: height 60"–90", weight 150–300 lbs
                      const heightPct = Math.min(1, Math.max(0, (h - 60) / 30));
                      const widthPct = Math.min(1, Math.max(0, (w - 150) / 150));
                      const figureH = 140 + heightPct * 60; // 140–200px tall
                      const shoulderW = 54 + widthPct * 30; // 54–84px wide
                      const hipW = shoulderW * 0.85;
                      const headR = 18 + widthPct * 4;
                      const legLen = figureH * 0.45;
                      const torsoH = figureH * 0.35;
                      const armLen = figureH * 0.38;
                      const cx = 80;
                      const topY = 10;
                      const headCY = topY + headR;
                      const neckY = headCY + headR;
                      const shoulderY = neckY + 8;
                      const waistY = shoulderY + torsoH;
                      const hipY = waistY + 8;
                      const kneeY = hipY + legLen * 0.5;
                      const footY = hipY + legLen;
                      const svgH = footY + 16;
                      const bodyColor = gameColor;
                      return (
                        <View style={{ height: svgH, width: 160, alignItems: 'center' }}>
                          {/* Head */}
                          <View style={{
                            position: 'absolute',
                            top: headCY - headR,
                            left: cx - headR,
                            width: headR * 2,
                            height: headR * 2,
                            borderRadius: headR,
                            backgroundColor: '#FBBF24',
                            borderWidth: 2,
                            borderColor: bodyColor,
                          }} />
                          {/* Torso */}
                          <View style={{
                            position: 'absolute',
                            top: shoulderY,
                            left: cx - shoulderW / 2,
                            width: shoulderW,
                            height: torsoH,
                            backgroundColor: bodyColor,
                            borderTopLeftRadius: 8,
                            borderTopRightRadius: 8,
                            borderBottomLeftRadius: 4,
                            borderBottomRightRadius: 4,
                          }} />
                          {/* Left Arm */}
                          <View style={{
                            position: 'absolute',
                            top: shoulderY,
                            left: cx - shoulderW / 2 - 10,
                            width: 10,
                            height: armLen,
                            backgroundColor: bodyColor,
                            borderRadius: 5,
                            transform: [{ rotate: '8deg' }],
                          }} />
                          {/* Right Arm */}
                          <View style={{
                            position: 'absolute',
                            top: shoulderY,
                            left: cx + shoulderW / 2,
                            width: 10,
                            height: armLen,
                            backgroundColor: bodyColor,
                            borderRadius: 5,
                            transform: [{ rotate: '-8deg' }],
                          }} />
                          {/* Left Leg */}
                          <View style={{
                            position: 'absolute',
                            top: hipY,
                            left: cx - hipW / 2,
                            width: hipW * 0.42,
                            height: legLen,
                            backgroundColor: '#374151',
                            borderRadius: 5,
                          }} />
                          {/* Right Leg */}
                          <View style={{
                            position: 'absolute',
                            top: hipY,
                            left: cx + hipW / 2 - hipW * 0.42,
                            width: hipW * 0.42,
                            height: legLen,
                            backgroundColor: '#374151',
                            borderRadius: 5,
                          }} />
                          {/* Number on jersey */}
                          <Text style={{
                            position: 'absolute',
                            top: shoulderY + torsoH * 0.25,
                            left: cx - 10,
                            color: '#fff',
                            fontWeight: '900',
                            fontSize: 13,
                          }}>
                            {build.position === 'PG' ? '1' : build.position === 'SG' ? '2' : build.position === 'SF' ? '3' : build.position === 'PF' ? '4' : '5'}
                          </Text>
                        </View>
                      );
                    })()}
                    {/* Stats row */}
                    <View style={{ flexDirection: 'row', gap: 20, marginTop: 8 }}>
                      {build.height_in && (
                        <View style={{ alignItems: 'center' }}>
                          <Text style={{ color: '#6B7280', fontSize: 11 }}>HEIGHT</Text>
                          <Text style={{ color: '#111', fontWeight: '800', fontSize: 16 }}>{fmtHeight(build.height_in)}</Text>
                        </View>
                      )}
                      {build.weight_lbs && (
                        <View style={{ alignItems: 'center' }}>
                          <Text style={{ color: '#6B7280', fontSize: 11 }}>WEIGHT</Text>
                          <Text style={{ color: '#111', fontWeight: '800', fontSize: 16 }}>{build.weight_lbs} lbs</Text>
                        </View>
                      )}
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ color: '#6B7280', fontSize: 11 }}>POSITION</Text>
                        <Text style={{ color: '#111', fontWeight: '800', fontSize: 16 }}>{build.position}</Text>
                      </View>
                    </View>
                  </View>
                )}
            {build.import_code && (
              <View style={{ backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <Text style={{ color: '#6B7280', fontSize: 11, marginBottom: 4 }}>IMPORT CODE</Text>
                <Text style={{ color: '#111', fontSize: 13, fontFamily: 'monospace' }} selectable>{build.import_code}</Text>
              </View>
            )}
            <Pressable
              onPress={handleGetQR}
              disabled={qrLoading}
              style={{ backgroundColor: '#15803D', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 8 }}>
              {qrLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '700' }}>📷 Get QR Code</Text>
              }
            </Pressable>
            {qr && (
              <View style={{ alignItems: 'center', marginTop: 8 }}>
                <Image source={{ uri: qr.qr }} style={{ width: 200, height: 200 }} resizeMode="contain" />
              </View>
            )}
            {!hasReviewed && !showReviewForm && (
              <Pressable
                onPress={() => setShowReviewForm(true)}
                style={{ backgroundColor: '#F59E0B', borderRadius: 10, padding: 10, alignItems: 'center', marginTop: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>⭐ Leave a Review</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Review Form */}
        {showReviewForm && alreadyBought && !hasReviewed && (
          <View style={{ backgroundColor: t.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: t.border }}>
            <Text style={{ color: t.foreground, fontWeight: '800', fontSize: 16, marginBottom: 12 }}>Write a Review</Text>
            <StarRating rating={reviewRating} onRate={setReviewRating} />
            <TextInput
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder="Share your experience with this build..."
              placeholderTextColor={t.mutedForeground}
              multiline
              numberOfLines={3}
              style={{ backgroundColor: t.muted, borderRadius: 10, padding: 12, color: t.foreground, marginTop: 12, minHeight: 80, textAlignVertical: 'top', fontSize: 14, borderWidth: 1, borderColor: t.border }}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Pressable onPress={() => setShowReviewForm(false)} style={{ flex: 1, borderRadius: 10, padding: 12, alignItems: 'center', backgroundColor: t.muted }}>
                <Text style={{ color: t.foreground, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmitReview}
                disabled={submittingReview}
                style={{ flex: 1, borderRadius: 10, padding: 12, alignItems: 'center', backgroundColor: '#7C3AED' }}>
                {submittingReview ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Submit</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {/* Reviews */}
        {build.reviews && build.reviews.length > 0 && (
          <View style={{ backgroundColor: t.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: t.border }}>
            <Text style={{ color: t.foreground, fontWeight: '800', fontSize: 16, marginBottom: 12 }}>
              Reviews ({build.reviews.length})
            </Text>
            {build.reviews.map((r) => (
              <View key={r.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: t.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ color: t.foreground, fontWeight: '700', fontSize: 14 }}>
                    {(r as { reviewer?: { username: string } }).reviewer?.username || 'Anonymous'}
                  </Text>
                  <StarRating rating={r.rating} />
                </View>
                {r.comment && <Text style={{ color: t.foreground, fontSize: 13, lineHeight: 20 }}>{r.comment}</Text>}
                <Text style={{ color: t.mutedForeground, fontSize: 11, marginTop: 4 }}>
                  {new Date(r.created_at).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Purchase / Action */}
        {!isOwner && !alreadyBought && !isSold && (
          <Pressable
            onPress={handlePurchase}
            disabled={purchasing}
            style={{ backgroundColor: '#7C3AED', borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 8 }}>
            {purchasing
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>Buy Now — ${build.price.toFixed(2)}</Text>
            }
          </Pressable>
        )}

        {isSold && !alreadyBought && (
          <View style={{ backgroundColor: '#F3F4F6', borderRadius: 14, padding: 16, alignItems: 'center' }}>
            <Text style={{ color: '#6B7280', fontWeight: '700', fontSize: 15 }}>🔒 This build has been sold</Text>
          </View>
        )}

        {isOwner && (
          <View style={{ backgroundColor: '#EDE9FE', borderRadius: 14, padding: 16, alignItems: 'center' }}>
            <Text style={{ color: '#7C3AED', fontWeight: '700', fontSize: 15 }}>This is your listing</Text>
          </View>
        )}

        {/* Flag */}
        {!isOwner && (
          <View style={{ marginBottom: 20 }}>
            {!showFlag ? (
              <Pressable onPress={() => setShowFlag(true)} style={{ alignItems: 'center', padding: 8 }}>
                <Text style={{ color: t.mutedForeground, fontSize: 12 }}>🚩 Report this build</Text>
              </Pressable>
            ) : (
              <View style={{ backgroundColor: t.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: t.border }}>
                <TextInput
                  value={flagReason}
                  onChangeText={setFlagReason}
                  placeholder="Reason for reporting..."
                  placeholderTextColor={t.mutedForeground}
                  style={{ backgroundColor: t.muted, borderRadius: 8, padding: 10, color: t.foreground, fontSize: 13, marginBottom: 10 }}
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable onPress={() => setShowFlag(false)} style={{ flex: 1, backgroundColor: t.muted, borderRadius: 8, padding: 10, alignItems: 'center' }}>
                    <Text style={{ color: t.foreground }}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={handleFlag} style={{ flex: 1, backgroundColor: '#EF4444', borderRadius: 8, padding: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Submit Report</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Legal disclaimer */}
        <View style={{ padding: 12 }}>
          <Text style={{ color: t.mutedForeground, fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
            Templates are user-generated; no affiliation with game publishers. Predictions are estimates only. Users assume risk.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
