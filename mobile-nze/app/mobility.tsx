import { View } from "react-native";
import { router } from "expo-router";
import { spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { UniverseCard } from "@/components/UniverseCard";

export default function MobilityScreen() {
  return (
    <Screen>
      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h1">Mobilité</Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
          <UniverseCard
            emoji="🚗"
            title="Location"
            subtitle="Louer un véhicule pour plusieurs jours"
            onPress={() => router.push("/vehicles")}
          />
        </View>
      </View>
    </Screen>
  );
}
