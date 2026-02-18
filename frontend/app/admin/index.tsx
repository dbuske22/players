import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, ScrollView,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { adminApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { Build, User } from '@/lib/types';

type AdminTab = 'Pending' | 'Active' | 'Flagged' | 'Users';

const STATUS_COLORS: Record<string, string> = {
  active: '#10B981',
  pending: '#F59E0B',
  rejected: '#EF4444',
  sold: '#6B7280',
};

export default function AdminScreen() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const { token, user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<AdminTab>('Pending');
  const [pendingBuilds, setPendingBuilds] = useState<Build[]>([]);
  const [activeBuilds, setActiveBuilds] = useState<Build[]>([]);
  const [flags, setFlags] = useState<unknown[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const [pending, active, flagData, userData] = await Promise.all([
        adminApi.getBuilds(token, 'pending'),
        adminApi.getBuilds(token, 'active'),
        adminApi.getFlags(token),
        adminApi.getUsers(token),
      ]);
      setPendingBuilds(pending);
      setActiveBuilds(active);
      setFlags(flagData);
      setUsers(userData);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: string) => {
    if (!token) return;
    setActionLoading(id + '-approve');
    try {
      await adminApi.approveBuild(token, id);
      setPendingBuilds((prev) => prev.filter((b) => b.id !== id));
      Alert.alert('Approved', 'Build is now live on the marketplace. Seller notified.');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = (id: string) => {
    Alert.alert('Reject Build', 'This will remove the build from the marketplace.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive', onPress: async () => {
          if (!token) return;
          setActionLoading(id + '-reject');
          try {
            await adminApi.rejectBuild(token, id);
            setPendingBuilds((prev) => prev.filter((b) => b.id !== id));
          } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed to reject');
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };

  const handleFeature = async (id: string, featured: boolean) => {
    if (!token) return;
    setActionLoading(id + '-feature');
    try {
      await adminApi.featureBuild(token, id, !featured);
      setActiveBuilds((prev) => prev.map((b) => b.id === id ? { ...b, featured: !featured } : b));
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveFlag = async (flagId: string) => {
    if (!token) return;
    setActionLoading(flagId + '-flag');
    try {
      await adminApi.resolveFlag(token, flagId);
      setFlags((prev) => (prev as Array<{ id: string }>).filter((f) => f.id !== flagId));
    } catch {
      Alert.alert('Error', 'Failed to resolve flag');
    } finally {
      setActionLoading(null);
    }
  };

  // Guard: only admin can access
  if (!user || user.role !== 'admin') {
    return (
      <View style={{ flex: 1, backgroundColor: t.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🔐</Text>
        <Text style={{ color: t.foreground, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 16 }}>Admin access required</Text>
        <Pressable onPress={() => router.back()} style={{ backgroundColor: '#7C3AED', borderRadius: 12, padding: 14, paddingHorizontal: 24 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const TABS: { label: AdminTab; count: number }[] = [
    { label: 'Pending', count: pendingBuilds.length },
    { label: 'Active', count: activeBuilds.length },
    { label: 'Flagged', count: flags.length },
    { label: 'Users', count: users.length },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      {/* Header */}
      <View style={{ backgroundColor: '#1E1B4B', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20 }}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: 10 }}>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>← Back</Text>
        </Pressable>
        <Text style={{ color: '#FFD700', fontWeight: '900', fontSize: 28, marginBottom: 4 }}>⚙ Admin Panel</Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Manage builds, users, and moderation</Text>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          {[
            { label: 'Pending', val: pendingBuilds.length, color: '#F59E0B' },
            { label: 'Active', val: activeBuilds.length, color: '#10B981' },
            { label: 'Flags', val: flags.length, color: '#EF4444' },
            { label: 'Users', val: users.length, color: '#3B82F6' },
          ].map((s) => (
            <View key={s.label} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 8, alignItems: 'center' }}>
              <Text style={{ color: s.color, fontWeight: '900', fontSize: 20 }}>{s.val}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: t.card, borderBottomWidth: 1, borderBottomColor: t.border }}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.label}
            onPress={() => setActiveTab(tab.label)}
            style={{
              flex: 1, paddingVertical: 12, alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab.label ? '#7C3AED' : 'transparent',
            }}>
            <Text style={{ color: activeTab === tab.label ? '#7C3AED' : t.mutedForeground, fontWeight: '700', fontSize: 11 }}>
              {tab.label}
              {tab.count > 0 && (
                <Text style={{ color: tab.label === 'Flagged' ? '#EF4444' : tab.label === 'Pending' ? '#F59E0B' : '#7C3AED' }}>
                  {' '}({tab.count})
                </Text>
              )}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#7C3AED" />}>

          {/* ── Pending Review ── */}
          {activeTab === 'Pending' && (
            pendingBuilds.length === 0
              ? <EmptyState icon="✅" title="All caught up!" sub="No builds pending review" />
              : pendingBuilds.map((b) => (
                <View key={b.id} style={{ backgroundColor: t.card, borderRadius: 14, marginBottom: 14, borderWidth: 1, borderColor: '#FDE047', overflow: 'hidden' }}>
                  <View style={{ backgroundColor: '#FEF9C3', padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#854D0E', fontWeight: '800', fontSize: 15 }} numberOfLines={1}>{b.title}</Text>
                      <Text style={{ color: '#92400E', fontSize: 12 }}>
                        {b.game_type} • {b.position} • {b.archetype}
                      </Text>
                    </View>
                    <Text style={{ color: '#7C3AED', fontWeight: '900', fontSize: 16 }}>${b.price.toFixed(2)}</Text>
                  </View>

                  <View style={{ padding: 12 }}>
                    <Text style={{ color: t.mutedForeground, fontSize: 12, marginBottom: 4 }}>
                      Seller: {(b as { seller?: { username?: string } }).seller?.username || 'Unknown'}
                    </Text>

                    {/* Performance snapshot */}
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                      {[
                        { label: 'Win Rate', val: `${b.performance?.win_rate}%` },
                        { label: 'Efficiency', val: `${b.performance?.shot_efficiency}%` },
                        { label: 'Grade', val: b.performance?.avg_grade },
                        { label: 'Mode', val: b.performance?.mode_played },
                      ].map((s) => (
                        <View key={s.label} style={{ flex: 1, backgroundColor: t.muted, borderRadius: 6, padding: 6, alignItems: 'center' }}>
                          <Text style={{ color: t.mutedForeground, fontSize: 9 }}>{s.label}</Text>
                          <Text style={{ color: t.foreground, fontWeight: '700', fontSize: 11 }} numberOfLines={1}>{s.val}</Text>
                        </View>
                      ))}
                    </View>

                    {b.badges?.length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                        {b.badges.slice(0, 5).map((badge) => (
                          <View key={badge} style={{ backgroundColor: '#EDE9FE', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 }}>
                            <Text style={{ color: '#7C3AED', fontSize: 10 }}>{badge}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <Pressable
                      onPress={() => router.push(`/build/${b.id}`)}
                      style={{ marginBottom: 10 }}>
                      <Text style={{ color: '#7C3AED', fontSize: 12, fontWeight: '600' }}>View full details →</Text>
                    </Pressable>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Pressable
                        onPress={() => handleReject(b.id)}
                        disabled={!!actionLoading}
                        style={{ flex: 1, backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, alignItems: 'center' }}>
                        <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>✕ Reject</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleApprove(b.id)}
                        disabled={!!actionLoading}
                        style={{ flex: 1, backgroundColor: '#DCFCE7', borderRadius: 10, padding: 12, alignItems: 'center' }}>
                        {actionLoading === b.id + '-approve'
                          ? <ActivityIndicator color="#15803D" size="small" />
                          : <Text style={{ color: '#15803D', fontWeight: '700', fontSize: 13 }}>✓ Approve</Text>
                        }
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))
          )}

          {/* ── Active Builds ── */}
          {activeTab === 'Active' && (
            activeBuilds.length === 0
              ? <EmptyState icon="📦" title="No active listings" sub="Approve pending builds to populate the marketplace" />
              : activeBuilds.map((b) => (
                <View key={b.id} style={{ backgroundColor: t.card, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: t.border, overflow: 'hidden' }}>
                  <View style={{ padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Pressable onPress={() => router.push(`/build/${b.id}`)}>
                        <Text style={{ color: t.foreground, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{b.title}</Text>
                      </Pressable>
                      <Text style={{ color: t.mutedForeground, fontSize: 12 }}>
                        {b.game_type} • {b.position} • ${b.price.toFixed(2)}
                      </Text>
                      <Text style={{ color: t.mutedForeground, fontSize: 11, marginTop: 2 }}>
                        {b.view_count} views • {(b as { seller?: { username?: string } }).seller?.username}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <View style={{ backgroundColor: STATUS_COLORS[b.status] + '20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: STATUS_COLORS[b.status], fontWeight: '700', fontSize: 10, textTransform: 'uppercase' }}>{b.status}</Text>
                      </View>
                      <Pressable
                        onPress={() => handleFeature(b.id, b.featured)}
                        disabled={actionLoading === b.id + '-feature'}
                        style={{
                          backgroundColor: b.featured ? '#FEF9C3' : t.muted,
                          borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
                        }}>
                        {actionLoading === b.id + '-feature'
                          ? <ActivityIndicator size="small" color="#854D0E" />
                          : <Text style={{ color: b.featured ? '#854D0E' : t.mutedForeground, fontSize: 11, fontWeight: '700' }}>
                            {b.featured ? '⭐ Featured' : 'Feature'}
                          </Text>
                        }
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))
          )}

          {/* ── Flagged Reports ── */}
          {activeTab === 'Flagged' && (
            flags.length === 0
              ? <EmptyState icon="🚩" title="No open reports" sub="All flags have been resolved" />
              : (flags as Array<{
                id: string;
                reason: string;
                created_at: string;
                build?: { title?: string; game_type?: string };
                reporter?: { username?: string };
              }>).map((flag) => (
                <View key={flag.id} style={{ backgroundColor: '#FFF5F5', borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA', padding: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 14 }}>🚩 Report</Text>
                    <Text style={{ color: '#9CA3AF', fontSize: 11 }}>{new Date(flag.created_at).toLocaleDateString()}</Text>
                  </View>
                  <Text style={{ color: '#374151', fontWeight: '600', fontSize: 13, marginBottom: 4 }}>
                    Build: {flag.build?.title || 'Unknown'} ({flag.build?.game_type})
                  </Text>
                  <Text style={{ color: '#374151', fontSize: 13, marginBottom: 4 }}>
                    Reason: {flag.reason}
                  </Text>
                  <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 10 }}>
                    Reported by: {flag.reporter?.username || 'Anonymous'}
                  </Text>
                  <Pressable
                    onPress={() => handleResolveFlag(flag.id)}
                    disabled={actionLoading === flag.id + '-flag'}
                    style={{ backgroundColor: '#10B981', borderRadius: 8, padding: 10, alignItems: 'center' }}>
                    {actionLoading === flag.id + '-flag'
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>✓ Mark Resolved</Text>
                    }
                  </Pressable>
                </View>
              ))
          )}

          {/* ── Users ── */}
          {activeTab === 'Users' && (
            users.length === 0
              ? <EmptyState icon="👥" title="No users yet" sub="Users will appear here once they sign up" />
              : users.map((u) => (
                <View key={u.id} style={{ backgroundColor: t.card, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: t.border, padding: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <Text style={{ color: t.foreground, fontWeight: '700', fontSize: 14 }}>{u.username}</Text>
                        {u.role === 'admin' && (
                          <View style={{ backgroundColor: '#FEF9C3', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                            <Text style={{ color: '#854D0E', fontSize: 10, fontWeight: '700' }}>ADMIN</Text>
                          </View>
                        )}
                        {u.role === 'seller' && (
                          <View style={{ backgroundColor: '#EDE9FE', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                            <Text style={{ color: '#7C3AED', fontSize: 10, fontWeight: '700' }}>SELLER</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ color: t.mutedForeground, fontSize: 12 }}>{u.email}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      {u.stripe_onboarded && (
                        <View style={{ backgroundColor: '#DCFCE7', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: '#15803D', fontSize: 10, fontWeight: '700' }}>✓ Stripe</Text>
                        </View>
                      )}
                      <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 12 }}>
                        ${(u.total_earnings || 0).toFixed(2)} earned
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: t.mutedForeground, fontSize: 11, marginTop: 6 }}>
                    Joined {new Date(u.created_at).toLocaleDateString()} • Spent: ${(u.total_spent || 0).toFixed(2)}
                  </Text>
                </View>
              ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <View style={{ alignItems: 'center', marginTop: 60, padding: 20 }}>
      <Text style={{ fontSize: 48, marginBottom: 12 }}>{icon}</Text>
      <Text style={{ color: '#111', fontSize: 17, fontWeight: '700', marginBottom: 6, textAlign: 'center' }}>{title}</Text>
      <Text style={{ color: '#6B7280', fontSize: 13, textAlign: 'center' }}>{sub}</Text>
    </View>
  );
}
