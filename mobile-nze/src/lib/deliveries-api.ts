import { apiRequest } from "./api";

export type DeliveryQuote = {
  storeId: string;
  prestataire: "nze" | "propre";
  distanceKm: number;
  sourceDistance: "google_routes" | "haversine";
  tarifBase: number;
  tarifKm: number;
  fraisLivraison: number;
  devise: "XAF";
};

export function quoteDelivery(
  token: string,
  storeId: string,
  destination: { latitude: number; longitude: number },
  prestataire?: "nze" | "propre",
) {
  return apiRequest<DeliveryQuote>("/deliveries/quote", {
    method: "POST", token,
    body: { storeId, destination, ...(prestataire ? { prestataire } : {}) },
  });
}

export type GlobalDeliveryPricing = {
  id: number;
  active: boolean;
  baseFee: string;
  feePerKm: string;
  maxDistanceKm: number;
  majLe: string;
};
export type AdminDelivery = {
  id: string;
  statut: string;
  typeLivraison: string | null;
  description: string | null;
  remuneration: string | null;
  positionDepartLatitude: number | null;
  positionDepartLongitude: number | null;
  positionClientLatitude: number | null;
  positionClientLongitude: number | null;
};
export type AvailableDeliverer = {
  id: string;
  typeVehicule: string;
  disponible: boolean;
  statutValidation: string;
};

export function getGlobalDeliveryPricing(token: string) {
  return apiRequest<GlobalDeliveryPricing>("/deliveries/pricing", { token });
}
export function saveGlobalDeliveryPricing(token: string, input: Partial<Pick<GlobalDeliveryPricing, "active" | "maxDistanceKm">> & { baseFee?: number; feePerKm?: number }) {
  return apiRequest<GlobalDeliveryPricing>("/deliveries/pricing", { method: "PATCH", token, body: input });
}
export function listPendingDeliveries(token: string) {
  return apiRequest<AdminDelivery[]>("/deliveries/pending", { token });
}
export function listAvailableDeliverers(token: string) {
  return apiRequest<AvailableDeliverer[]>("/deliveries/available-deliverers", { token });
}
export function assignDelivery(token: string, deliveryId: string, delivererId: string) {
  return apiRequest<AdminDelivery>(`/deliveries/${deliveryId}/assign`, { method: "PATCH", token, body: { delivererId } });
}
