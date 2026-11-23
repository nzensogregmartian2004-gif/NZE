import { useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
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
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!nom || !prenom || !telephone || !motDePasse) {
      setError("Remplis tous les champs obligatoires");
      return;
    }
    if (!acceptTerms) {
      setError("Accepte les conditions d'utilisation et la politique de confidentialité pour continuer");
      return;
    }
    setLoading(true);
    try {
      await register({ nom, prenom, telephone, email: email || undefined, motDePasse, acceptTerms: true });
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

        <Pressable
          onPress={() => setAcceptTerms((value) => !value)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acceptTerms }}
          style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              borderWidth: 1.5,
              borderColor: acceptTerms ? colors.primary : colors.line,
              backgroundColor: acceptTerms ? colors.primary : colors.white,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 2,
            }}
          >
            {acceptTerms && <Text variant="label" color={colors.white}>✓</Text>}
          </View>
          <Text variant="bodySm" color={colors.inkSoft} style={{ flex: 1 }}>
            J'accepte les{" "}
            <Text variant="bodySm" color={colors.primary} onPress={() => router.push("/legal/cgu")}>
              conditions d'utilisation
            </Text>{" "}
            et la{" "}
            <Text variant="bodySm" color={colors.primary} onPress={() => router.push("/legal/confidentialite")}>
              politique de confidentialité
            </Text>
            .
          </Text>
        </Pressable>

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
