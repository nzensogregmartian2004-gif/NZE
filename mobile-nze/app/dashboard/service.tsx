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
  type ServiceRequest,
  type ServiceRequestStats,
  listIncomingServiceRequests,
  updateServiceRequestStatus,
  getMyServiceRequestStats,
  getMyServiceCalendar,
} from "@/lib/services-api";
import { useAutoTutorial } from "@/hooks/useAutoTutorial";

const VALIDATION_TONE = { en_attente: "warning", valide: "success", refuse: "danger", suspendu: "danger" } as const;

export default function ServiceDashboard() {
  useAutoTutorial("professional");
  const accessToken = useAuthStore((s) => s.accessToken)!;
  const [profile, setProfile] = useState<ServiceProfileDetail | null>(null);
  const [posts, setPosts] = useState<ServicePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [calendar, setCalendar] = useState<ServiceRequest[]>([]);
  const [stats, setStats] = useState<ServiceRequestStats | null>(null);
  const [savingRequestId, setSavingRequestId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState("");
  const [competencesText, setCompetencesText] = useState("");
  const [acceptedPrice, setAcceptedPrice] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

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
      if (data) {
        setMetier(data.metier);
        setZone(data.zoneIntervention ?? "");
        setTarif(data.tarifIndicatif ?? "");
        setDescription(data.description ?? "");
        setCompetencesText(data.competences.map((skill) => skill.competence).join(", "));
        const [postData, inboxData, statsData, calendarData] = await Promise.all([
          listServicePosts(data.id),
          listIncomingServiceRequests(accessToken).catch(() => [] as ServiceRequest[]),
          getMyServiceRequestStats(accessToken).catch(() => null),
          getMyServiceCalendar(accessToken).catch(() => [] as ServiceRequest[]),
        ]);
        setPosts(postData);
        setRequests(inboxData);
        setStats(statsData);
        setCalendar(calendarData);
      } else {
        setRequests([]); setCalendar([]); setStats(null); setPosts([]);
      }
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
        metier: metier.trim(),
        zoneIntervention: zone.trim() || undefined,
        tarifIndicatif: tarif.trim() || undefined,
        description: description.trim() || undefined,
        competences: competencesText.split(",").map((value) => value.trim()).filter(Boolean),
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

  async function saveProfile() {
    if (!profile) return;
    setSavingProfile(true);
    try {
      await updateServiceProfile(accessToken, profile.id, {
        metier: metier.trim(),
        zoneIntervention: zone.trim() || undefined,
        tarifIndicatif: tarif.trim() || undefined,
        description: description.trim() || undefined,
        competences: competencesText.split(",").map((value) => value.trim()).filter(Boolean),
      });
      setEditing(false);
      await load();
      Alert.alert("Profil mis à jour", "Tes informations professionnelles ont été enregistrées.");
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible de modifier le profil");
    } finally { setSavingProfile(false); }
  }

  async function updateRequest(request: ServiceRequest, action: "accepter" | "refuser" | "commencer" | "terminer") {
    setSavingRequestId(request.id);
    try {
      const price = acceptedPrice.trim() ? Number(acceptedPrice.replace(",", ".")) : undefined;
      if (action === "accepter" && acceptedPrice.trim() && (!Number.isFinite(price) || (price ?? -1) < 0)) {
        Alert.alert("Prix invalide", "Saisis un montant XAF positif ou laisse vide.");
        return;
      }
      await updateServiceRequestStatus(accessToken, request.id, {
        action,
        ...(action === "accepter" && price !== undefined ? { prixAccepte: price } : {}),
        ...(action === "accepter" && request.dateSouhaitee ? { dateConfirmee: request.dateSouhaitee } : {}),
      });
      setAcceptedPrice("");
      await load();
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible de mettre à jour la demande");
    } finally { setSavingRequestId(null); }
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
          <Input label="Description professionnelle" value={description} onChangeText={setDescription} multiline placeholder="Expérience, services proposés..." />
          <Input label="Compétences (séparées par des virgules)" value={competencesText} onChangeText={setCompetencesText} placeholder="Installation, diagnostic, maintenance" />
          <Button label="Créer" onPress={handleCreateProfile} loading={creating} fullWidth />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Button label="Abonnements et promotions" variant="secondary" onPress={() => router.push("/dashboard/monetisation")} fullWidth />

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

        <Card style={{ gap: spacing.sm }}>
          <Text variant="h3">Mon profil professionnel</Text>
          {editing ? (
            <>
              <Input label="Métier" value={metier} onChangeText={setMetier} />
              <Input label="Zone d'intervention" value={zone} onChangeText={setZone} />
              <Input label="Tarif indicatif" value={tarif} onChangeText={setTarif} />
              <Input label="Description" value={description} onChangeText={setDescription} multiline />
              <Input label="Compétences séparées par des virgules" value={competencesText} onChangeText={setCompetencesText} multiline />
              <Button label="Enregistrer le profil" onPress={saveProfile} loading={savingProfile} />
              <Button label="Annuler" variant="ghost" onPress={() => { setEditing(false); void load(); }} />
            </>
          ) : (
            <>
              <Text variant="bodySm">{profile.description || "Aucune description"}</Text>
              <Button label="Modifier mes informations" variant="secondary" onPress={() => setEditing(true)} />
            </>
          )}
        </Card>

        {stats && (
          <Card style={{ gap: spacing.sm }}>
            <Text variant="h3">Mon activité</Text>
            <Text variant="bodySm">Vues du profil : {stats.vuesProfil}</Text>
            <Text variant="bodySm">Demandes reçues : {stats.totalDemandes} · En attente : {stats.demandesRecues}</Text>
            <Text variant="bodySm">En cours : {stats.prestationsEnCours} · Terminées : {stats.prestationsTerminees}</Text>
            <Text variant="bodySm">Avis reçus : {stats.avisRecus}</Text>
            <Text variant="bodySm">Valeur convenue des prestations terminées : {stats.valeurConvenuePrestationsTermineesXAF.toLocaleString()} XAF</Text>
            <Text variant="caption" color={colors.inkSoft}>{stats.avertissementFinancier}</Text>
          </Card>
        )}

        <View style={{ gap: spacing.md }}>
          <Text variant="h3">Calendrier des rendez-vous</Text>
          {calendar.length === 0 ? <Text variant="bodySm" color={colors.inkSoft}>Aucun rendez-vous confirmé dans les 90 prochains jours.</Text> : calendar.map((event) => (
            <Card key={event.id} style={{ gap: spacing.xs }}>
              <Text variant="body">{event.client ? `${event.client.prenom} ${event.client.nom}` : "Client"}</Text>
              <Text variant="bodySm">{event.dateConfirmee ? new Date(event.dateConfirmee).toLocaleString() : "Date à confirmer"}</Text>
              <Text variant="caption" color={colors.inkSoft}>{event.description}</Text>
            </Card>
          ))}
        </View>

        <View style={{ gap: spacing.md }}>
          <Text variant="h3">Demandes reçues</Text>
          <Input label="Prix XAF à proposer lors de l'acceptation (facultatif)" value={acceptedPrice} onChangeText={setAcceptedPrice} keyboardType="decimal-pad" placeholder="Ex. 30000" />
          {requests.length === 0 ? <Text variant="bodySm" color={colors.inkSoft}>Aucune demande reçue pour le moment.</Text> : requests.map((request) => (
            <Card key={request.id} style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}>
                <Text variant="h3" style={{ flex: 1 }}>{request.client ? `${request.client.prenom} ${request.client.nom}` : "Client"}</Text>
                <Badge label={request.statut} tone={request.statut === "recu" ? "warning" : request.statut === "terminee" ? "success" : "neutral"} />
              </View>
              {request.client?.telephone && <Text variant="bodySm">Téléphone : {request.client.telephone}</Text>}
              <Text variant="body">{request.description}</Text>
              {request.lieuIntervention && <Text variant="bodySm">Lieu : {request.lieuIntervention}</Text>}
              {request.dateSouhaitee && <Text variant="bodySm">Date souhaitée : {new Date(request.dateSouhaitee).toLocaleString()}</Text>}
              {request.budgetIndicatif && <Text variant="bodySm">Budget annoncé : {Number(request.budgetIndicatif).toLocaleString()} XAF</Text>}
              {request.commentairePrestataire && <Text variant="bodySm">Ta réponse : {request.commentairePrestataire}</Text>}
              {request.statut === "recu" && <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Button label="Accepter" onPress={() => void updateRequest(request, "accepter")} loading={savingRequestId === request.id} />
                <Button label="Refuser" variant="secondary" onPress={() => void updateRequest(request, "refuser")} loading={savingRequestId === request.id} />
              </View>}
              {request.statut === "acceptee" && <Button label="Commencer la prestation" onPress={() => void updateRequest(request, "commencer")} loading={savingRequestId === request.id} />}
              {request.statut === "en_cours" && <Button label="Marquer terminée" onPress={() => Alert.alert("Terminer la prestation ?", "Cette action permettra au client de laisser un avis.", [{ text: "Continuer le travail", style: "cancel" }, { text: "Terminer", onPress: () => void updateRequest(request, "terminer") }])} loading={savingRequestId === request.id} />}
            </Card>
          ))}
        </View>

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
