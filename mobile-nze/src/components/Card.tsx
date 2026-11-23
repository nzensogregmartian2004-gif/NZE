import { View, type ViewProps } from "react-native";
import { colors, radius, spacing } from "@/theme";

type Props = ViewProps & {
  padded?: boolean;
};

/**
 * Carte "plate" à bordure fine — délibérément sans ombre grise générique,
 * pour un rendu plus proche des apps mobile money d'Afrique centrale que
 * du kit SaaS-card habituel. Les ombres sont réservées aux éléments
 * flottants (voir theme/spacing.ts → shadow.floating).
 */
export function Card({ padded = true, style, ...rest }: Props) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.white,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.line,
          padding: padded ? spacing.lg : 0,
        },
        style,
      ]}
      {...rest}
    />
  );
}
