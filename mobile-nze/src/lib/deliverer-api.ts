import { apiRequest } from "./api";

export type Deliverer = {
  id: string;
  typeVehicule: string;
  disponible: boolean;
  statutValidation: "en_attente" | "valide" | "refuse" | "suspendu";
};

export function getMyDelivererProfile(token: string) {
  return apiRequest<Deliverer>("/deliverers/me", { token });
}

export function registerDeliverer(token: string, typeVehicule: string) {
  return apiRequest<Deliverer>("/deliverers/register", { method: "POST", body: { typeVehicule }, token });
}

export function setDelivererAvailability(token: string, disponible: boolean) {
  return apiRequest<Deliverer>("/deliverers/me/availability", { method: "PATCH", body: { disponible }, token });
}

export function updateDelivererLocation(token: string, latitude: number, longitude: number) {
  return apiRequest<{ message: string }>("/deliverers/me/location", {
    method: "POST",
    body: { latitude, longitude },
    token,
  });
}

export type DeliveryMission = {
  id: string;
  statut: string;
  typeLivraison: string | null;
  description: string | null;
  remuneration: string | null;
  positionDepartLatitude: number | null;
  positionDepartLongitude: number | null;
  positionClientLatitude: number | null;
  positionClientLongitude: number | null;
  preuveRequise?: boolean;
  preuveEnregistree?: boolean;
};

export function listMyDeliveries(token: string) {
  return apiRequest<DeliveryMission[]>("/deliveries/mine", { token });
}

export function updateDeliveryStatus(
  token: string,
  id: string,
  statut: string,
  proof?: { preuveType: "code" | "signature" | "photo" | "autre"; preuveReference: string },
) {
  return apiRequest<DeliveryMission>(`/deliveries/${id}/status`, {
    method: "PATCH", body: { statut, ...(proof ?? {}) }, token,
  });
}

export const DELIVERER_TYPES = ["moto", "voiture", "camionnette", "pick-up", "camion", "velo"] as const;

// Ordre exact attendu par le backend — impossible de sauter une étape
export const DELIVERY_STATUS_SEQUENCE = [
  "acceptee",
  "en_route_vers_magasin",
  "arrive_au_magasin",
  "produit_recupere",
  "en_route_vers_client",
  "arrive_chez_client",
  "livraison_terminee",
] as const;

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  nouvelle: "Nouvelle",
  livreur_attribue: "À accepter",
  acceptee: "Acceptée",
  en_route_vers_magasin: "En route vers le magasin",
  arrive_au_magasin: "Arrivé au magasin",
  produit_recupere: "Produit récupéré",
  en_route_vers_client: "En route vers le client",
  arrive_chez_client: "Arrivé chez le client",
  livraison_terminee: "Terminée",
  annulee: "Annulée",
};
