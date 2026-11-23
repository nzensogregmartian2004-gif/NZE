import { useState } from "react";
import { View, ScrollView } from "react-native";
import { Link, router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { login } from "@/lib/auth-api";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function LoginScreen() {
  const setSession = useAuthStore((s) => s.setSession);
  const [telephone, setTelephone] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!telephone || !motDePasse) {
      setError("Renseigne ton téléphone et ton mot de passe");
      return;
    }
    setLoading(true);
    try {
      const tokens = await login(telephone, motDePasse);
      await setSession(tokens);
      router.replace("/(tabs)");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        // Téléphone pas encore vérifié : redirige vers l'OTP plutôt que d'afficher une erreur sèche
        router.push({ pathname: "/(auth)/otp-verify", params: { telephone } });
        return;
      }
      setError(err instanceof ApiError ? err.message : "Connexion impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, flexGrow: 1, justifyContent: "center" }}>
        <View style={{ alignItems: "center", marginBottom: spacing.md }}>
          <Logo variant="mark" height={72} />
        </View>

        <Text variant="h1">Content de te revoir</Text>
        <Text variant="body" color={colors.inkSoft}>
          Connecte-toi pour continuer sur NZE.
        </Text>

        <View style={{ gap: spacing.md }}>
          <Input
            label="Téléphone"
            value={telephone}
            onChangeText={setTelephone}
            placeholder="Ex. 077123456"
            keyboardType="phone-pad"
          />
          <Input
            label="Mot de passe"
            value={motDePasse}
            onChangeText={setMotDePasse}
            placeholder="Ton mot de passe"
            secureTextEntry
          />
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Link href="/(auth)/forgot-password">
            <Text variant="bodySm" color={colors.primary} style={{ fontFamily: "PlusJakartaSans_600SemiBold" }}>
              Mot de passe oublié ?
            </Text>
          </Link>
        </View>

        {error && (
          <Text variant="bodySm" color={colors.danger}>
            {error}
          </Text>
        )}

        <Button label="Se connecter" onPress={handleSubmit} loading={loading} fullWidth />

        <View style={{ flexDirection: "row", justifyContent: "center", gap: spacing.xs }}>
          <Text variant="bodySm" color={colors.inkSoft}>
            Pas encore de compte ?
          </Text>
          <Link href="/(auth)/register">
            <Text variant="bodySm" color={colors.primary} style={{ fontFamily: "PlusJakartaSans_600SemiBold" }}>
              Créer un compte
            </Text>
          </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}
