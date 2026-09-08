import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, Image, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { getServicePost, likePost, unlikePost, type ServicePostDetail } from "@/lib/services-api";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";

export default function ServicePostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [post, setPost] = useState<ServicePostDetail | null>(null);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPost(await getServicePost(id));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleLike() {
    if (!accessToken || !post) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setPost((p) => (p ? { ...p, likes: p.likes + (wasLiked ? -1 : 1) } : p));
    try {
      if (wasLiked) await unlikePost(accessToken, post.id);
      else await likePost(accessToken, post.id);
    } catch (err) {
      // rollback silencieux en cas d'échec réseau
      setLiked(wasLiked);
      setPost((p) => (p ? { ...p, likes: p.likes + (wasLiked ? 1 : -1) } : p));
    }
  }

  if (loading || !post) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />

        {post.photos[0] && (
          <Image
            source={{ uri: post.photos[0].url }}
            style={{ width: "100%", height: 220, borderRadius: 14, backgroundColor: colors.bg }}
          />
        )}

        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Text variant="h1" style={{ flex: 1 }}>
              {post.titre}
            </Text>
            {post.travailVerifie && <Badge label="✓ Travail vérifié" tone="success" />}
          </View>
          {post.description && <Text variant="body">{post.description}</Text>}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Button label={liked ? "❤️ Aimé" : "🤍 Aimer"} variant="secondary" onPress={toggleLike} />
          <Text variant="bodySm" color={colors.inkSoft}>
            {post.likes} j'aime
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
