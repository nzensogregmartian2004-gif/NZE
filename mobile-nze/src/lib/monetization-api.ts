import { apiRequest } from "./api";
import type { ActivityType } from "./auth-api";

export type SubscriptionPlan = {
  id: string;
  nom: string;
  prix: string;
  dureeJours: number;
  fonctionnalites: string[];
  actif: boolean;
  creeLe: string;
};

export type SubscriptionRecord = {
  id: string;
  userActivityId: string;
  planId: string;
  statut: "active" | "expiree" | "annulee" | "en_attente_paiement";
  debutLe: string | null;
  expireLe: string | null;
  creeLe: string;
  planNom: string;
  planPrix: string;
  planDureeJours: number;
  paiementId: string | null;
};

export type PromotionTargetType = "produit" | "magasin" | "prestataire" | "vehicule" | "hebergement";
export type PromotionTarget = { cibleType: PromotionTargetType; cibleId: string; label: string; userActivityId: string };
export type PromotionPrice = { id: string; cibleType: PromotionTargetType; emplacement: string; prixParJour: string; devise: "XAF"; actif: boolean };
export type PromotionCampaign = {
  id: string;
  cibleType: PromotionTargetType;
  cibleId: string;
  ownerActivityId: string | null;
  prix: string;
  emplacement: string | null;
  region: string | null;
  dateDebut: string;
  dateFin: string;
  statut: "en_attente" | "active" | "expiree" | "refusee";
  paiementStatut: "en_attente" | "confirme" | "echoue" | "incertain";
  impressions: number;
  clics: number;
  commandesAttribuees: number;
};

export function listSubscriptionPlans() {
  return apiRequest<SubscriptionPlan[]>("/subscription-plans");
}

export function listSubscriptionsForActivity(token: string, userActivityId: string) {
  return apiRequest<SubscriptionRecord[]>(`/subscriptions/mine/${encodeURIComponent(userActivityId)}`, { token });
}

export function startSubscription(token: string, input: {
  userActivityId: string;
  planId: string;
  customerAccountNumber?: string;
  operatorCode?: string;
}) {
  return apiRequest<{ message: string; subscriptionId?: string; subscription?: SubscriptionRecord; payment?: { id: string; statut: string }; providerMessage?: string }>("/subscriptions", {
    method: "POST", token, body: input,
  });
}

export function listPromotionTargets(token: string) {
  return apiRequest<PromotionTarget[]>("/advertisements/targets/mine", { token });
}

export function listPromotionPrices() {
  return apiRequest<PromotionPrice[]>("/advertisements/pricing");
}

export function listMyPromotionCampaigns(token: string) {
  return apiRequest<PromotionCampaign[]>("/advertisements/mine", { token });
}

export function createPromotionCampaign(token: string, input: {
  cibleType: PromotionTargetType;
  cibleId: string;
  emplacement: string;
  dateDebut: string;
  dateFin: string;
  region?: string;
  customerAccountNumber: string;
  operatorCode: string;
}) {
  return apiRequest<{ message: string; advertisement: PromotionCampaign; payment?: { id: string; statut: string }; days: number; pricePerDay: number; total: number; currency: string; providerMessage?: string }>("/advertisements", {
    method: "POST", token, body: input,
  });
}

export function listAdminSubscriptionPlans(token: string) {
  return apiRequest<SubscriptionPlan[]>("/subscription-plans/admin/all", { token });
}

export function createAdminSubscriptionPlan(token: string, input: { nom: string; prix: number; dureeJours: number; fonctionnalites: string[] }) {
  return apiRequest<SubscriptionPlan>("/subscription-plans", { method: "POST", token, body: input });
}

export function updateAdminSubscriptionPlan(token: string, id: string, input: Partial<{ nom: string; prix: number; dureeJours: number; fonctionnalites: string[]; actif: boolean }>) {
  return apiRequest<SubscriptionPlan>(`/subscription-plans/${id}`, { method: "PATCH", token, body: input });
}

export function listAdminPromotionPrices(token: string) {
  return apiRequest<PromotionPrice[]>("/advertisements/pricing/admin", { token });
}

export function createAdminPromotionPrice(token: string, input: { cibleType: PromotionTargetType; emplacement: string; prixParJour: number; devise: "XAF"; actif: boolean }) {
  return apiRequest<PromotionPrice>("/advertisements/pricing/admin", { method: "POST", token, body: input });
}

export function updateAdminPromotionPrice(token: string, id: string, input: Partial<{ cibleType: PromotionTargetType; emplacement: string; prixParJour: number; devise: "XAF"; actif: boolean }>) {
  return apiRequest<PromotionPrice>(`/advertisements/pricing/admin/${id}`, { method: "PATCH", token, body: input });
}

export function listPendingPromotions(token: string) {
  return apiRequest<PromotionCampaign[]>("/advertisements/pending", { token });
}

export function moderatePromotion(token: string, id: string, statut: "active" | "refusee", raison?: string) {
  return apiRequest<PromotionCampaign>(`/advertisements/${id}/validate`, { method: "PATCH", token, body: { statut, raison } });
}

export function createEditorialFeature(token: string, input: {
  cibleType: PromotionTargetType; cibleId: string; emplacement: string; libelle: string;
  ordre: number; dateDebut: string; dateFin: string; actif: boolean;
}) {
  return apiRequest<{ id: string }>("/advertisements/editorial/admin", { method: "POST", token, body: input });
}

export type MonetizationActivityType = ActivityType;

export type PublicPromotion = {
  id: string;
  cibleType: PromotionTargetType;
  cibleId: string;
  targetLabel: string;
  emplacement: string | null;
  isSponsored: true;
  sponsoredLabel: "Sponsorisé";
};

export type EditorialFeature = {
  id: string;
  cibleType: PromotionTargetType;
  cibleId: string;
  targetLabel: string;
  emplacement: string;
  libelle: string;
  isSponsored: false;
  editorialLabel: string;
};

export function listActivePromotions(emplacement?: string) {
  const query = emplacement ? `?emplacement=${encodeURIComponent(emplacement)}` : "";
  return apiRequest<PublicPromotion[]>(`/advertisements/active${query}`);
}

export function listActiveEditorialFeatures(emplacement?: string) {
  const query = emplacement ? `?emplacement=${encodeURIComponent(emplacement)}` : "";
  return apiRequest<EditorialFeature[]>(`/advertisements/editorial/active${query}`);
}

export function trackPromotionEvent(advertisementId: string, type: "impression" | "clic", eventKey: string) {
  return apiRequest<{ recorded: boolean }>(`/advertisements/${advertisementId}/events`, {
    method: "POST", body: { type, eventKey },
  });
}
