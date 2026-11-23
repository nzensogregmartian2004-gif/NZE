import { Text as RNText, type TextProps } from "react-native";
import { typography, type TypographyToken, couleurs } from "@/theme";

type Props = TextProps & {
  variant?: TypographyToken;
  color?: string;
};

export function Text({ variant = "body", color = couleurs.texte, style, ...rest }: Props) {
  return <RNText style={[typography[variant], { color }, style]} {...rest} />;
}
