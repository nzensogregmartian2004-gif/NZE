import { useEffect, useState, useCallback } from "react";
import { View, FlatList, ActivityIndicator, Pressable } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { StoreListItem } from "@/components/StoreListItem";
import { listStores, type Store } from "@/lib/stores-api";
import { getCurrentLocation, type Coordinates } from "@/lib/location";
import { ApiError } from "@/lib/api";

export default function ProductsScreen() {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStores = useCallback(async (position: Coordinates | null, q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const results = await listStores({
        near: position ? `${position.latitude},${position.longitude}` : undefined,
        radiusKm: 15,
        q: q || undefined,
      });
      setStores(results);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les magasins");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const result = await getCurrentLocation();
      if (result.status === "ok") {
        setCoords(result.coords);
        loadStores(result.coords);
      } else {
        setLocationDenied(true);
        loadStores(null);
      }
    })();
  }, [loadStores]);

  return (
    <Screen>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h1">Produits</Text>
        <Input
          placeholder="Rechercher un magasin..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => loadStores(coords, query)}
          returnKeyType="search"
        />
        {locationDenied && (
          <Text variant="bodySm" color={colors.warning}>
            Active la localisation pour voir les magasins les plus proches de toi.
          </Text>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <Text variant="body" color={colors.danger} style={{ padding: spacing.lg }}>
          {error}
        </Text>
      ) : (
        <FlatList
          data={stores}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md }}
          ListEmptyComponent={
            <Text variant="body" color={colors.inkSoft} style={{ textAlign: "center", marginTop: spacing.xl }}>
              Aucun magasin trouvé pour l'instant.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/store/${item.id}`)}>
              <StoreListItem store={item} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
