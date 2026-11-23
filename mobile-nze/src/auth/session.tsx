// Façade de session : lit le store d'authentification. Le store est restauré au démarrage par SessionProvider.
import React, { useEffect } from "react";
import { useAuthStore } from "../store/auth";
import type { Utilisateur } from "../lib/auth-api";

export type { Utilisateur };

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  return <>{children}</>;
}

export function useSession() {
  const statut = useAuthStore((s) => s.statut);
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const ouvrirSession = useAuthStore((s) => s.ouvrirSession);
  const deconnecter = useAuthStore((s) => s.deconnecter);
  return { statut, utilisateur, ouvrirSession, deconnecter };
}
