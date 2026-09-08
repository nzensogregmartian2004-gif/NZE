import { useState } from "react";
import { View, ScrollView } from "react-native";
import { Link, router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { register } from "@/lib/auth-api";
import { ApiError } from "@/lib/api";

export default function RegisterScreen() {
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!nom || !prenom || !telephone || !motDePasse) {
      setError("Remplis tous les champs obligatoires");
      return;
    }
    setLoading(true);
    try {
      await register({ nom, prenom, telephone, email: email || undefined, motDePasse });
      router.push({ pathname: "/(auth)/otp-verify", params: { telephone } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de créer le compte");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ alignItems: "center", marginTop: spacing.xl, marginBottom: spacing.md }}>
          <Logo variant="mark" height={64} />
        </View>

        <Text variant="h1">Créer un compte</Text>
        <Text variant="body" color={colors.inkSoft}>
          Rejoins NZE pour acheter, vendre, livrer ou proposer tes services.
        </Text>

        <View style={{ gap: spacing.md }}>
          <Input label="Nom" value={nom} onChangeText={setNom} placeholder="Ex. Obame" />
          <Input label="Prénom" value={prenom} onChangeText={setPrenom} placeholder="Ex. Marie" />
          <Input
            label="Téléphone"
            value={telephone}
            onChangeText={setTelephone}
            placeholder="Ex. 077123456"
            keyboardType="phone-pad"
          />
          <Input
            label="Email (facultatif)"
            value={email}
            onChangeText={setEmail}
            placeholder="ton@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Mot de passe"
            value={motDePasse}
            onChangeText={setMotDePasse}
            placeholder="8 caractères minimum"
            secureTextEntry
          />
        </View>

        {error && (
          <Text variant="bodySm" color={colors.danger}>
            {error}
          </Text>
        )}

        <Button label="Continuer" onPress={handleSubmit} loading={loading} fullWidth />

        <View style={{ flexDirection: "row", justifyContent: "center", gap: spacing.xs, marginTop: spacing.md }}>
          <Text variant="bodySm" color={colors.inkSoft}>
            Déjà un compte ?
          </Text>
          <Link href="/(auth)/login">
            <Text variant="bodySm" color={colors.primary} style={{ fontFamily: "PlusJakartaSans_600SemiBold" }}>
              Se connecter
            </Text>
          </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}
