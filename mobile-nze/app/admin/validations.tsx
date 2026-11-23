import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";
import {
  listPendingStores,
  validateStore,
  listPendingDeliverers,
  validateDeliverer,
  listPendingServiceProfiles,
  validateServiceProfile,
  listPendingVehicles,
  validateVehicle,
  listPendingLodgings,
  validateLodging,
} from "@/lib/admin-api";

type ValidationType = "stores" | "deliverers" | "service-profiles" | "vehicles" | "lodgings";

const CONFIG: Record<
  ValidationType,
  { title: string; list: (t: string) => Promise<any[]>; validate: (t: string, id: string, s: "valide" | "refuse") => Promise<any>; label: (item: any) => string }
> = {
  stores: {
    title: "Magasins en attente",
    list: listPendingStores,
    validate: validateStore,
    label: (item) => `${item.nom}${item.quartier ? ` — ${item.quartier}` : ""}`,
  },
  deliverers: {
    title: "Livreurs en attente",
    list: listPendingDeliverers,
    validate: validateDeliverer,
    label: (item) => `Livreur — ${item.typeVehicule}`,
  },
  "service-profiles": {
    title: "Prestataires en attente",
    list: listPendingServiceProfiles,
    validate: validateServiceProfile,
    label: (item) => item.metier,
  },
  vehicles: {
    title: "Véhicules en attente",
    list: listPendingVehicles,
    validate: validateVehicle,
    label: (item) => `${item.marque ?? ""} ${item.modele ?? ""}`.trim() || "Véhicule",
  },
  lodgings: {
    title: "Hébergements en attente",
    list: listPendingLodgings,
    validate: validateLodging,
    label: (item) => `${item.nom} — ${item.ville} (${item.type})`,
  },
};

export default function AdminValidationsScreen() {
  const { type } = useLocalSearchParams<{ type: ValidationType }>();
  const accessToken = useAuthStore((s) => s.accessToken)!;
  const config = CONFIG[type];
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await config.list(accessToken));
    } finally {
      setLoading(false);
    }
  }, [accessToken, config]);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(id: string, statut: "valide" | "refuse") {
    try {
      await config.validate(accessToken, id, statut);
      await load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible de traiter la demande");
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h1">{config.title}</Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : items.length === 0 ? (
          <Text variant="body" color={colors.inkSoft}>
            Rien en attente pour l'instant.
          </Text>
        ) : (
          items.map((item) => (
            <Card key={item.id} style={{ gap: spacing.sm }}>
              <Text variant="body">{config.label(item)}</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Button label="Valider" onPress={() => respond(item.id, "valide")} />
                <Button label="Refuser" variant="ghost" onPress={() => respond(item.id, "refuse")} />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
