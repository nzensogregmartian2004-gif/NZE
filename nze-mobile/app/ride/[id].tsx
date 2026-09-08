import { useCallback, useEffect, useState } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { useAuthStore } from "@/store/auth";
import { listMyRides, cancelRide, RIDE_STATUS_LABELS, CANCELLABLE_RIDE_STATUSES, type Ride } from "@/lib/mobility-api";
import { ApiError } from "@/lib/api";

const POLL_INTERVAL_MS = 5000;

export default function RideStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const rides = await listMyRides(accessToken);
    setRide(rides.find((r) => r.id === id) ?? null);
    setLoading(false);
  }, [accessToken, id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  async function handleCancel() {
    if (!accessToken) return;
    setCancelling(true);
    try {
      await cancelRide(accessToken, id);
      await load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible d'annuler la course");
    } finally {
      setCancelling(false);
    }
  }

  if (loading || !ride) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  const canCancel = CANCELLABLE_RIDE_STATUSES.includes(ride.statut);

  return (
    <Screen>
      <View style={{ padding: spacing.lg, gap: spacing.lg, flex: 1 }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />

        <Text style={{ fontSize: 48, textAlign: "center" }}>{ride.typeService === "taxi" ? "🚕" : "🏍️"}</Text>

        <Card style={{ gap: spacing.sm, alignItems: "center" }}>
          <Badge label={RIDE_STATUS_LABELS[ride.statut] ?? ride.statut} tone="primary" />
          {ride.prixEstime && (
            <Text variant="h1" color={colors.primary}>
              {Number(ride.prixEstime).toLocaleString("fr-FR")} FCFA
            </Text>
          )}
          <Text variant="caption" color={colors.inkFaint}>
            Mis à jour automatiquement toutes les 5 secondes
          </Text>
        </Card>

        <View style={{ flex: 1 }} />

        {canCancel && (
          <Button label="Annuler la course" variant="ghost" onPress={handleCancel} loading={cancelling} />
        )}
      </View>
    </Screen>
  );
}
