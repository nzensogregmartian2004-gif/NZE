import { useCallback, useEffect, useState } from "react";
import { View, FlatList, ActivityIndicator, Pressable } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { listServiceProfiles, type ServiceProfile } from "@/lib/services-api";
import { ApiError } from "@/lib/api";

export default function ServicesScreen() {
  const [metier, setMetier] = useState("");
  const [profiles, setProfiles] = useState<ServiceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (metierFilter?: string) => {
    setLoading(true);
    setError(null);
    try {
      setProfiles(await listServiceProfiles({ metier: metierFilter || undefined }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les prestataires");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h1">Services</Text>
        <Input
          placeholder="Électricien, plombier, coiffeur..."
          value={metier}
          onChangeText={setMetier}
          onSubmitEditing={() => load(metier)}
          returnKeyType="search"
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <Text variant="body" color={colors.danger} style={{ padding: spacing.lg }}>
          {error}
        </Text>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md }}
          ListEmptyComponent={
            <Text variant="body" color={colors.inkSoft} style={{ textAlign: "center", marginTop: spacing.xl }}>
              Aucun prestataire trouvé.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/service/${item.id}`)}>
              <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: colors.primaryTint,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 24 }}>👷</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="body" style={{ fontFamily: "PlusJakartaSans_600SemiBold" }}>
                    {item.metier}
                  </Text>
                  {item.zoneIntervention && (
                    <Text variant="bodySm" color={colors.inkSoft} numberOfLines={1}>
                      📍 {item.zoneIntervention}
                    </Text>
                  )}
                  {item.noteMoyenne && (
                    <Text variant="caption" color={colors.inkSoft}>
                      ⭐ {Number(item.noteMoyenne).toFixed(1)}
                    </Text>
                  )}
                </View>
                <Badge label={item.disponible ? "Disponible" : "Indisponible"} tone={item.disponible ? "success" : "neutral"} />
              </Card>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
