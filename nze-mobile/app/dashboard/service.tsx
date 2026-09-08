import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";
import {
  getMyServiceProfile,
  createServiceProfile,
  updateServiceProfile,
  listServicePosts,
  createServicePost,
  type ServiceProfileDetail,
  type ServicePost,
} from "@/lib/services-api";

const VALIDATION_TONE = { en_attente: "warning", valide: "success", refuse: "danger", suspendu: "danger" } as const;

export default function ServiceDashboard() {
  const accessToken = useAuthStore((s) => s.accessToken)!;
  const [profile, setProfile] = useState<ServiceProfileDetail | null>(null);
  const [posts, setPosts] = useState<ServicePost[]>([]);
  const [loading, setLoading] = useState(true);

  const [metier, setMetier] = useState("");
  const [zone, setZone] = useState("");
  const [tarif, setTarif] = useState("");
  const [creating, setCreating] = useState(false);

  const [postTitre, setPostTitre] = useState("");
  const [postDescription, setPostDescription] = useState("");
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyServiceProfile(accessToken);
      setProfile(data);
      if (data) setPosts(await listServicePosts(data.id));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreateProfile() {
    if (!metier.trim()) return;
    setCreating(true);
    try {
      await createServiceProfile(accessToken, {
        metier,
        zoneIntervention: zone || undefined,
        tarifIndicatif: tarif || undefined,
      });
      await load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible de créer le profil");
    } finally {
      setCreating(false);
    }
  }

  async function toggleAvailability() {
    if (!profile) return;
    try {
      await updateServiceProfile(accessToken, profile.id, { disponible: !profile.disponible });
      await load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible de mettre à jour");
    }
  }

  async function handlePublish() {
    if (!profile || !postTitre.trim()) return;
    setPublishing(true);
    try {
      await createServicePost(accessToken, profile.id, { titre: postTitre, description: postDescription || undefined });
      setPostTitre("");
      setPostDescription("");
      await load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible de publier");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
          <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
          <Text variant="h1">Créer mon profil prestataire</Text>
          <Input label="Métier" value={metier} onChangeText={setMetier} placeholder="Ex. Électricien" />
          <Input label="Zone d'intervention" value={zone} onChangeText={setZone} placeholder="Ex. Libreville centre" />
          <Input label="Tarif indicatif" value={tarif} onChangeText={setTarif} placeholder="Ex. À partir de 15 000 FCFA" />
          <Button label="Créer" onPress={handleCreateProfile} loading={creating} fullWidth />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />

        <View style={{ gap: spacing.xs }}>
          <Text variant="h1">{profile.metier}</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Badge label={profile.statutValidation} tone={VALIDATION_TONE[profile.statutValidation as keyof typeof VALIDATION_TONE]} />
            <Badge label={profile.disponible ? "Disponible" : "Indisponible"} tone={profile.disponible ? "success" : "neutral"} />
          </View>
        </View>

        <Button
          label={profile.disponible ? "Me marquer indisponible" : "Me marquer disponible"}
          variant="secondary"
          onPress={toggleAvailability}
        />

        <View style={{ gap: spacing.md }}>
          <Text variant="h3">Réalisations</Text>
          {posts.map((post) => (
            <Card key={post.id}>
              <Text variant="body">{post.titre}</Text>
            </Card>
          ))}

          <Card style={{ gap: spacing.sm }}>
            <Text variant="label" color={colors.inkSoft}>
              PUBLIER UNE RÉALISATION
            </Text>
            <Input placeholder="Titre" value={postTitre} onChangeText={setPostTitre} />
            <Input placeholder="Description" value={postDescription} onChangeText={setPostDescription} />
            <Button label="Publier" variant="secondary" onPress={handlePublish} loading={publishing} />
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}
