import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { listRestaurants, type PublicRestaurant } from "@/lib/restaurants-api";

export default function RestaurantsScreen() {
  const [restaurants, setRestaurants] = useState<PublicRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRestaurants(await listRestaurants()); }
    catch { setError("Impossible de charger les restaurants. Vérifie ta connexion puis réessaie."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <Screen><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
    <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
    <View style={{ gap: spacing.xs }}><Text variant="h1">Restaurants</Text><Text variant="bodySm" color={colors.inkSoft}>Découvre les menus et commande auprès des restaurants validés sur NZE.</Text></View>
    {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} /> : error ? <Card style={{ gap: spacing.md }}><Text variant="body" color={colors.danger}>{error}</Text><Button label="Réessayer" onPress={() => void load()} /></Card> : restaurants.length === 0 ? <Card><Text variant="body" color={colors.inkSoft}>Aucun restaurant publié pour le moment. Les établissements apparaîtront ici après validation par NZE.</Text></Card> : restaurants.map((restaurant) => <Pressable key={restaurant.id} onPress={() => router.push(`/restaurants/${restaurant.id}` as any)}>
      <Card style={{ padding: 0, overflow: "hidden", gap: spacing.sm }}>
        {restaurant.couverture || restaurant.photo ? <Image source={{ uri: restaurant.couverture ?? restaurant.photo! }} style={{ width: "100%", height: 150 }} resizeMode="cover" /> : <View style={{ height: 120, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 44 }}>🍽️</Text></View>}
        <View style={{ padding: spacing.md, gap: spacing.xs }}>
          <Text variant="h3">{restaurant.nom}</Text>
          <Text variant="bodySm" color={colors.inkSoft}>{restaurant.profile?.typeCuisine ?? "Cuisine variée"}{restaurant.quartier ? ` · ${restaurant.quartier}` : ""}</Text>
          {restaurant.profile?.description ? <Text variant="bodySm">{restaurant.profile.description}</Text> : null}
          <Text variant="caption" color={restaurant.profile?.commandesActives === false ? colors.danger : colors.primary}>{restaurant.profile?.commandesActives === false ? "Commandes temporairement fermées" : "Consulter le menu →"}</Text>
        </View>
      </Card>
    </Pressable>)}
  </ScrollView></Screen>;
}
