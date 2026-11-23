import { useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuthStore } from "@/store/auth";
import { useCartStore } from "@/store/cart";
import { checkoutCart } from "@/lib/stores-api";
import { getCurrentLocation } from "@/lib/location";
import { quoteDelivery, type DeliveryQuote } from "@/lib/deliveries-api";
import { ApiError } from "@/lib/api";

function formatMoney(value: number) {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " FCFA";
}

export default function CartScreen() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const items = useCartStore((state) => state.items);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeProduct = useCartStore((state) => state.removeProduct);
  const clearCart = useCartStore((state) => state.clearCart);
  const [checkingOut, setCheckingOut] = useState(false);
  const [deliveryChoice, setDeliveryChoice] = useState<"pickup" | "delivery">("pickup");
  const [deliveryDestination, setDeliveryDestination] = useState<{ latitude: number; longitude: number } | null>(null);
  const [deliveryQuotes, setDeliveryQuotes] = useState<DeliveryQuote[]>([]);
  const [loadingDeliveryQuote, setLoadingDeliveryQuote] = useState(false);
  const idempotencyKey = useRef<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      map.set(item.storeId, [...(map.get(item.storeId) ?? []), item]);
    }
    return [...map.entries()];
  }, [items]);
  const total = useMemo(() => items.reduce((sum, item) => sum + Math.round(Number(item.price) * 100) * item.quantity, 0) / 100, [items]);
  const invalidItem = items.find((item) => !item.available || (item.stockManaged && (item.stock < item.quantity || item.stock < 1)));
  const activeStoreIds = new Set(groups.map(([storeId]) => storeId));
  const deliveryFee = deliveryChoice === "delivery"
    ? deliveryQuotes.filter((quote) => activeStoreIds.has(quote.storeId)).reduce((sum, quote) => sum + quote.fraisLivraison, 0)
    : 0;

  async function chooseDelivery() {
    if (!accessToken) return;
    setLoadingDeliveryQuote(true);
    try {
      const location = await getCurrentLocation();
      if (location.status !== "ok") {
        Alert.alert("Adresse nécessaire", location.status === "denied" ? "Autorise la géolocalisation pour calculer une livraison." : "Impossible d'obtenir ta position actuelle.");
        return;
      }
      const destination = location.coords;
      const quotes = await Promise.all(groups.map(([storeId]) => quoteDelivery(accessToken, storeId, destination)));
      setDeliveryDestination(destination);
      setDeliveryQuotes(quotes);
      setDeliveryChoice("delivery");
    } catch (error) {
      setDeliveryChoice("pickup");
      setDeliveryDestination(null);
      setDeliveryQuotes([]);
      Alert.alert("Livraison indisponible", error instanceof ApiError ? error.message : "Au moins un magasin ne peut pas livrer à cette adresse. Choisis le retrait ou vérifie les paramètres.");
    } finally {
      setLoadingDeliveryQuote(false);
    }
  }

  function changeQuantity(cartItemId: string, quantity: number) {
    idempotencyKey.current = null;
    setQuantity(cartItemId, quantity);
  }

  function removeItem(cartItemId: string) {
    idempotencyKey.current = null;
    removeProduct(cartItemId);
  }

  async function handleCheckout() {
    if (!accessToken || items.length === 0 || invalidItem) {
      if (invalidItem) Alert.alert("Stock à vérifier", `Vérifie la disponibilité de « ${invalidItem.productName} » avant de commander.`);
      return;
    }
    setCheckingOut(true);
    try {
      if (!idempotencyKey.current) {
        idempotencyKey.current = `nze-cart-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      }
      if (deliveryChoice === "delivery" && !deliveryDestination) {
        throw new Error("Demande un devis de livraison avant de valider la commande.");
      }
      const result = await checkoutCart(
        accessToken,
        items.map(({ productId, quantity, options }) => ({ productId, quantite: quantity, ...(options?.length ? { options } : {}) })),
        idempotencyKey.current,
        deliveryChoice === "delivery" && deliveryDestination
          ? { latitude: deliveryDestination.latitude, longitude: deliveryDestination.longitude }
          : undefined,
      );
      clearCart();
      idempotencyKey.current = null;
      // Le client doit passer par l'écran de paiement avant que les magasins puissent traiter la commande.
      router.replace(`/payment/${result.checkoutGroupId}`);
    } catch (error) {
      Alert.alert("Commande impossible", error instanceof ApiError ? error.message : "Vérifie ta connexion et le stock, puis réessaie.");
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <View style={{ gap: spacing.xs }}>
          <Text variant="h1">Mon panier</Text>
          <Text variant="bodySm" color={colors.inkSoft}>{items.length} produit(s) · les magasins auront chacun leur sous-commande.</Text>
        </View>

        {items.length === 0 ? (
          <Card style={{ gap: spacing.md, alignItems: "center" }}>
            <Text variant="h2">Ton panier est vide</Text>
            <Text variant="bodySm" color={colors.inkSoft}>Ajoute des produits depuis le catalogue pour préparer ta commande.</Text>
            <Button label="Découvrir les produits" onPress={() => router.push("/products")} fullWidth />
          </Card>
        ) : (
          <>
            {groups.map(([storeId, storeItems]) => (
              <View key={storeId} style={{ gap: spacing.sm }}>
                <Text variant="h3">{storeItems[0]?.storeName ?? "Magasin"}</Text>
                {storeItems.map((item) => (
                  <Card key={item.cartItemId} style={{ gap: spacing.sm }}>
                    <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
                      {item.photoUrl ? <Image source={{ uri: item.photoUrl }} style={{ width: 64, height: 64, borderRadius: 10 }} /> : <View style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 28 }}>📦</Text></View>}
                      <View style={{ flex: 1, gap: spacing.xs }}>
                        <Text variant="label">{item.productName}</Text>
                        <Text variant="bodySm" color={colors.primary}>{formatMoney(Number(item.price))} / unité</Text>
                        <Text variant="caption" color={colors.inkSoft}>{item.stockManaged ? `Stock : ${item.stock}` : "Préparé à la commande"}</Text>
                        {item.optionsSummary ? <Text variant="caption" color={colors.inkSoft}>Options : {item.optionsSummary}</Text> : null}
                      </View>
                      <Pressable onPress={() => removeItem(item.cartItemId)} accessibilityRole="button" accessibilityLabel={`Retirer ${item.productName}`}><Text color={colors.danger}>Retirer</Text></Pressable>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                        <Button label="−" variant="secondary" onPress={() => changeQuantity(item.cartItemId, item.quantity - 1)} />
                        <Text variant="label">{item.quantity}</Text>
                        <Button label="+" variant="secondary" disabled={item.quantity >= item.stock} onPress={() => changeQuantity(item.cartItemId, item.quantity + 1)} />
                      </View>
                      <Text variant="label">{formatMoney(Number(item.price) * item.quantity)}</Text>
                    </View>
                    {(!item.available || (item.stockManaged && (item.stock < item.quantity || item.stock === 0))) && <Text variant="caption" color={colors.danger}>Stock modifié ou produit indisponible. Ajuste la quantité ou retire-le.</Text>}
                  </Card>
                ))}
              </View>
            ))}
            <Card style={{ gap: spacing.md }}>
              <Text variant="h3">Mode de remise</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button label="Retrait sur place" variant={deliveryChoice === "pickup" ? "primary" : "secondary"} onPress={() => setDeliveryChoice("pickup")} fullWidth />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Livraison" variant={deliveryChoice === "delivery" ? "primary" : "secondary"} onPress={chooseDelivery} loading={loadingDeliveryQuote} disabled={loadingDeliveryQuote || groups.length === 0} fullWidth />
                </View>
              </View>
              {deliveryChoice === "delivery" && (
                <View style={{ gap: spacing.xs }}>
                  <Text variant="bodySm" color={colors.inkSoft}>Position utilisée : latitude {deliveryDestination?.latitude.toFixed(4)}, longitude {deliveryDestination?.longitude.toFixed(4)}.</Text>
                  {deliveryQuotes.filter((quote) => activeStoreIds.has(quote.storeId)).map((quote) => (
                    <View key={quote.storeId} style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="bodySm">{groups.find(([storeId]) => storeId === quote.storeId)?.[1][0]?.storeName ?? "Magasin"}</Text>
                        <Text variant="caption" color={colors.inkSoft}>{quote.distanceKm.toFixed(1)} km · {quote.sourceDistance === "google_routes" ? "itinéraire routier" : "estimation à vol d'oiseau"}</Text>
                      </View>
                      <Text variant="label">{formatMoney(quote.fraisLivraison)}</Text>
                    </View>
                  ))}
                  <Text variant="caption" color={colors.inkSoft}>Le serveur recalcule et valide chaque frais lors de la commande. La position est utilisée seulement pour cet itinéraire.</Text>
                </View>
              )}
            </Card>
            <Card style={{ gap: spacing.md }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text variant="h3">Total des produits</Text>
                <Text variant="h3" color={colors.primary}>{formatMoney(total)}</Text>
              </View>
              {deliveryChoice === "delivery" && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text variant="bodySm" color={colors.inkSoft}>Frais de livraison estimés</Text>
                  <Text variant="label">{formatMoney(deliveryFee)}</Text>
                </View>
              )}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text variant="h3">Total estimé</Text>
                <Text variant="h3" color={colors.primary}>{formatMoney(total + deliveryFee)}</Text>
              </View>
              <Text variant="caption" color={colors.inkSoft}>Les frais sont recalculés par le serveur. Un tarif est confirmé avant validation; si la configuration du magasin change, la commande est refusée plutôt que de facturer un montant obsolète.</Text>
              <Button label="Valider la commande" onPress={handleCheckout} loading={checkingOut} disabled={checkingOut || items.length === 0 || !!invalidItem || loadingDeliveryQuote || (deliveryChoice === "delivery" && !deliveryDestination)} fullWidth />
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
