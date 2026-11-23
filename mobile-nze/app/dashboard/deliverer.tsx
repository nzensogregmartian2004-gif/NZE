import { useCallback, useEffect, useRef, useState } from "react";
import { View, ScrollView, ActivityIndicator, Alert, TextInput, Pressable } from "react-native";
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
import { useAutoTutorial } from "@/hooks/useAutoTutorial";

const VALIDATION_TONE = { en_attente: "warning", valide: "success", refuse: "danger", suspendu: "danger" } as const;
const LOCATION_PUSH_INTERVAL_MS = 15000;

export default function DelivererDashboard() {
  useAutoTutorial("deliverer");
  const accessToken = useAuthStore((s) => s.accessToken)!;
  const [deliverer, setDeliverer] = useState<Deliverer | null>(null);
  const [missions, setMissions] = useState<DeliveryMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [proofReferences, setProofReferences] = useState<Record<string, string>>({});
  const [proofTypes, setProofTypes] = useState<Record<string, "code" | "signature" | "photo" | "autre">>({});
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
      if (nextStatus === "livraison_terminee") {
        const proofReference = (proofReferences[mission.id] ?? "").trim();
        const proofType = proofTypes[mission.id] ?? (mission.preuveRequise ? "code" : "autre");
        if (proofReference.length < 3) {
          Alert.alert("Preuve de remise requise", mission.preuveRequise ? "Saisis le code à usage unique affiché au client." : "Saisis la référence de preuve de remise.");
          return;
        }
        if (mission.preuveRequise && proofType !== "code") {
          Alert.alert("Code client obligatoire", "Pour cette commande NZE, la remise doit être confirmée avec le code à usage unique du client.");
          return;
        }
        await updateDeliveryStatus(accessToken, mission.id, nextStatus, {
          preuveType: proofType,
          preuveReference: proofReference,
        });
        setProofReferences((current) => ({ ...current, [mission.id]: "" }));
      } else {
        await updateDeliveryStatus(accessToken, mission.id, nextStatus);
      }
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
                {mission.statut === "arrive_chez_client" && (
                  <Button label="Faire signer le client" variant="secondary" onPress={() => router.push(`/delivery-proof/${mission.id}`)} />
                )}
                {mission.statut === "arrive_chez_client" && (
                  <View style={{ gap: spacing.xs }}>
                    <Text variant="caption" color={colors.inkSoft}>{mission.preuveRequise ? "Code à usage unique affiché au client" : "Type de preuve de remise"}</Text>
                    {!mission.preuveRequise && (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                        {([{ value: "signature", label: "Signature" }, { value: "photo", label: "Photo" }, { value: "autre", label: "Autre référence" }] as const).map((option) => {
                          const selected = (proofTypes[mission.id] ?? "autre") === option.value;
                          return <Pressable key={option.value} onPress={() => setProofTypes((current) => ({ ...current, [mission.id]: option.value }))} style={{ backgroundColor: selected ? colors.primary : colors.primaryTint, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8 }}><Text variant="caption" color={selected ? colors.white : colors.primary}>{option.label}</Text></Pressable>;
                        })}
                      </View>
                    )}
                    <TextInput
                      value={proofReferences[mission.id] ?? ""}
                      onChangeText={(value) => setProofReferences((current) => ({ ...current, [mission.id]: value }))}
                      placeholder={mission.preuveRequise ? "Code à 6 chiffres" : "Référence de signature ou photo"}
                      autoCapitalize="none"
                      keyboardType={mission.preuveRequise ? "number-pad" : "default"}
                      maxLength={mission.preuveRequise ? 6 : 1000}
                      style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: spacing.md, color: colors.ink, backgroundColor: colors.white }}
                    />
                    <Button label="Confirmer la remise avec preuve" onPress={() => handleAdvanceMission(mission)} />
                  </View>
                )}
                {DELIVERY_STATUS_SEQUENCE.includes(mission.statut as any) &&
                  mission.statut !== "livraison_terminee" && mission.statut !== "arrive_chez_client" && (
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
