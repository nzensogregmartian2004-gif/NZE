import { useMemo, useState } from "react";
import { Alert, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { createServiceRequest } from "@/lib/services-api";

export default function ServiceRequestFormScreen() {
  const { serviceProfileId } = useLocalSearchParams<{ serviceProfileId: string }>();
  const token = useAuthStore((s) => s.accessToken);
  const [description, setDescription] = useState("");
  const [dateText, setDateText] = useState("");
  const [location, setLocation] = useState("");
  const [budgetText, setBudgetText] = useState("");
  const [sending, setSending] = useState(false);

  const budget = useMemo(() => budgetText.trim() ? Number(budgetText.replace(",", ".")) : undefined, [budgetText]);

  async function submit() {
    if (!token) {
      Alert.alert("Connexion requise", "Connecte-toi pour envoyer une demande de prestation.");
      return;
    }
    if (description.trim().length < 10) {
      Alert.alert("Description trop courte", "Décris ton besoin en au moins 10 caractères.");
      return;
    }
    if (budgetText.trim() && (!Number.isFinite(budget) || (budget ?? -1) < 0)) {
      Alert.alert("Budget invalide", "Saisis un montant en XAF positif ou laisse ce champ vide.");
      return;
    }
    let dateSouhaitee: string | undefined;
    if (dateText.trim()) {
      const parsed = new Date(dateText);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        Alert.alert("Date invalide", "Saisis une date future, par exemple 2026-11-10 09:00.");
        return;
      }
      dateSouhaitee = parsed.toISOString();
    }

    setSending(true);
    try {
      await createServiceRequest(token, {
        serviceProfileId,
        description: description.trim(),
        dateSouhaitee,
        lieuIntervention: location.trim() || undefined,
        budgetIndicatif: budget,
      });
      Alert.alert("Demande envoyée", "Le prestataire pourra accepter ou refuser ta demande.", [
        { text: "Voir mes demandes", onPress: () => router.replace("/my-service-requests") },
      ]);
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible d'envoyer la demande.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h1">Demander une prestation</Text>
        <Text variant="body" color={colors.inkSoft}>Décris le travail souhaité. Le prestataire confirmera la date et, si besoin, le prix convenu.</Text>
        <Card style={{ gap: spacing.md }}>
          <Input label="Description du besoin *" value={description} onChangeText={setDescription} multiline numberOfLines={5} textAlignVertical="top" placeholder="Explique le travail, les contraintes et le résultat attendu..." />
          <Input label="Date souhaitée (facultatif)" value={dateText} onChangeText={setDateText} placeholder="2026-11-10 09:00" autoCapitalize="none" />
          <Input label="Lieu d'intervention (facultatif)" value={location} onChangeText={setLocation} placeholder="Quartier, ville ou repère" />
          <Input label="Budget indicatif en XAF (facultatif)" value={budgetText} onChangeText={setBudgetText} keyboardType="decimal-pad" placeholder="Ex. 25000" />
          <Button label="Envoyer la demande" onPress={submit} loading={sending} fullWidth />
        </Card>
      </ScrollView>
    </Screen>
  );
}
