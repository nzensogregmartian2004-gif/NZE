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

const ACTIVITY_LABELS: Record<ActivityType, { emoji: string; label: string }> = {
  client: { emoji: "👤", label: "Client" },
  commercant: { emoji: "🏪", label: "Mon magasin" },
  prestataire: { emoji: "👷", label: "Mes services" },
  livreur: { emoji: "🚚", label: "Livreur" },
  chauffeur: { emoji: "🚕", label: "Chauffeur" },
  proprietaire_vehicule: { emoji: "🚗", label: "Mes véhicules" },
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
  chauffeur: "/dashboard/driver",
  proprietaire_vehicule: "/dashboard/vehicles-owner",
};

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

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

  if (!user) return null;

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

        <Button label="Mes commandes" variant="secondary" onPress={() => router.push("/orders")} fullWidth />

        {user.isAdmin && (
          <Button label="🛠️ Administration" variant="secondary" onPress={() => router.push("/admin")} fullWidth />
        )}

        <Button label="Se déconnecter" variant="ghost" onPress={handleLogout} />
      </ScrollView>
    </Screen>
  );
}
