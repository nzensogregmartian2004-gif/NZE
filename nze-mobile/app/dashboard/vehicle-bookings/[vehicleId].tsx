import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { listVehicleBookings, acceptBooking, rejectBooking, type VehicleBooking } from "@/lib/mobility-api";

export default function VehicleBookingsScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const accessToken = useAuthStore((s) => s.accessToken)!;
  const [bookings, setBookings] = useState<VehicleBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBookings(await listVehicleBookings(accessToken, vehicleId));
    } finally {
      setLoading(false);
    }
  }, [accessToken, vehicleId]);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(booking: VehicleBooking, action: "accept" | "reject") {
    try {
      if (action === "accept") await acceptBooking(accessToken, booking.id);
      else await rejectBooking(accessToken, booking.id);
      await load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible de répondre à la demande");
    }
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h1">Demandes de réservation</Text>

        {bookings.length === 0 ? (
          <Text variant="body" color={colors.inkSoft}>
            Aucune demande pour l'instant.
          </Text>
        ) : (
          bookings.map((booking) => (
            <Card key={booking.id} style={{ gap: spacing.sm }}>
              <Text variant="body">
                Du {booking.dateDebut} au {booking.dateFin}
              </Text>
              {booking.message && (
                <Text variant="bodySm" color={colors.inkSoft}>
                  « {booking.message} »
                </Text>
              )}
              <Badge label={booking.statut} tone="primary" />
              {booking.statut === "demandee" && (
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Button label="Accepter" onPress={() => respond(booking, "accept")} />
                  <Button label="Refuser" variant="ghost" onPress={() => respond(booking, "reject")} />
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
