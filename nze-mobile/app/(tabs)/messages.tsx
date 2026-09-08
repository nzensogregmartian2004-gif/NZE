import { useEffect, useState, useCallback } from "react";
import { View, FlatList, RefreshControl, Pressable } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Card } from "@/components/Card";
import { useAuthStore } from "@/store/auth";
import { listConversations, type Conversation } from "@/lib/messaging-api";

export default function MessagesScreen() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setRefreshing(true);
    try {
      setConversations(await listConversations(accessToken));
    } finally {
      setRefreshing(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <Screen>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Text variant="h2">Messages</Text>
      </View>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: spacing["3xl"] }}>
            <Text style={{ fontSize: 32, marginBottom: spacing.sm }}>💬</Text>
            <Text variant="body" color={colors.inkSoft}>
              Aucune conversation pour l'instant.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/conversation/${item.id}`)}>
            <Card>
              <Text variant="body">Conversation</Text>
              <Text variant="caption" color={colors.inkSoft}>
                {new Date(item.creeLe).toLocaleDateString("fr-FR")}
              </Text>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}
