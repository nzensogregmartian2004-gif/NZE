import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, TextInput, View } from "react-native";
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
  assignDelivery,
  getGlobalDeliveryPricing,
  listAvailableDeliverers,
  listPendingDeliveries,
  saveGlobalDeliveryPricing,
  type AdminDelivery,
  type AvailableDeliverer,
  type GlobalDeliveryPricing,
} from "@/lib/deliveries-api";

function message(error: unknown) {
  return error instanceof ApiError ? error.message : "Une erreur est survenue. Réessaie.";
}
function money(value: string | number) {
  return Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " FCFA";
}

export default function AdminDeliveriesScreen() {
  const token = useAuthStore((s) => s.accessToken)!;
  const [pricing, setPricing] = useState<GlobalDeliveryPricing | null>(null);
  const [pricingActive, setPricingActive] = useState(false);
  const [deliveries, setDeliveries] = useState<AdminDelivery[]>([]);
  const [deliverers, setDeliverers] = useState<AvailableDeliverer[]>([]);
  const [baseFee, setBaseFee] = useState("500");
  const [feePerKm, setFeePerKm] = useState("100");
  const [maxDistanceKm, setMaxDistanceKm] = useState("30");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, pending, available] = await Promise.all([
        getGlobalDeliveryPricing(token),
        listPendingDeliveries(token),
        listAvailableDeliverers(token),
      ]);
      setPricing(p);
      setPricingActive(p.active);
      setBaseFee(String(p.baseFee));
      setFeePerKm(String(p.feePerKm));
      setMaxDistanceKm(String(p.maxDistanceKm));
      setDeliveries(pending);
      setDeliverers(available);
    } catch (error) {
      Alert.alert("Chargement impossible", message(error));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function savePricing() {
    const base = Number(baseFee);
    const perKm = Number(feePerKm);
    const max = Number(maxDistanceKm);
    if (!Number.isFinite(base) || base < 0 || !Number.isFinite(perKm) || perKm < 0 || !Number.isFinite(max) || max <= 0 || max > 200) {
      Alert.alert("Tarifs invalides", "Vérifie le tarif de base, le tarif au kilomètre et la distance maximale.");
      return;
    }
    setSaving(true);
    try {
      const updated = await saveGlobalDeliveryPricing(token, { active: pricingActive, baseFee: base, feePerKm: perKm, maxDistanceKm: max });
      setPricing(updated);
      setPricingActive(updated.active);
      Alert.alert("Configuration enregistrée", updated.active ? "Les nouveaux devis NZE sont activés." : "Les nouveaux devis NZE sont désactivés.");
    } catch (error) {
      Alert.alert("Enregistrement impossible", message(error));
    } finally {
      setSaving(false);
    }
  }

  async function assign(delivery: AdminDelivery, deliverer: AvailableDeliverer) {
    setAssigningId(delivery.id);
    try {
      await assignDelivery(token, delivery.id, deliverer.id);
      await load();
      Alert.alert("Mission attribuée", `La mission a été attribuée au livreur ${deliverer.typeVehicule}.`);
    } catch (error) {
      Alert.alert("Attribution impossible", message(error));
    } finally {
      setAssigningId(null);
    }
  }

  if (loading || !pricing) {
    return <Screen><ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /></Screen>;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h1">Livraisons NZE</Text>

        <Card style={{ gap: spacing.md }}>
          <Text variant="h2">Tarification NZE</Text>
          <Badge label={pricingActive ? "Devis NZE actifs" : "Devis NZE désactivés"} tone={pricingActive ? "success" : "warning"} />
          <Button label={pricingActive ? "Désactiver les nouveaux devis NZE" : "Activer les nouveaux devis NZE"} variant="secondary" onPress={() => setPricingActive((value) => !value)} fullWidth />
          <Text variant="bodySm" color={colors.inkSoft}>Tarif administré par NZE. Les frais sont calculés côté serveur selon la distance estimée et la zone autorisée.</Text>
          <Text variant="label">Tarif de base (FCFA)</Text>
          <TextInput value={baseFee} onChangeText={setBaseFee} keyboardType="decimal-pad" style={inputStyle} />
          <Text variant="label">Tarif par kilomètre (FCFA)</Text>
          <TextInput value={feePerKm} onChangeText={setFeePerKm} keyboardType="decimal-pad" style={inputStyle} />
          <Text variant="label">Distance maximale (km)</Text>
          <TextInput value={maxDistanceKm} onChangeText={setMaxDistanceKm} keyboardType="decimal-pad" style={inputStyle} />
          <Button label="Enregistrer la configuration" onPress={savePricing} loading={saving} fullWidth />
          <Text variant="caption" color={colors.inkSoft}>Pour éviter une activation accidentelle, laisse ce service désactivé tant que la zone, les tarifs et les conditions opérationnelles ne sont pas validés.</Text>
        </Card>

        <View style={{ gap: spacing.sm }}>
          <Text variant="h2">Missions en attente</Text>
          {deliveries.length === 0 ? <Text variant="bodySm" color={colors.inkSoft}>Aucune mission en attente d'attribution.</Text> : deliveries.map((delivery) => (
            <Card key={delivery.id} style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm }}>
                <Text variant="label">Mission #{delivery.id.slice(0, 8)}</Text>
                <Badge label={delivery.statut.replace(/_/g, " ")} tone="warning" />
              </View>
              {delivery.description && <Text variant="bodySm">{delivery.description}</Text>}
              {delivery.remuneration && <Text variant="bodySm" color={colors.primary}>Rémunération livreur : {money(delivery.remuneration)}</Text>}
              {deliverers.length === 0 ? <Text variant="caption" color={colors.inkSoft}>Aucun livreur validé et disponible actuellement.</Text> : (
                <View style={{ gap: spacing.xs }}>
                  <Text variant="caption" color={colors.inkSoft}>Attribuer à :</Text>
                  {deliverers.map((deliverer) => <Button key={deliverer.id} label={`${deliverer.typeVehicule} · ${deliverer.id.slice(0, 8)}`} variant="secondary" onPress={() => assign(delivery, deliverer)} loading={assigningId === delivery.id} fullWidth />)}
                </View>
              )}
            </Card>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: 12,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
  color: colors.ink,
  backgroundColor: colors.white,
} as const;
