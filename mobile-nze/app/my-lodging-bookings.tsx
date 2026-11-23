import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Alert } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { cancelLodgingBooking, listMyLodgingBookings, type LodgingBooking } from "@/lib/lodgings-api";
export default function MyLodgingBookingsScreen() { const token = useAuthStore((s) => s.accessToken); const [items, setItems] = useState<LodgingBooking[]>([]); const [loading, setLoading] = useState(true); const load = useCallback(async () => { if (!token) { setItems([]); setLoading(false); return; } setLoading(true); try { setItems(await listMyLodgingBookings(token)); } catch (e) { Alert.alert("Erreur", e instanceof ApiError ? e.message : "Impossible de charger tes réservations"); } finally { setLoading(false); } }, [token]); useEffect(() => { load(); }, [load]); async function cancel(item: LodgingBooking) { try { await cancelLodgingBooking(token!, item.id, "Annulation demandée par le client"); await load(); } catch (e) { Alert.alert("Erreur", e instanceof ApiError ? e.message : "Impossible d'annuler"); } } return <Screen><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}><Button label="← Retour" variant="ghost" onPress={() => router.back()} /><Text variant="h1">Mes réservations de logement</Text>{loading ? <ActivityIndicator color={colors.primary} /> : items.length === 0 ? <Text variant="body" color={colors.inkSoft}>Tu n'as pas encore de réservation.</Text> : items.map((item) => <Card key={item.id} style={{ gap: spacing.sm }}><Text variant="body">Du {item.dateDebut} au {item.dateFin}</Text><Text variant="bodySm">{item.nombreVoyageurs} voyageur(s) · {Number(item.montantTotal).toLocaleString("fr-FR")} FCFA</Text><Badge label={item.statut} tone={item.statut === "acceptee" || item.statut === "terminee" ? "success" : item.statut === "refusee" || item.statut === "annulee" ? "danger" : "warning"} />{["demandee", "acceptee"].includes(item.statut) && <Button label="Annuler la demande" variant="ghost" onPress={() => cancel(item)} />}</Card>)}</ScrollView></Screen>; }
