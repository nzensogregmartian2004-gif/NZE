import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { listAdminAds, reviewAdminAd, type AdminAd } from "@/lib/admin-api";

function money(amount: string) { return `${Number(amount).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} FCFA`; }
export default function AdminAdvertisementsScreen() {
  const token = useAuthStore((s) => s.accessToken)!;
  const [items, setItems] = useState<AdminAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState<Record<string, string>>({});
  const load = useCallback(async () => { setLoading(true); try { setItems(await listAdminAds(token)); } catch (error) { Alert.alert("Chargement impossible", error instanceof ApiError ? error.message : "Vérifie tes autorisations."); } finally { setLoading(false); } }, [token]);
  useEffect(() => { void load(); }, [load]);
  async function review(ad: AdminAd, action: "approuver" | "refuser") {
    try { await reviewAdminAd(token, ad.id, action, reason[ad.id]); await load(); }
    catch (error) { Alert.alert("Décision impossible", error instanceof ApiError ? error.message : "Impossible de modifier cette campagne."); }
  }
  return <Screen><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
    <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
    <Text variant="h1">Modération des promotions</Text>
    <Text variant="bodySm" color={colors.inkSoft}>Une campagne n'est activée qu'après confirmation du paiement par MyPVit et validation éditoriale. Cette page ne permet jamais de modifier le statut de paiement.</Text>
    {loading ? <ActivityIndicator color={colors.primary} /> : items.length === 0 ? <Text variant="bodySm" color={colors.inkSoft}>Aucune campagne en attente.</Text> : items.map((ad) => <Card key={ad.id} style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm }}><Text variant="h3">{ad.cibleType} · {ad.emplacement ?? "sans emplacement"}</Text><Badge label={ad.paiementStatut} tone={ad.paiementStatut === "confirme" ? "success" : "warning"} /></View>
      <Text variant="bodySm">{ad.dateDebut} → {ad.dateFin} · {money(ad.prix)}</Text>
      <Text variant="caption" color={colors.inkSoft}>Cible : {ad.cibleId}</Text>
      <Text variant="caption" color={colors.inkSoft}>Impressions : {ad.impressions} · Clics : {ad.clics} · Commandes attribuées : {ad.commandesAttribuees}</Text>
      <Input label="Motif si refus" value={reason[ad.id] ?? ""} onChangeText={(value) => setReason((old) => ({ ...old, [ad.id]: value }))} placeholder="Optionnel" />
      <View style={{ flexDirection: "row", gap: spacing.sm }}><View style={{ flex: 1 }}><Button label="Approuver" onPress={() => void review(ad, "approuver")} fullWidth /></View><View style={{ flex: 1 }}><Button label="Refuser" variant="secondary" onPress={() => void review(ad, "refuser")} fullWidth /></View></View>
    </Card>)}
    <Button label="Actualiser" variant="ghost" onPress={() => void load()} fullWidth />
  </ScrollView></Screen>;
}
