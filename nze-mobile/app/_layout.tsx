import { useEffect, useCallback } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { View } from "react-native";
import {
  useFonts as useSora,
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
} from "@expo-google-fonts/sora";
import {
  useFonts as useJakarta,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { colors } from "@/theme";
import { useAuthStore } from "@/store/auth";
import { connectSocket, disconnectSocket } from "@/lib/socket";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [soraLoaded] = useSora({ Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold });
  const [jakartaLoaded] = useJakarta({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Connexion Socket.IO tant qu'une session est active — messagerie et suivi
  // de livraison en temps réel (Phase 6 du backend).
  useEffect(() => {
    if (accessToken) {
      connectSocket(accessToken);
      return () => disconnectSocket();
    }
    disconnectSocket();
  }, [accessToken]);

  const fontsLoaded = soraLoaded && jakartaLoaded;
  const ready = fontsLoaded && hydrated;

  const onReady = useCallback(async () => {
    if (ready) await SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  if (!ready) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
