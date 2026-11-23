import { useCallback, useEffect, useMemo, useState } from "react";
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
import { assignAdminRole, getCurrentAdminRole, listAdminRoles, listAdminUsers, revokeAdminRole, type AdminRole, type AdminRoleAssignment, type AdminUser } from "@/lib/admin-api";

const ROLE_OPTIONS: Array<{ id: AdminRole; label: string }> = [
  { id: "super_admin", label: "Super-admin" }, { id: "moderation", label: "Modération" },
  { id: "support", label: "Support" }, { id: "finance", label: "Finance" },
  { id: "professionnels", label: "Professionnels" }, { id: "livraisons", label: "Livraisons" },
];
export default function AdminRolesScreen() {
  const token = useAuthStore((s) => s.accessToken)!;
  const [currentRole, setCurrentRole] = useState<AdminRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<AdminRoleAssignment[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const assignmentById = useMemo(() => new Map(assignments.map((item) => [item.userId, item])), [assignments]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [role, roleRows, userResult] = await Promise.all([
        getCurrentAdminRole(token), listAdminRoles(token), listAdminUsers(token, { q: query.trim() || undefined, limit: 40 }),
      ]);
      setCurrentRole(role.role); setCurrentUserId(role.userId); setAssignments(roleRows); setUsers(userResult.items);
    } catch (error) { Alert.alert("Chargement impossible", error instanceof ApiError ? error.message : "Vérifie que ton compte est super-administrateur."); }
    finally { setLoading(false); }
  }, [token, query]);
  useEffect(() => { void load(); }, [load]);
  async function setRole(role: AdminRole) {
    if (!selected) return;
    if (selected.id === currentUserId) { Alert.alert("Action impossible", "Utilise un autre compte super-administrateur pour modifier ton propre rôle."); return; }
    setBusy(true);
    try { await assignAdminRole(token, selected.id, role); await load(); Alert.alert("Rôle attribué", `${selected.prenom} ${selected.nom} dispose maintenant du rôle ${role}.`); setSelected(null); }
    catch (error) { Alert.alert("Modification impossible", error instanceof ApiError ? error.message : "Impossible d'attribuer ce rôle."); }
    finally { setBusy(false); }
  }
  async function revoke(user: AdminRoleAssignment) {
    setBusy(true);
    try { await revokeAdminRole(token, user.userId); await load(); }
    catch (error) { Alert.alert("Révocation impossible", error instanceof ApiError ? error.message : "Impossible de retirer ce rôle."); }
    finally { setBusy(false); }
  }
  if (loading || !currentRole) return <Screen><ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /></Screen>;
  if (currentRole !== "super_admin") return <Screen><View style={{ padding: spacing.lg, gap: spacing.md }}><Button label="← Retour" variant="ghost" onPress={() => router.back()} /><Text variant="h1">Rôles administratifs</Text><Text variant="body">Cette page est réservée au super-administrateur.</Text></View></Screen>;
  return <Screen><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
    <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
    <Text variant="h1">Rôles administratifs</Text>
    <Text variant="bodySm" color={colors.inkSoft}>Attribue uniquement les permissions nécessaires. Chaque modification est enregistrée dans le journal d'audit. Le compte connecté ne peut pas modifier ou retirer son propre rôle depuis cette page.</Text>
    <Card style={{ gap: spacing.sm }}>
      <Text variant="h2">Attribuer ou modifier un rôle</Text>
      <Input label="Rechercher un compte" value={query} onChangeText={setQuery} placeholder="Nom, téléphone ou e-mail" autoCapitalize="none" />
      <Button label="Rechercher" variant="secondary" onPress={() => void load()} fullWidth />
      {users.filter((user) => user.statut === "actif").slice(0, 20).map((user) => <View key={user.id} style={{ gap: spacing.xs, paddingVertical: spacing.xs }}>
        <Button label={`${user.prenom} ${user.nom} · ${user.telephoneMasque}${user.id === currentUserId ? " · Compte connecté" : ""}`} variant={selected?.id === user.id ? "primary" : "secondary"} disabled={user.id === currentUserId} onPress={() => setSelected(user)} fullWidth />
        {assignmentById.get(user.id) ? <Text variant="caption" color={colors.inkSoft}>Rôle actuel : {assignmentById.get(user.id)?.role}</Text> : null}
      </View>)}
      {selected && <View style={{ gap: spacing.sm, paddingTop: spacing.md }}>
        <Text variant="h3">Compte choisi : {selected.prenom} {selected.nom}</Text>
        <Text variant="caption" color={colors.inkFaint}>{selected.id}</Text>
        {ROLE_OPTIONS.map((option) => <Button key={option.id} label={`Attribuer : ${option.label}`} variant="secondary" loading={busy} onPress={() => void setRole(option.id)} fullWidth />)}
      </View>}
    </Card>
    <Text variant="h2">Comptes administratifs actuels</Text>
    {assignments.map((item) => <Card key={item.userId} style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}><Text variant="h3">{item.prenom} {item.nom}</Text><Badge label={item.role} tone={item.role === "super_admin" ? "primary" : "neutral"} /></View>
      <Text variant="caption" color={colors.inkSoft}>{item.telephoneMasque} · {item.statut}</Text>
      <Button label="Retirer l'accès administratif" variant="ghost" disabled={item.userId === currentUserId} loading={busy} onPress={() => Alert.alert("Retirer cet accès ?", "Le compte ne pourra plus accéder aux fonctions administratives.", [{ text: "Annuler", style: "cancel" }, { text: "Retirer", style: "destructive", onPress: () => void revoke(item) }])} fullWidth />
    </Card>)}
    <Button label="Actualiser" variant="ghost" onPress={() => void load()} fullWidth />
  </ScrollView></Screen>;
}
