import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";
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
import { cancelMyServiceRequest, createServiceReview, listMyServiceRequests, type ServiceRequest } from "@/lib/services-api";

const STATUS: Record<string, { label: string; tone: "neutral" | "warning" | "success" | "danger" | "primary" }> = {
  recu: { label: "Reçue", tone: "warning" }, acceptee: { label: "Acceptée", tone: "success" },
  refusee: { label: "Refusée", tone: "danger" }, en_cours: { label: "En cours", tone: "primary" },
  terminee: { label: "Terminée", tone: "success" }, annulee: { label: "Annulée", tone: "neutral" },
};

export default function MyServiceRequestsScreen() {
  const token = useAuthStore((s) => s.accessToken);
  const [rows, setRows] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    try { setRows(await listMyServiceRequests(token)); }
    catch (err) { Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible de charger les demandes."); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function cancelRequest(id: string) {
    if (!token) return;
    try { await cancelMyServiceRequest(token, id); await load(); }
    catch (err) { Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible d'annuler la demande."); }
  }

  async function sendReview(item: ServiceRequest) {
    if (!token || !item.serviceProfileId) return;
    setSavingReview(true);
    try {
      await createServiceReview(token, { cibleId: item.serviceProfileId, note: rating, commentaire: comment.trim() || undefined });
      setReviewId(null); setComment("");
      Alert.alert("Merci", "Ton avis a été enregistré.");
      await load();
    } catch (err) { Alert.alert("Avis non envoyé", err instanceof ApiError ? err.message : "Impossible d'enregistrer l'avis."); }
    finally { setSavingReview(false); }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h1">Mes demandes de prestations</Text>
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : rows.length === 0 ? (
          <Text variant="body" color={colors.inkSoft}>Tu n'as pas encore envoyé de demande à un prestataire.</Text>
        ) : rows.map((item) => {
          const status = STATUS[item.statut] ?? STATUS.recu;
          return (
            <Card key={item.id} style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm }}>
                <Text variant="h3" style={{ flex: 1 }}>{item.serviceProfile?.metier ?? "Prestation"}</Text>
                <Badge label={status.label} tone={status.tone} />
              </View>
              <Text variant="body">{item.description}</Text>
              {item.lieuIntervention && <Text variant="bodySm" color={colors.inkSoft}>📍 {item.lieuIntervention}</Text>}
              {item.dateConfirmee && <Text variant="bodySm">Date confirmée : {new Date(item.dateConfirmee).toLocaleString()}</Text>}
              {!item.dateConfirmee && item.dateSouhaitee && <Text variant="bodySm">Date souhaitée : {new Date(item.dateSouhaitee).toLocaleString()}</Text>}
              {item.budgetIndicatif && <Text variant="bodySm">Budget indicatif : {Number(item.budgetIndicatif).toLocaleString()} XAF</Text>}
              {item.prixAccepte !== null && <Text variant="bodySm">Prix convenu : {Number(item.prixAccepte).toLocaleString()} XAF</Text>}
              {item.commentairePrestataire && <Text variant="bodySm" color={colors.inkSoft}>Réponse : {item.commentairePrestataire}</Text>}
              {(item.statut === "recu" || item.statut === "acceptee") && <Button label="Annuler la demande" variant="secondary" onPress={() => Alert.alert("Annuler la demande ?", "Cette action est définitive.", [{ text: "Garder", style: "cancel" }, { text: "Annuler la demande", style: "destructive", onPress: () => void cancelRequest(item.id) }])} />}
              {item.statut === "terminee" && (
                reviewId === item.id ? (
                  <View style={{ gap: spacing.sm }}>
                    <Text variant="label">Ta note</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                      {[1,2,3,4,5].map((n) => <Button key={n} label={`${n} ★`} variant={rating === n ? "primary" : "secondary"} onPress={() => setRating(n)} />)}
                    </View>
                    <Input label="Commentaire (facultatif)" value={comment} onChangeText={setComment} multiline placeholder="Raconte ton expérience" />
                    <Button label="Envoyer mon avis" onPress={() => void sendReview(item)} loading={savingReview} />
                  </View>
                ) : <Button label="Laisser un avis" variant="secondary" onPress={() => { setRating(5); setReviewId(item.id); }} />
              )}
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
