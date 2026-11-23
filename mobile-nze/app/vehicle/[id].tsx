import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, Image, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { getVehicle, bookVehicle, type VehicleDetail } from "@/lib/vehicles-api";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [message, setMessage] = useState("");
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setVehicle(await getVehicle(id));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleBook() {
    if (!accessToken || !dateDebut || !dateFin) {
      setError("Renseigne les dates de début et de fin (AAAA-MM-JJ)");
      return;
    }
    setError(null);
    setBooking(true);
    try {
      await bookVehicle(accessToken, id, dateDebut, dateFin, message || undefined);
      Alert.alert("Demande envoyée", "Le propriétaire va confirmer ta réservation.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'envoyer la demande");
    } finally {
      setBooking(false);
    }
  }

  if (loading || !vehicle) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />

        {vehicle.photos[0] && (
          <Image
            source={{ uri: vehicle.photos[0].url }}
            style={{ width: "100%", height: 180, borderRadius: 14, backgroundColor: colors.bg }}
          />
        )}

        <View style={{ gap: spacing.xs }}>
          <Text variant="h1">
            {vehicle.marque} {vehicle.modele}
          </Text>
          {vehicle.prix && (
            <Text variant="h2" color={colors.primary}>
              {Number(vehicle.prix).toLocaleString("fr-FR")} FCFA / jour
            </Text>
          )}
        </View>

        {vehicle.description && <Text variant="body">{vehicle.description}</Text>}
        {vehicle.conditionsLocation && (
          <View>
            <Text variant="label" color={colors.inkSoft}>
              CONDITIONS
            </Text>
            <Text variant="bodySm">{vehicle.conditionsLocation}</Text>
          </View>
        )}

        <View style={{ gap: spacing.sm }}>
          <Text variant="h3">Réserver</Text>
          <Input label="Date de début" placeholder="2026-09-10" value={dateDebut} onChangeText={setDateDebut} />
          <Input label="Date de fin" placeholder="2026-09-12" value={dateFin} onChangeText={setDateFin} />
          <Input label="Message (optionnel)" placeholder="Précisions pour le propriétaire" value={message} onChangeText={setMessage} />

          {error && (
            <Text variant="bodySm" color={colors.danger}>
              {error}
            </Text>
          )}

          <Button label="Envoyer la demande" onPress={handleBook} loading={booking} fullWidth />
        </View>
      </ScrollView>
    </Screen>
  );
}
