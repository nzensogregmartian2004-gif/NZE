import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { ApiError } from "@/lib/api";
import { listLodgings, type Lodging } from "@/lib/lodgings-api";

const LABELS: Record<string, string> = { hotel: "Hôtel", motel: "Motel", auberge: "Auberge", maison_hotes: "Maison d'hôtes", chambre: "Chambre", studio: "Studio", appartement: "Appartement", maison: "Maison", villa: "Villa" };
export default function LodgingsScreen() {
  const [items, setItems] = useState<Lodging[]>([]); const [ville, setVille] = useState(""); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setItems(await listLodgings({ ville: ville.trim() || undefined })); } catch (e) { setError(e instanceof ApiError ? e.message : "Impossible de charger les hébergements"); } finally { setLoading(false); } }, [ville]);
  useEffect(() => { load(); }, [load]);
  return <Screen><View style={{ padding: spacing.lg, gap: spacing.md }}><Button label="← Retour" variant="ghost" onPress={() => router.back()} /><Text variant="h1">Hébergements</Text><Text variant="bodySm" color={colors.inkSoft}>Hôtels, auberges, chambres, studios, appartements et maisons au Gabon.</Text><Input label="Ville" placeholder="Ex. Libreville" value={ville} onChangeText={setVille} /><Button label="Rechercher" onPress={load} /><Button label="Mes réservations" variant="secondary" onPress={() => router.push("/my-lodging-bookings")} /></View>
    {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : error ? <Text variant="body" color={colors.danger} style={{ padding: spacing.lg }}>{error}</Text> : <FlatList data={items} keyExtractor={(i) => i.id} contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md }} ListEmptyComponent={<Text variant="body" color={colors.inkSoft}>Aucun hébergement validé ne correspond à la recherche.</Text>} renderItem={({ item }) => <Pressable onPress={() => router.push(`/lodging/${item.id}`)}><Card style={{ gap: spacing.xs }}><Text variant="body" style={{ fontFamily: "PlusJakartaSans_600SemiBold" }}>{item.nom}</Text><Text variant="bodySm" color={colors.inkSoft}>{LABELS[item.type] ?? item.type} · {item.ville}{item.quartier ? `, ${item.quartier}` : ""}</Text><Text variant="bodySm">Capacité : {item.capacite} personne(s)</Text><Text variant="body" color={colors.primary}>{Number(item.prixParNuit).toLocaleString("fr-FR")} FCFA / nuit</Text>{item.noteMoyenne && <Text variant="bodySm">⭐ {item.noteMoyenne} · {item.nombreAvis} avis</Text>}</Card></Pressable>} />}
  </Screen>;
}
