import { View } from "react-native";
import { colors, radius, spacing } from "@/theme";
import { Text } from "./Text";

type Tone = "primary" | "success" | "warning" | "danger" | "neutral";

const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  primary: { bg: colors.primaryTint, fg: colors.primary },
  success: { bg: colors.successTint, fg: colors.success },
  warning: { bg: colors.warningTint, fg: colors.warning },
  danger: { bg: colors.dangerTint, fg: colors.danger },
  neutral: { bg: colors.bg, fg: colors.inkSoft },
};

export function Badge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const { bg, fg } = toneStyles[tone];
  return (
    <View
      style={{
        backgroundColor: bg,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.full,
        alignSelf: "flex-start",
      }}
    >
      <Text variant="caption" color={fg} style={{ fontFamily: "PlusJakartaSans_600SemiBold" }}>
        {label}
      </Text>
    </View>
  );
}
