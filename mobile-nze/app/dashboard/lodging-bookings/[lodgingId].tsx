import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { listLodgingBookings, acceptLodgingBooking, rejectLodgingBooking, completeLodgingBooking, type LodgingBooking } from "@/lib/lodgings-api";
export default function LodgingBookingsScreen() {
  const { lodgingId } = useLocalSearchParams<{ lodgingId: string }>(); const token = useAuthStore((s) => s.accessToken)!; const [items, setItems] = useState<LodgingBooking[]>([]); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); try { setItems(await listLodgingBookings(token, lodgingId)); } catch (e) { Alert.alert("Erreur", e instanceof ApiError ? e.message : "Impossible de charger les réservations"); } finally { setLoading(false); } }, [token, lodgingId]); useEffect(() => { load(); }, [load]);
  async function action(item: LodgingBooking, type: "accept" | "reject" | "complete") { try { if (type === "accept") await acceptLodgingBooking(token, item.id); else if (type === "reject") await rejectLodgingBooking(token, item.id); else await completeLodgingBooking(token, item.id); await load(); } catch (e) { Alert.alert("Erreur", e instanceof ApiError ? e.message : "Impossible de modifier la réservation"); } }
  if (loading) return <Screen><ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /></Screen>;
  return <Screen><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}><Button label="← Retour" variant="ghost" onPress={() => router.back()} /><Text variant="h1">Réservations reçues</Text>{items.length === 0 ? <Text variant="body" color={colors.inkSoft}>Aucune demande pour l'instant.</Text> : items.map((item) => <Card key={item.id} style={{ gap: spacing.sm }}><Text variant="body">Du {item.dateDebut} au {item.dateFin}</Text><Text variant="bodySm">{item.nombreVoyageurs} voyageur(s) · Total indicatif : {Number(item.montantTotal).toLocaleString("fr-FR")} FCFA</Text>{item.message && <Text variant="bodySm" color={colors.inkSoft}>« {item.message} »</Text>}<Badge label={item.statut} tone={item.statut === "acceptee" || item.statut === "terminee" ? "success" : item.statut === "refusee" || item.statut === "annulee" ? "danger" : "warning"} />{item.statut === "demandee" && <View style={{ flexDirection: "row", gap: spacing.sm }}><Button label="Accepter" onPress={() => action(item, "accept")} /><Button label="Refuser" variant="ghost" onPress={() => action(item, "reject")} /></View>}{item.statut === "acceptee" && <Button label="Marquer le séjour terminé" onPress={() => action(item, "complete")} />}</Card>)}</ScrollView></Screen>;
}
