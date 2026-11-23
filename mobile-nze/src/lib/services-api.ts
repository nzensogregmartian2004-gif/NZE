import { apiRequest } from "./api";

export type ServiceProfile = {
  id: string;
  userActivityId: string;
  metier: string;
  zoneIntervention: string | null;
  tarifIndicatif: string | null;
  description: string | null;
  disponible: boolean;
  noteMoyenne: string | null;
  statutValidation: "en_attente" | "valide" | "refuse" | "suspendu";
};

export type ServiceProfileDetail = ServiceProfile & {
  competences: Array<{ id: string; competence: string }>;
  userId: string | null;
};

export type ServicePost = {
  id: string;
  serviceProfileId: string;
  titre: string;
  description: string | null;
  creeLe: string;
};

export type ServicePostDetail = ServicePost & {
  photos: Array<{ id: string; url: string }>;
  likes: number;
  travailVerifie: boolean;
};

export function listServiceProfiles(params: { metier?: string; disponible?: boolean } = {}) {
  const search = new URLSearchParams();
  if (params.metier) search.set("metier", params.metier);
  if (params.disponible !== undefined) search.set("disponible", String(params.disponible));
  const qs = search.toString();
  return apiRequest<ServiceProfile[]>(`/service-profiles${qs ? `?${qs}` : ""}`);
}

export function getServiceProfile(id: string) {
  return apiRequest<ServiceProfileDetail>(`/service-profiles/${id}`);
}

export function getMyServiceProfile(token: string) {
  return apiRequest<ServiceProfileDetail | null>("/service-profiles/mine", { token });
}

export type CreateServiceProfileInput = {
  metier: string;
  zoneIntervention?: string;
  tarifIndicatif?: string;
  description?: string;
  competences?: string[];
};

export function createServiceProfile(token: string, input: CreateServiceProfileInput) {
  return apiRequest<ServiceProfileDetail>("/service-profiles", { method: "POST", body: input, token });
}

export function updateServiceProfile(token: string, id: string, input: Partial<CreateServiceProfileInput & { disponible: boolean }>) {
  return apiRequest<ServiceProfileDetail>(`/service-profiles/${id}`, { method: "PATCH", body: input, token });
}

export type CreateServicePostInput = { titre: string; description?: string };

export function createServicePost(token: string, serviceProfileId: string, input: CreateServicePostInput) {
  return apiRequest<ServicePost>(`/service-profiles/${serviceProfileId}/posts`, {
    method: "POST",
    body: input,
    token,
  });
}

export function listServicePosts(serviceProfileId: string) {
  return apiRequest<ServicePost[]>(`/service-profiles/${serviceProfileId}/posts`);
}

export function getServicePost(id: string) {
  return apiRequest<ServicePostDetail>(`/service-posts/${id}`);
}

export function likePost(token: string, id: string) {
  return apiRequest<void>(`/service-posts/${id}/like`, { method: "POST", token });
}

export function unlikePost(token: string, id: string) {
  return apiRequest<void>(`/service-posts/${id}/like`, { method: "DELETE", token });
}


export type ServiceRequestStatus = "recu" | "acceptee" | "refusee" | "en_cours" | "terminee" | "annulee";

export type ServiceRequest = {
  id: string;
  serviceProfileId: string;
  clientActivityId: string;
  description: string;
  dateSouhaitee: string | null;
  dateConfirmee: string | null;
  lieuIntervention: string | null;
  budgetIndicatif: string | null;
  prixAccepte: string | null;
  commentairePrestataire: string | null;
  statut: ServiceRequestStatus;
  creeLe: string;
  majLe: string;
  serviceProfile?: { id: string; metier: string; zoneIntervention: string | null };
  client?: { prenom: string; nom: string; telephone: string };
};

export type ServiceRequestStats = {
  profileId: string;
  vuesProfil: number;
  totalDemandes: number;
  demandesRecues: number;
  demandesAcceptees: number;
  prestationsEnCours: number;
  prestationsTerminees: number;
  demandesRefusees: number;
  demandesAnnulees: number;
  avisRecus: number;
  valeurConvenuePrestationsTermineesXAF: number;
  avertissementFinancier: string;
};

export function createServiceRequest(token: string, input: {
  serviceProfileId: string;
  description: string;
  dateSouhaitee?: string;
  lieuIntervention?: string;
  budgetIndicatif?: number;
}) {
  return apiRequest<ServiceRequest>("/service-requests", { method: "POST", body: input, token });
}

export function listMyServiceRequests(token: string) {
  return apiRequest<ServiceRequest[]>("/service-requests/mine", { token });
}

export function listIncomingServiceRequests(token: string) {
  return apiRequest<ServiceRequest[]>("/service-requests/inbox", { token });
}

export function updateServiceRequestStatus(token: string, id: string, input: {
  action: "accepter" | "refuser" | "commencer" | "terminer";
  prixAccepte?: number;
  dateConfirmee?: string;
  commentairePrestataire?: string;
}) {
  return apiRequest<ServiceRequest>(`/service-requests/${id}/status`, { method: "PATCH", body: input, token });
}

export function cancelMyServiceRequest(token: string, id: string) {
  return apiRequest<ServiceRequest>(`/service-requests/${id}/cancel`, { method: "PATCH", token });
}

export function getMyServiceRequestStats(token: string) {
  return apiRequest<ServiceRequestStats>("/service-requests/stats/mine", { token });
}

export function getMyServiceCalendar(token: string, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  return apiRequest<ServiceRequest[]>(`/service-requests/calendar/mine${query ? `?${query}` : ""}`, { token });
}

export type ServiceReview = {
  id: string;
  auteurId: string;
  cibleType: string;
  cibleId: string;
  note: number;
  commentaire: string | null;
  verifie: boolean;
  creeLe: string;
};

export function listServiceReviews(serviceProfileId: string) {
  return apiRequest<ServiceReview[]>(`/reviews?cibleType=prestataire&cibleId=${encodeURIComponent(serviceProfileId)}`);
}

export function createServiceReview(token: string, input: { cibleId: string; note: number; commentaire?: string }) {
  return apiRequest<ServiceReview>("/reviews", {
    method: "POST",
    token,
    body: { cibleType: "prestataire", ...input },
  });
}
