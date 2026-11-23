import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { ProductCard } from "@/components/ProductCard";
import { listProducts, listProductCategories, type Product, type ProductCategory, type ProductSort } from "@/lib/stores-api";
import { ApiError } from "@/lib/api";

const SORT_OPTIONS: Array<{ value: ProductSort; label: string }> = [
  { value: "recent", label: "Récents" }, { value: "price_asc", label: "Prix croissant" }, { value: "price_desc", label: "Prix décroissant" },
];

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [selectedState, setSelectedState] = useState<"neuf" | "occasion" | "reconditionne" | undefined>();
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [appliedMinPrice, setAppliedMinPrice] = useState("");
  const [appliedMaxPrice, setAppliedMaxPrice] = useState("");
  const [sortIndex, setSortIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => { try { setCategories(await listProductCategories()); } catch { setCategories([]); } }, []);
  const loadProducts = useCallback(async (targetPage = 1, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const result = await listProducts({ q: appliedQuery.trim() || undefined, categorieId: selectedCategory, etat: selectedState,
        prixMin: appliedMinPrice.trim() || undefined, prixMax: appliedMaxPrice.trim() || undefined,
        sort: SORT_OPTIONS[sortIndex].value, page: targetPage, limit: 20 });
      setProducts((current) => append ? [...current, ...result.items] : result.items);
      setPage(result.pagination.page); setTotalPages(result.pagination.totalPages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger le catalogue");
      if (!append) setProducts([]);
    } finally { setLoading(false); setLoadingMore(false); }
  }, [appliedQuery, selectedCategory, selectedState, appliedMinPrice, appliedMaxPrice, sortIndex]);

  useEffect(() => { void loadCategories(); }, [loadCategories]);
  useEffect(() => { void loadProducts(1); }, [loadProducts]);

  return (
    <Screen>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h1">Catalogue</Text>
        <Input placeholder="Produit ou description..." value={query} onChangeText={setQuery} onSubmitEditing={() => setAppliedQuery(query.trim())} returnKeyType="search" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {[{ id: "", nom: "Tout" }, ...categories].map((category) => {
            const active = (selectedCategory ?? "") === category.id;
            return <Pressable key={category.id || "all"} onPress={() => setSelectedCategory(category.id || undefined)} style={{ borderRadius: 22, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: active ? colors.primary : colors.primaryTint }}>
              <Text variant="caption" color={active ? colors.white : colors.primary}>{category.nom}</Text>
            </Pressable>;
          })}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {[{ value: undefined, label: "Tous les états" }, { value: "neuf" as const, label: "Neuf" }, { value: "occasion" as const, label: "Occasion" }, { value: "reconditionne" as const, label: "Reconditionné" }].map((state) => {
            const active = selectedState === state.value;
            return <Pressable key={state.label} onPress={() => setSelectedState(state.value)} style={{ borderRadius: 22, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: active ? colors.primary : colors.primaryTint }}>
              <Text variant="caption" color={active ? colors.white : colors.primary}>{state.label}</Text>
            </Pressable>;
          })}
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1 }}><Input placeholder="Prix min. FCFA" keyboardType="numeric" value={minPrice} onChangeText={setMinPrice} /></View>
          <View style={{ flex: 1 }}><Input placeholder="Prix max. FCFA" keyboardType="numeric" value={maxPrice} onChangeText={setMaxPrice} /></View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
          <Text variant="caption" color={colors.inkSoft}>Tri : {SORT_OPTIONS[sortIndex].label}</Text>
          <View style={{ flexDirection: "row", gap: spacing.xs }}>
            <Button label="Changer le tri" variant="secondary" onPress={() => setSortIndex((value) => (value + 1) % SORT_OPTIONS.length)} />
            <Button label="Filtrer" onPress={() => { setAppliedQuery(query.trim()); setAppliedMinPrice(minPrice.trim()); setAppliedMaxPrice(maxPrice.trim()); }} />
          </View>
        </View>
      </View>
      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : error ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}><Text variant="body" color={colors.danger}>{error}</Text><Button label="Réessayer" onPress={() => loadProducts(1)} /></View>
      ) : (
        <FlatList data={products} keyExtractor={(item) => item.id} numColumns={2} columnWrapperStyle={{ gap: spacing.md }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}
          renderItem={({ item }) => <ProductCard product={item} width="100%" onPress={() => router.push(`/product/${item.id}`)} />}
          ListEmptyComponent={<Text variant="body" color={colors.inkSoft} style={{ textAlign: "center", marginTop: spacing.xl }}>Aucun produit ne correspond à ces critères.</Text>}
          ListFooterComponent={page < totalPages ? <View style={{ paddingVertical: spacing.lg }}><Button label={loadingMore ? "Chargement..." : "Charger plus"} loading={loadingMore} disabled={loadingMore} variant="secondary" onPress={() => loadProducts(page + 1, true)} /></View> : null} />
      )}
    </Screen>
  );
}
