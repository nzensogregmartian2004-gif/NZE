import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ProductCard } from "@/components/ProductCard";
import { getCurrentLocation, type Coordinates } from "@/lib/location";
import {
  search,
  searchProducts,
  fetchSearchSuggestions,
  type CatalogProduct,
  type SearchResults,
  type SearchSort,
  type SearchSuggestion,
} from "@/lib/search-api";
import type { ProductState } from "@/lib/stores-api";
import { ApiError } from "@/lib/api";

const SORT_OPTIONS: Array<{ value: SearchSort; label: string }> = [
  { value: "pertinence", label: "Pertinence" },
  { value: "prix_asc", label: "Prix croissant" },
  { value: "prix_desc", label: "Prix décroissant" },
  { value: "recent", label: "Récents" },
];
const DISTANCE_OPTION: { value: SearchSort; label: string } = { value: "distance", label: "Plus proches" };

const ETAT_OPTIONS: Array<{ value: ProductState | undefined; label: string }> = [
  { value: undefined, label: "Tous états" },
  { value: "neuf", label: "Neuf" },
  { value: "occasion", label: "Occasion" },
  { value: "reconditionne", label: "Reconditionné" },
];

const REMISE_OPTIONS: Array<{ value: "livraison" | "retrait" | undefined; label: string }> = [
  { value: undefined, label: "Toutes remises" },
  { value: "livraison", label: "Livraison" },
  { value: "retrait", label: "Retrait" },
];

const OTHER_LABELS = { magasins: "Magasins", services: "Services", vehicules: "Véhicules", hebergements: "Hébergements" } as const;
type OtherCategory = keyof typeof OTHER_LABELS;

const SUGGESTION_LABELS: Record<SearchSuggestion["type"], string> = {
  produit: "Produit",
  marque: "Marque",
  categorie: "Catégorie",
};

