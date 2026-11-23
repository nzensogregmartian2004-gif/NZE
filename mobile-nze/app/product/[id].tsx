import { useEffect, useState, useCallback, useRef } from "react";
import { View, ScrollView, Image, ActivityIndicator, Alert, Pressable } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { getProduct, createOrder, type ProductDetail } from "@/lib/stores-api";
import { getCurrentLocation } from "@/lib/location";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useCartStore } from "@/store/cart";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const orderKeyRef = useRef<string | null>(null);
  const addProductToCart = useCartStore((state) => state.addProduct);
  const cartCount = useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProduct(await getProduct(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Produit introuvable");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    setQuantity(1);
    orderKeyRef.current = null;
  }, [load]);

  async function handleOrder() {
    if (!product || !accessToken) return;
    if (!product.disponible || product.stock < quantity) {
      Alert.alert("Stock insuffisant", "La quantité demandée n'est plus disponible.");
      return;
    }
    setOrdering(true);
    try {
      const location = await getCurrentLocation();
      if (!orderKeyRef.current) orderKeyRef.current = `nze-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const order = await createOrder(accessToken, {
        storeId: product.storeId,
        items: [{ productId: product.id, quantite: quantity }],
        livraison:
          location.status === "ok"
            ? { latitude: location.coords.latitude, longitude: location.coords.longitude }
            : undefined,
      }, orderKeyRef.current);
      orderKeyRef.current = null;
      // Ne pas inviter le commerçant à préparer la commande avant la confirmation du paiement.
      router.replace(`/payment/${order.checkoutGroupId ?? order.id}`);
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible de passer la commande");
    } finally {
      setOrdering(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  if (error || !product) {
    return (
      <Screen>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
          <Text variant="body" color={colors.danger}>
            {error ?? "Produit introuvable"}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View
          style={{ height: 220, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" }}
        >
          {product.photos[0] ? (
            <Image source={{ uri: product.photos[0].url }} style={{ width: "100%", height: "100%" }} />
          ) : (
            <Text style={{ fontSize: 56 }}>📦</Text>
          )}
        </View>

        <View style={{ padding: spacing.lg, gap: spacing.lg, flex: 1 }}>
          <Button label="← Retour" variant="ghost" onPress={() => router.back()} />

          <View style={{ gap: spacing.xs }}>
            <Text variant="h1">{product.nom}</Text>
            <Text variant="h2" color={colors.primary}>
              {Number(product.prix).toLocaleString("fr-FR")} FCFA
            </Text>
            {(!product.disponible || product.stock < 1) && <Badge label="Indisponible" tone="danger" />}
            {product.disponible && product.stock > 0 && <Text variant="bodySm" color={colors.inkSoft}>Stock disponible : {product.stock}</Text>}
          </View>

          {product.categorie?.nom && <Text variant="bodySm" color={colors.inkSoft}>Catégorie : {product.categorie.nom}</Text>}
          {(product.marque || product.modele || product.reference) && <Text variant="bodySm" color={colors.inkSoft}>{[product.marque, product.modele, product.reference ? `Réf. ${product.reference}` : undefined].filter(Boolean).join(" · ")}</Text>}
          {product.etat && <Badge label={product.etat === "reconditionne" ? "Reconditionné" : product.etat === "occasion" ? "Occasion" : "Neuf"} tone="primary" />}
          {product.description && <Text variant="body">{product.description}</Text>}
          {!!product.caracteristiques?.length && <View style={{ gap: spacing.xs }}><Text variant="h3">Caractéristiques</Text>{product.caracteristiques.map((item, index) => <Text key={`${item.nom}-${index}`} variant="bodySm" color={colors.inkSoft}>{item.nom} : {item.valeur}</Text>)}</View>}
          {!!product.variantes?.length && <View style={{ gap: spacing.xs }}><Text variant="h3">Variantes disponibles</Text>{product.variantes.map((item, index) => <Text key={`${item.nom}-${index}`} variant="bodySm" color={colors.inkSoft}>{item.nom} : {item.options.join(", ")}</Text>)}</View>}
          {product.store.quartier && <Text variant="bodySm" color={colors.inkSoft}>📍 {product.store.quartier}</Text>}
          {!!product.offres?.length && <View style={{ gap: spacing.sm }}>
            <Text variant="h3">Comparer chez d'autres vendeurs</Text>
            {product.offres.map((offer) => <Pressable key={offer.id} onPress={() => router.push(`/product/${offer.id}`)}>
              <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: spacing.md, gap: spacing.xs }}>
                <Text variant="label">{offer.store.nom}</Text>
                {offer.store.quartier && <Text variant="caption" color={colors.inkSoft}>{offer.store.quartier}</Text>}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text variant="body" color={colors.primary}>{Number(offer.prix).toLocaleString("fr-FR")} FCFA</Text>
                  <Text variant="caption" color={colors.inkSoft}>Stock : {offer.stock}</Text>
                </View>
              </View>
            </Pressable>)}
          </View>}

          <Button
            label={`Voir ${product.store.nom}`}
            variant="secondary"
            onPress={() => router.push(`/store/${product.storeId}`)}
            fullWidth
          />

          <View style={{ gap: spacing.sm }}>
            <Text variant="label">Quantité</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Button label="−" variant="secondary" disabled={quantity <= 1} onPress={() => setQuantity((value) => Math.max(1, value - 1))} />
              <Text variant="h3">{quantity}</Text>
              <Button label="+" variant="secondary" disabled={quantity >= product.stock} onPress={() => setQuantity((value) => Math.min(product.stock, value + 1))} />
              <View style={{ flex: 1 }} />
              <Text variant="label" color={colors.primary}>{(Number(product.prix) * quantity).toLocaleString("fr-FR")} FCFA</Text>
            </View>
          </View>

          <Button
            label="Ajouter au panier"
            variant="secondary"
            onPress={() => {
              const added = addProductToCart(product, quantity);
              if (!added) { Alert.alert("Ajout impossible", "Vérifie la disponibilité et la quantité en stock."); return; }
              Alert.alert("Ajouté au panier", `${quantity} × ${product.nom} ajouté(s).`, [
                { text: "Continuer", style: "cancel" },
                { text: `Voir le panier (${cartCount + quantity})`, onPress: () => router.push("/cart") },
              ]);
            }}
            disabled={!product.disponible || product.stock < quantity || product.stock < 1}
            fullWidth
          />
          <Button label="Voir le panier" variant="ghost" onPress={() => router.push("/cart")} fullWidth />
          <View style={{ flex: 1 }} />

          <Button
            label="Commander maintenant"
            onPress={handleOrder}
            loading={ordering}
            disabled={!product.disponible || product.stock < quantity || product.stock < 1}
            fullWidth
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
