import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { couleurs, espaces } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { useAuthStore } from "@/store/auth";
import { acceptLegalTerms } from "@/lib/legal-api";
import { ApiError } from "@/lib/api";
import { useI18n } from "@/i18n";

/** Écran affiché une seule fois aux comptes qui n'ont pas accepté la version actuelle des conditions. */
export default function AcceptTermsScreen() {
  const { t } = useI18n();
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const logout = useAuthStore((s) => s.logout);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    setError(null);
    if (!accepted) {
      setError(t("cgu.accepterAvant"));
      return;
    }
    if (!accessToken) {
      router.replace("/(auth)/connexion");
      return;
    }
    setLoading(true);
    try {
      await acceptLegalTerms(accessToken);
      await refreshMe();
      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("cgu.erreurEnregistrement"));
    } finally {
      setLoading(false);
    }
  }

  async function handleRefuse() {
    await logout();
    router.replace("/(auth)/connexion");
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: espaces.l, gap: espaces.l }}>
        <View style={{ alignItems: "center", marginTop: espaces.xl }}>
          <Logo variant="mark" height={56} />
        </View>

        <Text variant="h1">{t("cgu.titre")}</Text>
        <Text variant="body" color={couleurs.texteSecondaire}>
          {t("cgu.intro")}
        </Text>

        <View style={{ flexDirection: "row", gap: espaces.m, flexWrap: "wrap" }}>
          <Button label={t("cgu.lienCgu")} variant="secondary" onPress={() => router.push("/legal/cgu")} />
          <Button label={t("cgu.lienConfidentialite")} variant="secondary" onPress={() => router.push("/legal/confidentialite")} />
        </View>

        <Pressable
          onPress={() => setAccepted((value) => !value)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
          style={{ flexDirection: "row", gap: espaces.m, alignItems: "flex-start" }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              borderWidth: 1.5,
              borderColor: accepted ? couleurs.violet : couleurs.bordure,
              backgroundColor: accepted ? couleurs.violet : couleurs.blanc,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 2,
            }}
          >
            {accepted && <Text variant="label" color={couleurs.blanc}>✓</Text>}
          </View>
          <Text variant="bodySm" color={couleurs.texteSecondaire} style={{ flex: 1 }}>
            {t("cgu.caseAcceptation")}
          </Text>
        </Pressable>

        {error && (
          <Text variant="bodySm" color={couleurs.danger}>
            {error}
          </Text>
        )}

        <Button label={t("cgu.continuer")} onPress={handleContinue} loading={loading} fullWidth />
        <Button label={t("cgu.refuser")} variant="ghost" onPress={handleRefuse} fullWidth />
      </ScrollView>
    </Screen>
  );
}
