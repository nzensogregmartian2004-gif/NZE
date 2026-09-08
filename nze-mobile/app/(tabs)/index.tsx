import { ScrollView, View, Pressable } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Logo } from "@/components/Logo";
import { SearchBar } from "@/components/SearchBar";
import { UniverseCard } from "@/components/UniverseCard";
import { StoreCard } from "@/components/StoreCard";

const UNIVERSES = [
  { emoji: "🛒", title: "Produits", subtitle: "Trouver un produit ou un magasin", route: "/products" },
  { emoji: "🔧", title: "Services", subtitle: "Trouver un professionnel", route: "/services" },
  { emoji: "🚕", title: "Mobilité", subtitle: "Taxi • Moto • Location", route: "/mobility" },
  { emoji: "🚚", title: "Livraison", subtitle: "Envoyer un colis", route: "/delivery" },
] as const;

// Données de démonstration — à remplacer par GET /stores?near=lat,lng
const NEARBY_STORES = [
  { nom: "Épicerie Awa", categorie: "Alimentation", distanceKm: 0.8, note: 4.7 },
  { nom: "Quincaillerie Moussa", categorie: "Bricolage", distanceKm: 1.4, note: 4.5 },
  { nom: "Boutique Chic", categorie: "Mode", distanceKm: 2.1, note: 4.8 },
];

export default function HomeScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Logo variant="mark" height={36} />
          </View>
          <Text variant="h2">Bonjour 👋</Text>
          <Pressable hitSlop={12}>
            <Text style={{ fontSize: 22 }}>🔔</Text>
          </Pressable>
        </View>

        <SearchBar onPress={() => router.push("/search")} />

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
          {UNIVERSES.map((u) => (
            <UniverseCard
              key={u.title}
              emoji={u.emoji}
              title={u.title}
              subtitle={u.subtitle}
              onPress={() => router.push(u.route as any)}
            />
          ))}
        </View>

        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text variant="h3">Magasins proches</Text>
            <Pressable>
              <Text variant="label" color={colors.primary}>
                Voir tout
              </Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              {NEARBY_STORES.map((store) => (
                <StoreCard key={store.nom} {...store} />
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </Screen>
  );
}
