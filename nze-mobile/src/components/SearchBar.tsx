import { Pressable } from "react-native";
import { colors, radius, spacing } from "@/theme";
import { Text } from "./Text";

export function SearchBar({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        backgroundColor: pressed ? colors.primaryTint : colors.bg,
        borderRadius: radius.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
      })}
    >
      <Text style={{ fontSize: 18 }}>🔎</Text>
      <Text variant="body" color={colors.inkFaint}>
        Que recherchez-vous ?
      </Text>
    </Pressable>
  );
}
