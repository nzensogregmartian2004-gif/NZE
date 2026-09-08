import { useState } from "react";
import { View, Alert } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { sendAnnouncement } from "@/lib/admin-api";

const TARGETS = [
  { value: "tous_clients", label: "Tous les clients" },
  { value: "tous_magasins", label: "Tous les magasins" },
  { value: "tous_prestataires", label: "Tous les prestataires" },
  { value: "tous_livreurs", label: "Tous les livreurs" },
  { value: "tous_chauffeurs", label: "Tous les chauffeurs" },
  { value: "tous_proprietaires_vehicules", label: "Tous les propriétaires de véhicules" },
] as const;

export default function AdminAnnouncementScreen() {
  const accessToken = useAuthStore((s) => s.accessToken)!;
  const [cible, setCible] = useState<(typeof TARGETS)[number]["value"]>("tous_clients");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    try {
      const result = await sendAnnouncement(accessToken, cible, message);
      Alert.alert("Envoyé", result.message);
      setMessage("");
    } catch (err) {
      Alert.alert("Erreur", err instanceof ApiError ? err.message : "Impossible d'envoyer l'annonce");
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen>
      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h1">Envoyer une annonce</Text>

        <View style={{ gap: spacing.sm }}>
          <Text variant="label" color={colors.inkSoft}>
            DESTINATAIRES
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {TARGETS.map((t) => (
              <Button
                key={t.value}
                label={t.label}
                variant={cible === t.value ? "primary" : "secondary"}
                onPress={() => setCible(t.value)}
              />
            ))}
          </View>
        </View>

        <Input label="Message" placeholder="Contenu de l'annonce" value={message} onChangeText={setMessage} />

        <Button label="Envoyer" onPress={handleSend} loading={sending} fullWidth />
      </View>
    </Screen>
  );
}
