import { useState } from "react";
import { ScrollView, View, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { createRefund, REFUND_MOTIF_LABELS, type Refund, type RefundMotif } from "@/lib/refunds-api";

/** Demande de remboursement d'une commande payée en ligne. Délai annoncé : 72 heures. */
export default function RefundRequestScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [motif, setMotif] = useState<RefundMotif>("produit_non_fonctionnel");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Refund | null>(null);

  async function envoyer() {
    if (!accessToken || !orderId) return;
    setBusy(true);
    setError(null);
    try {
      const refund = await createRefund(accessToken, { orderId, motif, description: description.trim() || undefined });
      setCreated(refund);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Demande impossible pour le moment. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
          <Text variant="h2">Demande enregistrée</Text>
          <Card>
            <Text variant="body">Montant demandé : {created.montantDemande} FCFA</Text>
            <Text variant="bodySm" color={colors.inkSoft}>
              Le vendeur décide sous 72 heures : remplacement du produit ou remboursement. Tu seras prévenu à chaque étape.
            </Text>
            <Text variant="caption" color={colors.inkSoft}>
              Échéance : {new Date(created.echeanceLe).toLocaleString("fr-FR")}
            </Text>
          </Card>
          <Button label="Retour à la commande" onPress={() => router.back()} fullWidth />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Text variant="h2">Demander un remboursement</Text>
        <Text variant="body" color={colors.inkSoft}>
          Le montant des articles payés sera remboursé si le vendeur accepte. Les frais de livraison ne sont pas inclus.
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {(Object.keys(REFUND_MOTIF_LABELS) as RefundMotif[]).map((option) => (
            <Pressable key={option} onPress={() => setMotif(option)}
              style={{ borderRadius: 22, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: motif === option ? colors.primary : colors.primaryTint }}>
              <Text variant="caption" color={motif === option ? colors.white : colors.primary}>{REFUND_MOTIF_LABELS[option]}</Text>
            </Pressable>
          ))}
        </View>

        <Input label="Explique le problème (facultatif)" value={description} onChangeText={setDescription} placeholder="Ex. le moteur ne démarre pas" />

        {error && <Text variant="bodySm" color={colors.danger}>{error}</Text>}

        <Button label="Envoyer la demande" onPress={envoyer} loading={busy} disabled={busy} fullWidth />
      </ScrollView>
    </Screen>
  );
}
