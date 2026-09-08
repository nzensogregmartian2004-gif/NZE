import { View } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "./Screen";
import { Text } from "./Text";
import { Button } from "./Button";

type Props = {
  emoji: string;
  title: string;
  description: string;
};

/** Écran de transition pour les univers pas encore construits en détail. */
export function PlaceholderScreen({ emoji, title, description }: Props) {
  return (
    <Screen>
      <View style={{ flex: 1, padding: spacing.lg, justifyContent: "space-between" }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <View style={{ alignItems: "center", gap: spacing.md }}>
          <Text style={{ fontSize: 48 }}>{emoji}</Text>
          <Text variant="h1" style={{ textAlign: "center" }}>
            {title}
          </Text>
          <Text variant="body" color={colors.inkSoft} style={{ textAlign: "center" }}>
            {description}
          </Text>
        </View>
        <View />
      </View>
    </Screen>
  );
}
