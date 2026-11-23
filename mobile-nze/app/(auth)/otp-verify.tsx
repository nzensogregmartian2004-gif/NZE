import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { verifyOtp, requestOtp } from "@/lib/auth-api";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function OtpVerifyScreen() {
  const { telephone } = useLocalSearchParams<{ telephone: string }>();
  const setSession = useAuthStore((s) => s.setSession);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleVerify() {
    setError(null);
    if (code.length < 4) {
      setError("Entre le code reçu par SMS");
      return;
    }
    setLoading(true);
    try {
      const tokens = await verifyOtp(telephone, code);
      await setSession(tokens);
      router.replace("/(auth)/choose-activities");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Code invalide");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    try {
      await requestOtp(telephone);
      setResent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de renvoyer le code");
    }
  }

  return (
    <Screen>
      <View style={{ padding: spacing.lg, gap: spacing.lg, flex: 1, justifyContent: "center" }}>
        <Text variant="h1">Vérifie ton numéro</Text>
        <Text variant="body" color={colors.inkSoft}>
          On a envoyé un code par SMS au {telephone}.
        </Text>

        <Input
          label="Code de vérification"
          value={code}
          onChangeText={setCode}
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={6}
        />

        {error && (
          <Text variant="bodySm" color={colors.danger}>
            {error}
          </Text>
        )}
        {resent && !error && (
          <Text variant="bodySm" color={colors.success}>
            Nouveau code envoyé.
          </Text>
        )}

        <Button label="Vérifier" onPress={handleVerify} loading={loading} fullWidth />
        <Button label="Renvoyer le code" variant="ghost" onPress={handleResend} />
      </View>
    </Screen>
  );
}
