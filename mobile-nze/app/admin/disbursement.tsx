import { useRef, useState } from "react";
import { Alert, Pressable, ScrollView, TextInput, View } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { createDisbursement, type DisbursementResult } from "@/lib/payments-api";

const OPERATORS = [{ code: "AIRTEL_MONEY", label: "Airtel Money" }, { code: "MOOV_MONEY", label: "Moov Money" }];
function newRequestKey() { return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 17); }

export default function AdminDisbursementScreen() {
  const accessToken = useAuthStore((state) => state.accessToken)!;
  const [recipientUserId, setRecipientUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [operatorCode, setOperatorCode] = useState("AIRTEL_MONEY");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DisbursementResult | null>(null);
  const requestKey = useRef(newRequestKey());

  async function submit() {
    const numericAmount = Number(amount);
    if (!recipientUserId.trim() || !Number.isInteger(numericAmount) || numericAmount <= 0 || !phone.trim()) {
      Alert.alert("Informations requises", "Renseigne l'identifiant du bénéficiaire, un montant entier positif et son numéro mobile.");
      return;
    }
    setSubmitting(true);
    try {
      const value = await createDisbursement(accessToken, {
        requestKey: requestKey.current,
        recipientUserId: recipientUserId.trim(),
        amount: numericAmount,
        customerAccountNumber: phone.trim(),
        operatorCode,
        note: note.trim() || undefined,
      });
      setResult(value);
      Alert.alert("Résultat MyPVit", value.message);
      // Une nouvelle référence n'est créée qu'après une réponse reçue du serveur.
      if (!value.reusedExistingAttempt && value.payment.statut !== "incertain") requestKey.current = newRequestKey();
    } catch (error) {
      Alert.alert("Décaissement non confirmé", error instanceof ApiError ? error.message : "Impossible de confirmer le résultat. Réessaie avec la même demande après vérification.");
    } finally { setSubmitting(false); }
  }

  return <Screen><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
    <Button label="← Administration" variant="ghost" onPress={() => router.back()} />
    <Text variant="h1">Décaissement Mobile Money</Text>
    <Text variant="bodySm" color={colors.inkSoft}>Opération réservée à l’administration. Le décaissement reste désactivé tant que MyPVit n’a pas confirmé que GIVE_CHANGE peut servir à des paiements sortants indépendants.</Text>
    <Card style={{ gap: spacing.md }}>
      <Text variant="label">Identifiant utilisateur du bénéficiaire</Text>
      <TextInput value={recipientUserId} onChangeText={setRecipientUserId} placeholder="UUID du compte bénéficiaire" autoCapitalize="none" style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: spacing.md, color: colors.ink, backgroundColor: colors.white }} />
      <Text variant="label">Montant en FCFA (entier)</Text>
      <TextInput value={amount} onChangeText={setAmount} placeholder="Ex. 15000" keyboardType="number-pad" style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: spacing.md, color: colors.ink, backgroundColor: colors.white }} />
      <Text variant="label">Numéro Mobile Money du bénéficiaire</Text>
      <TextInput value={phone} onChangeText={setPhone} placeholder="Ex. 074 11 11 11" keyboardType="phone-pad" style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: spacing.md, color: colors.ink, backgroundColor: colors.white }} />
      <Text variant="label">Opérateur</Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {OPERATORS.map((operator) => { const selected = operatorCode === operator.code; return <Pressable key={operator.code} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setOperatorCode(operator.code)} style={{ flex: 1, padding: spacing.md, borderRadius: 12, borderWidth: 1, borderColor: selected ? colors.primary : colors.line, backgroundColor: selected ? colors.primaryTint : colors.white }}><Text variant="label" color={selected ? colors.primary : colors.ink}>{operator.label}</Text></Pressable>; })}
      </View>
      <Text variant="label">Motif (facultatif)</Text>
      <TextInput value={note} onChangeText={setNote} placeholder="Ex. Versement commerçant" maxLength={140} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: spacing.md, color: colors.ink, backgroundColor: colors.white }} />
      <Button label="Envoyer la demande de décaissement" onPress={() => void submit()} loading={submitting} disabled={submitting} fullWidth />
    </Card>
    {result ? <Card style={{ gap: spacing.sm }}><Text variant="h3">Dernière demande</Text><Text variant="bodySm">{result.message}</Text><Text variant="bodySm" color={colors.inkSoft}>Statut : {result.payment.statut}</Text><Text variant="bodySm" color={colors.inkSoft}>Référence NZE : {result.payment.merchantReference}</Text>{result.payment.providerReference ? <Text variant="bodySm" color={colors.inkSoft}>Référence MyPVit : {result.payment.providerReference}</Text> : null}</Card> : null}
    <Text variant="caption" color={colors.danger}>En cas de statut incertain, ne crée pas une nouvelle référence et ne relance pas l’opération avant vérification chez MyPVit.</Text>
  </ScrollView></Screen>;
}
