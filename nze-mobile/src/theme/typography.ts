/**
 * Sora pour les titres (géométrique, anguleuse — fait écho au caractère
 * dynamique du logo) ; Plus Jakarta Sans pour le texte courant (plus
 * distinctif qu'Inter par défaut, très lisible en petite taille).
 */
export const fontFamily = {
  displayBold: "Sora_700Bold",
  displayExtraBold: "Sora_800ExtraBold",
  displaySemiBold: "Sora_600SemiBold",
  body: "PlusJakartaSans_400Regular",
  bodyMedium: "PlusJakartaSans_500Medium",
  bodySemiBold: "PlusJakartaSans_600SemiBold",
  bodyBold: "PlusJakartaSans_700Bold",
} as const;

// Échelle type resserrée autour d'un ratio ~1.2, pensée pour du mobile
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
} as const;

export const lineHeight = {
  xs: 16,
  sm: 20,
  base: 24,
  lg: 26,
  xl: 28,
  "2xl": 32,
  "3xl": 38,
  "4xl": 44,
} as const;

export const typography = {
  display: { fontFamily: fontFamily.displayExtraBold, fontSize: fontSize["4xl"], lineHeight: lineHeight["4xl"] },
  h1: { fontFamily: fontFamily.displayBold, fontSize: fontSize["3xl"], lineHeight: lineHeight["3xl"] },
  h2: { fontFamily: fontFamily.displayBold, fontSize: fontSize["2xl"], lineHeight: lineHeight["2xl"] },
  h3: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.xl, lineHeight: lineHeight.xl },
  bodyLg: { fontFamily: fontFamily.body, fontSize: fontSize.lg, lineHeight: lineHeight.lg },
  body: { fontFamily: fontFamily.body, fontSize: fontSize.base, lineHeight: lineHeight.base },
  bodySm: { fontFamily: fontFamily.body, fontSize: fontSize.sm, lineHeight: lineHeight.sm },
  label: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, lineHeight: lineHeight.sm },
  caption: { fontFamily: fontFamily.body, fontSize: fontSize.xs, lineHeight: lineHeight.xs },
  button: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.base, lineHeight: lineHeight.base },
} as const;

export type TypographyToken = keyof typeof typography;
