import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { listReports, updateReport, type Report } from "@/lib/admin-api";

export default function AdminReportsScreen() {
  const accessToken = useAuthStore((s) => s.accessToken)!;
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReports(await listReports(accessToken));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(id: string, statut: "traite" | "rejete") {
    try {
      await updateReport(accessToken, id, statut);
      await load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible de traiter le signalement");
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h1">Signalements</Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : reports.length === 0 ? (
          <Text variant="body" color={colors.inkSoft}>
            Aucun signalement en attente.
          </Text>
        ) : (
          reports.map((report) => (
            <Card key={report.id} style={{ gap: spacing.sm }}>
              <Badge label={report.cibleType} tone="warning" />
              <Text variant="body">{report.motif}</Text>
              <Text variant="caption" color={colors.inkFaint}>
                {new Date(report.creeLe).toLocaleDateString("fr-FR")}
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Button label="Traiter" onPress={() => respond(report.id, "traite")} />
                <Button label="Rejeter" variant="ghost" onPress={() => respond(report.id, "rejete")} />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
