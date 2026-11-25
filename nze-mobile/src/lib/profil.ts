// Profil du compte : initiales de l'avatar.
export function initiales(prenom?: string | null, nom?: string | null, nomAffiche?: string | null): string {
  const lettres = [prenom, nom].map((v) => v?.trim().charAt(0) ?? '').filter(Boolean).join('');
  if (lettres.length > 0) return lettres.toUpperCase();
  const premieres = (nomAffiche ?? '').trim().split(/\s+/).map((m) => m.charAt(0)).filter(Boolean).slice(0, 2).join('');
  return premieres ? premieres.toUpperCase() : '?';
}
