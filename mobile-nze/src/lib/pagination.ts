// Pagination du catalogue côté application : taille des pages et fusion sans doublon.
// La taille doit rester sous le plafond de l'API (100 par page).

export const TAILLE_PAGE = 24;     // liste principale de l'accueil, page par page
export const TAILLE_RANGEE = 10;   // articles par rangée de catégorie

// Une page pleine laisse supposer une suite ; une page incomplète marque la fin.
export function uneSuiteExiste(recus: number, taille: number): boolean {
  return recus >= taille;
}

// Ajoute la nouvelle page à la suite, sans répéter un article déjà affiché (un article peut
// bouger entre deux pages si le catalogue change). L'ordre des pages est conservé.
export function fusionnerPages<T extends { id: string }>(existants: T[], nouveaux: T[]): T[] {
  const vus = new Set(existants.map((p) => p.id));
  return [...existants, ...nouveaux.filter((p) => !vus.has(p.id))];
}

// Rafraîchissement d'un fil de messages : la dernière page remplace les messages récents, sans effacer
// les plus anciens déjà chargés. Un message reçu deux fois n'apparaît qu'une fois.
export function rafraichirFil<T extends { id: string; createdAt: string }>(actuels: T[], derniere: T[]): T[] {
  const debut = derniere[0] ? new Date(derniere[0].createdAt).getTime() : Infinity;
  const recus = new Set(derniere.map((m) => m.id));
  const anciensGardes = actuels.filter((m) => !recus.has(m.id) && new Date(m.createdAt).getTime() < debut);
  return [...anciensGardes, ...derniere];
}
