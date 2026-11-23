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
import { createAdminCategory, deleteAdminCategory, listAdminCategories, updateAdminCategory, type AdminCategory } from "@/lib/admin-api";

export default function AdminCategoriesScreen() {
  const token = useAuthStore((s) => s.accessToken)!;
  const [items, setItems] = useState<AdminCategory[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<"produit" | "service">("produit");
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { const rows = await listAdminCategories(token); setItems(rows); setRenames(Object.fromEntries(rows.map((r) => [r.id, r.nom]))); }
    catch (error) { Alert.alert("Chargement impossible", error instanceof ApiError ? error.message : "Vérifie tes autorisations."); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);
  async function add() {
    if (!name.trim()) return Alert.alert("Nom requis", "Saisis le nom de la catégorie.");
    setSaving(true);
    try { await createAdminCategory(token, name.trim(), type); setName(""); await load(); }
    catch (error) { Alert.alert("Création impossible", error instanceof ApiError ? error.message : "Impossible d'ajouter cette catégorie."); }
    finally { setSaving(false); }
  }
  async function rename(item: AdminCategory) {
    const nom = renames[item.id]?.trim(); if (!nom) return Alert.alert("Nom invalide", "Le nom ne peut pas être vide.");
    try { await updateAdminCategory(token, item.id, { nom }); await load(); }
    catch (error) { Alert.alert("Modification impossible", error instanceof ApiError ? error.message : "Impossible de modifier la catégorie."); }
  }
  async function remove(item: AdminCategory) {
    try { await deleteAdminCategory(token, item.id); await load(); }
    catch (error) { Alert.alert("Suppression impossible", error instanceof ApiError ? error.message : "La catégorie peut être utilisée par un produit."); }
  }
  return <Screen><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
    <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
    <Text variant="h1">Catégories</Text>
    <Card style={{ gap: spacing.sm }}>
      <Text variant="h3">Nouvelle catégorie</Text>
      <Input label="Nom" value={name} onChangeText={setName} placeholder="Ex. Électroménager" />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Button label="Produit" variant={type === "produit" ? "primary" : "secondary"} onPress={() => setType("produit")} />
        <Button label="Service" variant={type === "service" ? "primary" : "secondary"} onPress={() => setType("service")} />
      </View>
      <Button label="Créer la catégorie" onPress={() => void add()} loading={saving} fullWidth />
    </Card>
    <Text variant="h2">Catégories existantes</Text>
    {loading ? <ActivityIndicator color={colors.primary} /> : items.length === 0 ? <Text variant="bodySm" color={colors.inkSoft}>Aucune catégorie.</Text> : items.map((item) => <Card key={item.id} style={{ gap: spacing.sm }}>
      <Badge label={item.type} tone="primary" />
      <Input label="Nom de la catégorie" value={renames[item.id] ?? item.nom} onChangeText={(v) => setRenames((old) => ({ ...old, [item.id]: v }))} />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View style={{ flex: 1 }}><Button label="Enregistrer" variant="secondary" onPress={() => void rename(item)} fullWidth /></View>
        <View style={{ flex: 1 }}><Button label="Supprimer" variant="ghost" onPress={() => Alert.alert("Supprimer cette catégorie ?", "La suppression est refusée si un produit l'utilise.", [{ text: "Annuler", style: "cancel" }, { text: "Supprimer", style: "destructive", onPress: () => void remove(item) }])} fullWidth /></View>
      </View>
    </Card>)}
  </ScrollView></Screen>;
}
