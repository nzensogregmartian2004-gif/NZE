import { apiRequest } from "./api";

export type Tokens = { accessToken: string; refreshToken: string };

export function register(input: {
  nom: string;
  prenom: string;
  telephone: string;
  email?: string;
  motDePasse: string;
}) {
  return apiRequest<{ message: string; userId: string }>("/auth/register", {
    method: "POST",
    body: input,
  });
}

export function verifyOtp(telephone: string, code: string) {
  return apiRequest<Tokens>("/auth/otp/verify", { method: "POST", body: { telephone, code } });
}

export function requestOtp(telephone: string) {
  return apiRequest<{ message: string }>("/auth/otp/request", { method: "POST", body: { telephone } });
}

export function login(telephone: string, motDePasse: string) {
  return apiRequest<Tokens>("/auth/login", { method: "POST", body: { telephone, motDePasse } });
}

export type ActivityType =
  | "client"
  | "commercant"
  | "prestataire"
  | "livreur"
  | "chauffeur"
  | "proprietaire_vehicule";

export type UserActivity = {
  id: string;
  type: ActivityType;
  statut: "active" | "en_attente" | "refusee" | "suspendue";
};

export type Me = {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  isAdmin: boolean;
  activities: UserActivity[];
};

export function getMe(token: string) {
  return apiRequest<Me>("/users/me", { token });
}

export function createActivity(token: string, type: ActivityType) {
  return apiRequest<UserActivity>("/users/me/activities", { method: "POST", body: { type }, token });
}
