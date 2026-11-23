import { useCallback, useState } from "react";
import { View, FlatList, Pressable } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { useAuthStore } from "@/store/auth";
import { listMyOrders, ORDER_STATUS_LABELS, type Order } from "@/lib/orders-api";

const STATUS_TONE: Record<Order["statut"], "primary" | "success" | "warning" | "danger"> = {
  nouvelle: "warning",
  confirmee: "primary",
  produit_pret: "primary",
  terminee: "success",
  annulee: "danger",
};

export default function OrdersScreen() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setRefreshing(true);
    try {
      setOrders(await listMyOrders(accessToken));
    } finally {
      setRefreshing(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <Screen>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h1">Mes commandes</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshing={refreshing}
        onRefresh={load}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md, flexGrow: 1 }}
        ListEmptyComponent={
          <Text variant="body" color={colors.inkSoft} style={{ textAlign: "center", marginTop: spacing.xl }}>
            Tu n'as pas encore passé de commande.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/order/${item.id}`)}>
            <Card style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text variant="label">Commande #{item.id.slice(0, 8)}</Text>
                <Badge label={ORDER_STATUS_LABELS[item.statut]} tone={STATUS_TONE[item.statut]} />
              </View>
              <Text variant="body" style={{ fontFamily: "PlusJakartaSans_600SemiBold" }}>
                {Number(item.total).toLocaleString("fr-FR")} FCFA
              </Text>
              <Text variant="caption" color={colors.inkSoft}>
                {new Date(item.creeLe).toLocaleDateString("fr-FR")}
              </Text>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}
