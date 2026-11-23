import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { getRestaurantMenu, type RestaurantMenu, type RestaurantDish, type RestaurantOptionGroup, type SelectedRestaurantOption } from "@/lib/restaurants-api";
import type { ProductDetail } from "@/lib/stores-api";
import { useCartStore } from "@/store/cart";

function money(value: number | string) { return Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " FCFA"; }

type Selections = Record<string, Record<string, string[]>>;
function selectionPrice(groups: RestaurantOptionGroup[], selections: Record<string, string[]> = {}) {
  let total = 0;
  for (const group of groups) for (const id of selections[group.id] ?? []) total += Number(group.choices.find((choice) => choice.id === id)?.price ?? 0);
  return total;
}
function validSelections(groups: RestaurantOptionGroup[], selections: Record<string, string[]> = {}) {
  return groups.every((group) => {
    const count = (selections[group.id] ?? []).length;
    return count >= group.minSelections && count <= group.maxSelections;
  });
}

export default function RestaurantMenuScreen() {
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const [menu, setMenu] = useState<RestaurantMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState<Selections>({});
  const addProduct = useCartStore((state) => state.addProduct);
  const cartCount = useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const load = useCallback(async () => {
    setLoading(true);
    try { setMenu(await getRestaurantMenu(storeId)); }
    catch (error) { Alert.alert("Menu indisponible", error instanceof Error ? error.message : "Impossible de charger ce menu."); }
    finally { setLoading(false); }
  }, [storeId]);
  useEffect(() => { void load(); }, [load]);

  const sectioned = useMemo(() => {
    if (!menu) return [];
    return menu.sections.map((section) => ({ ...section, dishes: menu.dishes.filter((dish) => dish.sectionId === section.id) }))
      .filter((section) => section.dishes.length > 0);
  }, [menu]);
  const unsectioned = menu?.dishes.filter((dish) => !dish.sectionId) ?? [];

  function toggleChoice(dish: RestaurantDish, group: RestaurantOptionGroup, choiceId: string) {
    setSelections((current) => {
      const existing = current[dish.id]?.[group.id] ?? [];
      const next = existing.includes(choiceId)
        ? existing.filter((id) => id !== choiceId)
        : group.maxSelections === 1 ? [choiceId] : existing.length < group.maxSelections ? [...existing, choiceId] : existing;
      return { ...current, [dish.id]: { ...(current[dish.id] ?? {}), [group.id]: next } };
    });
  }

  function addDish(dish: RestaurantDish) {
    if (!dish.disponible || (dish.gestionStock && dish.stock < 1)) return;
    const selectedByGroup = selections[dish.id] ?? {};
    if (!validSelections(dish.optionGroups ?? [], selectedByGroup)) {
      Alert.alert("Choix incomplets", "Vérifie les suppléments et les formules obligatoires avant d'ajouter ce plat.");
      return;
    }
    const selected: SelectedRestaurantOption[] = Object.entries(selectedByGroup).filter(([, ids]) => ids.length > 0).map(([groupId, choiceIds]) => ({ groupId, choiceIds }));
    const cartProduct = { ...dish, store: menu!.store, offres: [] } as unknown as ProductDetail;
    const added = addProduct(cartProduct, 1, selected);
    if (!added) { Alert.alert("Ajout impossible", "Ce plat n'est plus disponible."); return; }
    Alert.alert("Plat ajouté", `${dish.nom} ajouté au panier.`, [
      { text: "Continuer", style: "cancel" },
      { text: `Voir le panier (${cartCount + 1})`, onPress: () => router.push("/cart") },
    ]);
  }

  if (loading) return <Screen><ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /></Screen>;
  if (!menu) return <Screen><View style={{ padding: spacing.lg, gap: spacing.md }}><Button label="← Retour" variant="ghost" onPress={() => router.back()} /><Text variant="body" color={colors.inkSoft}>Le menu n'est pas accessible.</Text><Button label="Réessayer" onPress={() => void load()} /></View></Screen>;

  const renderDish = (dish: RestaurantDish) => {
    const chosen = selections[dish.id] ?? {};
    const finalPrice = Number(dish.prix) + selectionPrice(dish.optionGroups ?? [], chosen);
    return <Card key={dish.id} style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        {dish.photos?.[0]?.url ? <Image source={{ uri: dish.photos[0].url }} style={{ width: 84, height: 84, borderRadius: 12 }} /> : <View style={{ width: 84, height: 84, backgroundColor: colors.primaryTint, borderRadius: 12, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 32 }}>🍲</Text></View>}
        <View style={{ flex: 1, gap: spacing.xs }}><Text variant="h3">{dish.nom}</Text><Text variant="label" color={colors.primary}>{money(finalPrice)}</Text><Text variant="caption" color={colors.inkSoft}>Préparation estimée : {dish.tempsPreparationMinutes} min</Text>{dish.description ? <Text variant="bodySm">{dish.description}</Text> : null}</View>
      </View>
      {dish.ingredients ? <Text variant="caption" color={colors.inkSoft}>Ingrédients : {dish.ingredients}</Text> : null}
      {dish.allergenes?.length ? <Text variant="caption" color={colors.warning}>Allergènes : {dish.allergenes.join(", ")}</Text> : null}
      {(dish.optionGroups ?? []).map((group) => <View key={group.id} style={{ gap: spacing.xs }}>
        <Text variant="label">{group.label}{group.required ? " · obligatoire" : " · facultatif"}</Text>
        {group.choices.map((choice) => {
          const active = (chosen[group.id] ?? []).includes(choice.id);
          return <Pressable key={choice.id} onPress={() => toggleChoice(dish, group, choice.id)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.sm, borderRadius: 10, borderWidth: 1, borderColor: active ? colors.primary : colors.line, backgroundColor: active ? colors.primaryTint : colors.white }}>
            <Text variant="bodySm" color={active ? colors.primary : colors.ink}>{active ? "✓ " : "○ "}{choice.label}</Text><Text variant="caption" color={colors.inkSoft}>{Number(choice.price) > 0 ? `+${money(choice.price)}` : "Inclus"}</Text>
          </Pressable>;
        })}
      </View>)}
      <Button label={dish.disponible ? "Ajouter au panier" : "Indisponible"} onPress={() => addDish(dish)} disabled={!dish.disponible || (dish.gestionStock && dish.stock < 1)} fullWidth />
    </Card>;
  };

  return <Screen><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
    <Button label="← Retour aux restaurants" variant="ghost" onPress={() => router.back()} />
    <View style={{ gap: spacing.xs }}>
      {menu.store.couverture || menu.store.photo ? <Image source={{ uri: menu.store.couverture ?? menu.store.photo! }} style={{ width: "100%", height: 180, borderRadius: 16 }} resizeMode="cover" /> : <View style={{ height: 125, borderRadius: 16, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 48 }}>🍽️</Text></View>}
      <Text variant="h1">{menu.store.nom}</Text>
      <Text variant="bodySm" color={colors.inkSoft}>{menu.profile?.typeCuisine ?? "Cuisine variée"}{menu.store.quartier ? ` · ${menu.store.quartier}` : ""}</Text>
      {menu.profile?.description ? <Text variant="body">{menu.profile.description}</Text> : null}
      {menu.profile?.commandesActives === false ? <Text variant="body" color={colors.danger}>Ce restaurant ne prend pas de commandes pour le moment.</Text> : null}
      {Number(menu.profile?.montantMinimum ?? 0) > 0 ? <Text variant="caption" color={colors.inkSoft}>Commande minimale : {money(menu.profile!.montantMinimum)}</Text> : null}
    </View>
    {menu.profile?.commandesActives === false ? null : <>
      {sectioned.map((section) => <View key={section.id} style={{ gap: spacing.md }}><View><Text variant="h2">{section.nom}</Text>{section.description ? <Text variant="caption" color={colors.inkSoft}>{section.description}</Text> : null}</View>{section.dishes.map(renderDish)}</View>)}
      {unsectioned.length > 0 ? <View style={{ gap: spacing.md }}><Text variant="h2">Autres plats</Text>{unsectioned.map(renderDish)}</View> : null}
      {menu.dishes.length === 0 ? <Card><Text variant="body" color={colors.inkSoft}>Le menu sera bientôt disponible.</Text></Card> : null}
    </>}
    <Button label={`Voir le panier (${cartCount})`} variant="secondary" onPress={() => router.push("/cart")} fullWidth />
  </ScrollView></Screen>;
}
