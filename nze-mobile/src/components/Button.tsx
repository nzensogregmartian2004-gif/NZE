import { Pressable, ActivityIndicator, type PressableProps } from "react-native";
import { colors, radius, spacing, typography } from "@/theme";
import { Text } from "./Text";

type Variant = "primary" | "secondary" | "ghost";

type Props = Omit<PressableProps, "children"> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
};

export function Button({ label, variant = "primary", loading, fullWidth, disabled, style, ...rest }: Props) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        fullWidth && { alignSelf: "stretch" },
        pressed && !isDisabled && pressedStyles[variant],
        isDisabled && { opacity: 0.5 },
        style as any,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.white : colors.primary} />
      ) : (
        <Text variant="button" color={textColor[variant]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = {
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    flexDirection: "row" as const,
  },
};

const variantStyles: Record<Variant, object> = {
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.primary },
  ghost: { backgroundColor: "transparent" },
};

const pressedStyles: Record<Variant, object> = {
  primary: { backgroundColor: colors.primaryMuted },
  secondary: { backgroundColor: colors.primaryTint },
  ghost: { backgroundColor: colors.primaryTint },
};

const textColor: Record<Variant, string> = {
  primary: colors.white,
  secondary: colors.primary,
  ghost: colors.primary,
};
