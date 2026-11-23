import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";
import {
  listStoreRefunds,
  decideRefund,
  REFUND_MOTIF_LABELS,
  REFUND_STATUS_LABELS,
  type Refund,
  type RefundDecision,
} from "@/lib/refunds-api";

const DECISIONS: Array<{ value: RefundDecision; label: string; confirm: string }> = [
  { value: "remplacement", label: "Proposer un remplacement", confirm: "Le client sera prévenu qu'un remplacement sera organisé avec toi." },
  { value: "remboursement", label: "Accepter le remboursement", confirm: "Le remboursement sera traité. Il n'apparaît comme effectué qu'après confirmation du virement." },
  { value: "refus", label: "Refuser", confirm: "Le client sera prévenu du refus avec le motif que tu as saisi." },
];

/** Demandes de remboursement de la boutique. Décision à prendre sous 72 heures. */
export default function StoreRefundsScreen() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      setRefunds(await listStoreRefunds(accessToken));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les demandes.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  function decider(refund: Refund, decision: RefundDecision) {
    const option = DECISIONS.find((item) => item.value === decision);
    if (!option) return;
    Alert.alert(option.label, option.confirm, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Confirmer",
        onPress: async () => {
          if (!accessToken) return;
          setBusyId(refund.id);
          try {
            const note = notes[refund.id]?.trim();
            await decideRefund(accessToken, refund.id, decision, decision === "refus" ? note : undefined);
            await load();
          } catch (err) {
            Alert.alert("Décision impossible", err instanceof ApiError ? err.message : "Réessaie dans un instant.");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Demandes de remboursement</Text>
        <Text variant="bodySm" color={colors.inkSoft}>
          Décide sous 72 heures : remplacement ou remboursement. Le client est prévenu à chaque étape.
        </Text>

        {loading && <ActivityIndicator color={colors.primary} />}
        {error && <Text variant="bodySm" color={colors.danger}>{error}</Text>}
        {!loading && !error && refunds.length === 0 && (
          <Text variant="body" color={colors.inkSoft}>Aucune demande de remboursement pour l'instant.</Text>
        )}

        {refunds.map((refund) => {
          const aDecider = refund.statut === "en_attente_decision";
          return (
            <Card key={refund.id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm }}>
                <Text variant="label">Commande #{refund.orderId.slice(0, 8)}</Text>
                {refund.enRetard ? <Badge label="En retard" tone="warning" /> : <Badge label={REFUND_STATUS_LABELS[refund.statut]} tone="primary" />}
              </View>
              {refund.enRetard && <Text variant="caption" color={colors.inkSoft}>{REFUND_STATUS_LABELS[refund.statut]}</Text>}
              <Text variant="body">{refund.montantDemande} FCFA · {REFUND_MOTIF_LABELS[refund.motif]}</Text>
              {refund.description && <Text variant="bodySm" color={colors.inkSoft}>{refund.description}</Text>}
              <Text variant="caption" color={colors.inkSoft}>Échéance : {new Date(refund.echeanceLe).toLocaleString("fr-FR")}</Text>

              {aDecider && (
                <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                  <Input
                    label="Motif du refus (facultatif)"
                    value={notes[refund.id] ?? ""}
                    onChangeText={(value) => setNotes((current) => ({ ...current, [refund.id]: value }))}
                    placeholder="Ex. produit conforme au test"
                  />
                  {DECISIONS.map((option) => (
                    <Button
                      key={option.value}
                      label={option.label}
                      variant={option.value === "refus" ? "secondary" : "primary"}
                      onPress={() => decider(refund, option.value)}
                      disabled={busyId === refund.id}
                      fullWidth
                    />
                  ))}
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
