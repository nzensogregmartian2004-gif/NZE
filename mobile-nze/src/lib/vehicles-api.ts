import { apiRequest } from "./api";

export type Vehicle = {
  id: string;
  type: string;
  marque: string | null;
  modele: string | null;
  annee: number | null;
  capacite: string | null;
  description: string | null;
  prix: string | null;
  conditionsLocation: string | null;
  disponible: boolean;
  montantTotal?: string | null;
  statutValidation: "en_attente" | "valide" | "refuse" | "suspendu";
};

export type VehicleDetail = Vehicle & { photos: Array<{ id: string; url: string }> };

export function listVehicles(params: { type?: string } = {}) {
  const search = new URLSearchParams();
  if (params.type) search.set("type", params.type);
  const qs = search.toString();
  return apiRequest<Vehicle[]>(`/vehicles${qs ? `?${qs}` : ""}`);
}

export function listMyVehicles(token: string) {
  return apiRequest<Vehicle[]>("/vehicles/me/mine", { token });
}

export type CreateVehicleInput = {
  type: string;
  marque?: string;
  modele?: string;
  annee?: number;
  capacite?: string;
  description?: string;
  prix?: number;
  conditionsLocation?: string;
  photos?: string[];
};

export function createVehicle(token: string, input: CreateVehicleInput) {
  return apiRequest<Vehicle>("/vehicles", { method: "POST", body: input, token });
}

export function updateVehicle(token: string, id: string, input: Partial<CreateVehicleInput & { disponible: boolean }>) {
  return apiRequest<Vehicle>(`/vehicles/${id}`, { method: "PATCH", body: input, token });
}

export type VehicleBooking = {
  id: string;
  vehicleId: string;
  dateDebut: string;
  dateFin: string;
  statut: "demandee" | "acceptee" | "refusee" | "terminee" | "annulee";
  message: string | null;
  prixJournalierSnapshot?: string | null;
  montantTotal?: string | null;
  devise?: string;
};

export function listVehicleBookings(token: string, vehicleId: string) {
  return apiRequest<VehicleBooking[]>(`/vehicles/${vehicleId}/bookings`, { token });
}

export function acceptBooking(token: string, id: string) {
  return apiRequest<VehicleBooking>(`/vehicle-bookings/${id}/accept`, { method: "PATCH", token });
}

export function rejectBooking(token: string, id: string) {
  return apiRequest<VehicleBooking>(`/vehicle-bookings/${id}/reject`, { method: "PATCH", token });
}

export function completeBooking(token: string, id: string) {
  return apiRequest<VehicleBooking>(`/vehicle-bookings/${id}/complete`, { method: "PATCH", token });
}

export const VEHICLE_TYPES = ["voiture", "moto", "camionnette", "pick_up", "camion", "autre"] as const;

export function getVehicle(id: string) {
  return apiRequest<VehicleDetail>(`/vehicles/${id}`);
}

export function bookVehicle(token: string, vehicleId: string, dateDebut: string, dateFin: string, message?: string) {
  return apiRequest<{ id: string; statut: string }>(`/vehicles/${vehicleId}/book`, {
    method: "POST",
    body: { dateDebut, dateFin, message },
    token,
  });
}
