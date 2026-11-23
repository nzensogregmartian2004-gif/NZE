import { useCallback, useEffect, useState } from "react";
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
import { getCurrentAdminRole, type AdminRole } from "@/lib/admin-api";
import {
  listAdminSubscriptionPlans, createAdminSubscriptionPlan, updateAdminSubscriptionPlan,
  listAdminPromotionPrices, createAdminPromotionPrice, updateAdminPromotionPrice,
  listPendingPromotions, moderatePromotion, createEditorialFeature,
  type SubscriptionPlan, type PromotionPrice, type PromotionCampaign, type PromotionTargetType,
} from "@/lib/monetization-api";

const TARGET_TYPES: PromotionTargetType[] = ["produit", "magasin", "prestataire", "vehicule", "hebergement"];
function message(error: unknown, fallback: string) { return error instanceof ApiError ? error.message : fallback; }
function dateAfter(days: number) { const d = new Date(); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }

export default function AdminMonetisationScreen() {
  const token = useAuthStore((s) => s.accessToken)!;
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [prices, setPrices] = useState<PromotionPrice[]>([]);
  const [pendingAds, setPendingAds] = useState<PromotionCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingPrice, setSavingPrice] = useState(false);
  const [savingEditorial, setSavingEditorial] = useState(false);
  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState("15000");
  const [planDays, setPlanDays] = useState("30");
  const [planFeatures, setPlanFeatures] = useState("Visibilité professionnelle\nStatistiques simplifiées");
  const [targetType, setTargetType] = useState<PromotionTargetType>("produit");
  const [placement, setPlacement] = useState("accueil");
  const [pricePerDay, setPricePerDay] = useState("1000");
  const [editorialTargetId, setEditorialTargetId] = useState("");
  const [editorialLabel, setEditorialLabel] = useState("Mis en avant par NZE");
  const [editorialPlacement, setEditorialPlacement] = useState("accueil");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [currentRole, p, pr] = await Promise.all([
        getCurrentAdminRole(token), listAdminSubscriptionPlans(token), listAdminPromotionPrices(token),
      ]);
      const ads = currentRole.role === "super_admin" ? await listPendingPromotions(token) : [];
      setAdminRole(currentRole.role);
      setPlans(p); setPrices(pr); setPendingAds(ads);
    } catch (error) { Alert.alert("Chargement impossible", message(error, "Vérifie tes autorisations d'administration.")); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  async function savePlan() {
    const price = Number(planPrice); const days = Number(planDays);
    if (!planName.trim() || !Number.isSafeInteger(price) || price < 0 || !Number.isInteger(days) || days < 1 || days > 3650) {
      Alert.alert("Formule invalide", "Saisis un nom, un prix entier en FCFA et une durée comprise entre 1 et 3650 jours."); return;
    }
    setSavingPlan(true);
    try {
      await createAdminSubscriptionPlan(token, { nom: planName.trim(), prix: price, dureeJours: days, fonctionnalites: planFeatures.split("\n").map((v) => v.trim()).filter(Boolean) });
      setPlanName(""); await load(); Alert.alert("Formule créée", "La nouvelle formule est disponible pour les activités professionnelles.");
    } catch (error) { Alert.alert("Création impossible", message(error, "Impossible d'enregistrer la formule.")); }
    finally { setSavingPlan(false); }
  }

  async function savePrice() {
    const price = Number(pricePerDay);
    if (!Number.isSafeInteger(price) || price <= 0 || !placement.trim()) { Alert.alert("Tarif invalide", "Saisis un emplacement et un montant entier positif en FCFA."); return; }
    setSavingPrice(true);
    try {
      await createAdminPromotionPrice(token, { cibleType: targetType, emplacement: placement.trim(), prixParJour: price, devise: "XAF", actif: true });
      await load(); Alert.alert("Tarif enregistré", "Le prix est désormais appliqué côté serveur aux nouvelles campagnes.");
    } catch (error) { Alert.alert("Enregistrement impossible", message(error, "Un tarif existe peut-être déjà pour cet emplacement.")); }
    finally { setSavingPrice(false); }
  }

  async function moderate(ad: PromotionCampaign, statut: "active" | "refusee") {
    try { await moderatePromotion(token, ad.id, statut); await load(); }
    catch (error) { Alert.alert("Modération impossible", message(error, "La campagne ne peut pas être modifiée.")); }
  }

  async function addEditorial() {
    if (!editorialTargetId.trim() || !/^[0-9a-f-]{36}$/i.test(editorialTargetId.trim())) { Alert.alert("Identifiant invalide", "Colle l'identifiant UUID de l'annonce à mettre en avant."); return; }
    setSavingEditorial(true);
    try {
      await createEditorialFeature(token, { cibleType: targetType, cibleId: editorialTargetId.trim(), emplacement: editorialPlacement.trim(), libelle: editorialLabel.trim() || "Mis en avant par NZE", ordre: 0, dateDebut: dateAfter(0), dateFin: dateAfter(30), actif: true });
      setEditorialTargetId(""); Alert.alert("Mise en avant créée", "Ce contenu éditorial est séparé des promotions payantes.");
    } catch (error) { Alert.alert("Création impossible", message(error, "Vérifie l'identifiant et le type de cible.")); }
    finally { setSavingEditorial(false); }
  }

  if (loading) return <Screen><ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /></Screen>;
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h1">Monétisation NZE</Text>
        <Text variant="bodySm" color={colors.inkSoft}>Les prix sont définis par l'administration et recalculés côté serveur. Un abonnement ou une campagne payante ne s'active jamais à la seule réponse initiale de MyPVit.</Text>

        <View style={{ gap: spacing.sm }}>
          <Text variant="h2">Formules d'abonnement</Text>
          <Card style={{ gap: spacing.sm }}>
            <Input label="Nom de la formule" value={planName} onChangeText={setPlanName} placeholder="Ex. Professionnel Plus" />
            <Input label="Prix (FCFA entiers)" value={planPrice} onChangeText={setPlanPrice} keyboardType="number-pad" />
            <Input label="Durée (jours)" value={planDays} onChangeText={setPlanDays} keyboardType="number-pad" />
            <Input label="Fonctionnalités (une par ligne)" value={planFeatures} onChangeText={setPlanFeatures} multiline />
            <Button label="Créer la formule" onPress={() => void savePlan()} loading={savingPlan} fullWidth />
          </Card>
          {plans.map((plan) => <Card key={plan.id} style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm }}>
              <Text variant="body">{plan.nom}</Text><Badge label={plan.actif ? "Active" : "Désactivée"} tone={plan.actif ? "success" : "neutral"} />
            </View>
            <Text variant="caption" color={colors.inkSoft}>{Number(plan.prix).toLocaleString("fr-FR")} FCFA · {plan.dureeJours} jours</Text>
            <Button label={plan.actif ? "Désactiver" : "Réactiver"} variant="secondary" onPress={async () => {
              try { await updateAdminSubscriptionPlan(token, plan.id, { actif: !plan.actif }); await load(); }
              catch (error) { Alert.alert("Modification impossible", message(error, "Impossible de modifier la formule.")); }
            }} />
          </Card>)}
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="h2">Tarification des promotions</Text>
          <Card style={{ gap: spacing.sm }}>
            <Text variant="label">Type d'annonce</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              {TARGET_TYPES.map((type) => <Button key={type} label={type} variant={targetType === type ? "primary" : "secondary"} onPress={() => setTargetType(type)} />)}
            </View>
            <Input label="Identifiant d'emplacement" value={placement} onChangeText={setPlacement} placeholder="accueil, recherche, categorie" />
            <Input label="Prix par jour (FCFA entiers)" value={pricePerDay} onChangeText={setPricePerDay} keyboardType="number-pad" />
            <Button label="Enregistrer le tarif" onPress={() => void savePrice()} loading={savingPrice} fullWidth />
          </Card>
          {prices.map((price) => <Card key={price.id} style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm }}>
              <Text variant="body">{price.cibleType} · {price.emplacement}</Text><Badge label={price.actif ? "Actif" : "Inactif"} tone={price.actif ? "success" : "neutral"} />
            </View>
            <Text variant="caption" color={colors.inkSoft}>{Number(price.prixParJour).toLocaleString("fr-FR")} FCFA / jour</Text>
            <Button label={price.actif ? "Désactiver le tarif" : "Réactiver le tarif"} variant="secondary" onPress={async () => {
              try { await updateAdminPromotionPrice(token, price.id, { actif: !price.actif }); await load(); }
              catch (error) { Alert.alert("Modification impossible", message(error, "Impossible de modifier le tarif.")); }
            }} />
          </Card>)}
        </View>

        {adminRole === "super_admin" && <View style={{ gap: spacing.sm }}>
          <Text variant="h2">Promotions à modérer</Text>
          {pendingAds.length === 0 ? <Text variant="bodySm" color={colors.inkSoft}>Aucune campagne payée en attente de modération.</Text> : pendingAds.map((ad) => <Card key={ad.id} style={{ gap: spacing.sm }}>
            <Text variant="body">{ad.cibleType} · {ad.emplacement}</Text>
            <Text variant="caption" color={colors.inkSoft}>{ad.dateDebut} → {ad.dateFin} · {Number(ad.prix).toLocaleString("fr-FR")} FCFA</Text>
            <Text variant="caption">Paiement : {ad.paiementStatut}</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}><Button label="Approuver" onPress={() => void moderate(ad, "active")} fullWidth /></View>
              <View style={{ flex: 1 }}><Button label="Refuser" variant="secondary" onPress={() => void moderate(ad, "refusee")} fullWidth /></View>
            </View>
          </Card>)}
        </View>}

        {adminRole === "super_admin" && <View style={{ gap: spacing.sm }}>
          <Text variant="h2">Mise en avant éditoriale</Text>
          <Text variant="bodySm" color={colors.inkSoft}>Cette mise en avant est choisie par NZE, sans facturation ; elle est distinguée des résultats marqués « Sponsorisé ».</Text>
          <Card style={{ gap: spacing.sm }}>
            <Text variant="label">Type de cible</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              {TARGET_TYPES.map((type) => <Button key={type} label={type} variant={targetType === type ? "primary" : "secondary"} onPress={() => setTargetType(type)} />)}
            </View>
            <Input label="UUID de l'annonce à mettre en avant" value={editorialTargetId} onChangeText={setEditorialTargetId} autoCapitalize="none" />
            <Input label="Libellé éditorial" value={editorialLabel} onChangeText={setEditorialLabel} />
            <Input label="Emplacement" value={editorialPlacement} onChangeText={setEditorialPlacement} />
            <Button label="Créer la mise en avant (30 jours)" onPress={() => void addEditorial()} loading={savingEditorial} fullWidth />
          </Card>
        </View>}
        <Button label="Actualiser les données" variant="ghost" onPress={() => void load()} fullWidth />
      </ScrollView>
    </Screen>
  );
}
