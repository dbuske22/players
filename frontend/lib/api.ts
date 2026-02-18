import type {
  Build,
  User,
  Purchase,
  Review,
  PlaystyleLabels,
  BuildAttribute,
  BuildPerformance,
  GameType,
} from './types';

const BASE = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? '/api'
  : (process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3002');

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, headers = {}, ...rest } = options;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers as Record<string, string>),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  signup: (body: { email: string; password: string; username: string; role: 'buyer' | 'seller' }) =>
    request<{ token: string; user: User }>('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  me: (token: string) =>
    request<User>('/auth/me', { token }),
};

// ─── Playstyle ───────────────────────────────────────────────────────────────
export const playstyleApi = {
  save: (token: string, vector: number[], labels: PlaystyleLabels, preferred_sport?: GameType) =>
    request('/users/playstyle', {
      method: 'POST',
      token,
      body: JSON.stringify({ vector, labels, preferred_sport }),
    }),
};

// ─── Builds ──────────────────────────────────────────────────────────────────
export const buildsApi = {
  list: (params?: {
    game_type?: GameType;
    position?: string;
    min_price?: number;
    max_price?: number;
    sort?: string;
    search?: string;
    featured?: boolean;
  }) => {
    const q = new URLSearchParams();
    if (params?.game_type) q.set('game_type', params.game_type);
    if (params?.position) q.set('position', params.position);
    if (params?.min_price !== undefined) q.set('min_price', String(params.min_price));
    if (params?.max_price !== undefined) q.set('max_price', String(params.max_price));
    if (params?.sort) q.set('sort', params.sort);
    if (params?.search) q.set('search', params.search);
    if (params?.featured) q.set('featured', 'true');
    return request<Build[]>(`/builds?${q.toString()}`);
  },

  get: (id: string) => request<Build>(`/builds/${id}`),

  create: (
    token: string,
    body: {
      title: string;
      game_type: GameType;
      position: string;
      archetype: string;
      description?: string;
      price: number;
      import_code?: string;
      preview_url?: string;
      build_vector?: number[];
      attributes: BuildAttribute[];
      badges: string[];
      performance: BuildPerformance;
    }
  ) => request<Build>('/builds', { method: 'POST', token, body: JSON.stringify(body) }),

  update: (token: string, id: string, body: Partial<Build>) =>
    request<Build>(`/builds/${id}`, { method: 'PUT', token, body: JSON.stringify(body) }),

  delete: (token: string, id: string) =>
    request<{ success: boolean }>(`/builds/${id}`, { method: 'DELETE', token }),

  getQR: (token: string, buildId: string) =>
    request<{ qr: string; import_code: string }>(`/builds/${buildId}/qr`, { token }),

  flag: (token: string, buildId: string, reason: string) =>
    request(`/builds/${buildId}/flag`, { method: 'POST', token, body: JSON.stringify({ reason }) }),
};

// ─── Purchases ───────────────────────────────────────────────────────────────
export const purchasesApi = {
  checkout: (token: string, buildId: string) =>
    request<{
      client_secret?: string;
      payment_intent_id?: string;
      amount?: number;
      demo?: boolean;
      purchase?: Purchase;
      message?: string;
    }>(`/builds/${buildId}/checkout`, { method: 'POST', token }),

  confirm: (token: string, buildId: string, payment_intent_id: string) =>
    request<Purchase>(`/builds/${buildId}/purchase/confirm`, {
      method: 'POST',
      token,
      body: JSON.stringify({ payment_intent_id }),
    }),

  myPurchases: (token: string) => request<Purchase[]>('/users/me/purchases', { token }),

  myBuilds: (token: string) => request<Build[]>('/users/me/builds', { token }),

  myEarnings: (token: string) =>
    request<{ sales: Purchase[]; total_earned: number }>('/users/me/earnings', { token }),
};

// ─── Reviews ─────────────────────────────────────────────────────────────────
export const reviewsApi = {
  create: (
    token: string,
    buildId: string,
    body: { rating: number; comment?: string; purchase_id: string }
  ) =>
    request<Review>(`/builds/${buildId}/reviews`, {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    }),
};

// ─── Stripe ──────────────────────────────────────────────────────────────────
export const stripeApi = {
  connect: (token: string) =>
    request<{ url?: string; error?: string }>('/stripe/connect', { method: 'POST', token }),

  status: (token: string) =>
    request<{ onboarded: boolean; account_id?: string }>('/stripe/connect/status', { token }),
};

// ─── Admin ───────────────────────────────────────────────────────────────────
export const adminApi = {
  getBuilds: (token: string, status?: string) =>
    request<Build[]>(`/admin/builds${status ? `?status=${status}` : ''}`, { token }),

  approveBuild: (token: string, id: string) =>
    request<Build>(`/admin/builds/${id}/approve`, { method: 'POST', token }),

  rejectBuild: (token: string, id: string) =>
    request<Build>(`/admin/builds/${id}/reject`, { method: 'POST', token }),

  getFlags: (token: string) =>
    request<unknown[]>('/admin/flags', { token }),

  resolveFlag: (token: string, id: string) =>
    request(`/admin/flags/${id}/resolve`, { method: 'POST', token }),

  getUsers: (token: string) =>
    request<User[]>('/admin/users', { token }),

  featureBuild: (token: string, id: string, featured: boolean) =>
    request(`/admin/builds/${id}/feature`, { method: 'PUT', token, body: JSON.stringify({ featured }) }),
};

// ─── Stats ───────────────────────────────────────────────────────────────────
export const statsApi = {
  get: () => request<{ total_builds: number; total_users: number; total_sales: number }>('/stats'),
};
