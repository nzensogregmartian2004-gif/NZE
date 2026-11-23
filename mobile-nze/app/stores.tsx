import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { StoreListItem } from "@/components/StoreListItem";
import { listStores, type Store } from "@/lib/stores-api";
import { ApiError } from "@/lib/api";

export default function StoresScreen() {
  const [stores, setStores] = useState<Store[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (q = "") => {
    setLoading(true); setError(null);
    try { setStores(await listStores({ q: q.trim() || undefined })); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Impossible de charger les magasins"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return (
    <Screen>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h1">Magasins</Text>
        <Input placeholder="Rechercher un magasin..." value={query} onChangeText={setQuery} onSubmitEditing={() => load(query)} returnKeyType="search" />
      </View>
      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : error ?
        <View style={{ padding: spacing.lg, gap: spacing.md }}><Text variant="body" color={colors.danger}>{error}</Text><Button label="Réessayer" onPress={() => load(query)} /></View> :
        <FlatList data={stores} keyExtractor={(store) => store.id} contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md }}
          ListEmptyComponent={<Text variant="body" color={colors.inkSoft}>Aucun magasin validé trouvé.</Text>}
          renderItem={({ item }) => <Pressable onPress={() => router.push(`/store/${item.id}`)}><StoreListItem store={item} /></Pressable>} />}
    </Screen>
  );
}
