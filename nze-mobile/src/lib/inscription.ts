// Inscription : validation de la date de naissance (format AAAA-MM-JJ, date réelle, pas dans le futur).
export function dateNaissanceValide(texte: string, maintenant: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texte)) return false;
  const date = new Date(`${texte}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== texte) return false;
  return date.getTime() <= maintenant.getTime();
}
