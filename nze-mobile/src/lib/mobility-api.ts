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

export type Ride = {
  id: string;
  typeService: "taxi" | "moto";
  statut: string;
  positionDepartLatitude: number;
  positionDepartLongitude: number;
  positionArriveeLatitude: number | null;
  positionArriveeLongitude: number | null;
  prixEstime: string | null;
  creeLe: string;
};

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

export function createRide(
  token: string,
  input: {
    typeService: "taxi" | "moto";
    positionDepart: { latitude: number; longitude: number };
    positionArrivee: { latitude: number; longitude: number };
  }
) {
  return apiRequest<Ride & { distanceKm: number }>("/rides", { method: "POST", body: input, token });
}

export function listMyRides(token: string) {
  return apiRequest<Ride[]>("/rides/me", { token });
}

export function cancelRide(token: string, id: string) {
  return apiRequest<Ride>(`/rides/${id}/cancel`, { method: "PATCH", token });
}

export const RIDE_STATUS_LABELS: Record<string, string> = {
  demandee: "Recherche d'un chauffeur",
  chauffeur_recherche: "Recherche d'un chauffeur",
  acceptee: "Chauffeur trouvé",
  en_cours: "Course en cours",
  terminee: "Course terminée",
  annulee: "Annulée",
};

export const CANCELLABLE_RIDE_STATUSES = ["demandee", "chauffeur_recherche", "acceptee"];
