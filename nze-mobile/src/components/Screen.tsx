import { SafeAreaView, type ViewProps } from "react-native";
import { colors } from "@/theme";

export function Screen({ style, ...rest }: ViewProps) {
  return <SafeAreaView style={[{ flex: 1, backgroundColor: colors.white }, style]} {...rest} />;
}
