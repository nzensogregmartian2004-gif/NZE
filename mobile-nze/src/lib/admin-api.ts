import { apiRequest } from "./api";

export type AdminStats = {
  utilisateurs: { clients: number; commercants: number; prestataires: number; livreurs: number };
  validationsEnAttente: { magasins: number; livreurs: number; hebergements?: number };
  activite: { commandesTotal: number; livraisonsTerminees: number };
  signalementsEnAttente: number;
};

export function getAdminStats(token: string) {
  return apiRequest<AdminStats>("/admin/stats", { token });
}

type ValidationStatus = "valide" | "refuse" | "suspendu";

export function listPendingStores(token: string) {
  return apiRequest<Array<{ id: string; nom: string; quartier: string | null }>>("/admin/stores/pending", { token });
}
export function validateStore(token: string, id: string, statutValidation: ValidationStatus) {
  return apiRequest(`/admin/stores/${id}/validate`, { method: "PATCH", body: { statutValidation }, token });
}

export function listPendingLodgings(token: string) {
  return apiRequest<Array<{ id: string; nom: string; type: string; quartier: string | null }>>(
    "/admin/lodgings/pending",
    { token }
  );
}
export function validateLodging(token: string, id: string, statutValidation: ValidationStatus) {
  return apiRequest(`/admin/lodgings/${id}/validate`, { method: "PATCH", body: { statutValidation }, token });
}

export function listPendingDeliverers(token: string) {
  return apiRequest<Array<{ id: string; typeVehicule: string }>>("/admin/deliverers/pending", { token });
}
export function validateDeliverer(token: string, id: string, statutValidation: ValidationStatus) {
  return apiRequest(`/admin/deliverers/${id}/validate`, { method: "PATCH", body: { statutValidation }, token });
}

export function listPendingServiceProfiles(token: string) {
  return apiRequest<Array<{ id: string; metier: string }>>("/admin/service-profiles/pending", { token });
}
export function validateServiceProfile(token: string, id: string, statutValidation: ValidationStatus) {
  return apiRequest(`/admin/service-profiles/${id}/validate`, { method: "PATCH", body: { statutValidation }, token });
}

export function listPendingVehicles(token: string) {
  return apiRequest<Array<{ id: string; marque: string | null; modele: string | null }>>("/admin/vehicles/pending", {
    token,
  });
}
export function validateVehicle(token: string, id: string, statutValidation: ValidationStatus) {
  return apiRequest(`/admin/vehicles/${id}/validate`, { method: "PATCH", body: { statutValidation }, token });
}

export type Report = { id: string; cibleType: string; cibleId: string; motif: string; statut: string; creeLe: string };
export function listReports(token: string, statut = "en_attente") {
  return apiRequest<Report[]>(`/admin/reports?statut=${statut}`, { token });
}
export function updateReport(token: string, id: string, statut: "traite" | "rejete") {
  return apiRequest<Report>(`/admin/reports/${id}`, { method: "PATCH", body: { statut }, token });
}

type Cible =
  | "tous_livreurs"
  | "tous_magasins"
  | "tous_prestataires"
  | "tous_proprietaires_vehicules"
  | "tous_clients";

export function sendAnnouncement(token: string, cible: Cible, message: string) {
  return apiRequest<{ message: string }>("/admin/announcements", { method: "POST", body: { cible, message }, token });
}

export type AdminRole = "super_admin" | "moderation" | "support" | "finance" | "professionnels" | "livraisons";
export function getCurrentAdminRole(token: string) {
  return apiRequest<{ userId: string; role: AdminRole }>("/admin/me", { token });
}

export type AdminUser = {
  id: string; nom: string; prenom: string; email: string | null; telephoneMasque: string;
  statut: "actif" | "suspendu" | "supprime"; isAdmin: boolean; creeLe: string; activites: string[];
};
export function listAdminUsers(token: string, params: { q?: string; statut?: string; page?: number; limit?: number } = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.statut) search.set("statut", params.statut);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  return apiRequest<{ items: AdminUser[]; page: number; limit: number; total: number }>(`/admin/users${search.toString() ? `?${search.toString()}` : ""}`, { token });
}
export function updateAdminUserStatus(token: string, id: string, statut: "actif" | "suspendu") {
  return apiRequest<{ id: string; statut: string }>(`/admin/users/${id}/status`, { method: "PATCH", body: { statut }, token });
}

