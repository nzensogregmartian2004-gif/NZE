import { useRef, useState } from "react";
import { Alert, PanResponder, Pressable, ScrollView, View, type GestureResponderEvent } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { updateDeliveryStatus } from "@/lib/deliverer-api";
import { recordSignatureProof, recordRefusalProof, REFUSAL_LABELS, type RefusalMotif, type SignatureStroke } from "@/lib/delivery-proof-api";

const MIN_POINTS = 4;

/** Preuve de remise : signature du client sur l'écran du livreur, ou refus constaté. */
export default function DeliveryProofScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [strokes, setStrokes] = useState<SignatureStroke[]>([]);
  const [current, setCurrent] = useState<SignatureStroke>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [conforme, setConforme] = useState(false);
  const [motif, setMotif] = useState<RefusalMotif>("produit_non_fonctionnel");
  const [busy, setBusy] = useState(false);

  const sizeRef = useRef({ width: 0, height: 0 });
  const bufferRef = useRef<SignatureStroke>([]);

  function toPoint(event: GestureResponderEvent) {
    const { locationX, locationY } = event.nativeEvent;
    const { width, height } = sizeRef.current;
    return {
      x: width ? Math.min(1, Math.max(0, locationX / width)) : 0,
      y: height ? Math.min(1, Math.max(0, locationY / height)) : 0,
    };
  }

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      bufferRef.current = [toPoint(event)];
    },
    onPanResponderMove: (event) => {
      bufferRef.current = [...bufferRef.current, toPoint(event)];
      setCurrent(bufferRef.current);
    },
    onPanResponderRelease: () => {
      if (bufferRef.current.length > 0) setStrokes((list) => [...list, bufferRef.current]);
      bufferRef.current = [];
      setCurrent([]);
    },
    onPanResponderTerminate: () => {
      if (bufferRef.current.length > 0) setStrokes((list) => [...list, bufferRef.current]);
      bufferRef.current = [];
      setCurrent([]);
    },
  })).current;

  const totalPoints = [...strokes, current].reduce((total, stroke) => total + stroke.length, 0);

  function fail(err: unknown) {
    Alert.alert("Action impossible", err instanceof ApiError ? err.message : "Réessaie dans un instant.");
  }

  async function validerRemise() {
    if (!accessToken || !id) return;
    if (!conforme) return Alert.alert("Confirmation requise", "Le client doit confirmer que le colis est bien reçu et en bon état.");
    if (totalPoints < MIN_POINTS) return Alert.alert("Signature requise", "Demande au client de signer dans le cadre.");
    setBusy(true);
    try {
      await recordSignatureProof(accessToken, id, strokes);
      await updateDeliveryStatus(accessToken, id, "livraison_terminee", { preuveType: "signature", preuveReference: "signature" });
      Alert.alert("Remise confirmée", "La livraison est terminée.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  function refuser() {
    if (!accessToken || !id) return;
    Alert.alert("Enregistrer le refus ?", "Le client sera prévenu qu'il peut demander un remboursement.", [
      { text: "Annuler", style: "cancel" },
      { text: "Enregistrer le refus", style: "destructive", onPress: async () => {
        setBusy(true);
        try {
          await recordRefusalProof(accessToken, id, motif);
          Alert.alert("Refus enregistré", "Le client peut demander un remboursement depuis sa commande.", [{ text: "OK", onPress: () => router.back() }]);
        } catch (err) {
          fail(err);
        } finally {
          setBusy(false);
        }
      } },
    ]);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} scrollEnabled={!busy}>
        <Text variant="h2">Remise du colis</Text>
        <Text variant="body" color={colors.inkSoft}>Fais signer le client dans le cadre ci-dessous.</Text>

        <View
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            sizeRef.current = { width, height };
            setSize({ width, height });
          }}
          {...panResponder.panHandlers}
          style={{ height: 220, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.white, overflow: "hidden" }}
        >
          <View pointerEvents="none" style={{ flex: 1 }}>
            {[...strokes, current].flat().map((point, index) => (
              <View
                key={index}
                style={{ position: "absolute", left: point.x * size.width - 2, top: point.y * size.height - 2, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary }}
              />
            ))}
          </View>
        </View>
        <Button label="Effacer la signature" variant="ghost" onPress={() => setStrokes([])} />

        <Pressable onPress={() => setConforme((value) => !value)} accessibilityRole="checkbox" accessibilityState={{ checked: conforme }}
          style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
          <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: conforme ? colors.primary : colors.line, backgroundColor: conforme ? colors.primary : colors.white, alignItems: "center", justifyContent: "center" }}>
            {conforme && <Text variant="label" color={colors.white}>✓</Text>}
          </View>
          <Text variant="bodySm" color={colors.inkSoft} style={{ flex: 1 }}>
            Le client confirme avoir reçu le colis et qu'il est en bon état.
          </Text>
        </Pressable>

        <Button label="Valider la remise" onPress={validerRemise} loading={busy} fullWidth />

        <View style={{ gap: spacing.md, borderTopWidth: 1, borderColor: colors.line, paddingTop: spacing.lg }}>
          <Text variant="label" color={colors.inkSoft}>Le client refuse la remise</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {(Object.keys(REFUSAL_LABELS) as RefusalMotif[]).map((option) => (
              <Pressable key={option} onPress={() => setMotif(option)}
                style={{ borderRadius: 22, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: motif === option ? colors.primary : colors.primaryTint }}>
                <Text variant="caption" color={motif === option ? colors.white : colors.primary}>{REFUSAL_LABELS[option]}</Text>
              </Pressable>
            ))}
          </View>
          <Button label="Enregistrer le refus" variant="secondary" onPress={refuser} disabled={busy} fullWidth />
        </View>
      </ScrollView>
    </Screen>
  );
}
