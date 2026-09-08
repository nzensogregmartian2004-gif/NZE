import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { useAuthStore } from "@/store/auth";
import { getAdminStats, type AdminStats } from "@/lib/admin-api";

export default function AdminDashboard() {
  const accessToken = useAuthStore((s) => s.accessToken)!;
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await getAdminStats(accessToken));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !stats) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  const totalPending =
    stats.validationsEnAttente.magasins + stats.validationsEnAttente.livreurs + stats.signalementsEnAttente;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h1">Administration NZE</Text>

        {totalPending > 0 && (
          <Card style={{ backgroundColor: colors.warningTint, borderColor: colors.warning }}>
            <Text variant="body" style={{ fontFamily: "PlusJakartaSans_600SemiBold" }}>
              {totalPending} élément(s) en attente de traitement
            </Text>
          </Card>
        )}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
          <StatCard label="Clients" value={stats.utilisateurs.clients} />
          <StatCard label="Commerçants" value={stats.utilisateurs.commercants} />
          <StatCard label="Prestataires" value={stats.utilisateurs.prestataires} />
          <StatCard label="Livreurs" value={stats.utilisateurs.livreurs} />
          <StatCard label="Chauffeurs" value={stats.utilisateurs.chauffeurs} />
          <StatCard label="Commandes" value={stats.activite.commandesTotal} />
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="h3">Validations</Text>
          <Button
            label={`Magasins en attente (${stats.validationsEnAttente.magasins})`}
            variant="secondary"
            onPress={() => router.push("/admin/validations?type=stores")}
          />
          <Button
            label={`Livreurs en attente (${stats.validationsEnAttente.livreurs})`}
            variant="secondary"
            onPress={() => router.push("/admin/validations?type=deliverers")}
          />
          <Button label="Chauffeurs" variant="secondary" onPress={() => router.push("/admin/validations?type=drivers")} />
          <Button
            label="Prestataires"
            variant="secondary"
            onPress={() => router.push("/admin/validations?type=service-profiles")}
          />
          <Button label="Véhicules" variant="secondary" onPress={() => router.push("/admin/validations?type=vehicles")} />
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="h3">Modération</Text>
          <Button
            label={`Signalements (${stats.signalementsEnAttente})`}
            variant="secondary"
            onPress={() => router.push("/admin/reports")}
          />
          <Button label="Envoyer une annonce" variant="secondary" onPress={() => router.push("/admin/announcement")} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card style={{ width: "31%", alignItems: "center", gap: 4 }}>
      <Text variant="h2" color={colors.primary}>
        {value}
      </Text>
      <Text variant="caption" color={colors.inkSoft} style={{ textAlign: "center" }}>
        {label}
      </Text>
    </Card>
  );
}
