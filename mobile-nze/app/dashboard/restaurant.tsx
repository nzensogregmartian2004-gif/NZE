import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { listMyStores, updateOrderStatus, type Store } from "@/lib/stores-api";
import {
  createRestaurantDish, createRestaurantSection, getRestaurantDashboard, listRestaurantOrders,
  saveRestaurantProfile, setRestaurantDishAvailability, setRestaurantOrderPreparationTime, updateRestaurantDish,
  type RestaurantDashboard, type RestaurantOrder,
} from "@/lib/restaurants-api";
import { useAutoTutorial } from "@/hooks/useAutoTutorial";

function message(error: unknown, fallback: string) { return error instanceof ApiError ? error.message : fallback; }
function money(value: string | number) { return Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " FCFA"; }
function parseOptions(raw: string) {
  if (!raw.trim()) return [];
  return raw.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [nom, amount = "0"] = line.split("|");
    const prix = Number(amount.trim());
    if (!nom.trim() || !Number.isFinite(prix) || prix < 0) throw new Error("Format d'option invalide. Utilise un nom et un prix séparés par |.");
    return { nom: nom.trim(), prix };
  });
}

export default function RestaurantDashboardScreen() {
  useAutoTutorial("restaurant");
  const accessToken = useAuthStore((state) => state.accessToken)!;
  const params = useLocalSearchParams<{ storeId?: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [dashboard, setDashboard] = useState<RestaurantDashboard | null>(null);
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cuisine, setCuisine] = useState("Cuisine variée");
  const [profileDescription, setProfileDescription] = useState("");
  const [telephone, setTelephone] = useState("");
  const [prepAverage, setPrepAverage] = useState("20");
  const [minimum, setMinimum] = useState("0");
  const [commandsActive, setCommandsActive] = useState(true);
  const [prepMinutes, setPrepMinutes] = useState("20");
  const [sectionName, setSectionName] = useState("");
  const [dishName, setDishName] = useState("");
  const [dishDescription, setDishDescription] = useState("");
  const [dishPrice, setDishPrice] = useState("");
  const [dishPrep, setDishPrep] = useState("15");
  const [dishStock, setDishStock] = useState("0");
  const [dishManagedStock, setDishManagedStock] = useState(false);
  const [dishPhotosText, setDishPhotosText] = useState("");
  const [allergensText, setAllergensText] = useState("");
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [editDishName, setEditDishName] = useState("");
  const [editDishDescription, setEditDishDescription] = useState("");
  const [editDishPrice, setEditDishPrice] = useState("");
  const [editDishPrep, setEditDishPrep] = useState("15");
  const [editDishIngredients, setEditDishIngredients] = useState("");
  const [editSupplementsText, setEditSupplementsText] = useState("");
  const [editFormulasText, setEditFormulasText] = useState("");
  const [dishIngredients, setDishIngredients] = useState("");
  const [supplementsText, setSupplementsText] = useState("");
  const [formulasText, setFormulasText] = useState("");
  const [sectionId, setSectionId] = useState<string | undefined>();
  const [creatingDish, setCreatingDish] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const allStores = await listMyStores(accessToken);
      const chosen = allStores.find((item) => item.id === params.storeId) ?? allStores.find((item) => item.typeEtablissement === "restaurant") ?? null;
      setStore(chosen);
      if (chosen?.typeEtablissement === "restaurant") {
        const data = await getRestaurantDashboard(accessToken, chosen.id);
        setDashboard(data);
        setOrders(await listRestaurantOrders(accessToken, chosen.id));
        if (data.profile) {
          setCuisine(data.profile.typeCuisine);
          setProfileDescription(data.profile.description ?? "");
          setTelephone(data.profile.telephone ?? "");
          setPrepAverage(String(data.profile.tempsPreparationMoyen));
          setMinimum(String(data.profile.montantMinimum));
          setCommandsActive(data.profile.commandesActives);
        }
      } else { setDashboard(null); setOrders([]); }
    } catch (error) { Alert.alert("Chargement impossible", message(error, "Impossible de charger l'espace restaurant.")); }
    finally { setLoading(false); }
  }, [accessToken, params.storeId]);
  useEffect(() => { void load(); }, [load]);

  async function saveProfile() {
    if (!store) return;
    const prep = Number(prepAverage), min = Number(minimum);
    if (!cuisine.trim() || !Number.isInteger(prep) || prep < 1 || prep > 240 || !Number.isFinite(min) || min < 0) {
      Alert.alert("Informations invalides", "Vérifie le type de cuisine, le délai moyen et le montant minimum."); return;
    }
    setSaving(true);
    try {
      await saveRestaurantProfile(accessToken, store.id, { typeCuisine: cuisine.trim(), description: profileDescription.trim() || undefined, telephone: telephone.trim() || undefined, tempsPreparationMoyen: prep, montantMinimum: min, commandesActives: commandsActive });
      await load(); Alert.alert("Profil enregistré", "Les informations du restaurant ont été enregistrées.");
    } catch (error) { Alert.alert("Erreur", message(error, "Impossible d'enregistrer le profil.")); }
    finally { setSaving(false); }
  }

  async function addSection() {
    if (!store || !sectionName.trim()) return;
    setSaving(true);
    try { await createRestaurantSection(accessToken, store.id, { nom: sectionName.trim(), ordre: dashboard?.sections.length ?? 0 }); setSectionName(""); await load(); }
    catch (error) { Alert.alert("Erreur", message(error, "Impossible d'ajouter la rubrique.")); }
    finally { setSaving(false); }
  }

  async function addDish() {
    if (!store || !dishName.trim() || !dishPrice.trim()) { Alert.alert("Champs requis", "Saisis le nom et le prix du plat."); return; }
    const price = Number(dishPrice), prep = Number(dishPrep), stock = Number(dishStock);
    if (!Number.isFinite(price) || price <= 0 || !Number.isInteger(prep) || prep < 1 || prep > 240 || (dishManagedStock && (!Number.isInteger(stock) || stock < 0))) {
      Alert.alert("Valeurs invalides", "Vérifie le prix, le temps de préparation et le stock."); return;
    }
    setCreatingDish(true);
    try {
      const photoUrls = dishPhotosText.split("\n").map((line) => line.trim()).filter(Boolean);
      if (photoUrls.some((url) => !/^https?:\/\//i.test(url))) throw new Error("Chaque photo doit être une URL publique commençant par https:// ou http://.");
      await createRestaurantDish(accessToken, store.id, { nom: dishName.trim(), description: dishDescription.trim() || undefined, prix: price, photos: photoUrls, sectionId, tempsPreparationMinutes: prep, ingredients: dishIngredients.trim() || undefined, allergenes: allergensText.split(",").map((value) => value.trim()).filter(Boolean), gestionStock: dishManagedStock, ...(dishManagedStock ? { stock } : {}), supplements: parseOptions(supplementsText), formules: parseOptions(formulasText) });
      setDishName(""); setDishDescription(""); setDishPrice(""); setDishPrep("15"); setDishStock("0"); setDishIngredients(""); setSupplementsText(""); setFormulasText(""); setDishPhotosText(""); setAllergensText("");
      await load(); Alert.alert("Plat ajouté", "Le plat a été ajouté au menu.");
    } catch (error) { Alert.alert("Erreur", message(error, error instanceof Error ? error.message : "Impossible d'ajouter le plat.")); }
    finally { setCreatingDish(false); }
  }

  function startDishEdit(dish: NonNullable<RestaurantDashboard["dishes"]>[number]) {
    setEditingDishId(dish.id);
    setEditDishName(dish.nom);
    setEditDishDescription(dish.description ?? "");
    setEditDishPrice(String(dish.prix));
    setEditDishPrep(String(dish.tempsPreparationMinutes));
    setEditDishIngredients(dish.ingredients ?? "");
    setEditSupplementsText((dish.optionGroups ?? []).filter((group) => group.kind === "supplement").flatMap((group) => group.choices.map((choice) => `${choice.label}|${choice.price}`)).join("\n"));
    setEditFormulasText((dish.optionGroups ?? []).filter((group) => group.kind === "formule").flatMap((group) => group.choices.map((choice) => `${choice.label}|${choice.price}`)).join("\n"));
  }

  async function saveDishEdit() {
    if (!store || !editingDishId) return;
    const price = Number(editDishPrice), prep = Number(editDishPrep);
    if (!editDishName.trim() || !Number.isFinite(price) || price <= 0 || !Number.isInteger(prep) || prep < 1 || prep > 240) {
      Alert.alert("Valeurs invalides", "Vérifie le nom, le prix et le temps de préparation du plat."); return;
    }
    setSaving(true);
    try {
      await updateRestaurantDish(accessToken, editingDishId, {
        nom: editDishName.trim(), description: editDishDescription.trim(), prix: price,
        tempsPreparationMinutes: prep, ingredients: editDishIngredients.trim(),
        supplements: parseOptions(editSupplementsText), formules: parseOptions(editFormulasText),
      });
      setEditingDishId(null);
      await load();
      Alert.alert("Plat modifié", "Les informations du plat ont été enregistrées.");
    } catch (error) { Alert.alert("Erreur", message(error, error instanceof Error ? error.message : "Impossible de modifier le plat.")); }
    finally { setSaving(false); }
  }

  async function toggleDish(dishId: string, current: boolean) {
    try { await setRestaurantDishAvailability(accessToken, dishId, !current); await load(); }
    catch (error) { Alert.alert("Erreur", message(error, "Impossible de modifier la disponibilité.")); }
  }
  async function orderAction(order: RestaurantOrder, next: RestaurantOrder["statut"]) {
    try { await updateOrderStatus(accessToken, order.id, next); await load(); }
    catch (error) { Alert.alert("Erreur", message(error, "Impossible de mettre à jour cette commande.")); }
  }
  async function savePrepTime(order: RestaurantOrder) {
    const minutes = Number(prepMinutes);
    if (!store || !Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
      Alert.alert("Valeur invalide", "Le délai doit être compris entre 1 et 240 minutes."); return;
    }
    try { await setRestaurantOrderPreparationTime(accessToken, store.id, order.id, minutes); await load(); }
    catch (error) { Alert.alert("Erreur", message(error, "Impossible d'enregistrer le délai.")); }
  }

  if (loading) return <Screen><ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /></Screen>;
  if (!store || store.typeEtablissement !== "restaurant") return <Screen><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
    <Button label="← Retour" variant="ghost" onPress={() => router.back()} /><Text variant="h1">Espace restaurant</Text>
    <Card style={{ gap: spacing.md }}><Text variant="body">Aucun établissement de type restaurant n'a été trouvé sur ton compte.</Text><Text variant="bodySm" color={colors.inkSoft}>Depuis le tableau de bord commerçant, crée un établissement et choisis « Restaurant ». Il doit être validé par NZE pour apparaître publiquement.</Text><Button label="Ouvrir le tableau commerçant" onPress={() => router.push("/dashboard/store" as any)} fullWidth /></Card>
  </ScrollView></Screen>;

  const profile = dashboard?.profile;
  const stats = dashboard?.stats;
  const action = (order: RestaurantOrder) => order.statut === "nouvelle" ? { label: "Accepter la commande", status: "confirmee" as const } : order.statut === "confirmee" ? { label: "Marquer le plat prêt", status: "produit_pret" as const } : order.statut === "produit_pret" ? { label: "Terminer la commande", status: "terminee" as const } : null;

  return <Screen><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
    <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
    <Button label="Abonnements et promotions" variant="secondary" onPress={() => router.push("/dashboard/monetisation")} fullWidth />
    <View style={{ gap: spacing.xs }}><Text variant="h1">Espace restaurant</Text><Text variant="h3">{store.nom}</Text><Badge label={store.statutValidation} tone={store.statutValidation === "valide" ? "success" : "warning"} />{store.statutValidation !== "valide" ? <Text variant="caption" color={colors.inkSoft}>Le menu public sera visible après validation de l'établissement.</Text> : null}</View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
      {[{ label: "Commandes aujourd'hui", value: stats?.todayOrders ?? 0 }, { label: "Nouvelles commandes", value: stats?.newOrders ?? 0 }, { label: "Plats disponibles", value: stats?.availableDishes ?? 0 }, { label: "Commandes terminées", value: stats?.completedOrders ?? 0 }].map((stat) => <Card key={stat.label} style={{ width: "48%", flexGrow: 1, gap: spacing.xs }}><Text variant="caption" color={colors.inkSoft}>{stat.label}</Text><Text variant="h2">{stat.value}</Text></Card>)}
    </View>
    <Card style={{ gap: spacing.sm }}><Text variant="h2">Profil et disponibilité</Text><Input label="Type de cuisine" value={cuisine} onChangeText={setCuisine} placeholder="Ex. Gabonaise, grillades" /><Input label="Description" value={profileDescription} onChangeText={setProfileDescription} multiline /><Input label="Téléphone du restaurant" value={telephone} onChangeText={setTelephone} keyboardType="phone-pad" /><Input label="Temps moyen de préparation (minutes)" value={prepAverage} onChangeText={setPrepAverage} keyboardType="number-pad" /><Input label="Montant minimum de commande (FCFA)" value={minimum} onChangeText={setMinimum} keyboardType="decimal-pad" /><Button label={commandsActive ? "Suspendre les nouvelles commandes" : "Accepter les nouvelles commandes"} variant="secondary" onPress={() => setCommandsActive((value) => !value)} fullWidth /><Text variant="caption" color={colors.inkSoft}>{commandsActive ? "Les nouvelles commandes sont activées." : "Les clients ne pourront plus envoyer de nouvelles commandes."}</Text><Button label="Enregistrer le profil" onPress={saveProfile} loading={saving} fullWidth /></Card>
    <Card style={{ gap: spacing.sm }}><Text variant="h2">Rubriques du menu</Text><Input label="Nouvelle rubrique" value={sectionName} onChangeText={setSectionName} placeholder="Ex. Plats principaux" /><Button label="Ajouter la rubrique" variant="secondary" onPress={addSection} loading={saving} disabled={!sectionName.trim()} fullWidth /><View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}><Pressable onPress={() => setSectionId(undefined)} style={{ borderWidth: 1, borderColor: !sectionId ? colors.primary : colors.line, backgroundColor: !sectionId ? colors.primaryTint : colors.white, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 }}><Text variant="caption" color={!sectionId ? colors.primary : colors.ink}>Sans rubrique</Text></Pressable>{(dashboard?.sections ?? []).map((section) => <Pressable key={section.id} onPress={() => setSectionId(section.id)} style={{ borderWidth: 1, borderColor: sectionId === section.id ? colors.primary : colors.line, backgroundColor: sectionId === section.id ? colors.primaryTint : colors.white, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 }}><Text variant="caption" color={sectionId === section.id ? colors.primary : colors.ink}>{section.nom}</Text></Pressable>)}</View></Card>
    <Card style={{ gap: spacing.sm }}><Text variant="h2">Ajouter un plat</Text><Input label="Nom du plat" value={dishName} onChangeText={setDishName} placeholder="Ex. Poulet braisé" /><Input label="Description" value={dishDescription} onChangeText={setDishDescription} multiline /><Input label="Prix (FCFA)" value={dishPrice} onChangeText={setDishPrice} keyboardType="decimal-pad" /><Input label="Temps de préparation (minutes)" value={dishPrep} onChangeText={setDishPrep} keyboardType="number-pad" /><Input label="Ingrédients" value={dishIngredients} onChangeText={setDishIngredients} multiline /><Input label="Allergènes (séparés par une virgule)" value={allergensText} onChangeText={setAllergensText} placeholder="Ex. arachides, lait, gluten" /><Input label="URL des photos (une par ligne)" value={dishPhotosText} onChangeText={setDishPhotosText} multiline placeholder="https://..." /><Input label="Suppléments (une ligne par option : Nom|Prix)" value={supplementsText} onChangeText={setSupplementsText} multiline placeholder={'Fromage|500\nSauce supplémentaire|250'} /><Input label="Formules (une ligne par formule : Nom|Supplément de prix)" value={formulasText} onChangeText={setFormulasText} multiline placeholder={'Menu complet|1500\nGrande portion|1000'} /><Button label={dishManagedStock ? "Stock suivi : activé" : "Stock suivi : désactivé"} variant="secondary" onPress={() => setDishManagedStock((value) => !value)} fullWidth /><Text variant="caption" color={colors.inkSoft}>Désactivé : le plat est préparé à la commande. Activé : les quantités indiquées limitent les commandes.</Text>{dishManagedStock ? <Input label="Quantité disponible" value={dishStock} onChangeText={setDishStock} keyboardType="number-pad" /> : null}<Button label="Ajouter au menu" onPress={addDish} loading={creatingDish} disabled={creatingDish || !dishName.trim() || !dishPrice.trim()} fullWidth /></Card>
    <View style={{ gap: spacing.sm }}><Text variant="h2">Carte et disponibilité</Text>{(dashboard?.dishes ?? []).length === 0 ? <Text variant="bodySm" color={colors.inkSoft}>Aucun plat enregistré pour le moment.</Text> : dashboard!.dishes.map((dish) => <Card key={dish.id} style={{ gap: spacing.sm }}><View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}><View style={{ flex: 1, gap: spacing.xs }}><Text variant="label">{dish.nom}</Text><Text variant="bodySm" color={colors.primary}>{money(dish.prix)}</Text><Text variant="caption" color={colors.inkSoft}>{dish.tempsPreparationMinutes} min · {dish.section?.nom ?? "Sans rubrique"}</Text></View><Badge label={dish.disponible ? "Disponible" : "Indisponible"} tone={dish.disponible ? "success" : "neutral"} /></View><Button label={editingDishId === dish.id ? "Fermer la modification" : "Modifier le plat"} variant="ghost" onPress={() => editingDishId === dish.id ? setEditingDishId(null) : startDishEdit(dish)} fullWidth />{editingDishId === dish.id ? <View style={{ gap: spacing.sm }}><Input label="Nom" value={editDishName} onChangeText={setEditDishName} /><Input label="Description" value={editDishDescription} onChangeText={setEditDishDescription} multiline /><Input label="Prix (FCFA)" value={editDishPrice} onChangeText={setEditDishPrice} keyboardType="decimal-pad" /><Input label="Préparation (minutes)" value={editDishPrep} onChangeText={setEditDishPrep} keyboardType="number-pad" /><Input label="Ingrédients" value={editDishIngredients} onChangeText={setEditDishIngredients} multiline /><Input label="Suppléments (Nom|Prix, une ligne par choix)" value={editSupplementsText} onChangeText={setEditSupplementsText} multiline /><Input label="Formules (Nom|Prix, une ligne par formule)" value={editFormulasText} onChangeText={setEditFormulasText} multiline /><Button label="Enregistrer les modifications" onPress={() => void saveDishEdit()} loading={saving} fullWidth /></View> : null}<Button label={dish.disponible ? "Marquer indisponible" : "Remettre au menu"} variant="secondary" onPress={() => void toggleDish(dish.id, dish.disponible)} fullWidth /></Card>)}</View>
    <View style={{ gap: spacing.sm }}><Text variant="h2">Commandes du restaurant</Text><Input label="Délai estimé à appliquer (minutes)" value={prepMinutes} onChangeText={setPrepMinutes} keyboardType="number-pad" />{orders.length === 0 ? <Text variant="bodySm" color={colors.inkSoft}>Aucune commande pour le moment.</Text> : orders.map((order) => { const next = action(order); return <Card key={order.id} style={{ gap: spacing.sm }}><View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}><Text variant="label">Commande #{order.id.slice(0, 8)}</Text><Text variant="label" color={colors.primary}>{money(order.total)}</Text></View><Text variant="caption" color={colors.inkSoft}>{new Date(order.creeLe).toLocaleString("fr-FR")}</Text><Badge label={order.statut.replace(/_/g, " ")} tone={order.statut === "annulee" ? "danger" : order.statut === "terminee" ? "success" : order.statut === "nouvelle" ? "warning" : "primary"} />{order.tempsPreparationEstimeMinutes ? <Text variant="bodySm">Préparation estimée : {order.tempsPreparationEstimeMinutes} min</Text> : null}{order.items.map((item) => <Text key={item.id} variant="bodySm">• {item.quantite} × {item.productName}{item.options?.length ? ` — ${item.options.map((group) => group.choices.map((choice) => choice.label).join(", ")).join("; ")}` : ""}</Text>)}{order.statut === "nouvelle" || order.statut === "confirmee" ? <Button label="Modifier le délai de préparation" variant="secondary" onPress={() => savePrepTime(order)} fullWidth /> : null}{next ? <Button label={next.label} onPress={() => void orderAction(order, next.status)} fullWidth /> : null}{order.statut === "nouvelle" || order.statut === "confirmee" ? <Button label="Refuser / annuler" variant="ghost" onPress={() => Alert.alert("Annuler la commande ?", "Le stock suivi sera restitué et le client sera notifié.", [{ text: "Retour", style: "cancel" }, { text: "Annuler la commande", style: "destructive", onPress: () => void orderAction(order, "annulee") }])} fullWidth /> : null}</Card>; })}</View>
    <Text variant="caption" color={colors.inkSoft}>Les commandes partagent le système commun de NZE. Leur statut de commande ne vaut pas confirmation de paiement.</Text>
    <Button label="Actualiser" variant="ghost" onPress={() => void load()} fullWidth />
  </ScrollView></Screen>;
}
