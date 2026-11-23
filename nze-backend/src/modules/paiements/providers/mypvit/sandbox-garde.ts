// Garde-fous du banc d'essai MyPVit (lot 4 de l'audit). Fonction pure : aucun appel réseau.
// Le banc d'essai ne doit jamais toucher la production, dont l'adresse est la valeur par défaut de la configuration.
export const URL_PRODUCTION_MYPVIT = 'https://api.mypvit.pro';

export function verifierGardeSandbox(env: Record<string, string | undefined>): string | null {
  if (env.APP_ENV === 'production') {
    return 'APP_ENV=production : le banc d’essai ne s’exécute jamais en production.';
  }
  const base = env.MYPVIT_BASE_URL?.trim();
  if (!base) {
    return 'MYPVIT_BASE_URL doit être renseignée explicitement, avec l’adresse de test fournie par MyPVit (la valeur par défaut est la production).';
  }
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return 'MYPVIT_BASE_URL n’est pas une URL valide.';
  }
  if (url.protocol !== 'https:') {
    return 'MYPVIT_BASE_URL doit être en https.';
  }
  if (url.origin === URL_PRODUCTION_MYPVIT || url.hostname === 'api.mypvit.pro') {
    return 'MYPVIT_BASE_URL pointe vers la production : arrêt.';
  }
  if (env.SANDBOX_CONFIRME !== 'oui') {
    return 'SANDBOX_CONFIRME=oui est requis : confirmer que cette adresse est bien un banc d’essai fourni par MyPVit.';
  }
  return null;
}

// Classe la relation entre le montant demandé, les frais et le total renvoyés par MyPVit.
// FRAIS_EN_PLUS : le client paie montant + frais. FRAIS_INCLUS : le total est le montant. INDETERMINE : autre cas, à examiner.
export function classerFrais(montant: number, frais: number, total: number): "FRAIS_EN_PLUS" | "FRAIS_INCLUS" | "INDETERMINE" {
  if (total === montant + frais && frais > 0) return "FRAIS_EN_PLUS";
  if (total === montant) return "FRAIS_INCLUS";
  return "INDETERMINE";
}
