import { Pressable, ActivityIndicator, type PressableProps } from "react-native";
import { typography, couleurs, espaces, rayons } from "@/theme";
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
        <ActivityIndicator color={variant === "primary" ? couleurs.blanc : couleurs.violet} />
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
    paddingVertical: espaces.m,
    paddingHorizontal: espaces.xl,
    borderRadius: rayons.m,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    flexDirection: "row" as const,
  },
};

const variantStyles: Record<Variant, object> = {
  primary: { backgroundColor: couleurs.violet },
  secondary: { backgroundColor: couleurs.blanc, borderWidth: 1.5, borderColor: couleurs.violet },
  ghost: { backgroundColor: "transparent" },
};

const pressedStyles: Record<Variant, object> = {
  primary: { backgroundColor: couleurs.violetFonce },
  secondary: { backgroundColor: couleurs.violetClair },
  ghost: { backgroundColor: couleurs.violetClair },
};

const textColor: Record<Variant, string> = {
  primary: couleurs.blanc,
  secondary: couleurs.violet,
  ghost: couleurs.violet,
};
