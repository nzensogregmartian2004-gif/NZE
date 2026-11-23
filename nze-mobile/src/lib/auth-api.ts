// Authentification : contrat réel du backend. Une session = un jeton (30 jours), pas de renouvellement ni de déconnexion serveur.
import { appeler } from "@/api/client";

export type ActivityType = "client" | "commercant" | "livreur";
export type UserActivity = { id: string; type: ActivityType; statut: "active" | "en_attente" | "refusee" | "suspendue" };

export type Utilisateur = {
  id: string;
  role: string;
  telephone?: string;
  nomAffiche?: string | null;
  langue?: string;
  /** false tant que la version actuelle des conditions n'est pas acceptée. */
  conditionsAcceptees?: boolean;
};

export function connexion(telephone: string, motDePasse: string) {
  return appeler<{ token: string; utilisateur: Utilisateur }>("/auth/connexion", {
    methode: "POST", corps: { telephone, motDePasse }, sansJeton: true,
  });
}

export function moi() {
  return appeler<{ utilisateur: Utilisateur }>("/auth/moi");
}
