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
import { getAdminSettings, getCurrentAdminRole, updateAdminSetting, type AdminRole, type AdminSettings } from "@/lib/admin-api";

type ServiceFee = { mode: "fixe" | "pourcentage"; valeur: number; devise: "XAF" };
type Contact = { email: string; telephone: string };
function valueOf<T>(settings: AdminSettings, key: string, fallback: T): T { const value = settings[key]?.value; return value === undefined || value === null ? fallback : value as T; }
export default function AdminSettingsScreen() {
  const token = useAuthStore((s) => s.accessToken)!;
  const [settings, setSettings] = useState<AdminSettings>({});
  const [role, setRole] = useState<AdminRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [feeMode, setFeeMode] = useState<ServiceFee["mode"]>("pourcentage");
  const [feeValue, setFeeValue] = useState("0");
  const [stockThreshold, setStockThreshold] = useState("5");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([getCurrentAdminRole(token), getAdminSettings(token)]);
      setRole(r.role); setSettings(s);
      const fee = valueOf<ServiceFee>(s, "service_fee", { mode: "pourcentage", valeur: 0, devise: "XAF" });
      setFeeMode(fee.mode); setFeeValue(String(fee.valeur));
      setStockThreshold(String(valueOf<number>(s, "low_stock_threshold", 5)));
      const contact = valueOf<Contact>(s, "support_contact", { email: "", telephone: "" });
      setEmail(contact.email ?? ""); setPhone(contact.telephone ?? "");
    } catch (error) { Alert.alert("Chargement impossible", error instanceof ApiError ? error.message : "Vérifie tes autorisations."); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);
  async function save(key: string, value: unknown) {
    setSaving(key);
    try { await updateAdminSetting(token, key, value); await load(); Alert.alert("Paramètre enregistré", "La nouvelle valeur est enregistrée."); }
    catch (error) { Alert.alert("Enregistrement impossible", error instanceof ApiError ? error.message : "Impossible d'enregistrer ce paramètre."); }
    finally { setSaving(null); }
  }
  if (loading || !role) return <Screen><ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /></Screen>;
  const superAdmin = role === "super_admin";
  const canFinance = superAdmin || role === "finance";
  const canSupport = superAdmin || role === "support";
  return <Screen><ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
    <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
    <Text variant="h1">Paramètres de NZE</Text>
    <Text variant="bodySm" color={colors.inkSoft}>Les secrets MyPVit, les clés API et les mots de passe ne peuvent pas être enregistrés ici. Ils restent dans les variables d'environnement du serveur.</Text>
    {superAdmin && <Card style={{ gap: spacing.sm }}>
      <Text variant="h2">Disponibilité de la plateforme</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text variant="body">Mode maintenance</Text><Badge label={String(valueOf<boolean>(settings, "maintenance_mode", false) ? "Activé" : "Désactivé")} tone={valueOf<boolean>(settings, "maintenance_mode", false) ? "warning" : "success"} /></View>
      <Button label={valueOf<boolean>(settings, "maintenance_mode", false) ? "Désactiver maintenance" : "Activer maintenance"} variant="secondary" loading={saving === "maintenance_mode"} onPress={() => void save("maintenance_mode", !valueOf<boolean>(settings, "maintenance_mode", false))} fullWidth />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text variant="body">Nouvelles commandes</Text><Badge label={String(valueOf<boolean>(settings, "orders_enabled", true) ? "Autorisées" : "Suspendues")} tone={valueOf<boolean>(settings, "orders_enabled", true) ? "success" : "warning"} /></View>
      <Button label={valueOf<boolean>(settings, "orders_enabled", true) ? "Suspendre les nouvelles commandes" : "Réautoriser les commandes"} variant="secondary" loading={saving === "orders_enabled"} onPress={() => void save("orders_enabled", !valueOf<boolean>(settings, "orders_enabled", true))} fullWidth />
    </Card>}
    {canFinance && <Card style={{ gap: spacing.sm }}>
      <Text variant="h2">Frais de service</Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }}><Button label="Pourcentage" variant={feeMode === "pourcentage" ? "primary" : "secondary"} onPress={() => setFeeMode("pourcentage")} /><Button label="Montant fixe" variant={feeMode === "fixe" ? "primary" : "secondary"} onPress={() => setFeeMode("fixe")} /></View>
      <Input label={feeMode === "pourcentage" ? "Taux (%) — maximum 20" : "Montant par opération (FCFA)"} value={feeValue} onChangeText={setFeeValue} keyboardType="decimal-pad" />
      <Text variant="caption" color={colors.inkSoft}>Ce paramètre est stocké dans la configuration. Vérifie son branchement au calcul de chaque commande avant de l'utiliser en production.</Text>
      <Button label="Enregistrer les frais" loading={saving === "service_fee"} onPress={() => void save("service_fee", { mode: feeMode, valeur: Number(feeValue), devise: "XAF" })} fullWidth />
      <Input label="Seuil de stock faible (1–100)" value={stockThreshold} onChangeText={setStockThreshold} keyboardType="number-pad" />
      <Button label="Enregistrer le seuil" variant="secondary" loading={saving === "low_stock_threshold"} onPress={() => void save("low_stock_threshold", Number(stockThreshold))} fullWidth />
    </Card>}
    {canSupport && <Card style={{ gap: spacing.sm }}>
      <Text variant="h2">Contact du support</Text>
      <Input label="E-mail du support" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Input label="Téléphone du support" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Button label="Enregistrer le contact" loading={saving === "support_contact"} onPress={() => void save("support_contact", { email, telephone: phone })} fullWidth />
    </Card>}
    {superAdmin && <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text variant="body">Affectation automatique</Text><Badge label={valueOf<boolean>(settings, "affectation_automatique", false) ? "Activée" : "Manuelle"} tone={valueOf<boolean>(settings, "affectation_automatique", false) ? "warning" : "success"} /></View>
        <Button label={valueOf<boolean>(settings, "affectation_automatique", false) ? "Repasser en affectation manuelle" : "Activer l'affectation automatique"} variant="secondary" loading={saving === "affectation_automatique"} onPress={() => void save("affectation_automatique", !valueOf<boolean>(settings, "affectation_automatique", false))} fullWidth />
      </View>}
    <Button label="Actualiser" variant="ghost" onPress={() => void load()} fullWidth />
  </ScrollView></Screen>;
}