export type AdminCategory = { id: string; nom: string; type: "produit" | "service"; creeLe: string };
export function listAdminCategories(token: string) { return apiRequest<AdminCategory[]>("/admin/categories", { token }); }
export function createAdminCategory(token: string, nom: string, type: "produit" | "service") {
  return apiRequest<AdminCategory>("/admin/categories", { method: "POST", body: { nom, type }, token });
}
export function updateAdminCategory(token: string, id: string, body: { nom?: string; type?: "produit" | "service" }) {
  return apiRequest<AdminCategory>(`/admin/categories/${id}`, { method: "PATCH", body, token });
}
export function deleteAdminCategory(token: string, id: string) {
  return apiRequest<{ success: boolean }>(`/admin/categories/${id}`, { method: "DELETE", token });
}

export type AdminRoleAssignment = { userId: string; nom: string; prenom: string; telephoneMasque: string; statut: string; isAdmin: boolean; role: AdminRole; creeLe: string };
export function listAdminRoles(token: string) { return apiRequest<AdminRoleAssignment[]>("/admin/roles", { token }); }
export function assignAdminRole(token: string, userId: string, role: AdminRole) {
  return apiRequest<{ userId: string; role: AdminRole; isAdmin: boolean }>(`/admin/roles/${userId}`, { method: "PUT", body: { role }, token });
}
export function revokeAdminRole(token: string, userId: string) {
  return apiRequest<{ userId: string; revoked: boolean }>(`/admin/roles/${userId}`, { method: "DELETE", token });
}

export type AdminSettingRow = { value: unknown; majLe: string };
export type AdminSettings = Record<string, AdminSettingRow>;
export function getAdminSettings(token: string) { return apiRequest<AdminSettings>("/admin/settings", { token }); }
export function updateAdminSetting(token: string, key: string, value: unknown) {
  return apiRequest<{ key: string; value: unknown; majLe: string }>(`/admin/settings/${key}`, { method: "PUT", body: { value }, token });
}

export type AdminAd = { id: string; cibleType: string; cibleId: string; prix: string; emplacement: string | null; region: string | null; dateDebut: string; dateFin: string; statut: string; paiementStatut: string; impressions: number; clics: number; commandesAttribuees: number; raisonModeration: string | null; creeLe: string };
export function listAdminAds(token: string, statut = "en_attente") {
  return apiRequest<AdminAd[]>(`/admin/advertisements?statut=${encodeURIComponent(statut)}`, { token });
}
export function reviewAdminAd(token: string, id: string, action: "approuver" | "refuser", raison?: string) {
  return apiRequest<{ id: string; statut: string; paiementStatut: string }>(`/admin/advertisements/${id}/review`, { method: "PATCH", body: { action, raison }, token });
}

export type AdminPayment = { id: string; montant: string; type: string; statut: string; transactionType: string; provider: string | null; operatorCode: string | null; merchantReference: string | null; providerReference: string | null; creeLe: string; confirmeLe: string | null; userNom: string; userPrenom: string; telephoneMasque: string };
export function getAdminFinanceSummary(token: string) { return apiRequest<Array<{ statut: string; type: string; nombre: number; montant: string }>>("/admin/finance/summary", { token }); }
export function listAdminPayments(token: string, params: { statut?: string; type?: string; q?: string; page?: number; limit?: number } = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== "") search.set(key, String(value)); });
  return apiRequest<{ items: AdminPayment[]; page: number; limit: number; total: number }>(`/admin/payments${search.toString() ? `?${search.toString()}` : ""}`, { token });
}

export type AdminAuditEntry = { id: string; action: string; cibleType: string | null; cibleId: string | null; details: Record<string, unknown>; creeLe: string; adminId: string; adminNom: string; adminPrenom: string };
export function listAdminAudit(token: string, page = 1) { return apiRequest<{ items: AdminAuditEntry[]; page: number; limit: number }>(`/admin/audit?page=${page}`, { token }); }
