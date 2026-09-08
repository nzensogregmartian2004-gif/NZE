import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator, Alert } from "react-native";
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
  listStoreProducts,
  createProduct,
  listStoreOrders,
  updateOrderStatus,
  type Store,
  type Product,
  type StoreOrder,
} from "@/lib/stores-api";

const VALIDATION_TONE = { en_attente: "warning", valide: "success", refuse: "danger", suspendu: "danger" } as const;
const ORDER_NEXT_ACTION: Partial<Record<StoreOrder["statut"], { label: string; next: StoreOrder["statut"] }>> = {
  nouvelle: { label: "Confirmer", next: "confirmee" },
  confirmee: { label: "Produit prêt", next: "produit_pret" },
  produit_pret: { label: "Marquer terminée", next: "terminee" },
};

export default function StoreDashboard() {
  const accessToken = useAuthStore((s) => s.accessToken)!;
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulaire création magasin
  const [nom, setNom] = useState("");
  const [quartier, setQuartier] = useState("");
  const [description, setDescription] = useState("");
  const [creatingStore, setCreatingStore] = useState(false);

  // Formulaire ajout produit
  const [prodNom, setProdNom] = useState("");
  const [prodPrix, setProdPrix] = useState("");
  const [addingProduct, setAddingProduct] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const stores = await listMyStores(accessToken);
      const mine = stores[0] ?? null;
      setStore(mine);
      if (mine) {
        const [productsData, ordersData] = await Promise.all([
          listStoreProducts(mine.id),
          listStoreOrders(accessToken, mine.id),
        ]);
        setProducts(productsData);
        setOrders(ordersData);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreateStore() {
    if (!nom.trim()) return;
    setCreatingStore(true);
    try {
      const location = await getCurrentLocation();
      await createStore(accessToken, {
        nom,
        description: description || undefined,
        quartier: quartier || undefined,
        latitude: location.status === "ok" ? location.coords.latitude : undefined,
        longitude: location.status === "ok" ? location.coords.longitude : undefined,
      });
      await load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible de créer le magasin");
    } finally {
      setCreatingStore(false);
    }
  }

  async function handleAddProduct() {
    if (!store || !prodNom.trim() || !prodPrix) return;
    setAddingProduct(true);
    try {
      await createProduct(accessToken, store.id, { nom: prodNom, prix: Number(prodPrix) });
      setProdNom("");
      setProdPrix("");
      await load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible d'ajouter le produit");
    } finally {
      setAddingProduct(false);
    }
  }

  async function handleAdvanceOrder(order: StoreOrder) {
    const action = ORDER_NEXT_ACTION[order.statut];
    if (!action) return;
    try {
      await updateOrderStatus(accessToken, order.id, action.next);
      await load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible de mettre à jour la commande");
    }
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  if (!store) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
          <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
          <Text variant="h1">Créer mon magasin</Text>
          <Input label="Nom du magasin" value={nom} onChangeText={setNom} placeholder="Ex. Épicerie Awa" />
          <Input label="Quartier" value={quartier} onChangeText={setQuartier} placeholder="Ex. Nombakélé" />
          <Input label="Description" value={description} onChangeText={setDescription} placeholder="Optionnel" />
          <Button label="Créer" onPress={handleCreateStore} loading={creatingStore} fullWidth />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />

        <View style={{ gap: spacing.xs }}>
          <Text variant="h1">{store.nom}</Text>
          <Badge label={store.statutValidation} tone={VALIDATION_TONE[store.statutValidation as keyof typeof VALIDATION_TONE]} />
        </View>

        <View style={{ gap: spacing.md }}>
          <Text variant="h3">Commandes</Text>
          {orders.length === 0 ? (
            <Text variant="body" color={colors.inkSoft}>
              Aucune commande pour l'instant.
            </Text>
          ) : (
            orders.map((order) => {
              const action = ORDER_NEXT_ACTION[order.statut];
              return (
                <Card key={order.id} style={{ gap: spacing.xs }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text variant="label">#{order.id.slice(0, 8)}</Text>
                    <Text variant="label">{Number(order.total).toLocaleString("fr-FR")} FCFA</Text>
                  </View>
                  <Badge label={order.statut} tone="primary" />
                  {action && (
                    <Button label={action.label} variant="secondary" onPress={() => handleAdvanceOrder(order)} />
                  )}
                </Card>
              );
            })
          )}
        </View>

        <View style={{ gap: spacing.md }}>
          <Text variant="h3">Produits</Text>
          {products.map((product) => (
            <Card key={product.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text variant="body">{product.nom}</Text>
              <Text variant="body" color={colors.primary}>
                {Number(product.prix).toLocaleString("fr-FR")} FCFA
              </Text>
            </Card>
          ))}

          <Card style={{ gap: spacing.sm }}>
            <Text variant="label" color={colors.inkSoft}>
              AJOUTER UN PRODUIT
            </Text>
            <Input placeholder="Nom du produit" value={prodNom} onChangeText={setProdNom} />
            <Input placeholder="Prix (FCFA)" value={prodPrix} onChangeText={setProdPrix} keyboardType="number-pad" />
            <Button label="Ajouter" variant="secondary" onPress={handleAddProduct} loading={addingProduct} />
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}
