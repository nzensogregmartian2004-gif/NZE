export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

// Rayons volontairement modestes (8-14px) plutôt que le "tout arrondi à 24px"
// générique — cohérent avec un logo aux formes anguleuses.
export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  full: 999,
} as const;

// Une seule ombre, réservée aux éléments flottants (FAB, modales) —
// le reste de l'interface utilise des bordures fines plutôt que des ombres.
export const shadow = {
  floating: {
    shadowColor: "#170B2E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;
