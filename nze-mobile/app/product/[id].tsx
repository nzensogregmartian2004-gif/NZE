import { useEffect, useState, useCallback } from "react";
import { View, ScrollView, Image, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { getProduct, createOrder, type ProductDetail } from "@/lib/stores-api";
import { getCurrentLocation } from "@/lib/location";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProduct(await getProduct(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Produit introuvable");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleOrder() {
    if (!product || !accessToken) return;
    setOrdering(true);
    try {
      const location = await getCurrentLocation();
      const order = await createOrder(accessToken, {
        storeId: product.storeId,
        items: [{ productId: product.id, quantite: 1 }],
        livraison:
          location.status === "ok"
            ? { latitude: location.coords.latitude, longitude: location.coords.longitude }
            : undefined,
      });
      Alert.alert(
        "Commande envoyée",
        `Ta commande de ${Number(order.total).toLocaleString("fr-FR")} FCFA a été transmise au magasin.`,
        [{ text: "Suivre ma commande", onPress: () => router.replace(`/order/${order.id}`) }]
      );
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible de passer la commande");
    } finally {
      setOrdering(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  if (error || !product) {
    return (
      <Screen>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
          <Text variant="body" color={colors.danger}>
            {error ?? "Produit introuvable"}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View
          style={{ height: 220, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" }}
        >
          {product.photos[0] ? (
            <Image source={{ uri: product.photos[0].url }} style={{ width: "100%", height: "100%" }} />
          ) : (
            <Text style={{ fontSize: 56 }}>📦</Text>
          )}
        </View>

        <View style={{ padding: spacing.lg, gap: spacing.lg, flex: 1 }}>
          <Button label="← Retour" variant="ghost" onPress={() => router.back()} />

          <View style={{ gap: spacing.xs }}>
            <Text variant="h1">{product.nom}</Text>
            <Text variant="h2" color={colors.primary}>
              {Number(product.prix).toLocaleString("fr-FR")} FCFA
            </Text>
            {!product.disponible && <Badge label="Indisponible" tone="danger" />}
          </View>

          {product.description && <Text variant="body">{product.description}</Text>}

          <Button
            label={`Voir ${product.store.nom}`}
            variant="secondary"
            onPress={() => router.push(`/store/${product.storeId}`)}
            fullWidth
          />

          <View style={{ flex: 1 }} />

          <Button
            label="Commander"
            onPress={handleOrder}
            loading={ordering}
            disabled={!product.disponible}
            fullWidth
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
