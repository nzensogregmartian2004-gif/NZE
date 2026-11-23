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
import {
  getMyDriverProfile,
  registerDriver,
  setDriverAvailability,
  listAvailableRides,
  acceptRide,
  startRide,
  completeRide,
  type Driver,
  type AvailableRide,
} from "@/lib/driver-api";
import { useAutoTutorial } from "@/hooks/useAutoTutorial";

const VALIDATION_TONE = { en_attente: "warning", valide: "success", refuse: "danger", suspendu: "danger" } as const;

export default function DriverDashboard() {
  useAutoTutorial("driver");
  const accessToken = useAuthStore((s) => s.accessToken)!;
  const [driver, setDriver] = useState<Driver | null>(null);
  const [availableRides, setAvailableRides] = useState<AvailableRide[]>([]);
  const [activeRide, setActiveRide] = useState<AvailableRide | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await getMyDriverProfile(accessToken);
      setDriver(profile);
      if (profile.statutValidation === "valide" && profile.disponible && !activeRide) {
        setAvailableRides(await listAvailableRides(accessToken));
      }
    } catch {
      setDriver(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, activeRide]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRegister(typeService: "taxi" | "moto") {
    setRegistering(true);
    try {
      await registerDriver(accessToken, typeService);
      await load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible de créer le profil chauffeur");
    } finally {
      setRegistering(false);
    }
  }

  async function toggleAvailability() {
    if (!driver) return;
    try {
      await setDriverAvailability(accessToken, !driver.disponible);
      await load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible de mettre à jour");
    }
  }

  async function handleAccept(ride: AvailableRide) {
    try {
      const accepted = await acceptRide(accessToken, ride.id);
      setActiveRide(accepted);
      setAvailableRides((rides) => rides.filter((r) => r.id !== ride.id));
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Cette course n'est plus disponible");
      load();
    }
  }

  async function handleStart() {
    if (!activeRide) return;
    const updated = await startRide(accessToken, activeRide.id);
    setActiveRide(updated);
  }

  async function handleComplete() {
    if (!activeRide) return;
    await completeRide(accessToken, activeRide.id);
    setActiveRide(null);
    load();
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  if (!driver) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
          <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
          <Text variant="h1">Devenir chauffeur</Text>
          <Button label="🚕 Taxi" variant="secondary" onPress={() => handleRegister("taxi")} loading={registering} />
          <Button label="🏍️ Moto" variant="secondary" onPress={() => handleRegister("moto")} loading={registering} />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />

        <View style={{ gap: spacing.xs }}>
          <Text variant="h1">Mon activité chauffeur</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Badge label={driver.statutValidation} tone={VALIDATION_TONE[driver.statutValidation]} />
            <Badge label={driver.disponible ? "Disponible" : "Indisponible"} tone={driver.disponible ? "success" : "neutral"} />
          </View>
        </View>

        {driver.statutValidation !== "valide" ? (
          <Text variant="body" color={colors.warning}>
            Ton compte est en attente de validation par l'administration.
          </Text>
        ) : (
          <Button
            label={driver.disponible ? "Me marquer indisponible" : "Me marquer disponible"}
            variant="secondary"
            onPress={toggleAvailability}
          />
        )}

        {activeRide ? (
          <Card style={{ gap: spacing.sm }}>
            <Text variant="label" color={colors.inkSoft}>
              COURSE EN COURS
            </Text>
            <Badge label={activeRide.statut} tone="primary" />
            {activeRide.prixEstime && (
              <Text variant="h3" color={colors.primary}>
                {Number(activeRide.prixEstime).toLocaleString("fr-FR")} FCFA
              </Text>
            )}
            {activeRide.statut === "acceptee" && <Button label="Démarrer la course" onPress={handleStart} />}
            {activeRide.statut === "en_cours" && <Button label="Terminer la course" onPress={handleComplete} />}
          </Card>
        ) : (
          driver.disponible &&
          driver.statutValidation === "valide" && (
            <View style={{ gap: spacing.md }}>
              <Text variant="h3">Courses disponibles</Text>
              {availableRides.length === 0 ? (
                <Text variant="body" color={colors.inkSoft}>
                  Aucune course disponible pour l'instant.
                </Text>
              ) : (
                availableRides.map((ride) => (
                  <Card key={ride.id} style={{ gap: spacing.sm }}>
                    <Text variant="body">{ride.typeService === "taxi" ? "🚕 Taxi" : "🏍️ Moto"}</Text>
                    {ride.prixEstime && (
                      <Text variant="bodySm" color={colors.primary}>
                        {Number(ride.prixEstime).toLocaleString("fr-FR")} FCFA
                      </Text>
                    )}
                    <Button label="Accepter" onPress={() => handleAccept(ride)} />
                  </Card>
                ))
              )}
            </View>
          )
        )}
      </ScrollView>
    </Screen>
  );
}
