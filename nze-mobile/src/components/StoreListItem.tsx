import { View, Image } from "react-native";
import { Card } from "./Card";
import { Text } from "./Text";
import { colors, spacing } from "@/theme";
import type { Store } from "@/lib/stores-api";

export function StoreListItem({ store }: { store: Store }) {
  return (
    <Card style={{ flexDirection: "row", gap: spacing.md }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 10,
          backgroundColor: colors.primaryTint,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {store.photo ? (
          <Image source={{ uri: store.photo }} style={{ width: "100%", height: "100%" }} />
        ) : (
          <Text style={{ fontSize: 28 }}>🏪</Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" style={{ fontFamily: "PlusJakartaSans_600SemiBold" }} numberOfLines={1}>
          {store.nom}
        </Text>
        {store.quartier && (
          <Text variant="bodySm" color={colors.inkSoft} numberOfLines={1}>
            {store.quartier}
          </Text>
        )}
        {store.distanceKm !== undefined && (
          <Text variant="caption" color={colors.primary}>
            📍 {store.distanceKm.toFixed(1)} km
          </Text>
        )}
      </View>
    </Card>
  );
}
