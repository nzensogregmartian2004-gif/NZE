import { useCallback, useEffect, useMemo, useState } from "react";
import { View, ScrollView, ActivityIndicator, Alert, Pressable } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { useAuthStore } from "@/store/auth";
import { getCurrentLocation } from "@/lib/location";
import { ApiError } from "@/lib/api";
import {
  listMyStores,
  createStore,
  updateStore,
  updateStoreDeliverySettings,
  listMyStoreProducts,
  listProductCategories,
  importProductsCsv,
  createProduct,
  updateProduct,
  deleteProduct,
  listStoreOrders,
  updateOrderStatus,
  getStoreDashboardStats,
  type Store,
  type Product,
  type StoreOrder,
  type ProductCategory,
  type StoreDashboardStats,
} from "@/lib/stores-api";
import { useAutoTutorial } from "@/hooks/useAutoTutorial";

const VALIDATION_TONE = { en_attente: "warning", valide: "success", refuse: "danger", suspendu: "danger" } as const;
const ORDER_NEXT_ACTION: Partial<Record<StoreOrder["statut"], { label: string; next: StoreOrder["statut"] }>> = {
  nouvelle: { label: "Confirmer", next: "confirmee" },
  confirmee: { label: "Produit prêt", next: "produit_pret" },
  produit_pret: { label: "Marquer terminée", next: "terminee" },
};
const ORDER_FILTERS = [
  { value: "toutes", label: "Toutes" },
  { value: "nouvelle", label: "Nouvelles" },
  { value: "confirmee", label: "Confirmées" },
  { value: "produit_pret", label: "Prêtes" },
  { value: "terminee", label: "Terminées" },
  { value: "annulee", label: "Annulées" },
] as const;
type OrderFilter = (typeof ORDER_FILTERS)[number]["value"];

