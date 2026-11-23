import { useState } from "react";
import { View, ScrollView, Alert } from "react-native";
import { Link, router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { requestPasswordReset, confirmPasswordReset } from "@/lib/auth-api";
import { ApiError } from "@/lib/api";

type Step = "telephone" | "code";

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>("telephone");
  const [telephone, setTelephone] = useState("");
  const [code, setCode] = useState("");
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequest() {
    setError(null);
    setMessage(null);
    if (telephone.trim().length < 8) { setError("Entre un numéro de téléphone valide."); return; }
    setLoading(true);
    try {
      const result = await requestPasswordReset(telephone.trim());
      setMessage(result.message);
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de demander le code pour le moment.");
    } finally { setLoading(false); }
  }

  async function handleConfirm() {
    setError(null);
    setMessage(null);
    if (!/^\d{4,8}$/.test(code)) { setError("Entre le code reçu par SMS."); return; }
    if (nouveauMotDePasse.length < 8) { setError("Le nouveau mot de passe doit contenir au moins 8 caractères."); return; }
    if (nouveauMotDePasse !== confirmation) { setError("Les deux mots de passe ne correspondent pas."); return; }
    setLoading(true);
    try {
      const result = await confirmPasswordReset(telephone.trim(), code, nouveauMotDePasse);
      Alert.alert("Mot de passe modifié", result.message, [{ text: "Se connecter", onPress: () => router.replace("/(auth)/login") }]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de réinitialiser le mot de passe.");
    } finally { setLoading(false); }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, flexGrow: 1, justifyContent: "center" }}>
        <View style={{ alignItems: "center", marginBottom: spacing.md }}>
          <Logo variant="mark" height={64} />
        </View>
        <Text variant="h1">Mot de passe oublié ?</Text>
        <Text variant="body" color={colors.inkSoft}>
          {step === "telephone"
            ? "Indique le numéro associé à ton compte NZE."
            : `Entre le code reçu et choisis un nouveau mot de passe pour ${telephone}.`}
        </Text>

        {step === "telephone" ? (
          <View style={{ gap: spacing.md }}>
            <Input label="Téléphone" value={telephone} onChangeText={setTelephone} placeholder="Ex. 077123456" keyboardType="phone-pad" />
            <Button label="Recevoir un code" onPress={handleRequest} loading={loading} fullWidth />
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <Input label="Code reçu par SMS" value={code} onChangeText={setCode} placeholder="123456" keyboardType="number-pad" maxLength={8} />
            <Input label="Nouveau mot de passe" value={nouveauMotDePasse} onChangeText={setNouveauMotDePasse} placeholder="8 caractères minimum" secureTextEntry />
            <Input label="Confirmer le mot de passe" value={confirmation} onChangeText={setConfirmation} placeholder="Répète le mot de passe" secureTextEntry />
            <Button label="Réinitialiser le mot de passe" onPress={handleConfirm} loading={loading} fullWidth />
            <Button label="Changer de numéro" variant="ghost" onPress={() => { setStep("telephone"); setMessage(null); setError(null); }} />
          </View>
        )}

        {message && <Text variant="bodySm" color={colors.success}>{message}</Text>}
        {error && <Text variant="bodySm" color={colors.danger}>{error}</Text>}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: spacing.xs }}>
          <Link href="/(auth)/login"><Text variant="bodySm" color={colors.primary}>Retour à la connexion</Text></Link>
        </View>
      </ScrollView>
    </Screen>
  );
}
