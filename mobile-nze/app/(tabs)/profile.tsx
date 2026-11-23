import { View, ScrollView, Alert, Pressable } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { useAuthStore } from "@/store/auth";
import type { ActivityType } from "@/lib/auth-api";
import { updateMe } from "@/lib/auth-api";
import { STEP15_COPY } from "@/i18n/step15";

const ACTIVITY_LABELS: Record<ActivityType, { emoji: string; label: string }> = {
  client: { emoji: "👤", label: "Client" },
  commercant: { emoji: "🏪", label: "Mon magasin" },
  prestataire: { emoji: "👷", label: "Mes services" },
  livreur: { emoji: "🚚", label: "Livreur" },
  proprietaire_vehicule: { emoji: "🚗", label: "Mes véhicules" },
  loueur: { emoji: "🚗", label: "Mes véhicules" },
  hebergeur: { emoji: "🏨", label: "Mes hébergements" },
};

const STATUS_TONE = {
  active: { label: "Active", tone: "success" as const },
  en_attente: { label: "En attente", tone: "warning" as const },
  refusee: { label: "Refusée", tone: "danger" as const },
  suspendue: { label: "Suspendue", tone: "danger" as const },
};

const DASHBOARD_ROUTES: Partial<Record<ActivityType, string>> = {
  commercant: "/dashboard/store",
  prestataire: "/dashboard/service",
  livreur: "/dashboard/deliverer",
  proprietaire_vehicule: "/dashboard/vehicles-owner",
  loueur: "/dashboard/vehicles-owner",
  hebergeur: "/dashboard/lodgings-owner",
};

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshMe = useAuthStore((s) => s.refreshMe);

  async function handleLogout() {
    Alert.alert("Se déconnecter", "Tu peux te reconnecter à tout moment.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Se déconnecter",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  async function toggleLanguage() {
    if (!user || !accessToken) return;
    const langue = user.langue === "fr" ? "en" : "fr";
    try {
      await updateMe(accessToken, { langue });
      await refreshMe();
    } catch (error) {
      Alert.alert("NZE", error instanceof Error ? error.message : "Erreur");
    }
  }

  if (!user) return null;
  const copy = STEP15_COPY[user.langue === "en" ? "en" : "fr"];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <View>
          <Text variant="h2">
            {user.prenom} {user.nom}
          </Text>
          <Text variant="body" color={colors.inkSoft}>
            {user.telephone}
          </Text>
        </View>

        <View style={{ gap: spacing.md }}>
          <Text variant="label" color={colors.inkSoft}>
            MES ACTIVITÉS
          </Text>

          {user.activities.map((activity) => {
            const info = ACTIVITY_LABELS[activity.type];
            const status = STATUS_TONE[activity.statut];
            const dashboardRoute = DASHBOARD_ROUTES[activity.type];
            const card = (
              <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Text style={{ fontSize: 24 }}>{info.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text variant="body">{info.label}</Text>
                </View>
                <Badge label={status.label} tone={status.tone} />
              </Card>
            );
            return dashboardRoute ? (
              <Pressable key={activity.id} onPress={() => router.push(dashboardRoute as any)}>
                {card}
              </Pressable>
            ) : (
              <View key={activity.id}>{card}</View>
            );
          })}

          <Button
            label="Ajouter une activité"
            variant="secondary"
            onPress={() => router.push("/(auth)/choose-activities")}
            fullWidth
          />
        </View>

        <Button label="Mes réservations de véhicules" variant="secondary" onPress={() => router.push("/my-vehicle-bookings")} fullWidth />
        <Button label="Mes réservations de logement" variant="secondary" onPress={() => router.push("/my-lodging-bookings")} fullWidth />

        <Button label={copy.notificationsTitle} variant="secondary" onPress={() => router.push("/notifications")} fullWidth />
        <Button label={copy.helpTitle} variant="secondary" onPress={() => router.push("/help")} fullWidth />
        <Button label="Conditions d'utilisation" variant="secondary" onPress={() => router.push("/legal/cgu")} fullWidth />
        <Button label="Politique de confidentialité" variant="secondary" onPress={() => router.push("/legal/confidentialite")} fullWidth />
        <Button label={`${copy.language}: ${user.langue.toUpperCase()} / ${user.langue === "fr" ? "EN" : "FR"}`} variant="secondary" onPress={() => void toggleLanguage()} fullWidth />
        <Button label={copy.restartGuide + " — " + copy.guideNames.client} variant="secondary" onPress={() => router.push({ pathname: "/tutorial", params: { guide: "client", restart: "1" } })} fullWidth />
        <Button label="Mes commandes" variant="secondary" onPress={() => router.push("/orders")} fullWidth />

        {user.isAdmin && (
          <Button label="🛠️ Administration" variant="secondary" onPress={() => router.push("/admin")} fullWidth />
        )}

        <Button label="Se déconnecter" variant="ghost" onPress={handleLogout} />
      </ScrollView>
    </Screen>
  );
}
