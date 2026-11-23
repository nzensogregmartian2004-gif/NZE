import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator, Alert, Pressable } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { listMyVehicles, createVehicle, updateVehicle, VEHICLE_TYPES, type Vehicle } from "@/lib/vehicles-api";
import { useAutoTutorial } from "@/hooks/useAutoTutorial";

const VALIDATION_TONE = { en_attente: "warning", valide: "success", refuse: "danger", suspendu: "danger" } as const;

export default function VehicleOwnerDashboard() {
  useAutoTutorial("vehicle");
  const accessToken = useAuthStore((s) => s.accessToken)!;
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<(typeof VEHICLE_TYPES)[number]>("voiture");
  const [marque, setMarque] = useState("");
  const [modele, setModele] = useState("");
  const [prix, setPrix] = useState("");
  const [photosText, setPhotosText] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setVehicles(await listMyVehicles(accessToken));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!marque.trim()) return;
    setCreating(true);
    try {
      await createVehicle(accessToken, {
        type,
        marque,
        modele: modele || undefined,
        prix: prix ? Number(prix) : undefined,
        photos: photosText.trim() ? photosText.split(/[;,\n]/).map((value) => value.trim()).filter(Boolean) : undefined,
      });
      setMarque("");
      setModele("");
      setPrix("");
      setPhotosText("");
      await load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible d'ajouter le véhicule");
    } finally {
      setCreating(false);
    }
  }

  async function toggleAvailability(vehicle: Vehicle) {
    try { await updateVehicle(accessToken, vehicle.id, { disponible: !vehicle.disponible }); await load(); }
    catch (err) { Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible de modifier la disponibilité"); }
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
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Button label="Abonnements et promotions" variant="secondary" onPress={() => router.push("/dashboard/monetisation")} fullWidth />
        <Text variant="h1">Mes véhicules</Text>

        {vehicles.map((vehicle) => (
          <View key={vehicle.id} style={{ gap: spacing.xs }}>
            <Pressable onPress={() => router.push(`/dashboard/vehicle-bookings/${vehicle.id}`)}>
              <Card style={{ gap: spacing.xs }}>
                <Text variant="body" style={{ fontFamily: "PlusJakartaSans_600SemiBold" }}>{vehicle.marque} {vehicle.modele}</Text>
                <Badge label={vehicle.statutValidation} tone={VALIDATION_TONE[vehicle.statutValidation]} />
                <Text variant="bodySm" color={vehicle.disponible ? colors.success : colors.inkSoft}>{vehicle.disponible ? "Location activée" : "Location désactivée"}</Text>
                <Text variant="caption" color={colors.primary}>Voir les demandes de réservation →</Text>
              </Card>
            </Pressable>
            <Button label={vehicle.disponible ? "Désactiver les réservations" : "Réactiver les réservations"} variant="secondary" onPress={() => toggleAvailability(vehicle)} />
          </View>
        ))}

        <Card style={{ gap: spacing.sm }}>
          <Text variant="label" color={colors.inkSoft}>
            AJOUTER UN VÉHICULE
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {VEHICLE_TYPES.map((t) => (
              <Button key={t} label={t} variant={type === t ? "primary" : "secondary"} onPress={() => setType(t)} />
            ))}
          </View>
          <Input placeholder="Marque" value={marque} onChangeText={setMarque} />
          <Input placeholder="Modèle" value={modele} onChangeText={setModele} />
          <Input placeholder="Prix / jour (FCFA)" value={prix} onChangeText={setPrix} keyboardType="number-pad" />
          <Input placeholder="URL de photo(s), séparées par une virgule" value={photosText} onChangeText={setPhotosText} />
          <Button label="Ajouter" onPress={handleCreate} loading={creating} />
        </Card>
      </ScrollView>
    </Screen>
  );
}
