import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { getAdminFinanceSummary, listAdminPayments, type AdminPayment } from "@/lib/admin-api";

function money(amount: string) { return `${Number(amount).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} FCFA`; }
export default function AdminFinanceScreen() {
  const token = useAuthStore((s) => s.accessToken)!;
  const [summary, setSummary] = useState<Array<{ statut: string; type: string; nombre: number; montant: string }>>([]);
  const [items, setItems] = useState<AdminPayment[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([getAdminFinanceSummary(token), listAdminPayments(token, { q: query.trim() || undefined, statut: status || undefined, limit: 50 })]);
      setSummary(s); setItems(p.items);
    } catch (error) { Alert.alert("Chargement impossible", error instanceof ApiError ? error.message : "Vérifie tes autorisations de finance."); }
    finally { setLoading(false); }
  }, [token, query, status]);
  useEffect(() => { void load(); }, [load]);
  return <Screen><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
    <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
    <Text variant="h1">Finances et paiements</Text>
    <Text variant="bodySm" color={colors.inkSoft}>Consultation uniquement : cette interface ne peut pas marquer un paiement comme réussi ni remplacer la confirmation du fournisseur.</Text>
    {loading ? <ActivityIndicator color={colors.primary} /> : <>
      <Text variant="h2">Résumé par statut</Text>
      <View style={{ gap: spacing.sm }}>{summary.map((row) => <Card key={`${row.type}-${row.statut}`} style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}><Text variant="h3">{row.type}</Text><Badge label={row.statut} tone={row.statut === "reussi" ? "success" : row.statut === "echoue" ? "danger" : "warning"} /></View>
        <Text variant="body">{money(row.montant)} · {row.nombre} transaction(s)</Text>
      </Card>)}</View>
      <Text variant="h2">Transactions récentes</Text>
      <Input label="Référence marchande ou fournisseur" value={query} onChangeText={setQuery} autoCapitalize="none" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>{[{ value: "", label: "Tous" }, { value: "en_attente", label: "En attente" }, { value: "reussi", label: "Réussis" }, { value: "echoue", label: "Échoués" }, { value: "incertain", label: "Incertain" }].map((f) => <Button key={f.value || "all"} label={f.label} variant={status === f.value ? "primary" : "secondary"} onPress={() => setStatus(f.value)} />)}<Button label="Rechercher" onPress={() => void load()} /></View>
      {items.length === 0 ? <Text variant="bodySm" color={colors.inkSoft}>Aucune transaction trouvée.</Text> : items.map((item) => <Card key={item.id} style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}><Text variant="h3">{item.userPrenom} {item.userNom}</Text><Badge label={item.statut} tone={item.statut === "reussi" ? "success" : item.statut === "echoue" ? "danger" : "warning"} /></View>
        <Text variant="body">{money(item.montant)} · {item.type} · {item.transactionType}</Text>
        <Text variant="caption" color={colors.inkSoft}>Téléphone : {item.telephoneMasque} · Opérateur : {item.operatorCode ?? "—"}</Text>
        <Text variant="caption" color={colors.inkSoft}>Référence NZE : {item.merchantReference ?? "—"}</Text>
        <Text variant="caption" color={colors.inkSoft}>Référence fournisseur : {item.providerReference ?? "—"}</Text>
        <Text variant="caption" color={colors.inkFaint}>{new Date(item.creeLe).toLocaleString("fr-FR")}</Text>
      </Card>)}
    </>}
    <Button label="Actualiser" variant="ghost" onPress={() => void load()} fullWidth />
  </ScrollView></Screen>;
}
