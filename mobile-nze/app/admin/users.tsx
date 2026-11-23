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
import { getCurrentAdminRole, listAdminUsers, updateAdminUserStatus, type AdminRole, type AdminUser } from "@/lib/admin-api";

export default function AdminUsersScreen() {
  const token = useAuthStore((s) => s.accessToken)!;
  const [role, setRole] = useState<AdminRole | null>(null);
  const [items, setItems] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, result] = await Promise.all([getCurrentAdminRole(token), listAdminUsers(token, { q: query.trim() || undefined, statut: status || undefined, limit: 50 })]);
      setRole(r.role); setItems(result.items);
    } catch (error) { Alert.alert("Chargement impossible", error instanceof ApiError ? error.message : "Vérifie tes autorisations."); }
    finally { setLoading(false); }
  }, [token, query, status]);
  useEffect(() => { void load(); }, [load]);
  async function changeStatus(user: AdminUser) {
    const next = user.statut === "suspendu" ? "actif" : "suspendu";
    setBusyId(user.id);
    try { await updateAdminUserStatus(token, user.id, next); await load(); }
    catch (error) { Alert.alert("Modification impossible", error instanceof ApiError ? error.message : "Impossible de modifier ce compte."); }
    finally { setBusyId(null); }
  }
  return <Screen><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
    <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
    <Text variant="h1">Comptes utilisateurs</Text>
    <Input label="Rechercher" value={query} onChangeText={setQuery} placeholder="Nom, téléphone ou e-mail" autoCapitalize="none" />
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
      {[{ id: "", label: "Tous" }, { id: "actif", label: "Actifs" }, { id: "suspendu", label: "Suspendus" }].map((item) => <Button key={item.id || "tous"} label={item.label} variant={status === item.id ? "primary" : "secondary"} onPress={() => setStatus(item.id)} />)}
      <Button label="Rechercher" onPress={() => void load()} />
    </View>
    {loading ? <ActivityIndicator color={colors.primary} /> : items.length === 0 ? <Text variant="bodySm" color={colors.inkSoft}>Aucun utilisateur trouvé.</Text> : items.map((user) => <Card key={user.id} style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
        <Text variant="h3">{user.prenom} {user.nom}</Text><Badge label={user.statut} tone={user.statut === "actif" ? "success" : "warning"} />
      </View>
      <Text variant="bodySm" color={colors.inkSoft}>Téléphone : {user.telephoneMasque}</Text>
      {user.email ? <Text variant="bodySm" color={colors.inkSoft}>{user.email}</Text> : null}
      {user.isAdmin ? <Badge label="Compte administratif" tone="primary" /> : null}
      <Text variant="caption" color={colors.inkFaint}>{user.activites.length ? user.activites.join(" · ") : "Aucune activité professionnelle enregistrée"}</Text>
      <Text variant="caption" color={colors.inkFaint}>Créé le {new Date(user.creeLe).toLocaleDateString("fr-FR")}</Text>
      {role === "super_admin" && !user.isAdmin ? <Button label={user.statut === "suspendu" ? "Réactiver le compte" : "Suspendre le compte"} variant="secondary" loading={busyId === user.id} onPress={() => void changeStatus(user)} fullWidth /> : null}
      {role === "super_admin" && user.isAdmin ? <Text variant="caption" color={colors.inkSoft}>Les comptes administratifs se gèrent dans « Rôles administratifs ».</Text> : null}
    </Card>)}
    <Button label="Actualiser" variant="ghost" onPress={() => void load()} fullWidth />
  </ScrollView></Screen>;
}
