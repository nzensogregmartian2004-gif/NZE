import { useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { colors, radius, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { createActivity, type ActivityType } from "@/lib/auth-api";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

const OPTIONS: Array<{ type: ActivityType; emoji: string; label: string; description: string }> = [
  { type: "client", emoji: "👤", label: "Client", description: "Acheter, commander, réserver" },
  { type: "commercant", emoji: "🏪", label: "Commerçant", description: "Vendre des produits dans un magasin" },
  { type: "prestataire", emoji: "👷", label: "Prestataire", description: "Proposer un service (électricien, coiffeur...)" },
  { type: "livreur", emoji: "🚚", label: "Livreur", description: "Effectuer des livraisons" },
  { type: "loueur", emoji: "🚗", label: "Loueur de véhicules", description: "Proposer des voitures, motos ou camions à louer" },
  { type: "hebergeur", emoji: "🏨", label: "Hébergeur", description: "Publier des chambres, appartements, maisons ou hôtels" },
];

export default function ChooseActivitiesScreen() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const [selected, setSelected] = useState<Set<ActivityType>>(new Set(["client"]));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggle(type: ActivityType) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  async function handleContinue() {
    if (!accessToken) return;
    if (selected.size === 0) {
      setError("Choisis au moins une activité pour continuer");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      for (const type of selected) {
        await createActivity(accessToken, type);
      }
      await refreshMe();
      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer tes activités");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={{ padding: spacing.lg, gap: spacing.lg, flex: 1 }}>
        <Text variant="h1">Que veux-tu faire sur NZE ?</Text>
        <Text variant="body" color={colors.inkSoft}>
          Tu peux choisir plusieurs activités et en ajouter d'autres plus tard.
        </Text>

        <ScrollView contentContainerStyle={{ gap: spacing.sm }}>
          {OPTIONS.map((option) => {
            const isSelected = selected.has(option.type);
            return (
              <Pressable
                key={option.type}
                onPress={() => toggle(option.type)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: spacing.lg,
                  borderRadius: radius.lg,
                  borderWidth: 1.5,
                  borderColor: isSelected ? colors.primary : colors.line,
                  backgroundColor: isSelected ? colors.primaryTint : colors.white,
                }}
              >
                <Text style={{ fontSize: 24 }}>{option.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text variant="body" style={{ fontFamily: "PlusJakartaSans_600SemiBold" }}>
                    {option.label}
                  </Text>
                  <Text variant="bodySm" color={colors.inkSoft}>
                    {option.description}
                  </Text>
                </View>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: radius.full,
                    borderWidth: 1.5,
                    borderColor: isSelected ? colors.primary : colors.line,
                    backgroundColor: isSelected ? colors.primary : "transparent",
                  }}
                />
              </Pressable>
            );
          })}
        </ScrollView>

        {error && (
          <Text variant="bodySm" color={colors.danger}>
            {error}
          </Text>
        )}

        <Button label="Continuer" onPress={handleContinue} loading={loading} fullWidth />
      </View>
    </Screen>
  );
}
