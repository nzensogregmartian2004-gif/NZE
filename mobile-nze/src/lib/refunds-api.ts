import { apiRequest } from "./api";

export type RefundMotif = "produit_non_fonctionnel" | "produit_non_conforme" | "non_recu" | "autre";
export type RefundStatus = "en_attente_decision" | "remplacement_a_organiser" | "remboursement_a_executer" | "rembourse" | "refusee";

export type Refund = {
  id: string;
  orderId: string;
  motif: RefundMotif;
  description: string | null;
  montantDemande: string;
  statut: RefundStatus;
  decisionNote: string | null;
  echeanceLe: string;
  enRetard: boolean;
  referenceVirement: string | null;
  confirmeLe: string | null;
  creeLe: string;
};

export const REFUND_MOTIF_LABELS: Record<RefundMotif, string> = {
  produit_non_fonctionnel: "Le produit ne fonctionne pas",
  produit_non_conforme: "Le produit n'est pas conforme à la description",
  non_recu: "Je n'ai pas reçu le produit",
  autre: "Autre motif",
};

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  en_attente_decision: "En attente de la décision du vendeur",
  remplacement_a_organiser: "Remplacement en cours d'organisation",
  remboursement_a_executer: "Remboursement en cours de traitement",
  rembourse: "Remboursement effectué",
  refusee: "Demande refusée",
};

export function createRefund(token: string, input: { orderId: string; motif: RefundMotif; description?: string }) {
  return apiRequest<Refund>("/refunds", { method: "POST", body: input, token });
}

export function listMyRefunds(token: string) {
  return apiRequest<Refund[]>("/refunds/mine", { token });
}
