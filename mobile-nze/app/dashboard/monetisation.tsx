import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
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
import {
  listSubscriptionPlans, listSubscriptionsForActivity, startSubscription,
  listPromotionTargets, listPromotionPrices, listMyPromotionCampaigns, createPromotionCampaign,
  type SubscriptionPlan, type SubscriptionRecord, type PromotionTarget, type PromotionPrice,
  type PromotionCampaign, type PromotionTargetType,
} from "@/lib/monetization-api";

const OPERATORS = ["AIRTEL_MONEY", "MOOV_MONEY"] as const;
const TARGET_LABELS: Record<PromotionTargetType, string> = {
  produit: "Produit", magasin: "Magasin / restaurant", prestataire: "Prestataire", vehicule: "Véhicule", hebergement: "Hébergement",
};
const SUB_STATUS: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active: "success", expiree: "neutral", annulee: "danger", en_attente_paiement: "warning",
};
const AD_STATUS: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active: "success", en_attente: "warning", expiree: "neutral", refusee: "danger",
};
function today() { return new Date().toISOString().slice(0, 10); }
function datePlusDays(days: number) { const d = new Date(); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function money(value: string | number) { return `${Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA`; }
function errorMessage(error: unknown, fallback: string) { return error instanceof ApiError ? error.message : fallback; }

export default function MonetisationDashboard() {
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const activities = useMemo(() => (user?.activities ?? []).filter((item) => item.type !== "client"), [user?.activities]);
  const [activityId, setActivityId] = useState("");
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [targets, setTargets] = useState<PromotionTarget[]>([]);
  const [prices, setPrices] = useState<PromotionPrice[]>([]);
  const [campaigns, setCampaigns] = useState<PromotionCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [busyCampaign, setBusyCampaign] = useState(false);
  const [accountNumber, setAccountNumber] = useState(user?.telephone ?? "");
  const [operatorCode, setOperatorCode] = useState<(typeof OPERATORS)[number]>("AIRTEL_MONEY");
  const [targetId, setTargetId] = useState("");
  const [placement, setPlacement] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(datePlusDays(6));
  const [region, setRegion] = useState("");

  const loadBase = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [planRows, targetRows, priceRows, campaignRows] = await Promise.all([
        listSubscriptionPlans(), listPromotionTargets(token), listPromotionPrices(), listMyPromotionCampaigns(token),
      ]);
      setPlans(planRows);
      setTargets(targetRows);
      setPrices(priceRows);
      setCampaigns(campaignRows);
    } catch (error) {
      Alert.alert("Chargement impossible", errorMessage(error, "Vérifie la connexion puis réessaie."));
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    if (!activityId && activities.length) setActivityId(activities[0].id);
  }, [activities, activityId]);

  useEffect(() => { void loadBase(); }, [loadBase]);
  useEffect(() => {
    if (!targetId && targets.length > 0) setTargetId(targets[0].cibleId);
  }, [targets, targetId]);

  const loadSubscriptions = useCallback(async () => {
    if (!token || !activityId) { setSubscriptions([]); return; }
    try { setSubscriptions(await listSubscriptionsForActivity(token, activityId)); }
    catch (error) { Alert.alert("Abonnements indisponibles", errorMessage(error, "Impossible de consulter les abonnements.")); }
  }, [token, activityId]);
  useEffect(() => { void loadSubscriptions(); }, [loadSubscriptions]);

  const selectedTarget = targets.find((target) => target.cibleId === targetId) ?? null;
  const placementOptions = prices.filter((price) => price.cibleType === selectedTarget?.cibleType && price.actif);
  const selectedPrice = placementOptions.find((price) => price.emplacement === placement) ?? placementOptions[0] ?? null;
  const dayCount = Math.max(0, Math.floor((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000) + 1);
  const estimatedTotal = selectedPrice ? Number(selectedPrice.prixParJour) * dayCount : 0;

  useEffect(() => {
    if (selectedTarget && placementOptions.length && !placementOptions.some((price) => price.emplacement === placement)) {
      setPlacement(placementOptions[0].emplacement);
    }
  }, [selectedTarget?.cibleType, placementOptions.map((p) => p.emplacement).join("|"), placement]);

  async function buyPlan(plan: SubscriptionPlan) {
    if (!token || !activityId) { Alert.alert("Activité requise", "Sélectionne une activité professionnelle active."); return; }
    if (Number(plan.prix) > 0 && !accountNumber.trim()) { Alert.alert("Numéro requis", "Saisis le numéro Mobile Money à utiliser."); return; }
    setBusyPlanId(plan.id);
    try {
      const result = await startSubscription(token, {
        userActivityId: activityId, planId: plan.id,
        ...(Number(plan.prix) > 0 ? { customerAccountNumber: accountNumber, operatorCode } : {}),
      });
      Alert.alert("Demande envoyée", result.providerMessage ?? result.message);
      await loadSubscriptions();
    } catch (error) { Alert.alert("Souscription impossible", errorMessage(error, "Vérifie les informations puis réessaie.")); }
    finally { setBusyPlanId(null); }
  }

  async function createCampaign() {
    if (!token || !selectedTarget) { Alert.alert("Annonce requise", "Choisis une annonce à promouvoir."); return; }
    if (!selectedPrice) { Alert.alert("Tarif indisponible", "L'administration n'a pas configuré de tarif pour ce type d'annonce."); return; }
    if (!accountNumber.trim()) { Alert.alert("Numéro requis", "Saisis le numéro Mobile Money à utiliser."); return; }
    setBusyCampaign(true);
    try {
      const result = await createPromotionCampaign(token, {
        cibleType: selectedTarget.cibleType, cibleId: selectedTarget.cibleId,
        emplacement: selectedPrice.emplacement, dateDebut: startDate, dateFin: endDate,
        ...(region.trim() ? { region: region.trim() } : {}), customerAccountNumber: accountNumber, operatorCode,
      });
      Alert.alert("Demande envoyée", `${result.providerMessage ?? result.message}\n\nDurée : ${result.days} jour(s)\nTarif : ${money(result.pricePerDay)} / jour\nTotal : ${money(result.total)}`);
      await loadBase();
    } catch (error) { Alert.alert("Campagne impossible", errorMessage(error, "Vérifie les dates et réessaie.")); }
    finally { setBusyCampaign(false); }
  }

  if (loading) return <Screen><ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /></Screen>;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h1">Abonnements et promotions</Text>
        <Text variant="bodySm" color={colors.inkSoft}>Les tarifs proviennent de NZE. Une demande payante reste en attente jusqu'à la confirmation officielle de MyPVit, puis une promotion attend la modération.</Text>

        <Card style={{ gap: spacing.sm }}>
          <Text variant="h3">Paiement Mobile Money</Text>
          <Input label="Numéro du compte à débiter" placeholder="Ex. 074000000" value={accountNumber} onChangeText={setAccountNumber} keyboardType="phone-pad" />
          <Text variant="label">Opérateur</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {OPERATORS.map((operator) => <Button key={operator} label={operator.replace("_", " ")} variant={operatorCode === operator ? "primary" : "secondary"} onPress={() => setOperatorCode(operator)} />)}
          </View>
        </Card>

        <View style={{ gap: spacing.sm }}>
          <Text variant="h2">Abonnement professionnel</Text>
          {activities.length === 0 ? <Text color={colors.inkSoft}>Aucune activité professionnelle n'est associée à ce compte.</Text> : (
            <>
              <Text variant="label">Activité à abonner</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                {activities.map((activity) => <Button key={activity.id} label={`${activity.type} · ${activity.statut}`} variant={activityId === activity.id ? "primary" : "secondary"} onPress={() => setActivityId(activity.id)} />)}
              </View>
              {subscriptions.map((subscription) => (
                <Card key={subscription.id} style={{ gap: spacing.xs }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
                    <Text variant="body">{subscription.planNom}</Text>
                    <Badge label={subscription.statut} tone={SUB_STATUS[subscription.statut] ?? "neutral"} />
                  </View>
                  <Text variant="caption" color={colors.inkSoft}>{subscription.expireLe ? `Expire le ${new Date(subscription.expireLe).toLocaleDateString("fr-FR")}` : "Activation en attente de paiement"}</Text>
                </Card>
              ))}
              {plans.map((plan) => (
                <Card key={plan.id} style={{ gap: spacing.sm }}>
                  <Text variant="h3">{plan.nom}</Text>
                  <Text variant="h2" color={colors.primary}>{money(plan.prix)}</Text>
                  <Text variant="caption" color={colors.inkSoft}>{plan.dureeJours} jour(s)</Text>
                  {(plan.fonctionnalites ?? []).map((feature, index) => <Text key={`${plan.id}-${index}`} variant="bodySm">• {feature}</Text>)}
                  <Button label={Number(plan.prix) === 0 ? "Activer la formule gratuite" : "Souscrire et payer"} onPress={() => void buyPlan(plan)} loading={busyPlanId === plan.id} fullWidth />
                </Card>
              ))}
            </>
          )}
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="h2">Promotion payante</Text>
          <Text variant="bodySm" color={colors.inkSoft}>Choisis une annonce que tu possèdes. NZE calcule le montant à partir du tarif configuré par jour.</Text>
          {targets.length === 0 ? <Text color={colors.inkSoft}>Aucune cible promotionnelle disponible. Crée une annonce et assure-toi que ton activité est validée.</Text> : (
            <Card style={{ gap: spacing.sm }}>
              <Text variant="label">Annonce à promouvoir</Text>
              {targets.map((target) => (
                <Pressable key={`${target.cibleType}-${target.cibleId}`} onPress={() => { setTargetId(target.cibleId); setPlacement(""); }} style={{ padding: spacing.sm, borderRadius: 10, borderWidth: 1, borderColor: targetId === target.cibleId ? colors.primary : colors.line, backgroundColor: targetId === target.cibleId ? colors.primaryTint : colors.white }}>
                  <Text variant="bodySm" color={targetId === target.cibleId ? colors.primary : colors.ink}>{target.label}</Text>
                </Pressable>
              ))}
              <Text variant="label">Emplacement publicitaire</Text>
              {placementOptions.length === 0 ? <Text variant="caption" color={colors.inkSoft}>Aucun tarif actif pour cette catégorie.</Text> : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                  {placementOptions.map((price) => <Button key={price.id} label={`${price.emplacement} · ${money(price.prixParJour)}/j`} variant={(selectedPrice?.id === price.id) ? "primary" : "secondary"} onPress={() => setPlacement(price.emplacement)} />)}
                </View>
              )}
              <Input label="Date de début (AAAA-MM-JJ)" value={startDate} onChangeText={setStartDate} autoCapitalize="none" />
              <Input label="Date de fin (AAAA-MM-JJ)" value={endDate} onChangeText={setEndDate} autoCapitalize="none" />
              <Input label="Ville ou zone (facultatif)" value={region} onChangeText={setRegion} placeholder="Ex. Libreville" />
              {selectedPrice && dayCount > 0 ? <Text variant="body" color={colors.primary}>Estimation : {dayCount} jour(s) × {money(selectedPrice.prixParJour)} = {money(estimatedTotal)}</Text> : null}
              <Button label="Demander la promotion" onPress={() => void createCampaign()} loading={busyCampaign} disabled={!selectedPrice || dayCount < 1} fullWidth />
            </Card>
          )}
          <Text variant="caption" color={colors.inkSoft}>L'envoi de la demande ne garantit pas la publication : le paiement doit être confirmé et la campagne approuvée par NZE.</Text>
          {campaigns.length > 0 && <Text variant="h3">Mes campagnes</Text>}
          {campaigns.map((campaign) => (
            <Card key={campaign.id} style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm }}>
                <Text variant="body">{TARGET_LABELS[campaign.cibleType]}</Text>
                <Badge label={campaign.statut} tone={AD_STATUS[campaign.statut] ?? "neutral"} />
              </View>
              <Text variant="caption" color={colors.inkSoft}>{campaign.dateDebut} → {campaign.dateFin}</Text>
              <Text variant="bodySm">Paiement : {campaign.paiementStatut} · {money(campaign.prix)}</Text>
              <Text variant="caption" color={colors.inkSoft}>{campaign.impressions} affichage(s) · {campaign.clics} clic(s) · {campaign.commandesAttribuees} commande(s) attribuée(s)</Text>
            </Card>
          ))}
        </View>
        <Button label="Actualiser" variant="ghost" onPress={() => void loadBase()} fullWidth />
      </ScrollView>
    </Screen>
  );
}
