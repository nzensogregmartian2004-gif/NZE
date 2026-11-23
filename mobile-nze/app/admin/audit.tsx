import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { listAdminAudit, type AdminAuditEntry } from "@/lib/admin-api";

export default function AdminAuditScreen() {
  const token = useAuthStore((s) => s.accessToken)!;
  const [items, setItems] = useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); try { const result = await listAdminAudit(token); setItems(result.items); } catch (error) { throw error; } finally { setLoading(false); } }, [token]);
  useEffect(() => { void load().catch((error) => { Alert.alert("Chargement impossible", error instanceof ApiError ? error.message : "Impossible de charger le journal."); }); }, [load]);
  return <Screen><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
    <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
    <Text variant="h1">Historique administratif</Text>
    <Text variant="bodySm" color={colors.inkSoft}>Journal en lecture seule des décisions et opérations sensibles enregistrées par NZE.</Text>
    {loading ? <ActivityIndicator color={colors.primary} /> : items.length === 0 ? <Text variant="bodySm" color={colors.inkSoft}>Aucune action enregistrée.</Text> : items.map((item) => <Card key={item.id} style={{ gap: spacing.xs }}>
      <Text variant="h3">{item.action}</Text>
      <Text variant="bodySm">Par {item.adminPrenom} {item.adminNom}</Text>
      <Text variant="caption" color={colors.inkSoft}>Cible : {item.cibleType ?? "générale"}{item.cibleId ? ` · ${item.cibleId}` : ""}</Text>
      <Text variant="caption" color={colors.inkFaint}>{new Date(item.creeLe).toLocaleString("fr-FR")}</Text>
      {Object.keys(item.details ?? {}).length > 0 ? <Text variant="caption" color={colors.inkSoft}>{JSON.stringify(item.details)}</Text> : null}
    </Card>)}
    <Button label="Actualiser" variant="ghost" onPress={() => void load()} fullWidth />
  </ScrollView></Screen>;
}

