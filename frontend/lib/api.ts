import type { Build, Purchase } from './types';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3002';

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export const api = {
  getBuilds: (params?: { position?: string; maxPrice?: number; sort?: string }) => {
    const qs = new URLSearchParams();
    if (params?.position) qs.set('position', params.position);
    if (params?.maxPrice) qs.set('maxPrice', String(params.maxPrice));
    if (params?.sort) qs.set('sort', params.sort);
    const query = qs.toString();
    return req<Build[]>(`/builds${query ? `?${query}` : ''}`);
  },
  getBuild: (id: string) => req<Build>(`/builds/${id}`),
  createBuild: (data: Omit<Build, 'id' | 'overallRating' | 'sold' | 'createdAt'>) =>
    req<Build>('/builds', { method: 'POST', body: JSON.stringify(data) }),
  deleteBuild: (id: string) => req<{ success: boolean }>(`/builds/${id}`, { method: 'DELETE' }),
  purchaseBuild: (id: string, buyerId: string, buyerName: string) =>
    req<Purchase>(`/builds/${id}/purchase`, {
      method: 'POST',
      body: JSON.stringify({ buyerId, buyerName }),
    }),
  getMyListings: (sellerId: string) => req<Build[]>(`/users/${sellerId}/builds`),
  getMyPurchases: (buyerId: string) => req<Purchase[]>(`/users/${buyerId}/purchases`),
};

export { BACKEND_URL };