function formatMoney(value: string | number) {
  return Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export default function StoreDashboard() {
  useAutoTutorial("store");
  const accessToken = useAuthStore((s) => s.accessToken)!;
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [stats, setStats] = useState<StoreDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("toutes");

  // Création de magasin
  const [nom, setNom] = useState("");
  const [quartier, setQuartier] = useState("");
  const [description, setDescription] = useState("");
  const [storeType, setStoreType] = useState<"commerce" | "restaurant">("commerce");
  const [creatingStore, setCreatingStore] = useState(false);

  // Modification des informations publiques du magasin
  const [showStoreEdit, setShowStoreEdit] = useState(false);
  const [editStoreNom, setEditStoreNom] = useState("");
  const [editStoreQuartier, setEditStoreQuartier] = useState("");
  const [editStoreDescription, setEditStoreDescription] = useState("");
  const [editStoreType, setEditStoreType] = useState<"commerce" | "restaurant">("commerce");
  const [savingStore, setSavingStore] = useState(false);

  // Réglages de livraison et de retrait du magasin.
  const [livraisonActive, setLivraisonActive] = useState(false);
  const [modeLivraison, setModeLivraison] = useState<"nze" | "propre" | "mixte">("nze");
  const [retraitActive, setRetraitActive] = useState(true);
  const [rayonLivraisonKm, setRayonLivraisonKm] = useState("10");
  const [tarifLivraisonBase, setTarifLivraisonBase] = useState("0");
  const [tarifLivraisonKm, setTarifLivraisonKm] = useState("0");
  const [savingDeliverySettings, setSavingDeliverySettings] = useState(false);
  const [updatingStoreLocation, setUpdatingStoreLocation] = useState(false);

  // Ajout de produit
  const [prodNom, setProdNom] = useState("");
  const [prodPrix, setProdPrix] = useState("");
  const [prodDescription, setProdDescription] = useState("");
  const [prodMarque, setProdMarque] = useState("");
  const [prodModele, setProdModele] = useState("");
  const [prodReference, setProdReference] = useState("");
  const [prodEtat, setProdEtat] = useState<"neuf" | "occasion" | "reconditionne">("neuf");
  const [prodStock, setProdStock] = useState("1");
  const [prodPhoto, setProdPhoto] = useState("");
  const [prodCategorieId, setProdCategorieId] = useState<string | undefined>();
  const [addingProduct, setAddingProduct] = useState(false);
  const [csvContent, setCsvContent] = useState("");
  const [importingCsv, setImportingCsv] = useState(false);

  // Modification d'un produit existant : prix, stock et description
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editProductNom, setEditProductNom] = useState("");
  const [editProductPrix, setEditProductPrix] = useState("");
  const [editProductStock, setEditProductStock] = useState("");
  const [editProductDescription, setEditProductDescription] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [stores, categories] = await Promise.all([
        listMyStores(accessToken),
        listProductCategories().catch(() => [] as ProductCategory[]),
      ]);
      setProductCategories(categories);
      const mine = stores[0] ?? null;
      setStore(mine);
      if (mine) {
        setLivraisonActive(mine.livraisonActive ?? false);
        setModeLivraison(mine.modeLivraison ?? "nze");
        setRetraitActive(mine.retraitActive ?? true);
        setRayonLivraisonKm(String(mine.rayonLivraisonKm ?? 10));
        setTarifLivraisonBase(String(mine.tarifLivraisonBase ?? "0"));
        setTarifLivraisonKm(String(mine.tarifLivraisonKm ?? "0"));
      }
      if (!mine) {
        setProducts([]);
        setOrders([]);
        setStats(null);
        return;
      }
      const [productsData, ordersData, statsData] = await Promise.all([
        mine.typeEtablissement === "restaurant" ? Promise.resolve([] as Product[]) : listMyStoreProducts(accessToken, mine.id),
        listStoreOrders(accessToken, mine.id),
        getStoreDashboardStats(accessToken, mine.id).catch(() => null),
      ]);
      setProducts(productsData);
      setOrders(ordersData);
      setStats(statsData);
    } catch (error) {
      Alert.alert("Chargement impossible", errorMessage(error, "Vérifie ta connexion puis réessaie."));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreateStore() {
    if (!nom.trim()) {
      Alert.alert("Nom requis", "Saisis le nom de ton magasin.");
      return;
    }
    setCreatingStore(true);
    try {
      const location = await getCurrentLocation();
      await createStore(accessToken, {
        nom: nom.trim(),
        typeEtablissement: storeType,
        description: description.trim() || undefined,
        quartier: quartier.trim() || undefined,
        latitude: location.status === "ok" ? location.coords.latitude : undefined,
        longitude: location.status === "ok" ? location.coords.longitude : undefined,
      });
      await load();
      Alert.alert("Magasin créé", "Il est en attente de validation par l'administration avant publication.");
    } catch (error) {
      Alert.alert("Erreur", errorMessage(error, "Impossible de créer le magasin."));
    } finally {
      setCreatingStore(false);
    }
  }

  function openStoreEditor() {
    if (!store) return;
    setEditStoreNom(store.nom);
    setEditStoreQuartier(store.quartier ?? "");
    setEditStoreDescription(store.description ?? "");
    setEditStoreType(store.typeEtablissement ?? "commerce");
    setShowStoreEdit((value) => !value);
  }

  async function handleUpdateStore() {
    if (!store || !editStoreNom.trim()) {
      Alert.alert("Nom requis", "Le magasin doit avoir un nom.");
      return;
    }
    setSavingStore(true);
    try {
      await updateStore(accessToken, store.id, {
        nom: editStoreNom.trim(),
        typeEtablissement: editStoreType,
        description: editStoreDescription.trim() || undefined,
        quartier: editStoreQuartier.trim() || undefined,
      });
      setShowStoreEdit(false);
      await load(false);
      Alert.alert("Magasin mis à jour", "Les informations ont été enregistrées.");
    } catch (error) {
      Alert.alert("Erreur", errorMessage(error, "Impossible de modifier le magasin."));
    } finally {
      setSavingStore(false);
    }
  }

  async function handleSaveDeliverySettings() {
    if (!store) return;
    const radius = Number(rayonLivraisonKm);
    const base = Number(tarifLivraisonBase);
    const perKm = Number(tarifLivraisonKm);
    if (!Number.isFinite(radius) || radius <= 0 || radius > 200 || !Number.isFinite(base) || base < 0 || !Number.isFinite(perKm) || perKm < 0) {
      Alert.alert("Paramètres invalides", "Le rayon doit être entre 0 et 200 km et les tarifs ne peuvent pas être négatifs.");
      return;
    }
    setSavingDeliverySettings(true);
    try {
      await updateStoreDeliverySettings(accessToken, store.id, {
        livraisonActive, modeLivraison, retraitActive,
        rayonLivraisonKm: radius,
        tarifLivraisonBase: base,
        tarifLivraisonKm: perKm,
      });
      await load(false);
      Alert.alert("Livraison mise à jour", "Les paramètres de livraison et de retrait ont été enregistrés.");
    } catch (error) {
      Alert.alert("Erreur", errorMessage(error, "Impossible d'enregistrer les paramètres de livraison."));
    } finally {
      setSavingDeliverySettings(false);
    }
  }

  async function handleUpdateStoreLocation() {
    if (!store) return;
    setUpdatingStoreLocation(true);
    try {
      const location = await getCurrentLocation();
      if (location.status !== "ok") {
        Alert.alert("Position indisponible", location.status === "denied" ? "Autorise la géolocalisation pour enregistrer la position du magasin." : "Impossible de lire la position GPS.");
        return;
      }
      await updateStore(accessToken, store.id, {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      await load(false);
      Alert.alert("Position enregistrée", "La position GPS du magasin a été mise à jour.");
    } catch (error) {
      Alert.alert("Erreur", errorMessage(error, "Impossible de mettre à jour la position du magasin."));
    } finally {
      setUpdatingStoreLocation(false);
    }
  }

  async function handleAddProduct() {
    if (!store || !prodNom.trim() || !prodPrix) {
      Alert.alert("Champs requis", "Saisis au minimum le nom et le prix du produit.");
      return;
    }
    if (!Number.isFinite(Number(prodPrix)) || Number(prodPrix) <= 0) {
      Alert.alert("Prix invalide", "Saisis un prix supérieur à zéro.");
      return;
    }
    if (prodStock && (!Number.isInteger(Number(prodStock)) || Number(prodStock) < 0)) {
      Alert.alert("Stock invalide", "Le stock doit être un nombre entier positif ou nul.");
      return;
    }
    setAddingProduct(true);
    try {
      await createProduct(accessToken, store.id, {
        nom: prodNom.trim(), prix: Number(prodPrix),
        description: prodDescription.trim() || undefined,
        marque: prodMarque.trim() || undefined,
        modele: prodModele.trim() || undefined,
        reference: prodReference.trim() || undefined,
        etat: prodEtat,
        stock: prodStock ? Number(prodStock) : 0,
        categorieId: prodCategorieId,
        photos: prodPhoto.trim() ? [prodPhoto.trim()] : undefined,
      });
      setProdNom(""); setProdPrix(""); setProdDescription(""); setProdMarque(""); setProdModele(""); setProdReference(""); setProdEtat("neuf"); setProdStock("1"); setProdPhoto(""); setProdCategorieId(undefined);
      await load(false);
      Alert.alert("Produit ajouté", "Le produit a été enregistré.");
    } catch (error) {
      Alert.alert("Erreur", errorMessage(error, "Impossible d'ajouter le produit."));
    } finally {
      setAddingProduct(false);
    }
  }

  async function handleImportCsv() {
    if (!store || !csvContent.trim()) {
      Alert.alert("CSV manquant", "Colle le contenu de ton fichier CSV avant de lancer l'import.");
      return;
    }
    setImportingCsv(true);
    try {
      const result = await importProductsCsv(accessToken, store.id, csvContent);
      Alert.alert("Import terminé", `${result.imported} produit(s) importé(s).`);
      setCsvContent("");
      await load(false);
    } catch (error) {
      Alert.alert("Import impossible", errorMessage(error, "Vérifie le format CSV et réessaie."));
    } finally {
      setImportingCsv(false);
    }
  }

  function openProductEditor(product: Product) {
    setEditingProductId(product.id);
    setEditProductNom(product.nom);
    setEditProductPrix(String(product.prix));
    setEditProductStock(String(product.stock));
    setEditProductDescription(product.description ?? "");
  }

  async function handleSaveProduct() {
    if (!editingProductId) return;
    const price = Number(editProductPrix);
    const stock = Number(editProductStock);
    if (!editProductNom.trim() || !Number.isFinite(price) || price <= 0) {
      Alert.alert("Informations invalides", "Le nom est obligatoire et le prix doit être supérieur à zéro.");
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      Alert.alert("Stock invalide", "Le stock doit être un entier positif ou nul.");
      return;
    }
    setSavingProduct(true);
    try {
      await updateProduct(accessToken, editingProductId, {
        nom: editProductNom.trim(),
        prix: price,
        stock,
        description: editProductDescription.trim() || undefined,
      });
      setEditingProductId(null);
      await load(false);
      Alert.alert("Produit mis à jour", "Le prix, la description et le stock ont été enregistrés.");
    } catch (error) {
      Alert.alert("Erreur", errorMessage(error, "Impossible de modifier le produit."));
    } finally {
      setSavingProduct(false);
    }
  }

  async function handleToggleAvailability(product: Product) {
    try {
      await updateProduct(accessToken, product.id, { disponible: !product.disponible });
      await load(false);
    } catch (error) {
      Alert.alert("Erreur", errorMessage(error, "Impossible de modifier la disponibilité."));
    }
  }

  function confirmDeleteProduct(product: Product) {
    Alert.alert("Supprimer le produit ?", `« ${product.nom} » sera retiré du catalogue.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteProduct(accessToken, product.id);
            await load(false);
          } catch (error) {
            Alert.alert("Erreur", errorMessage(error, "Impossible de supprimer le produit."));
          }
        },
      },
    ]);
  }

  async function handleAdvanceOrder(order: StoreOrder) {
    const action = ORDER_NEXT_ACTION[order.statut];
    if (!action) return;
    try {
      await updateOrderStatus(accessToken, order.id, action.next);
      await load(false);
    } catch (error) {
      Alert.alert("Erreur", errorMessage(error, "Impossible de mettre à jour la commande."));
    }
  }

  const filteredOrders = useMemo(() => {
    if (orderFilter === "toutes") return orders;
    return orders.filter((order) => order.statut === orderFilter);
  }, [orders, orderFilter]);

  if (loading) {
    return <Screen><ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /></Screen>;
  }

  if (!store) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
          <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
          <Text variant="h1">Créer mon magasin</Text>
          <Text variant="body" color={colors.inkSoft}>Présente ton commerce aux clients de NZE Gabon.</Text>
          <Text variant="label">Type d’établissement</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}><Button label="Commerce" variant={storeType === "commerce" ? "primary" : "secondary"} onPress={() => setStoreType("commerce")} fullWidth /></View>
            <View style={{ flex: 1 }}><Button label="Restaurant" variant={storeType === "restaurant" ? "primary" : "secondary"} onPress={() => setStoreType("restaurant")} fullWidth /></View>
          </View>
          <Input label="Nom de l’établissement" value={nom} onChangeText={setNom} placeholder={storeType === "restaurant" ? "Ex. Le Bon Goût" : "Ex. Épicerie Awa"} />
          <Input label="Quartier" value={quartier} onChangeText={setQuartier} placeholder="Ex. Nombakélé" />
          <Input label="Description" value={description} onChangeText={setDescription} placeholder="Présente ton commerce" multiline />
          <Button label="Créer mon magasin" onPress={handleCreateStore} loading={creatingStore} fullWidth />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }} keyboardShouldPersistTaps="handled">
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Button label="Abonnements et promotions" variant="secondary" onPress={() => router.push("/dashboard/monetisation")} fullWidth />
        <Button label="Demandes de remboursement" variant="secondary" onPress={() => router.push("/dashboard/refunds")} fullWidth />

        <View style={{ gap: spacing.xs }}>
          <Text variant="h1">Tableau de bord</Text>
          <Text variant="h3">{store.nom}</Text>
          <Badge label={store.statutValidation} tone={VALIDATION_TONE[store.statutValidation as keyof typeof VALIDATION_TONE] ?? "neutral"} />
          {store.statutValidation !== "valide" && (
            <Text variant="caption" color={colors.inkSoft}>Ton magasin doit être validé par l'administration avant d'être visible publiquement.</Text>
          )}
          <Button label={showStoreEdit ? "Fermer les informations du magasin" : "Modifier les informations du magasin"} variant="secondary" onPress={openStoreEditor} fullWidth />
          {store.typeEtablissement === "restaurant" ? <Button label="Ouvrir le tableau de bord restaurant" onPress={() => router.push({ pathname: "/dashboard/restaurant", params: { storeId: store.id } } as any)} fullWidth /> : null}
        </View>

        {showStoreEdit && (
          <Card style={{ gap: spacing.sm }}>
            <Text variant="h3">Informations du magasin</Text>
            <Input label="Nom" value={editStoreNom} onChangeText={setEditStoreNom} />
            <Text variant="label">Type d’établissement</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}><Button label="Commerce" variant={editStoreType === "commerce" ? "primary" : "secondary"} onPress={() => setEditStoreType("commerce")} fullWidth /></View>
              <View style={{ flex: 1 }}><Button label="Restaurant" variant={editStoreType === "restaurant" ? "primary" : "secondary"} onPress={() => setEditStoreType("restaurant")} fullWidth /></View>
            </View>
            <Input label="Quartier" value={editStoreQuartier} onChangeText={setEditStoreQuartier} />
            <Input label="Description" value={editStoreDescription} onChangeText={setEditStoreDescription} multiline />
            <Button label="Enregistrer les modifications" onPress={handleUpdateStore} loading={savingStore} fullWidth />
          </Card>
        )}

        <Card style={{ gap: spacing.md }}>
          <Text variant="h2">Livraison et retrait</Text>
          <Text variant="bodySm" color={colors.inkSoft}>La livraison est distincte du retrait. Les commandes déjà acceptées continuent même si tu désactives ensuite la livraison.</Text>
          <Button
            label={livraisonActive ? "Désactiver la livraison" : "Activer la livraison"}
            variant={livraisonActive ? "primary" : "secondary"}
            onPress={() => setLivraisonActive((value) => !value)}
            fullWidth
          />
          <Button
            label={retraitActive ? "Désactiver le retrait sur place" : "Activer le retrait sur place"}
            variant={retraitActive ? "primary" : "secondary"}
            onPress={() => setRetraitActive((value) => !value)}
            fullWidth
          />
          <Text variant="label">Mode de livraison</Text>
          <View style={{ gap: spacing.xs }}>
            {([
              { value: "nze", label: "Livreurs NZE" },
              { value: "propre", label: "Mes propres livreurs" },
              { value: "mixte", label: "NZE ou mes propres livreurs" },
            ] as const).map((option) => (
              <Pressable key={option.value} onPress={() => setModeLivraison(option.value)} style={{ padding: spacing.md, borderRadius: 12, borderWidth: 1, borderColor: modeLivraison === option.value ? colors.primary : colors.line, backgroundColor: modeLivraison === option.value ? colors.primaryTint : colors.white }}>
                <Text variant="body" color={modeLivraison === option.value ? colors.primary : colors.ink}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Input label="Rayon de livraison maximal (km)" value={rayonLivraisonKm} onChangeText={setRayonLivraisonKm} keyboardType="decimal-pad" />
          {modeLivraison !== "nze" && (
            <>
              <Input label="Tarif de base de tes livreurs (FCFA)" value={tarifLivraisonBase} onChangeText={setTarifLivraisonBase} keyboardType="decimal-pad" />
              <Input label="Tarif supplémentaire par km (FCFA)" value={tarifLivraisonKm} onChangeText={setTarifLivraisonKm} keyboardType="decimal-pad" />
            </>
          )}
          <Button label="Mettre à jour la position GPS du magasin" variant="secondary" onPress={handleUpdateStoreLocation} loading={updatingStoreLocation} fullWidth />
          <Button label="Enregistrer les paramètres de livraison" onPress={handleSaveDeliverySettings} loading={savingDeliverySettings} fullWidth />
          <Text variant="caption" color={colors.inkSoft}>Les tarifs NZE sont configurés par l'administration. Sans clé Google Maps côté serveur, la distance est estimée à vol d'oiseau.</Text>
        </Card>

        <View style={{ gap: spacing.md }}>
          <Text variant="h2">Vue d'ensemble</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            <Card style={{ width: "48%", flexGrow: 1, gap: spacing.xs }}>
              <Text variant="caption" color={colors.inkSoft}>{store.typeEtablissement === "restaurant" ? "Plats enregistrés" : "Produits au catalogue"}</Text>
              <Text variant="h2">{stats?.products.total ?? products.length}</Text>
            </Card>
            <Card style={{ width: "48%", flexGrow: 1, gap: spacing.xs }}>
              <Text variant="caption" color={colors.inkSoft}>Commandes reçues</Text>
              <Text variant="h2">{stats?.orders.total ?? orders.length}</Text>
              <Text variant="caption" color={colors.inkSoft}>{stats?.orders.new ?? orders.filter((o) => o.statut === "nouvelle").length} en attente</Text>
            </Card>
            <Card style={{ width: "48%", flexGrow: 1, gap: spacing.xs }}>
              <Text variant="caption" color={colors.inkSoft}>{store.typeEtablissement === "restaurant" ? "Plats suivis en stock faible" : "Stocks faibles (≤ 5)"}</Text>
              <Text variant="h2" color={(stats?.products.lowStock ?? products.filter((p) => p.disponible && p.stock <= 5).length) > 0 ? colors.warning : colors.ink}>
                {stats?.products.lowStock ?? products.filter((p) => p.disponible && p.stock <= 5).length}
              </Text>
            </Card>
            <Card style={{ width: "48%", flexGrow: 1, gap: spacing.xs }}>
              <Text variant="caption" color={colors.inkSoft}>Commandes terminées</Text>
              <Text variant="h2">{stats?.orders.completed ?? orders.filter((o) => o.statut === "terminee").length}</Text>
              <Text variant="caption" color={colors.inkSoft}>Montant : {formatMoney(stats?.completedOrderAmount ?? orders.filter((o) => o.statut === "terminee").reduce((sum, o) => sum + Number(o.total), 0))} FCFA</Text>
            </Card>
          </View>
          <Text variant="caption" color={colors.inkSoft}>Le montant des commandes terminées n'est pas une confirmation d'encaissement. Les statistiques de visites seront ajoutées lorsque le suivi des consultations sera activé.</Text>
        </View>

        {store.typeEtablissement !== "restaurant" && <View style={{ gap: spacing.md }}>
          <Text variant="h2">Commandes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
            {ORDER_FILTERS.map((filter) => (
              <Pressable key={filter.value} onPress={() => setOrderFilter(filter.value)} style={{ backgroundColor: orderFilter === filter.value ? colors.primary : colors.primaryTint, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
                <Text variant="caption" color={orderFilter === filter.value ? colors.white : colors.primary}>{filter.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {filteredOrders.length === 0 ? (
            <Text variant="body" color={colors.inkSoft}>Aucune commande dans cette catégorie.</Text>
          ) : (
            filteredOrders.map((order) => {
              const action = ORDER_NEXT_ACTION[order.statut];
              return (
                <Card key={order.id} style={{ gap: spacing.sm }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm }}>
                    <Text variant="label">Commande #{order.id.slice(0, 8)}</Text>
                    <Text variant="label">{formatMoney(order.total)} FCFA</Text>
                  </View>
                  <Text variant="caption" color={colors.inkSoft}>{new Date(order.creeLe).toLocaleString("fr-FR")}</Text>
                  <Badge label={order.statut.replace(/_/g, " ")} tone={order.statut === "annulee" ? "danger" : order.statut === "terminee" ? "success" : order.statut === "nouvelle" ? "warning" : "primary"} />
                  {action && <Button label={action.label} variant="secondary" onPress={() => handleAdvanceOrder(order)} />}
                </Card>
              );
            })
          )}
        </View>}

        {store.typeEtablissement !== "restaurant" && <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variant="h2">Produits et stock</Text>
            <Text variant="caption" color={colors.inkSoft}>{products.length} produit(s)</Text>
          </View>
          {products.length === 0 ? <Text variant="body" color={colors.inkSoft}>Aucun produit. Ajoute ton premier produit ci-dessous.</Text> : null}
          {products.map((product) => {
            const isEditing = editingProductId === product.id;
            return (
              <Card key={product.id} style={{ gap: spacing.sm }}>
                {isEditing ? (
                  <>
                    <Text variant="h3">Modifier le produit</Text>
                    <Input label="Nom" value={editProductNom} onChangeText={setEditProductNom} />
                    <Input label="Prix (FCFA)" value={editProductPrix} onChangeText={setEditProductPrix} keyboardType="decimal-pad" />
                    <Input label="Stock disponible" value={editProductStock} onChangeText={setEditProductStock} keyboardType="number-pad" />
                    <Input label="Description" value={editProductDescription} onChangeText={setEditProductDescription} multiline />
                    <Button label="Enregistrer" onPress={handleSaveProduct} loading={savingProduct} fullWidth />
                    <Button label="Annuler" variant="ghost" onPress={() => setEditingProductId(null)} fullWidth />
                  </>
                ) : (
                  <>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm }}>
                      <View style={{ flex: 1, gap: spacing.xs }}>
                        <Text variant="body">{product.nom}</Text>
                        <Text variant="label" color={colors.primary}>{formatMoney(product.prix)} FCFA</Text>
                        <Text variant="caption" color={colors.inkSoft}>Stock : {product.stock}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: spacing.xs }}>
                        <Badge label={product.disponible ? "Publié" : "Masqué"} tone={product.disponible ? "success" : "neutral"} />
                        {product.stock <= 5 && <Badge label="Stock faible" tone="warning" />}
                      </View>
                    </View>
                    {product.description ? <Text variant="caption" color={colors.inkSoft}>{product.description}</Text> : null}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                      <View style={{ flexGrow: 1, minWidth: "45%" }}><Button label="Modifier / stock" variant="secondary" onPress={() => openProductEditor(product)} fullWidth /></View>
                      <View style={{ flexGrow: 1, minWidth: "45%" }}><Button label={product.disponible ? "Masquer" : "Publier"} variant="secondary" onPress={() => handleToggleAvailability(product)} fullWidth /></View>
                      <View style={{ flexGrow: 1, minWidth: "45%" }}><Button label="Supprimer" variant="ghost" onPress={() => confirmDeleteProduct(product)} fullWidth /></View>
                    </View>
                  </>
                )}
              </Card>
            );
          })}

          <Card style={{ gap: spacing.sm }}>
            <Text variant="h3">Ajouter un produit</Text>
            <Input label="Nom du produit" placeholder="Ex. Téléphone Android" value={prodNom} onChangeText={setProdNom} />
            <Input label="Description (facultatif)" placeholder="Description" value={prodDescription} onChangeText={setProdDescription} multiline />
            <Input label="Marque (facultatif)" value={prodMarque} onChangeText={setProdMarque} />
            <Input label="Modèle (facultatif)" value={prodModele} onChangeText={setProdModele} />
            <Input label="Référence (facultatif)" value={prodReference} onChangeText={setProdReference} />
            <Text variant="caption" color={colors.inkSoft}>État du produit</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              {([{ value: "neuf", label: "Neuf" }, { value: "occasion", label: "Occasion" }, { value: "reconditionne", label: "Reconditionné" }] as const).map((state) => <Pressable key={state.value} onPress={() => setProdEtat(state.value)} style={{ backgroundColor: prodEtat === state.value ? colors.primary : colors.primaryTint, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8 }}><Text variant="caption" color={prodEtat === state.value ? colors.white : colors.primary}>{state.label}</Text></Pressable>)}
            </View>
            <Input label="Prix (FCFA)" placeholder="25000" value={prodPrix} onChangeText={setProdPrix} keyboardType="decimal-pad" />
            <Input label="Quantité en stock" placeholder="1" value={prodStock} onChangeText={setProdStock} keyboardType="number-pad" />
            <Input label="URL de la photo (facultatif)" placeholder="https://..." value={prodPhoto} onChangeText={setProdPhoto} autoCapitalize="none" keyboardType="url" />
            <Text variant="caption" color={colors.inkSoft}>Catégorie</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              <Pressable onPress={() => setProdCategorieId(undefined)} style={{ backgroundColor: !prodCategorieId ? colors.primary : colors.primaryTint, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8 }}>
                <Text variant="caption" color={!prodCategorieId ? colors.white : colors.primary}>Sans catégorie</Text>
              </Pressable>
              {productCategories.map((category) => <Pressable key={category.id} onPress={() => setProdCategorieId(category.id)} style={{ backgroundColor: prodCategorieId === category.id ? colors.primary : colors.primaryTint, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8 }}>
                <Text variant="caption" color={prodCategorieId === category.id ? colors.white : colors.primary}>{category.nom}</Text>
              </Pressable>)}
            </View>
            <Button label="Ajouter le produit" variant="secondary" onPress={handleAddProduct} loading={addingProduct} fullWidth />
          </Card>

          <Card style={{ gap: spacing.sm }}>
            <Text variant="h3">Importer des produits en lot (CSV)</Text>
            <Text variant="caption" color={colors.inkSoft}>Colonnes obligatoires : nom, prix. Colonnes facultatives : description, marque, modele, reference, etat, stock, categorie (nom de catégorie) ou categorieId, photos, variantes, caracteristiques. Les deux dernières colonnes utilisent du JSON ; les URL de photos sont séparées par un point-virgule. Exporte un fichier Excel en CSV avant l'import.</Text>
            <Input placeholder={`nom,prix,description,stock,categorie,photos\nProduit exemple,2500,Description,5,Électronique,https://...`} value={csvContent} onChangeText={setCsvContent} multiline autoCapitalize="none" style={{ height: 130, textAlignVertical: "top" }} />
            <Button label="Importer le CSV" variant="secondary" onPress={handleImportCsv} loading={importingCsv} disabled={importingCsv} fullWidth />
          </Card>
        </View>}

        <Button label="Actualiser le tableau de bord" variant="ghost" onPress={() => void load()} fullWidth />
      </ScrollView>
    </Screen>
  );
}