const PAGE_SIZE = 20;
const SUGGESTION_DELAY_MS = 300;
const NEAR_RADIUS_KM = 10;

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ borderRadius: 22, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: active ? colors.primary : colors.primaryTint }}
    >
      <Text variant="caption" color={active ? colors.white : colors.primary}>{label}</Text>
    </Pressable>
  );
}

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [nonce, setNonce] = useState(0);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [sort, setSort] = useState<SearchSort>("pertinence");
  const [etat, setEtat] = useState<ProductState | undefined>(undefined);
  const [modeRemise, setModeRemise] = useState<"livraison" | "retrait" | undefined>(undefined);
  const [nearMe, setNearMe] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [appliedMin, setAppliedMin] = useState("");
  const [appliedMax, setAppliedMax] = useState("");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [others, setOthers] = useState<Partial<SearchResults>>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [approximatif, setApproximatif] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  // Suggestions à partir de deux caractères, avec un court délai pour ne pas interroger l'API à chaque lettre.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed === submitted) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      fetchSearchSuggestions(trimmed)
        .then((result) => setSuggestions(result.suggestions))
        .catch(() => setSuggestions([]));
    }, SUGGESTION_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query, submitted]);

  async function load(targetPage: number, append: boolean) {
    const current = ++requestRef.current;
    if (append) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const [result, otherResults] = await Promise.all([
        searchProducts({
          q: submitted,
          sort,
          etat,
          modeRemise,
          near: nearMe ? `${nearMe.latitude},${nearMe.longitude}` : undefined,
          rayonKm: nearMe ? NEAR_RADIUS_KM : undefined,
          prixMin: appliedMin || undefined,
          prixMax: appliedMax || undefined,
          page: targetPage,
          limit: PAGE_SIZE,
        }),
        append ? Promise.resolve(null) : search(submitted),
      ]);
      if (current !== requestRef.current) return;
      setProducts((list) => (append ? [...list, ...result.items] : result.items));
      setPage(result.pagination.page);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
      setApproximatif(result.approximatif);
      if (otherResults) setOthers(otherResults);
    } catch (err) {
      if (current !== requestRef.current) return;
      setError(errorMessage(err, "Recherche impossible pour le moment"));
      if (!append) {
        setProducts([]);
        setOthers({});
      }
    } finally {
      if (current === requestRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  useEffect(() => {
    if (!submitted) {
      requestRef.current++;
      setProducts([]);
      setOthers({});
      setTotal(0);
      setApproximatif(false);
      return;
    }
    void load(1, false);
    // Recharge à chaque nouvelle recherche, changement de filtre, de tri ou de position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, sort, etat, modeRemise, nearMe, appliedMin, appliedMax]);

  function submit(value = query) {
    setSuggestions([]);
    setSubmitted(value.trim());
    setNonce((n) => n + 1);
  }

  function pickSuggestion(suggestion: SearchSuggestion) {
    setQuery(suggestion.value);
    submit(suggestion.value);
  }

  async function toggleNearMe() {
    if (nearMe) {
      setNearMe(null);
      if (sort === "distance") setSort("pertinence");
      return;
    }
    setLocating(true);
    setError(null);
    const result = await getCurrentLocation();
    setLocating(false);
    if (result.status === "ok") {
      setNearMe(result.coords);
      setSort("distance");
    } else {
      setError(result.status === "denied"
        ? "Autorise la localisation pour trier par distance."
        : "Position indisponible pour le moment.");
    }
  }

  const priceError = minPrice.trim() && maxPrice.trim() && Number(minPrice) > Number(maxPrice)
    ? "Le prix minimum dépasse le maximum."
    : null;

  function applyPrice() {
    if (priceError) return;
    setAppliedMin(minPrice.trim());
    setAppliedMax(maxPrice.trim());
  }

  function openOther(category: OtherCategory, item: any) {
    if (category === "magasins") router.push(`/store/${item.id}`);
    else if (category === "services") router.push(`/service/${item.id}`);
    else if (category === "hebergements") router.push(`/lodging/${item.id}`);
    else router.push(`/vehicle/${item.id}`);
  }

  function otherTitle(category: OtherCategory, item: any) {
    if (category === "services") return item.metier;
    if (category === "magasins") return item.nom;
    if (category === "hebergements") return `${item.nom} · ${item.ville}`;
    return `${item.marque ?? "Véhicule"} ${item.modele ?? ""}`.trim();
  }

  const otherKeys = (Object.keys(OTHER_LABELS) as OtherCategory[]).filter((key) => (others[key]?.length ?? 0) > 0);
  const sortOptions = nearMe ? [...SORT_OPTIONS, DISTANCE_OPTION] : SORT_OPTIONS;

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {sortOptions.map((option) => (
          <Chip key={option.value} label={option.label} active={sort === option.value} onPress={() => setSort(option.value)} />
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {ETAT_OPTIONS.map((option) => (
          <Chip key={option.label} label={option.label} active={etat === option.value} onPress={() => setEtat(option.value)} />
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {REMISE_OPTIONS.map((option) => (
          <Chip key={option.label} label={option.label} active={modeRemise === option.value} onPress={() => setModeRemise(option.value)} />
        ))}
      </View>

      <Button
        label={nearMe ? `Position active · ${NEAR_RADIUS_KM} km (désactiver)` : `Près de moi (${NEAR_RADIUS_KM} km)`}
        variant="secondary"
        loading={locating}
        onPress={() => void toggleNearMe()}
        fullWidth
      />

      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-end" }}>
        <View style={{ flex: 1 }}>
          <Input placeholder="Prix min." keyboardType="numeric" value={minPrice} onChangeText={setMinPrice} />
        </View>
        <View style={{ flex: 1 }}>
          <Input placeholder="Prix max." keyboardType="numeric" value={maxPrice} onChangeText={setMaxPrice} />
        </View>
        <Button label="Appliquer" variant="secondary" onPress={applyPrice} disabled={Boolean(priceError)} />
      </View>
      {priceError && <Text variant="caption" color={colors.danger}>{priceError}</Text>}

      {error && !loading && <Text variant="caption" color={colors.danger}>{error}</Text>}

      {!loading && !error && approximatif && (
        <Text variant="caption" color={colors.inkSoft}>Résultats approchants pour « {submitted} »</Text>
      )}
      {!loading && !error && total > 0 && (
        <Text variant="caption" color={colors.inkSoft}>
          {total} produit{total > 1 ? "s" : ""}
        </Text>
      )}

      {otherKeys.map((key) => (
        <View key={key} style={{ gap: spacing.sm }}>
          <Text variant="label" color={colors.inkSoft}>{OTHER_LABELS[key]}</Text>
          {(others[key] ?? []).map((item: any) => (
            <Pressable key={item.id} onPress={() => openOther(key, item)}>
              <Card>
                <Text variant="body">{otherTitle(key, item)}</Text>
              </Card>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );

  return (
    <Screen>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md }}>
        <Text variant="h2">Rechercher</Text>
        <Input
          placeholder="Produit, marque, magasin, hébergement..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => submit()}
          returnKeyType="search"
        />
        {suggestions.length > 0 && (
          <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 10, overflow: "hidden" }}>
            {suggestions.map((suggestion) => (
              <Pressable
                key={`${suggestion.type}-${suggestion.value}`}
                onPress={() => pickSuggestion(suggestion)}
                style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderTopWidth: 1, borderColor: colors.line }}
              >
                <Text variant="body">{suggestion.value}</Text>
                <Text variant="caption" color={colors.inkSoft}>{SUGGESTION_LABELS[suggestion.type]}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {!submitted ? (
        <Text variant="body" color={colors.inkSoft} style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          Tape le nom d'un produit, d'une marque, d'un magasin ou d'un hébergement pour commencer.
        </Text>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <View style={{ width: "100%", gap: spacing.xs }}>
              <ProductCard product={item} width="100%" onPress={() => router.push(`/product/${item.id}`)} />
              {item.distanceKm != null && (
                <Text variant="caption" color={colors.inkSoft}>{item.distanceKm.toFixed(1)} km</Text>
              )}
            </View>
          )}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
            ) : error ? null : otherKeys.length > 0 ? null : (
              <Text variant="body" color={colors.inkSoft} style={{ textAlign: "center", marginTop: spacing.xl }}>
                Aucun résultat pour « {submitted} ».
              </Text>
            )
          }
          ListFooterComponent={
            page < totalPages ? (
              <View style={{ paddingVertical: spacing.lg }}>
                <Button
                  label={loadingMore ? "Chargement..." : "Charger plus"}
                  loading={loadingMore}
                  disabled={loadingMore}
                  variant="secondary"
                  onPress={() => load(page + 1, true)}
                />
              </View>
            ) : null
          }
        />
      )}
    </Screen>
  );
}
