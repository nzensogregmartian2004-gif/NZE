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
  statutValidation: "en_attente" | "valide" | "refuse" | "suspendu";
};

export type VehicleDetail = Vehicle & { photos: Array<{ id: string; url: string }> };

export type VehicleBooking = {
  id: string;
  vehicleId: string;
  dateDebut: string;
  dateFin: string;
  statut: "demandee" | "acceptee" | "refusee" | "terminee" | "annulee";
  message: string | null;
};

export function rejectBooking(token: string, id: string) {
  return apiRequest<VehicleBooking>(`/vehicle-bookings/${id}/reject`, { method: "PATCH", token });
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

