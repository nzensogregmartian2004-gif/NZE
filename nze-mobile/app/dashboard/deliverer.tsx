import { useCallback, useEffect, useRef, useState } from "react";
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
import { getCurrentLocation } from "@/lib/location";
import {
  getMyDelivererProfile,
  registerDeliverer,
  setDelivererAvailability,
  updateDelivererLocation,
  listMyDeliveries,
  updateDeliveryStatus,
  DELIVERER_TYPES,
  DELIVERY_STATUS_SEQUENCE,
  DELIVERY_STATUS_LABELS,
  type Deliverer,
  type DeliveryMission,
} from "@/lib/deliverer-api";

const VALIDATION_TONE = { en_attente: "warning", valide: "success", refuse: "danger", suspendu: "danger" } as const;
const LOCATION_PUSH_INTERVAL_MS = 15000;

export default function DelivererDashboard() {
  const accessToken = useAuthStore((s) => s.accessToken)!;
  const [deliverer, setDeliverer] = useState<Deliverer | null>(null);
  const [missions, setMissions] = useState<DeliveryMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const locationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await getMyDelivererProfile(accessToken);
      setDeliverer(profile);
      setMissions(await listMyDeliveries(accessToken));
    } catch {
      setDeliverer(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (locationInterval.current) clearInterval(locationInterval.current);
    };
  }, []);

  async function handleRegister(typeVehicule: string) {
    setRegistering(true);
    try {
      await registerDeliverer(accessToken, typeVehicule);
      await load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible de créer le profil livreur");
    } finally {
      setRegistering(false);
    }
  }

  async function toggleAvailability() {
    if (!deliverer) return;
    try {
      await setDelivererAvailability(accessToken, !deliverer.disponible);
      await load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible de mettre à jour");
    }
  }

  function toggleLocationSharing() {
    if (sharingLocation) {
      if (locationInterval.current) clearInterval(locationInterval.current);
      setSharingLocation(false);
      return;
    }
    setSharingLocation(true);
    const push = async () => {
      const result = await getCurrentLocation();
      if (result.status === "ok") {
        await updateDelivererLocation(accessToken, result.coords.latitude, result.coords.longitude);
      }
    };
    push();
    locationInterval.current = setInterval(push, LOCATION_PUSH_INTERVAL_MS);
  }

  async function handleAdvanceMission(mission: DeliveryMission) {
    const currentIndex = DELIVERY_STATUS_SEQUENCE.indexOf(mission.statut as any);
    const nextStatus = currentIndex === -1 ? DELIVERY_STATUS_SEQUENCE[0] : DELIVERY_STATUS_SEQUENCE[currentIndex + 1];
    if (!nextStatus) return;
    try {
      await updateDeliveryStatus(accessToken, mission.id, nextStatus);
      await load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible de mettre à jour la mission");
    }
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  if (!deliverer) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
          <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
          <Text variant="h1">Devenir livreur</Text>
          <Text variant="body" color={colors.inkSoft}>
            Choisis ton type de véhicule pour t'inscrire.
          </Text>
          {DELIVERER_TYPES.map((type) => (
            <Button key={type} label={type} variant="secondary" onPress={() => handleRegister(type)} loading={registering} />
          ))}
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />

        <View style={{ gap: spacing.xs }}>
          <Text variant="h1">Mon activité livreur</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Badge label={deliverer.statutValidation} tone={VALIDATION_TONE[deliverer.statutValidation]} />
            <Badge label={deliverer.disponible ? "Disponible" : "Indisponible"} tone={deliverer.disponible ? "success" : "neutral"} />
          </View>
        </View>

        {deliverer.statutValidation !== "valide" ? (
          <Text variant="body" color={colors.warning}>
            Ton compte est en attente de validation par l'administration.
          </Text>
        ) : (
          <>
            <Button
              label={deliverer.disponible ? "Me marquer indisponible" : "Me marquer disponible"}
              variant="secondary"
              onPress={toggleAvailability}
            />
            <Button
              label={sharingLocation ? "Arrêter le partage de position" : "Partager ma position"}
              variant={sharingLocation ? "primary" : "secondary"}
              onPress={toggleLocationSharing}
            />
          </>
        )}

        <View style={{ gap: spacing.md }}>
          <Text variant="h3">Mes missions</Text>
          {missions.length === 0 ? (
            <Text variant="body" color={colors.inkSoft}>
              Aucune mission pour l'instant.
            </Text>
          ) : (
            missions.map((mission) => (
              <Card key={mission.id} style={{ gap: spacing.sm }}>
                <Badge label={DELIVERY_STATUS_LABELS[mission.statut] ?? mission.statut} tone="primary" />
                {mission.description && <Text variant="body">{mission.description}</Text>}
                {mission.remuneration && (
                  <Text variant="bodySm" color={colors.primary}>
                    {Number(mission.remuneration).toLocaleString("fr-FR")} FCFA
                  </Text>
                )}
                {DELIVERY_STATUS_SEQUENCE.includes(mission.statut as any) &&
                  mission.statut !== "livraison_terminee" && (
                    <Button label="Étape suivante" variant="secondary" onPress={() => handleAdvanceMission(mission)} />
                  )}
                {mission.statut === "livreur_attribue" && (
                  <Button label="Accepter la mission" onPress={() => handleAdvanceMission(mission)} />
                )}
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
