/**
 * Palette NZE — extraite directement du logo officiel (tête de panthère violette).
 * Blanc dominant, violet comme unique accent, textes en "encre violette" plutôt
 * qu'un gris neutre générique, pour rester cohérent avec l'identité de marque.
 */
export const colors = {
  // Violet — accent unique
  primary: "#7A2AE3",
  primaryMuted: "#5B1FBF", // état pressed/hover
  primaryDark: "#210569", // dégradés, fonds foncés
  primaryDeep: "#0D0143", // quasi-noir violet
  primarySoft: "#C49BE9", // bordures actives, icônes secondaires
  primaryTint: "#F3EFFC", // fonds teintés très clairs, badges

  // Neutres teintés violet (jamais de gris pur)
  ink: "#170B2E", // texte principal
  inkSoft: "#5B5470", // texte secondaire
  inkFaint: "#9891AC", // texte tertiaire, placeholder
  line: "#E7E2F0", // bordures
  bg: "#FBFAFD", // fond secondaire (cartes sur fond blanc)
  white: "#FFFFFF",

  // États
  success: "#1FA971",
  successTint: "#E7F8F0",
  warning: "#D97706",
  warningTint: "#FEF3E2",
  danger: "#DC3545",
  dangerTint: "#FCEAEC",
} as const;

export type ColorToken = keyof typeof colors;
