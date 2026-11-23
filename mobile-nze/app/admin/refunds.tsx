import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
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
  listAdminRefunds,
  confirmRefund,
  REFUND_MOTIF_LABELS,
  REFUND_STATUS_LABELS,
  type Refund,
} from "@/lib/refunds-api";

type Filter = "a_confirmer" | "en_retard" | "toutes";
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "a_confirmer", label: "À confirmer" },
  { value: "en_retard", label: "En retard" },
  { value: "toutes", label: "Toutes" },
];

/** Finance : confirmation des virements de remboursement. Seul ce passage marque un remboursement comme effectué. */
export default function AdminRefundsScreen() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [filter, setFilter] = useState<Filter>("a_confirmer");
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [references, setReferences] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const options = filter === "en_retard"
        ? { enRetard: true }
        : filter === "a_confirmer"
          ? { statut: "remboursement_a_executer" as const }
          : {};
      setRefunds(await listAdminRefunds(accessToken, options));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les demandes.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  function confirmer(refund: Refund) {
    const reference = (references[refund.id] ?? "").trim();
    if (reference.length < 3) {
      Alert.alert("Référence requise", "Saisis la référence du virement effectué (3 caractères minimum).");
      return;
    }
    Alert.alert(
      "Confirmer le virement",
      `Confirmes-tu avoir envoyé ${refund.montantDemande} FCFA au client (réf. ${reference}) ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer",
          onPress: async () => {
            if (!accessToken) return;
            setBusyId(refund.id);
            try {
              await confirmRefund(accessToken, refund.id, reference);
              await load();
            } catch (err) {
              Alert.alert("Confirmation impossible", err instanceof ApiError ? err.message : "Réessaie dans un instant.");
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h2">Remboursements</Text>
        <Text variant="bodySm" color={colors.inkSoft}>
          Un remboursement n'est affiché comme effectué qu'après confirmation du virement ici.
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {FILTERS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setFilter(option.value)}
              style={{ borderRadius: 22, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: filter === option.value ? colors.primary : colors.primaryTint }}
            >
              <Text variant="caption" color={filter === option.value ? colors.white : colors.primary}>{option.label}</Text>
            </Pressable>
          ))}
        </View>

        {loading && <ActivityIndicator color={colors.primary} />}
        {error && <Text variant="bodySm" color={colors.danger}>{error}</Text>}
        {!loading && !error && refunds.length === 0 && (
          <Text variant="body" color={colors.inkSoft}>Aucune demande dans cette liste.</Text>
        )}

        {refunds.map((refund) => {
          const aConfirmer = refund.statut === "remboursement_a_executer";
          return (
            <Card key={refund.id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm }}>
                <Text variant="label">Commande #{refund.orderId.slice(0, 8)}</Text>
                {refund.enRetard ? <Badge label="En retard" tone="warning" /> : <Badge label={REFUND_STATUS_LABELS[refund.statut]} tone="primary" />}
              </View>
              <Text variant="body">{refund.montantDemande} FCFA · {REFUND_MOTIF_LABELS[refund.motif]}</Text>
              <Text variant="caption" color={colors.inkSoft}>Échéance : {new Date(refund.echeanceLe).toLocaleString("fr-FR")}</Text>
              {refund.referenceVirement && (
                <Text variant="caption" color={colors.inkSoft}>
                  Virement {refund.referenceVirement}{refund.confirmeLe ? ` · confirmé le ${new Date(refund.confirmeLe).toLocaleString("fr-FR")}` : ""}
                </Text>
              )}

              {aConfirmer && (
                <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                  <Input
                    label="Référence du virement"
                    value={references[refund.id] ?? ""}
                    onChangeText={(value) => setReferences((current) => ({ ...current, [refund.id]: value }))}
                    placeholder="Ex. TRX-2026-0001"
                  />
                  <Button
                    label="Confirmer le virement effectué"
                    onPress={() => confirmer(refund)}
                    disabled={busyId === refund.id}
                    fullWidth
                  />
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
