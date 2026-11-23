import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator, Pressable, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { colors, radius, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { getServiceProfile, listServicePosts, listServiceReviews, type ServiceProfileDetail, type ServicePost, type ServiceReview } from "@/lib/services-api";
import { createConversation } from "@/lib/messaging-api";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";

export default function ServiceProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [profile, setProfile] = useState<ServiceProfileDetail | null>(null);
  const [posts, setPosts] = useState<ServicePost[]>([]);
  const [reviews, setReviews] = useState<ServiceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [contacting, setContacting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileData, postsData, reviewData] = await Promise.all([getServiceProfile(id), listServicePosts(id), listServiceReviews(id)]);
      setProfile(profileData);
      setPosts(postsData);
      setReviews(reviewData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Profil introuvable");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleContact() {
    if (!accessToken || !profile?.userId) return;
    setContacting(true);
    try {
      const conversation = await createConversation(accessToken, [profile.userId]);
      router.push(`/conversation/${conversation.id}`);
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible de démarrer la conversation");
    } finally {
      setContacting(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  if (error || !profile) {
    return (
      <Screen>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
          <Text variant="body" color={colors.danger}>
            {error ?? "Profil introuvable"}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: colors.primaryTint,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 32 }}>👷</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="h2">{profile.metier}</Text>
            {profile.zoneIntervention && (
              <Text variant="bodySm" color={colors.inkSoft}>
                📍 {profile.zoneIntervention}
              </Text>
            )}
            <Badge label={profile.disponible ? "Disponible" : "Indisponible"} tone={profile.disponible ? "success" : "neutral"} />
          </View>
        </View>

        {profile.description && <Text variant="body">{profile.description}</Text>}

        {profile.tarifIndicatif && (
          <Card>
            <Text variant="label" color={colors.inkSoft}>
              TARIF INDICATIF
            </Text>
            <Text variant="body">{profile.tarifIndicatif}</Text>
          </Card>
        )}

        {profile.competences.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {profile.competences.map((c) => (
              <Badge key={c.id} label={c.competence} tone="primary" />
            ))}
          </View>
        )}

        <Button label="Contacter" onPress={handleContact} loading={contacting} fullWidth />
        {profile.disponible && accessToken && (
          <Button label="Demander une prestation" onPress={() => router.push(`/service-request/${profile.id}`)} fullWidth />
        )}
        {accessToken && <Button label="Mes demandes de prestations" variant="secondary" onPress={() => router.push("/my-service-requests")} fullWidth />}

        <View style={{ gap: spacing.md }}>
          <Text variant="h3">Avis clients</Text>
          {reviews.length === 0 ? <Text variant="bodySm" color={colors.inkSoft}>Aucun avis pour le moment.</Text> : reviews.slice(0, 10).map((review) => (
            <Card key={review.id} style={{ gap: spacing.xs }}>
              <Text variant="body">{"★".repeat(Math.max(0, Math.min(5, review.note)))}{"☆".repeat(Math.max(0, 5 - review.note))}</Text>
              {review.commentaire && <Text variant="bodySm">{review.commentaire}</Text>}
              <Text variant="caption" color={colors.inkSoft}>{review.verifie ? "Prestation vérifiée" : "Avis"} · {new Date(review.creeLe).toLocaleDateString()}</Text>
            </Card>
          ))}
        </View>

        <View style={{ gap: spacing.md }}>
          <Text variant="h3">Réalisations</Text>
          {posts.length === 0 ? (
            <Text variant="body" color={colors.inkSoft}>
              Aucune réalisation publiée pour l'instant.
            </Text>
          ) : (
            posts.map((post) => (
              <Pressable key={post.id} onPress={() => router.push(`/service-post/${post.id}`)}>
                <Card>
                  <Text variant="body" style={{ fontFamily: "PlusJakartaSans_600SemiBold" }}>
                    {post.titre}
                  </Text>
                  {post.description && (
                    <Text variant="bodySm" color={colors.inkSoft} numberOfLines={2}>
                      {post.description}
                    </Text>
                  )}
                </Card>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
