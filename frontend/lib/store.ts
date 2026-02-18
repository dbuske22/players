import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from './types';
import { authApi } from './api';

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username: string, role: 'buyer' | 'seller') => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  initialize: () => Promise<void>;
}

const TOKEN_KEY = 'sbm_token';

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoading: false,
  initialized: false,

  initialize: async () => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        const user = await authApi.me(token);
        set({ token, user, initialized: true });
      } catch {
        await AsyncStorage.removeItem(TOKEN_KEY);
        set({ token: null, user: null, initialized: true });
      }
    } else {
      set({ initialized: true });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { token, user } = await authApi.login({ email, password });
      await AsyncStorage.setItem(TOKEN_KEY, token);
      set({ token, user, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  signup: async (email, password, username, role) => {
    set({ isLoading: true });
    try {
      const { token, user } = await authApi.signup({ email, password, username, role });
      await AsyncStorage.setItem(TOKEN_KEY, token);
      set({ token, user, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null });
  },

  setUser: (user) => set({ user }),
}));
