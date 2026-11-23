import { SafeAreaView, type ViewProps } from "react-native";
import { couleurs } from "@/theme";

export function Screen({ style, ...rest }: ViewProps) {
  return <SafeAreaView style={[{ flex: 1, backgroundColor: couleurs.blanc }, style]} {...rest} />;
}
