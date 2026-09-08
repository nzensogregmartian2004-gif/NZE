import { View, Pressable } from "react-native";
import { colors, radius, spacing } from "@/theme";
import { Text } from "./Text";

type Props = {
  nom: string;
  categorie: string;
  distanceKm?: number;
  note?: number;
  onPress?: () => void;
};

export function StoreCard({ nom, categorie, distanceKm, note, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 160,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          height: 100,
          borderRadius: radius.lg,
          backgroundColor: colors.primaryTint,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.sm,
        }}
      >
        <Text style={{ fontSize: 32 }}>🏪</Text>
      </View>
      <Text variant="label" numberOfLines={1}>
        {nom}
      </Text>
      <Text variant="caption" color={colors.inkSoft} numberOfLines={1}>
        {categorie}
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
        {note !== undefined && (
          <Text variant="caption" color={colors.inkSoft}>
            ⭐ {note.toFixed(1)}
          </Text>
        )}
        {distanceKm !== undefined && (
          <Text variant="caption" color={colors.inkSoft}>
            📍 {distanceKm.toFixed(1)} km
          </Text>
        )}
      </View>
    </Pressable>
  );
}
