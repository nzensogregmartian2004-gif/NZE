import { apiRequest } from "./api";

export type Driver = {
  id: string;
  typeService: "taxi" | "moto";
  disponible: boolean;
  statutValidation: "en_attente" | "valide" | "refuse" | "suspendu";
};

export function getMyDriverProfile(token: string) {
  return apiRequest<Driver>("/drivers/me", { token });
}

export function registerDriver(token: string, typeService: "taxi" | "moto") {
  return apiRequest<Driver>("/drivers/register", { method: "POST", body: { typeService }, token });
}

export function setDriverAvailability(token: string, disponible: boolean) {
  return apiRequest<Driver>("/drivers/me/availability", { method: "PATCH", body: { disponible }, token });
}

export type AvailableRide = {
  id: string;
  typeService: "taxi" | "moto";
  statut: string;
  prixEstime: string | null;
  positionDepartLatitude: number;
  positionDepartLongitude: number;
};

export function listAvailableRides(token: string) {
  return apiRequest<AvailableRide[]>("/rides/available", { token });
}

export function acceptRide(token: string, id: string) {
  return apiRequest<AvailableRide>(`/rides/${id}/accept`, { method: "PATCH", token });
}

export function startRide(token: string, id: string) {
  return apiRequest<AvailableRide>(`/rides/${id}/start`, { method: "PATCH", token });
}

export function completeRide(token: string, id: string) {
  return apiRequest<AvailableRide>(`/rides/${id}/complete`, { method: "PATCH", token });
}
