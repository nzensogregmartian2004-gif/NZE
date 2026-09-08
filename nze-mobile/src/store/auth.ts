import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { Me, Tokens } from "@/lib/auth-api";
import { getMe } from "@/lib/auth-api";

const ACCESS_TOKEN_KEY = "nze_access_token";
const REFRESH_TOKEN_KEY = "nze_refresh_token";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: Me | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (tokens: Tokens) => Promise<void>;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  hydrated: false,

  hydrate: async () => {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    ]);

    if (accessToken) {
      try {
        const user = await getMe(accessToken);
        set({ accessToken, refreshToken, user, hydrated: true });
        return;
      } catch {
        // Token expiré ou invalide — on efface la session locale
        await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      }
    }
    set({ hydrated: true });
  },

  setSession: async (tokens: Tokens) => {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
    const user = await getMe(tokens.accessToken);
    set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user });
  },

  refreshMe: async () => {
    const { accessToken } = get();
    if (!accessToken) return;
    const user = await getMe(accessToken);
    set({ user });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    set({ accessToken: null, refreshToken: null, user: null });
  },
}));
