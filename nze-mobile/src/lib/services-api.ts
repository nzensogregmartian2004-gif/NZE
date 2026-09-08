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
