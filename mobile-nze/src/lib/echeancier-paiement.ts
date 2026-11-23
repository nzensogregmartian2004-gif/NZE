// Paiement d'une échéance : logique pure (montant saisi et reste à payer par article).
export interface ArticleSolde {
  echeancierId: string;
  nom: string;
  principalRestantFcfa: number;
  penalitesRestantesFcfa: number;
}

// Reste à payer d'un article : mensualités restantes et pénalités dues.
export function restantArticle(a: { principalRestantFcfa: number; penalitesRestantesFcfa: number }): number {
  return a.principalRestantFcfa + a.penalitesRestantesFcfa;
}

// Montant saisi : un entier entre 1 et le reste à payer. Espaces tolérés ; tout le reste est refusé.
export function montantSaisi(texte: string, solde: number): number | null {
  const propre = texte.replace(/\s/g, '');
  if (!/^\d+$/.test(propre)) return null;
  const n = Number(propre);
  if (!Number.isSafeInteger(n) || n < 1 || n > solde) return null;
  return n;
}
