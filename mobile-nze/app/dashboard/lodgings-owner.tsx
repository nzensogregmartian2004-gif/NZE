import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator, Alert, Pressable } from "react-native";
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
import { createLodging, listMyLodgings, updateLodging, LODGING_TYPES, type Lodging, type LodgingType } from "@/lib/lodgings-api";
import { useAutoTutorial } from "@/hooks/useAutoTutorial";

const LABELS: Record<string, string> = {
  hotel: "Hôtel", motel: "Motel", auberge: "Auberge", maison_hotes: "Maison d'hôtes",
  chambre: "Chambre", studio: "Studio", appartement: "Appartement", maison: "Maison", villa: "Villa",
};
const TONES = { en_attente: "warning", valide: "success", refuse: "danger", suspendu: "danger" } as const;

export default function LodgingsOwnerScreen() {
  useAutoTutorial("lodging");
  const token = useAuthStore((s) => s.accessToken)!;
  const [items, setItems] = useState<Lodging[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState<LodgingType>("appartement");
  const [nom, setNom] = useState("");
  const [adresse, setAdresse] = useState("");
  const [ville, setVille] = useState("Libreville");
  const [quartier, setQuartier] = useState("");
  const [prix, setPrix] = useState("");
  const [capacite, setCapacite] = useState("2");
  const [description, setDescription] = useState("");
  const [photosText, setPhotosText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await listMyLodgings(token)); }
    catch (e) { Alert.alert("Erreur", e instanceof ApiError ? e.message : "Impossible de charger les hébergements"); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  async function toggleAvailability(item: Lodging) {
    try { await updateLodging(token, item.id, { disponible: !item.disponible }); await load(); }
    catch (e) { Alert.alert("Erreur", e instanceof ApiError ? e.message : "Impossible de modifier la disponibilité"); }
  }

  async function create() {
    if (!nom.trim() || !adresse.trim() || !ville.trim() || !(Number(prix) > 0) || !(Number(capacite) > 0)) {
      Alert.alert("Informations manquantes", "Renseigne le nom, l'adresse, la ville, le prix et la capacité.");
      return;
    }
    const photos = photosText.trim() ? photosText.split(/[;,\n]/).map((value) => value.trim()).filter(Boolean) : undefined;
    setCreating(true);
    try {
      await createLodging(token, {
        type, nom, adresse, ville, quartier: quartier || undefined,
        prixParNuit: Number(prix), capacite: Number(capacite),
        description: description || undefined, photos,
      });
      setNom(""); setAdresse(""); setPrix(""); setDescription(""); setPhotosText("");
      await load();
      Alert.alert("Hébergement créé", "Ton annonce attend la validation de l'administration avant publication.");
    } catch (e) { Alert.alert("Erreur", e instanceof ApiError ? e.message : "Impossible de créer l'annonce"); }
    finally { setCreating(false); }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Button label="Abonnements et promotions" variant="secondary" onPress={() => router.push("/dashboard/monetisation")} fullWidth />
        <Text variant="h1">Mes hébergements</Text>
        {loading ? <ActivityIndicator color={colors.primary} /> : items.map((item) => (
          <View key={item.id} style={{ gap: spacing.xs }}>
            <Pressable onPress={() => router.push(`/dashboard/lodging-bookings/${item.id}`)}>
              <Card style={{ gap: spacing.xs }}>
                <Text variant="body" style={{ fontFamily: "PlusJakartaSans_600SemiBold" }}>{item.nom}</Text>
                <Text variant="bodySm" color={colors.inkSoft}>{LABELS[item.type] ?? item.type} · {item.ville}</Text>
                <Text variant="bodySm">{Number(item.prixParNuit).toLocaleString("fr-FR")} FCFA / nuit</Text>
                <Badge label={item.statutValidation} tone={TONES[item.statutValidation]} />
                <Text variant="bodySm" color={item.disponible ? colors.success : colors.inkSoft}>{item.disponible ? "Réservations activées" : "Réservations désactivées"}</Text>
                <Text variant="caption" color={colors.primary}>Gérer les réservations →</Text>
              </Card>
            </Pressable>
            <Button label={item.disponible ? "Désactiver les réservations" : "Réactiver les réservations"} variant="secondary" onPress={() => toggleAvailability(item)} />
          </View>
        ))}
        <Card style={{ gap: spacing.sm }}>
          <Text variant="h3">Nouvelle annonce</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {LODGING_TYPES.map((t) => <Button key={t} label={LABELS[t]} variant={type === t ? "primary" : "secondary"} onPress={() => setType(t)} />)}
          </View>
          <Input label="Nom de l'hébergement" value={nom} onChangeText={setNom} placeholder="Ex. Studio centre-ville" />
          <Input label="Adresse complète" value={adresse} onChangeText={setAdresse} placeholder="Rue ou repère" />
          <Input label="Ville" value={ville} onChangeText={setVille} />
          <Input label="Quartier (facultatif)" value={quartier} onChangeText={setQuartier} />
          <Input label="Prix par nuit (FCFA)" value={prix} onChangeText={setPrix} keyboardType="number-pad" />
          <Input label="Capacité (personnes)" value={capacite} onChangeText={setCapacite} keyboardType="number-pad" />
          <Input label="Description" value={description} onChangeText={setDescription} placeholder="Équipements, accès, etc." />
          <Input label="URL des photos (séparées par des virgules)" value={photosText} onChangeText={setPhotosText} placeholder="https://..." />
          <Button label="Créer l'annonce" onPress={create} loading={creating} fullWidth />
        </Card>
      </ScrollView>
    </Screen>
  );
}
