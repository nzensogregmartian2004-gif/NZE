import { apiRequest } from "./api";

export const LODGING_TYPES = ["hotel", "motel", "auberge", "maison_hotes", "chambre", "studio", "appartement", "maison", "villa"] as const;
export type LodgingType = typeof LODGING_TYPES[number];
export type Lodging = {
  id: string; type: LodgingType; nom: string; description: string | null; adresse: string; ville: string; quartier: string | null;
  prixParNuit: string; capacite: number; chambres: number | null; sallesDeBain: number | null; equipements: string[];
  heureArrivee: string; heureDepart: string; regles: string | null; disponible: boolean; statutValidation: "en_attente" | "valide" | "refuse" | "suspendu";
  latitude: number | null; longitude: number | null; nombreVues: number; noteMoyenne: string | null; nombreAvis: number;
};
export type LodgingDetail = Lodging & { photos: Array<{ id: string; url: string; ordre: number }> };
export type LodgingBooking = { id: string; lodgingId: string; dateDebut: string; dateFin: string; nombreVoyageurs: number; prixNuitSnapshot: string; montantTotal: string; devise: string; statut: "demandee" | "acceptee" | "refusee" | "terminee" | "annulee"; message: string | null; creeLe: string };

export function listLodgings(params: { type?: string; ville?: string; personnes?: number; prixMin?: number; prixMax?: number } = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== "") query.set(key, String(value)); });
  const qs = query.toString();
  return apiRequest<Lodging[]>(`/lodgings${qs ? `?${qs}` : ""}`);
}
export function getLodging(id: string) { return apiRequest<LodgingDetail>(`/lodgings/${id}`); }
export function listMyLodgings(token: string) { return apiRequest<Lodging[]>("/lodgings/me/mine", { token }); }
export type CreateLodgingInput = {
  type: LodgingType; nom: string; description?: string; adresse: string; ville: string; quartier?: string; prixParNuit: number;
  capacite: number; chambres?: number; sallesDeBain?: number; equipements?: string[]; heureArrivee?: string; heureDepart?: string; regles?: string; photos?: string[];
};
export function createLodging(token: string, input: CreateLodgingInput) { return apiRequest<Lodging>("/lodgings", { method: "POST", body: input, token }); }
export function updateLodging(token: string, id: string, input: Partial<CreateLodgingInput & { disponible: boolean }>) { return apiRequest<Lodging>(`/lodgings/${id}`, { method: "PATCH", body: input, token }); }
export function createLodgingBooking(token: string, id: string, dateDebut: string, dateFin: string, nombreVoyageurs: number, message?: string) {
  return apiRequest<LodgingBooking>(`/lodgings/${id}/book`, { method: "POST", body: { dateDebut, dateFin, nombreVoyageurs, message }, token });
}
export function listLodgingBookings(token: string, lodgingId: string) { return apiRequest<LodgingBooking[]>(`/lodgings/${lodgingId}/bookings`, { token }); }
export function listMyLodgingBookings(token: string) { return apiRequest<LodgingBooking[]>("/lodging-bookings/me", { token }); }
export function acceptLodgingBooking(token: string, id: string) { return apiRequest<LodgingBooking>(`/lodging-bookings/${id}/accept`, { method: "PATCH", token }); }
export function rejectLodgingBooking(token: string, id: string) { return apiRequest<LodgingBooking>(`/lodging-bookings/${id}/reject`, { method: "PATCH", token }); }
export function completeLodgingBooking(token: string, id: string) { return apiRequest<LodgingBooking>(`/lodging-bookings/${id}/complete`, { method: "PATCH", token }); }
export function cancelLodgingBooking(token: string, id: string, raison?: string) { return apiRequest<LodgingBooking>(`/lodging-bookings/${id}/cancel`, { method: "PATCH", body: { raison }, token }); }
export function listMyVehicleBookings(token: string) { return apiRequest<any[]>("/vehicle-bookings/me", { token }); }
export function cancelVehicleBooking(token: string, id: string, raison?: string) { return apiRequest<any>(`/vehicle-bookings/${id}/cancel`, { method: "PATCH", body: { raison }, token }); }
