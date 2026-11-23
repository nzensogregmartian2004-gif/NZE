import { apiRequest } from "./api";

export type SignaturePoint = { x: number; y: number };
export type SignatureStroke = SignaturePoint[];
export type RefusalMotif = "produit_non_fonctionnel" | "produit_non_conforme" | "client_absent" | "autre";

export const REFUSAL_LABELS: Record<RefusalMotif, string> = {
  produit_non_fonctionnel: "Produit non fonctionnel",
  produit_non_conforme: "Produit non conforme",
  client_absent: "Client absent",
  autre: "Autre",
};

/** Le client a signé et confirme que le colis est bien reçu et en bon état. */
export function recordSignatureProof(token: string, deliveryId: string, signature: SignatureStroke[]) {
  return apiRequest<{ id: string; resultat: string }>(`/deliveries/${deliveryId}/proof`, {
    method: "POST",
    body: { resultat: "livree", methode: "signature", signature, colisConforme: true },
    token,
  });
}

/** Le client refuse la remise. La livraison reste ouverte et le client peut demander un remboursement. */
export function recordRefusalProof(token: string, deliveryId: string, motif: RefusalMotif, commentaire?: string) {
  return apiRequest<{ id: string; resultat: string }>(`/deliveries/${deliveryId}/proof`, {
    method: "POST",
    body: { resultat: "refusee", motif, ...(commentaire ? { commentaire } : {}) },
    token,
  });
}
