import { apiRequest } from "./api";

export type AdminStats = {
  utilisateurs: { clients: number; commercants: number; prestataires: number; livreurs: number; chauffeurs: number };
  validationsEnAttente: { magasins: number; livreurs: number };
  activite: { commandesTotal: number; livraisonsTerminees: number; coursesTerminees: number };
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

export function listPendingDeliverers(token: string) {
  return apiRequest<Array<{ id: string; typeVehicule: string }>>("/admin/deliverers/pending", { token });
}
export function validateDeliverer(token: string, id: string, statutValidation: ValidationStatus) {
  return apiRequest(`/admin/deliverers/${id}/validate`, { method: "PATCH", body: { statutValidation }, token });
}

export function listPendingDrivers(token: string) {
  return apiRequest<Array<{ id: string; typeService: string }>>("/admin/drivers/pending", { token });
}
export function validateDriver(token: string, id: string, statutValidation: ValidationStatus) {
  return apiRequest(`/admin/drivers/${id}/validate`, { method: "PATCH", body: { statutValidation }, token });
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
  | "tous_chauffeurs"
  | "tous_proprietaires_vehicules"
  | "tous_clients";

export function sendAnnouncement(token: string, cible: Cible, message: string) {
  return apiRequest<{ message: string }>("/admin/announcements", { method: "POST", body: { cible, message }, token });
}
