import { View, TextInput, type TextInputProps } from "react-native";
import { colors, radius, spacing } from "@/theme";
import { Text } from "./Text";

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

export function Input({ label, error, style, ...rest }: Props) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label && <Text variant="label">{label}</Text>}
      <TextInput
        placeholderTextColor={colors.inkFaint}
        style={[
          {
            borderWidth: 1.5,
            borderColor: error ? colors.danger : colors.line,
            borderRadius: radius.md,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            fontFamily: "PlusJakartaSans_400Regular",
            fontSize: 16,
            color: colors.ink,
          },
          style,
        ]}
        {...rest}
      />
      {error && (
        <Text variant="caption" color={colors.danger}>
          {error}
        </Text>
      )}
    </View>
  );
}
