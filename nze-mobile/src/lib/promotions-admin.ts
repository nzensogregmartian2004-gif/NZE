// Gestion des promotions (administration) : statut d'une promotion et contrôle des saisies.
// Les dates sont au format AAAA-MM-JJ, à l'heure de Libreville, comme côté serveur.
export type StatutPromotion = 'A_VENIR' | 'EN_COURS' | 'TERMINEE';

export function statutPromotion(debut: string, fin: string, maintenant: Date = new Date()): StatutPromotion {
  const m = maintenant.getTime();
  if (m < Date.parse(`${debut}T00:00:00+01:00`)) return 'A_VENIR';
  if (m >= Date.parse(`${fin}T23:59:59+01:00`)) return 'TERMINEE';
  return 'EN_COURS';
}

export function jourValide(texte: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texte)) return false;
  return new Date(`${texte}T00:00:00Z`).toISOString().slice(0, 10) === texte;
}

export function periodeValide(debut: string, fin: string): boolean {
  return jourValide(debut) && jourValide(fin) && debut <= fin;
}

export function pourcentageValide(texte: string): boolean {
  return /^\d{1,2}$/.test(texte) && Number(texte) >= 1 && Number(texte) <= 90;
}
