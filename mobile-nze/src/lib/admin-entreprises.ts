// Aides de saisie des écrans d'administration : entreprises, accords, états du stock, registres.
// Les libellés sont des clés de traduction (voir src/i18n/dictionnaire.ts).
export const STATUTS_ENTREPRISE = [
  { code: 'prospect', cle: 'statut.prospect' },
  { code: 'negociation', cle: 'statut.negociation' },
  { code: 'actif', cle: 'statut.actif' },
  { code: 'suspendu', cle: 'statut.suspendu' },
  { code: 'cloture', cle: 'statut.cloture' },
] as const;

export const ETATS_STOCK = [
  { code: 'DISPONIBLE', cle: 'etat.DISPONIBLE' },
  { code: 'COLLECTE', cle: 'etat.COLLECTE' },
  { code: 'INDISPONIBLE', cle: 'etat.INDISPONIBLE' },
  { code: 'A_CONFIRMER', cle: 'etat.A_CONFIRMER' },
] as const;

export const REGISTRES = [
  { code: 'TOUS', cle: 'registre.TOUS' },
  { code: 'CLIENT', cle: 'registre.CLIENT' },
  { code: 'COMMISSIONS', cle: 'registre.COMMISSIONS' },
  { code: 'PARTENAIRE', cle: 'registre.PARTENAIRE' },
] as const;

// « 12,5 » -> 1250 points de base. Refuse toute valeur hors de 0 à 100 %.
export function pourcentageVersBps(texte: string): number | null {
  const propre = texte.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(propre)) return null;
  const valeur = Number(propre);
  if (valeur < 0 || valeur > 100) return null;
  return Math.round(valeur * 100);
}

// « 2026-06-01 » -> « 2026-06-01T00:00:00.000Z ». Refuse les dates inexistantes.
export function dateVersIso(texte: string): string | null {
  const propre = texte.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(propre)) return null;
  const date = new Date(`${propre}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== propre) return null;
  return `${propre}T00:00:00.000Z`;
}

// Clé de traduction d'un état du stock (ou le code lui-même s'il est inconnu).
export function cleEtat(code: string): string {
  return ETATS_STOCK.find((e) => e.code === code)?.cle ?? code;
}
