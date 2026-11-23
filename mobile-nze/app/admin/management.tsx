import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "@/theme";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuthStore } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { getCurrentAdminRole, type AdminRole } from "@/lib/admin-api";

const TITLES: Record<AdminRole, string> = {
  super_admin: "Super-administrateur",
  moderation: "Modération",
  support: "Support client",
  finance: "Finance",
  professionnels: "Gestion des professionnels",
  livraisons: "Gestion des livraisons",
};

export default function AdminManagementScreen() {
  const token = useAuthStore((s) => s.accessToken)!;
  const [role, setRole] = useState<AdminRole | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getCurrentAdminRole(token).then((result) => setRole(result.role)).catch((error) => {
      Alert.alert("Accès impossible", error instanceof ApiError ? error.message : "Impossible de charger ton rôle.");
    }).finally(() => setLoading(false));
  }, [token]);

  if (loading || !role) return <Screen><ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /></Screen>;
  const visible = new Set<string>();
  if (role === "super_admin") ["users", "categories", "ads", "finance", "settings", "roles", "audit", "monetisation", "reports", "validations", "deliveries"].forEach((v) => visible.add(v));
  if (role === "moderation") ["categories", "ads", "reports", "validations"].forEach((v) => visible.add(v));
  if (role === "support") ["users", "reports", "settings", "announcement"].forEach((v) => visible.add(v));
  if (role === "finance") ["finance", "settings", "monetisation"].forEach((v) => visible.add(v));
  if (role === "professionnels") ["categories", "validations"].forEach((v) => visible.add(v));
  if (role === "livraisons") ["deliveries"].forEach((v) => visible.add(v));

  const links: Array<{ id: string; label: string; route: string; subtitle: string }> = [
    { id: "users", label: "Comptes utilisateurs", route: "/admin/users", subtitle: "Recherche et suspension des comptes" },
    { id: "categories", label: "Catégories", route: "/admin/categories", subtitle: "Créer, modifier ou retirer une catégorie" },
    { id: "ads", label: "Modération des promotions", route: "/admin/advertisements", subtitle: "Approuver seulement les campagnes payées" },
    { id: "finance", label: "Finances et paiements", route: "/admin/finance", subtitle: "Consulter les transactions sans modifier leur statut" },
    { id: "settings", label: "Paramètres de la plateforme", route: "/admin/settings", subtitle: "Réglages métier autorisés selon ton rôle" },
    { id: "roles", label: "Rôles administratifs", route: "/admin/roles", subtitle: "Attribuer les permissions administratives" },
    { id: "audit", label: "Historique administratif", route: "/admin/audit", subtitle: "Consulter les actions et décisions enregistrées" },
    { id: "monetisation", label: "Abonnements et tarifs publicitaires", route: "/admin/monetisation", subtitle: "Formules, tarifs et mises en avant" },
    { id: "reports", label: "Signalements", route: "/admin/reports", subtitle: "Examiner les signalements des utilisateurs" },
    { id: "validations", label: "Validation des magasins", route: "/admin/validations?type=stores", subtitle: "Examiner les magasins, livreurs, prestataires et annonces" },
    { id: "deliveries", label: "Livraisons et tarifs", route: "/admin/deliveries", subtitle: "Affecter les missions et administrer les tarifs" },
    { id: "announcement", label: "Annonces aux utilisateurs", route: "/admin/announcement", subtitle: "Envoyer un message à un groupe d'utilisateurs" },
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Button label="← Retour" variant="ghost" onPress={() => router.back()} />
        <Text variant="h1">Administration complète</Text>
        <Card style={{ gap: spacing.xs, backgroundColor: colors.primaryTint }}>
          <Text variant="label">Rôle actif</Text>
          <Text variant="h3">{TITLES[role]}</Text>
          <Text variant="bodySm" color={colors.inkSoft}>Les opérations financières sensibles et la gestion des rôles sont réservées aux profils autorisés.</Text>
        </Card>
        {links.filter((item) => visible.has(item.id)).map((item) => (
          <Card key={item.id} style={{ gap: spacing.sm }}>
            <Text variant="h3">{item.label}</Text>
            <Text variant="bodySm" color={colors.inkSoft}>{item.subtitle}</Text>
            <Button label="Ouvrir" variant="secondary" onPress={() => router.push(item.route as never)} fullWidth />
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
