// Store d'authentification : source unique de la session (statut, utilisateur, jeton).
// Il est restauré au démarrage à partir du jeton stocké. useSession (src/auth/session.tsx) en est une façade.
import { create } from "zustand";
import { effacerJeton, enregistrerJeton, lireJeton } from "@/api/jeton";
import { arreterSurveillanceJeton, demarrerSurveillanceJeton, desenregistrerAppareilPush, enregistrerAppareilPush } from "@/lib/push";
import { ApiError } from "@/api/client";
import { moi, type ActivityType, type UserActivity, type Utilisateur } from "@/lib/auth-api";

export type Me = {
  id: string;
  role: string;
  telephone: string;
  nom: string;
  prenom: string;
  email: string | null;
  langue: "fr" | "en" | "ar" | "zh-Hans";
  telephoneVerifie: boolean;
  statut: "actif";
  isAdmin: boolean;
  activities: UserActivity[];
  conditionsAcceptees: boolean;
};

const ACTIVITE_PAR_ROLE: Record<string, ActivityType> = { client: "client", partenaire: "commercant", livreur: "livreur" };

export function versMe(u: Utilisateur): Me {
  const type = ACTIVITE_PAR_ROLE[u.role];
  return {
    id: u.id,
    role: u.role,
    telephone: u.telephone ?? "",
    nom: u.nomAffiche ?? "",
    prenom: "",
    email: null,
    langue: (u.langue ?? "fr") as Me["langue"],
    telephoneVerifie: true,
    statut: "actif",
    isAdmin: u.role === "admin_principal" || u.role === "admin_secondaire",
    activities: type ? [{ id: `${u.id}:${type}`, type, statut: "active" }] : [],
    conditionsAcceptees: u.conditionsAcceptees ?? false,
  };
}

type SessionState = {
  statut: "chargement" | "connecte" | "deconnecte";
  utilisateur: Utilisateur | null;
  accessToken: string | null;
  user: Me | null;
  hydrate: () => Promise<void>;
  ouvrirSession: (r: { token: string; utilisateur: Utilisateur }) => Promise<void>;
  refreshMe: () => Promise<void>;
  deconnecter: () => Promise<void>;
  logout: () => Promise<void>;
};

const SANS_SESSION = { statut: "deconnecte" as const, utilisateur: null, accessToken: null, user: null };

export const useAuthStore = create<SessionState>((set, get) => ({
  statut: "chargement",
  utilisateur: null,
  accessToken: null,
  user: null,

  hydrate: async () => {
    const jeton = await lireJeton();
    if (!jeton) return set(SANS_SESSION);
    try {
      const r = await moi();
      set({ statut: "connecte", utilisateur: r.utilisateur, accessToken: jeton, user: versMe(r.utilisateur) });
      // Push : renouvelle l'enregistrement au démarrage, sans nouvelle demande de permission, et surveille le renouvellement du jeton.
      void enregistrerAppareilPush(false).catch(() => undefined);
      demarrerSurveillanceJeton();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // Push : l'appareil est retiré du compte avant que la session ne soit effacée (silencieux si la session est déjà expirée).
        arreterSurveillanceJeton();
        await desenregistrerAppareilPush().catch(() => undefined);
        await effacerJeton();
        return set(SANS_SESSION);
      }
      // Panne réseau ou serveur : le jeton n'est pas effacé, la session sera relue au prochain démarrage.
      set(SANS_SESSION);
    }
  },

  ouvrirSession: async (r) => {
    await enregistrerJeton(r.token);
    // Push : enregistrement silencieux ; un échec ne bloque jamais la connexion.
    void enregistrerAppareilPush().catch(() => undefined);
    demarrerSurveillanceJeton();
    set({ statut: "connecte", accessToken: r.token, utilisateur: r.utilisateur, user: versMe(r.utilisateur) });
    try {
      const m = await moi();
      set({ utilisateur: m.utilisateur, user: versMe(m.utilisateur) });
    } catch {
      // Le profil complet sera relu au prochain démarrage.
    }
  },

  refreshMe: async () => {
    const m = await moi();
    set({ utilisateur: m.utilisateur, user: versMe(m.utilisateur) });
  },

  deconnecter: async () => {
    // Push : l'appareil est retiré du compte avant que la session ne soit effacée (silencieux si la session est déjà expirée).
    arreterSurveillanceJeton();
    await desenregistrerAppareilPush().catch(() => undefined);
    await effacerJeton();
    set(SANS_SESSION);
  },

  logout: async () => {
    await get().deconnecter();
  },
}));
