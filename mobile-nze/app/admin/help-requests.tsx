import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, View, Pressable, RefreshControl } from "react-native";
import { router } from "expo-router";
import { apiRequest } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { colors, spacing } from "@/theme";

type RequestRow = { id: string; subject: string; category: string; message: string; status: "ouvert" | "en_cours" | "resolu" | "ferme"; resolution: string | null; createdAt: string; userNom: string; userPrenom: string; userEmail: string | null; userTelephone: string };
const STATUSES: RequestRow["status"][] = ["ouvert", "en_cours", "resolu", "ferme"];

export default function AdminHelpRequestsScreen() {
  const token = useAuthStore((s) => s.accessToken);
  const [items, setItems] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!token) return;
    try { const data = await apiRequest<{ items: RequestRow[] }>("/admin/help-requests?limit=100", { token }); setItems(data.items); }
    catch (error) { Alert.alert("Support", error instanceof Error ? error.message : "Erreur"); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  async function changeStatus(item: RequestRow, status: RequestRow["status"]) {
    if (!token) return;
    try {
      const updated = await apiRequest<RequestRow>(`/admin/help-requests/${item.id}`, { method: "PATCH", token, body: { status, ...(status === "resolu" ? { resolution: "Demande traitée par le support NZE." } : {}) } });
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, ...updated } : row));
    } catch (error) { Alert.alert("Support", error instanceof Error ? error.message : "Erreur"); }
  }

  return <Screen><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); void load(); }} tintColor={colors.primary} />}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text variant="h2">Demandes au support</Text><Pressable onPress={() => router.back()}><Text color={colors.primary}>Retour</Text></Pressable></View>
    {items.length === 0 ? <Card><Text color={colors.inkSoft}>{loading ? "Chargement…" : "Aucune demande."}</Text></Card> : items.map((item) => <Card key={item.id} style={{ gap: spacing.sm }}>
      <Text variant="h3">{item.subject}</Text>
      <Text variant="caption" color={colors.inkSoft}>{item.userPrenom} {item.userNom} · {item.userEmail ?? item.userTelephone} · {item.category}</Text>
      <Text>{item.message}</Text>
      <Text color={colors.primary}>Statut : {item.status.replaceAll("_", " ")}</Text>
      {item.resolution ? <Text color={colors.success}>{item.resolution}</Text> : null}
      <View style={{ gap: spacing.xs }}>{STATUSES.map((status) => <Button key={status} label={`Passer à : ${status.replaceAll("_", " ")}`} variant={item.status === status ? "primary" : "secondary"} disabled={item.status === status} onPress={() => void changeStatus(item, status)} fullWidth />)}</View>
    </Card>)}
  </ScrollView></Screen>;
}
