import { Pressable } from "react-native";
import { colors, radius, spacing } from "@/theme";
import { Text } from "./Text";

type Props = {
  emoji: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
};

export function UniverseCard({ emoji, title, subtitle, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexBasis: "48%",
        backgroundColor: pressed ? colors.primaryTint : colors.white,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: spacing.xs,
      })}
    >
      <Text style={{ fontSize: 28 }}>{emoji}</Text>
      <Text variant="h3">{title}</Text>
      <Text variant="bodySm" color={colors.inkSoft}>
        {subtitle}
      </Text>
    </Pressable>
  );
}
