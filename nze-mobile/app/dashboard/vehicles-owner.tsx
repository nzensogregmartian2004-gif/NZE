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
import { listMyVehicles, createVehicle, VEHICLE_TYPES, type Vehicle } from "@/lib/mobility-api";

const VALIDATION_TONE = { en_attente: "warning", valide: "success", refuse: "danger", suspendu: "danger" } as const;

export default function VehicleOwnerDashboard() {
  const accessToken = useAuthStore((s) => s.accessToken)!;
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<(typeof VEHICLE_TYPES)[number]>("voiture");
  const [marque, setMarque] = useState("");
  const [modele, setModele] = useState("");
  const [prix, setPrix] = useState("");
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
      });
      setMarque("");
      setModele("");
      setPrix("");
      await load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible d'ajouter le véhicule");
    } finally {
      setCreating(false);
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
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h1">Mes véhicules</Text>

        {vehicles.map((vehicle) => (
          <Pressable key={vehicle.id} onPress={() => router.push(`/dashboard/vehicle-bookings/${vehicle.id}`)}>
            <Card style={{ gap: spacing.xs }}>
              <Text variant="body" style={{ fontFamily: "PlusJakartaSans_600SemiBold" }}>
                {vehicle.marque} {vehicle.modele}
              </Text>
              <Badge label={vehicle.statutValidation} tone={VALIDATION_TONE[vehicle.statutValidation]} />
              <Text variant="caption" color={colors.primary}>
                Voir les demandes de réservation →
              </Text>
            </Card>
          </Pressable>
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
          <Button label="Ajouter" onPress={handleCreate} loading={creating} />
        </Card>
      </ScrollView>
    </Screen>
  );
}
