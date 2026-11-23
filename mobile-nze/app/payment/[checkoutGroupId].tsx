import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { getCheckoutPayment, initiateOrderPayment, PAYMENT_STATUS_LABELS, type CheckoutPaymentSnapshot, type PaymentStatus } from "@/lib/payments-api";

const OPERATORS = [
  { code: "AIRTEL_MONEY", label: "Airtel Money" },
  { code: "MOOV_MONEY", label: "Moov Money" },
];

function money(value: number) { return value.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " FCFA"; }
function paymentTone(status: PaymentStatus): "primary" | "success" | "danger" | "warning" {
  if (status === "reussi") return "success";
  if (status === "echoue") return "danger";
  if (status === "incertain") return "warning";
  return "primary";
}

export default function OrderPaymentScreen() {
  const { checkoutGroupId } = useLocalSearchParams<{ checkoutGroupId: string }>();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [snapshot, setSnapshot] = useState<CheckoutPaymentSnapshot | null>(null);
  const [phone, setPhone] = useState("");
  const [operatorCode, setOperatorCode] = useState("AIRTEL_MONEY");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken || !checkoutGroupId) return;
    try {
      const value = await getCheckoutPayment(accessToken, checkoutGroupId);
      setSnapshot(value);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "Impossible de lire le statut de paiement.");
    } finally { setLoading(false); }
  }, [accessToken, checkoutGroupId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function pay() {
    if (!accessToken || !checkoutGroupId) return;
    const normalizedPhone = phone.trim().replace(/[ ()-]/g, "");
    if (!/^\+?[0-9]{8,15}$/.test(normalizedPhone)) {
      Alert.alert("Numéro invalide", "Entre un numéro de téléphone valide pour Mobile Money.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await initiateOrderPayment(accessToken, checkoutGroupId, normalizedPhone, operatorCode);
      setSnapshot((current) => current ? { ...current, payment: result.payment } : current);
      Alert.alert("Statut du paiement", result.message);
      await refresh();
    } catch (error) {
      Alert.alert("Paiement indisponible", error instanceof ApiError ? error.message : "Le paiement n’a pas pu être initié.");
    } finally { setSubmitting(false); }
  }

  if (loading && !snapshot) return <Screen><ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /></Screen>;
  const status = snapshot?.payment?.statut;
  const hasCancelledOrder = Boolean(snapshot?.orders.some((order) => order.statut === "annulee"));
  const allOrdersCancelled = Boolean(snapshot?.orders.length) && snapshot!.orders.every((order) => order.statut === "annulee");
  const canStart = (!snapshot?.payment || status === "echoue") && !hasCancelledOrder;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Button label="← Mes commandes" variant="ghost" onPress={() => router.replace("/orders")} />
        <View style={{ gap: spacing.xs }}>
          <Text variant="h1">Paiement de la commande</Text>
          <Text variant="bodySm" color={colors.inkSoft}>Référence panier : {checkoutGroupId?.slice(0, 8)}</Text>
        </View>
        <Card style={{ gap: spacing.sm }}>
          <Text variant="label" color={colors.inkSoft}>TOTAL DES COMMANDES</Text>
          <Text variant="h2" color={colors.primary}>{money(Number(snapshot?.orderTotal ?? 0))}</Text>
          <Text variant="caption" color={colors.inkSoft}>Paiement Mobile Money via MyPVit. Aucun succès ne sera affiché avant la confirmation officielle.</Text>
        </Card>

        {snapshot?.payment ? <Card style={{ gap: spacing.sm }}>
          <Text variant="h3">Dernière transaction</Text>
          <Badge label={PAYMENT_STATUS_LABELS[snapshot.payment.statut]} tone={paymentTone(snapshot.payment.statut)} />
          <Text variant="bodySm" color={colors.inkSoft}>Référence NZE : {snapshot.payment.merchantReference ?? snapshot.payment.id}</Text>
          {snapshot.payment.providerReference ? <Text variant="bodySm" color={colors.inkSoft}>Référence MyPVit : {snapshot.payment.providerReference}</Text> : null}
          {snapshot.payment.statut === "incertain" ? <Text variant="bodySm" color={colors.danger}>Ne lance pas une autre tentative avant vérification : la transaction peut avoir été reçue par MyPVit.</Text> : null}
          <Button label="Actualiser le statut" variant="secondary" onPress={() => void refresh()} loading={loading} fullWidth />
        </Card> : null}

        {hasCancelledOrder ? <Card style={{ gap: spacing.md }}>
          <Text variant="h3">{allOrdersCancelled ? "Commande annulée" : "Panier à recréer"}</Text>
          <Text variant="bodySm" color={colors.inkSoft}>{allOrdersCancelled
            ? "Aucune nouvelle tentative de paiement n’est autorisée pour cette commande. Les quantités ont été remises en stock. Retourne au catalogue et reconstitue ton panier pour réessayer."
            : "Une sous-commande de ce panier a été annulée. Ce panier ne peut plus être payé. Reviens au catalogue et reconstitue ton panier ; les autres réservations seront libérées automatiquement."}</Text>
          <Button label="Retour au catalogue" onPress={() => router.replace("/products")} fullWidth />
        </Card> : null}
        {canStart ? <Card style={{ gap: spacing.md }}>
          <Text variant="h3">Payer par Mobile Money</Text>
          <Text variant="bodySm" color={colors.inkSoft}>Choisis l’opérateur activé dans NZE.</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {OPERATORS.map((operator) => {
              const selected = operatorCode === operator.code;
              return <Pressable key={operator.code} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setOperatorCode(operator.code)} style={{ flex: 1, padding: spacing.md, borderRadius: 12, borderWidth: 1, borderColor: selected ? colors.primary : colors.line, backgroundColor: selected ? colors.primaryTint : colors.white }}><Text variant="label" color={selected ? colors.primary : colors.ink}>{operator.label}</Text></Pressable>;
            })}
          </View>
          <Text variant="label">Numéro Mobile Money</Text>
          <TextInput value={phone} onChangeText={setPhone} placeholder="Ex. 074 11 11 11" keyboardType="phone-pad" autoComplete="tel" style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.md, color: colors.ink, backgroundColor: colors.white }} />
          <Button label="Initier le paiement" onPress={() => void pay()} loading={submitting} disabled={submitting || !phone.trim()} fullWidth />
          <Text variant="caption" color={colors.inkSoft}>La demande est d’abord initiée. Le paiement ne sera marqué comme réussi qu’après le webhook officiel MyPVit.</Text>
        </Card> : null}

        {status === "reussi" ? <Card style={{ gap: spacing.md }}>
          <Text variant="h3">Paiement confirmé</Text>
          <Text variant="bodySm" color={colors.inkSoft}>MyPVit a confirmé la transaction. Chaque magasin gère ensuite la confirmation et la préparation de sa commande.</Text>
          <Button label="Voir mes commandes" onPress={() => router.replace("/orders")} fullWidth />
        </Card> : null}
        {errorMessage ? <Text variant="bodySm" color={colors.danger}>{errorMessage}</Text> : null}
        <Text variant="caption" color={colors.inkFaint}>Si le statut ne change pas, ne paie pas une seconde fois. Vérifie la transaction auprès de MyPVit ou du support NZE.</Text>
      </ScrollView>
    </Screen>
  );
}
