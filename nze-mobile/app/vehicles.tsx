import { useCallback, useEffect, useState } from "react";
import { View, FlatList, ActivityIndicator, Pressable } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { listVehicles, type Vehicle } from "@/lib/mobility-api";
import { ApiError } from "@/lib/api";

const TYPE_LABELS: Record<string, string> = {
  voiture: "🚗 Voiture",
  moto: "🏍️ Moto",
  camionnette: "🚐 Camionnette",
  pick_up: "🛻 Pick-up",
  camion: "🚚 Camion",
  autre: "🚙 Autre",
};

export default function VehiclesScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVehicles(await listVehicles());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les véhicules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h1">Véhicules à louer</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <Text variant="body" color={colors.danger} style={{ padding: spacing.lg }}>
          {error}
        </Text>
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={(v) => v.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md }}
          ListEmptyComponent={
            <Text variant="body" color={colors.inkSoft} style={{ textAlign: "center", marginTop: spacing.xl }}>
              Aucun véhicule disponible pour l'instant.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/vehicle/${item.id}`)}>
              <Card style={{ gap: spacing.xs }}>
                <Text variant="body" style={{ fontFamily: "PlusJakartaSans_600SemiBold" }}>
                  {TYPE_LABELS[item.type] ?? item.type} {item.marque} {item.modele}
                </Text>
                {item.capacite && (
                  <Text variant="bodySm" color={colors.inkSoft}>
                    {item.capacite}
                  </Text>
                )}
                {item.prix && (
                  <Text variant="bodySm" color={colors.primary} style={{ fontFamily: "PlusJakartaSans_600SemiBold" }}>
                    {Number(item.prix).toLocaleString("fr-FR")} FCFA / jour
                  </Text>
                )}
              </Card>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
