import { Redirect } from 'expo-router';
import { Chargement } from '../src/components/ui';
import { useSession } from '../src/auth/session';

// Chaque rôle a son espace. Un rôle inconnu renvoie vers l'écran « bientôt disponible ».
export function cheminPourRole(role: string): string {
  if (role === 'client') return '/(tabs)';
  if (role === 'partenaire') return '/(partenaire)';
  if (role === 'livreur') return '/(livreur)';
  if (role === 'admin_principal' || role === 'admin_secondaire') return '/(admin)';
  return '/bientot';
}

export default function Entree() {
  const { statut, utilisateur } = useSession();
  if (statut === 'chargement') return <Chargement />;
  // Sans compte, l'accueil est le catalogue : la connexion n'est demandée qu'au moment d'acheter.
  if (statut === 'deconnecte' || !utilisateur) return <Redirect href="/(tabs)" />;
  return <Redirect href={cheminPourRole(utilisateur.role)} />;
}
