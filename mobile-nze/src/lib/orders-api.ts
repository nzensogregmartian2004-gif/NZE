import { apiRequest } from "./api";

export type Order = {
  id: string;
  storeId: string;
  statut: "nouvelle" | "confirmee" | "produit_pret" | "terminee" | "annulee";
  total: string;
  fraisLivraison?: string;
  distanceLivraisonKm?: number | null;
  prestataireLivraison?: "nze" | "propre" | null;
  creeLe: string;
};

export type DeliveryTracking = {
  id: string;
  statut: string;
  positionLivreur: { latitude: number; longitude: number } | null;
  positionDepart: { latitude: number | null; longitude: number | null };
  positionClient: { latitude: number | null; longitude: number | null };
  distanceKm?: number | null;
  fraisLivraison?: string | number;
  preuveEnregistree?: boolean;
  preuveType?: string | null;
};

export function listMyOrders(token: string) {
  return apiRequest<Order[]>("/orders/me", { token });
}

export function getOrder(token: string, id: string) {
  return apiRequest<Order & { items: unknown[]; historique?: Array<{ fromStatus: Order["statut"] | null; toStatus: Order["statut"]; creeLe: string; note: string | null }> }>(`/orders/${id}`, { token });
}

export function cancelOrder(token: string, id: string) {
  return apiRequest<Order>(`/orders/${id}/status`, { method: "PATCH", body: { statut: "annulee" }, token });
}

/** Renvoie null si la commande n'a pas encore de livraison associée. */
export async function getDeliveryTrackingForOrder(token: string, orderId: string) {
  try {
    return await apiRequest<DeliveryTracking>(`/deliveries/by-order/${orderId}/tracking`, { token });
  } catch {
    return null;
  }
}

export const ORDER_STATUS_LABELS: Record<Order["statut"], string> = {
  nouvelle: "Nouvelle",
  confirmee: "Confirmée par le magasin",
  produit_pret: "Produit prêt",
  terminee: "Terminée",
  annulee: "Annulée",
};

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  nouvelle: "Recherche d'un livreur",
  en_attente: "En attente",
  livreur_recherche: "Recherche d'un livreur",
  livreur_attribue: "Livreur attribué",
  acceptee: "Acceptée par le livreur",
  en_route_vers_magasin: "Livreur en route vers le magasin",
  arrive_au_magasin: "Livreur arrivé au magasin",
  produit_recupere: "Produit récupéré",
  en_route_vers_client: "Livreur en route vers toi",
  arrive_chez_client: "Livreur arrivé",
  livraison_terminee: "Livraison terminée",
  annulee: "Annulée",
};
