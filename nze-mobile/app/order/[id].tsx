import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
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
  getDeliveryTrackingForOrder,
  ORDER_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
  type Order,
  type DeliveryTracking,
} from "@/lib/orders-api";
import { getSocket } from "@/lib/socket";

const POLL_FALLBACK_MS = 20000; // filet de sécurité si le socket se déconnecte

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [order, setOrder] = useState<Order | null>(null);
  const [delivery, setDelivery] = useState<DeliveryTracking | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const [orderData, deliveryData] = await Promise.all([
      getOrder(accessToken, id),
      getDeliveryTrackingForOrder(accessToken, id),
    ]);
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

        <Card style={{ gap: spacing.sm }}>
          <Text variant="label" color={colors.inkSoft}>
            STATUT DE LA COMMANDE
          </Text>
          <Badge label={ORDER_STATUS_LABELS[order.statut]} tone="primary" />
        </Card>

        {delivery ? (
          <Card style={{ gap: spacing.sm }}>
            <Text variant="label" color={colors.inkSoft}>
              SUIVI DE LA LIVRAISON
            </Text>
            <Badge label={DELIVERY_STATUS_LABELS[delivery.statut] ?? delivery.statut} tone="primary" />

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
