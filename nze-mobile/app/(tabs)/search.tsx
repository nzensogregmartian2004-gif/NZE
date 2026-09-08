import { useState } from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { search, type SearchResults } from "@/lib/search-api";
import { ApiError } from "@/lib/api";

const CATEGORY_LABELS: Record<keyof SearchResults, string> = {
  produits: "Produits",
  magasins: "Magasins",
  services: "Services",
  vehicules: "Véhicules",
  transport: "Transport",
};

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(q: string) {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResults(await search(q));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Recherche impossible pour le moment");
    } finally {
      setLoading(false);
    }
  }

  const hasResults = results && Object.values(results).some((list) => list.length > 0);

  return (
    <Screen>
      <View style={{ padding: spacing.lg, gap: spacing.lg, flex: 1 }}>
        <Text variant="h2">Rechercher</Text>
        <Input
          placeholder="Produit, magasin, prestataire, véhicule..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => runSearch(query)}
          returnKeyType="search"
        />

        {loading && <ActivityIndicator color={colors.primary} />}
        {error && (
          <Text variant="bodySm" color={colors.danger}>
            {error}
          </Text>
        )}

        {!loading && query && results && !hasResults && (
          <Text variant="body" color={colors.inkSoft}>
            Aucun résultat pour « {query} ».
          </Text>
        )}

        {results && hasResults && (
          <ScrollView contentContainerStyle={{ gap: spacing.lg }}>
            {(Object.keys(results) as Array<keyof SearchResults>).map((category) => {
              const items = results[category];
              if (!items.length) return null;
              return (
                <View key={category} style={{ gap: spacing.sm }}>
                  <Text variant="label" color={colors.inkSoft}>
                    {CATEGORY_LABELS[category]}
                  </Text>
                  {items.map((item: any) => (
                    <Card key={item.id}>
                      <Text variant="body">
                        {item.nom ?? item.metier ?? `${item.marque ?? ""} ${item.modele ?? ""}`.trim()}
                      </Text>
                    </Card>
                  ))}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}
