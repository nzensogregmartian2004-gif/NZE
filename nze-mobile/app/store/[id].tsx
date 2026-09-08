import { useEffect, useState, useCallback } from "react";
import { View, ScrollView, Image, ActivityIndicator, Pressable } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { colors, radius, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { getStore, listStoreProducts, type StoreDetail, type Product } from "@/lib/stores-api";
import { ApiError } from "@/lib/api";

export default function StoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [storeData, productsData] = await Promise.all([getStore(id), listStoreProducts(id)]);
      setStore(storeData);
      setProducts(productsData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Magasin introuvable");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  if (error || !store) {
    return (
      <Screen>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
          <Text variant="body" color={colors.danger}>
            {error ?? "Magasin introuvable"}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView>
        <View
          style={{
            height: 160,
            backgroundColor: colors.primaryTint,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {store.couverture ? (
            <Image source={{ uri: store.couverture }} style={{ width: "100%", height: "100%" }} />
          ) : (
            <Text style={{ fontSize: 48 }}>🏪</Text>
          )}
        </View>

        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <Button label="← Retour" variant="ghost" onPress={() => router.back()} />

          <View style={{ gap: spacing.xs }}>
            <Text variant="h1">{store.nom}</Text>
            {store.quartier && (
              <Text variant="body" color={colors.inkSoft}>
                📍 {store.quartier}
              </Text>
            )}
            {store.adresseLibre && (
              <Text variant="bodySm" color={colors.inkSoft}>
                {store.adresseLibre}
              </Text>
            )}
          </View>

          {store.description && <Text variant="body">{store.description}</Text>}

          <View style={{ gap: spacing.md }}>
            <Text variant="h3">Produits</Text>
            {products.length === 0 ? (
              <Text variant="body" color={colors.inkSoft}>
                Ce magasin n'a pas encore de produits en ligne.
              </Text>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
                {products.map((product) => (
                  <Pressable
                    key={product.id}
                    onPress={() => router.push(`/product/${product.id}`)}
                    style={{ width: "47%" }}
                  >
                    <Card>
                      <View
                        style={{
                          height: 80,
                          borderRadius: radius.sm,
                          backgroundColor: colors.bg,
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: spacing.sm,
                        }}
                      >
                        <Text style={{ fontSize: 24 }}>📦</Text>
                      </View>
                      <Text variant="label" numberOfLines={1}>
                        {product.nom}
                      </Text>
                      <Text variant="bodySm" color={colors.primary} style={{ fontFamily: "PlusJakartaSans_600SemiBold" }}>
                        {Number(product.prix).toLocaleString("fr-FR")} FCFA
                      </Text>
                      {!product.disponible && <Badge label="Indisponible" tone="danger" />}
                    </Card>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
