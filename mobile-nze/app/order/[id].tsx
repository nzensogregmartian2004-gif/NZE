import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { useAuthStore } from "@/store/auth";
import {
  getOrder,
  cancelOrder,
  getDeliveryTrackingForOrder,
  ORDER_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
  type Order,
  type DeliveryTracking,
} from "@/lib/orders-api";
import { getSocket } from "@/lib/socket";
import { listNotifications } from "@/lib/messaging-api";

const POLL_FALLBACK_MS = 20000; // filet de sécurité si le socket se déconnecte

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [order, setOrder] = useState<Order | null>(null);
  const [delivery, setDelivery] = useState<DeliveryTracking | null>(null);
  const [deliveryProofCode, setDeliveryProofCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const [orderData, deliveryData, notificationData] = await Promise.all([
      getOrder(accessToken, id),
      getDeliveryTrackingForOrder(accessToken, id),
      listNotifications(accessToken).catch(() => []),
    ]);
    const proofNotification = notificationData.find((item) =>
      item.type === "code_preuve_livraison" && item.donnees?.orderId === id
    );
    const proofCode = proofNotification?.donnees?.code;
    setDeliveryProofCode(typeof proofCode === "string" ? proofCode : null);
    setOrder(orderData);
    setDelivery(deliveryData);
    setLoading(false);
  }, [accessToken, id]);

  useEffect(() => {
    load();

    const socket = getSocket();

    // Position du livreur en direct — rejoint la salle une fois la livraison connue.
    if (delivery?.id) socket?.emit("tracking:join", delivery.id);

    function handleLocationUpdate(position: { latitude: number; longitude: number }) {
      setDelivery((prev) => (prev ? { ...prev, positionLivreur: position } : prev));
    }
    socket?.on("location:update", handleLocationUpdate);

    // Notification de changement de statut (commande confirmée, livreur arrivé...) → on rafraîchit.
    function handleNotification(notification: { type: string }) {
      if (notification.type === "commande_statut" || notification.type === "livraison_statut") {
        load();
      }
    }
    socket?.on("notification:new", handleNotification);

    // Filet de sécurité si le socket est déconnecté
    const interval = setInterval(load, POLL_FALLBACK_MS);

    return () => {
      if (delivery?.id) socket?.emit("tracking:leave", delivery.id);
      socket?.off("location:update", handleLocationUpdate);
      socket?.off("notification:new", handleNotification);
      clearInterval(interval);
    };
  }, [load, delivery?.id]);

  if (loading || !order) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />

        <View style={{ gap: spacing.xs }}>
          <Text variant="h1">Commande #{order.id.slice(0, 8)}</Text>
          <Text variant="h2" color={colors.primary}>
            {Number(order.total).toLocaleString("fr-FR")} FCFA
          </Text>
        </View>

        {Number(order.fraisLivraison ?? 0) > 0 && (
          <Card style={{ gap: spacing.sm }}>
            <Text variant="label" color={colors.inkSoft}>DÉTAIL DU MONTANT</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}>
              <Text variant="bodySm" color={colors.inkSoft}>Produits</Text>
              <Text variant="bodySm">{(Number(order.total) - Number(order.fraisLivraison ?? 0)).toLocaleString("fr-FR")} FCFA</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}>
              <Text variant="bodySm" color={colors.inkSoft}>Livraison ({order.prestataireLivraison === "nze" ? "NZE" : "commerçant"})</Text>
              <Text variant="bodySm">{Number(order.fraisLivraison).toLocaleString("fr-FR")} FCFA</Text>
            </View>
            {order.distanceLivraisonKm != null && <Text variant="caption" color={colors.inkFaint}>Distance estimée : {order.distanceLivraisonKm.toFixed(1)} km</Text>}
          </Card>
        )}

        <Card style={{ gap: spacing.sm }}>
          <Text variant="label" color={colors.inkSoft}>
            STATUT DE LA COMMANDE
          </Text>
          <Badge label={ORDER_STATUS_LABELS[order.statut]} tone="primary" />
        </Card>

        {accessToken && (order.statut === "produit_pret" || order.statut === "terminee") && (
          <Button label="Demander un remboursement" variant="secondary" onPress={() => router.push(`/refund/${order.id}`)} fullWidth />
        )}

        {order.statut === "nouvelle" && accessToken && (
          <Button
            label="Annuler la commande"
            variant="secondary"
            onPress={() => Alert.alert("Annuler cette commande ?", "Cette action restituera les quantités au stock du magasin.", [
              { text: "Garder la commande", style: "cancel" },
              { text: "Annuler la commande", style: "destructive", onPress: async () => {
                try { await cancelOrder(accessToken, order.id); await load(); }
                catch (error) { Alert.alert("Annulation impossible", error instanceof Error ? error.message : "Réessaie plus tard."); }
              } },
            ])}
            fullWidth
          />
        )}

        {delivery && deliveryProofCode && !delivery.preuveEnregistree && (
          <Card style={{ gap: spacing.sm }}>
            <Text variant="label" color={colors.inkSoft}>CODE DE REMISE À USAGE UNIQUE</Text>
            <Text variant="h1" color={colors.primary}>{deliveryProofCode}</Text>
            <Text variant="caption" color={colors.inkSoft}>Communique ce code uniquement au livreur lorsque tu reçois ta commande. Il sera nécessaire pour confirmer la remise.</Text>
          </Card>
        )}

        {delivery ? (
          <Card style={{ gap: spacing.sm }}>
            <Text variant="label" color={colors.inkSoft}>
              SUIVI DE LA LIVRAISON
            </Text>
            <Badge label={DELIVERY_STATUS_LABELS[delivery.statut] ?? delivery.statut} tone="primary" />
            {delivery.preuveEnregistree && <Text variant="caption" color={colors.success}>Preuve de remise enregistrée.</Text>}

            {delivery.positionLivreur ? (
              <Text variant="bodySm" color={colors.inkSoft}>
                📍 Position du livreur : {delivery.positionLivreur.latitude.toFixed(4)},{" "}
                {delivery.positionLivreur.longitude.toFixed(4)}
              </Text>
            ) : (
              <Text variant="bodySm" color={colors.inkSoft}>
                En attente de la position du livreur...
              </Text>
            )}

            <Text variant="caption" color={colors.inkFaint}>
              Mis à jour automatiquement toutes les 5 secondes
            </Text>
          </Card>
        ) : (
          order.statut !== "annulee" && (
            <Text variant="body" color={colors.inkSoft}>
              La livraison sera visible ici une fois que le magasin aura préparé ta commande.
            </Text>
          )
        )}
      </ScrollView>
    </Screen>
  );
}
