import { Text as RNText, type TextProps } from "react-native";
import { colors, typography, type TypographyToken } from "@/theme";

type Props = TextProps & {
  variant?: TypographyToken;
  color?: string;
};

export function Text({ variant = "body", color = colors.ink, style, ...rest }: Props) {
  return <RNText style={[typography[variant], { color }, style]} {...rest} />;
}
