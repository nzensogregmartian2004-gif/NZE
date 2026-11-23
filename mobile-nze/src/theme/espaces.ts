// Espacements, rayons, tailles de composants et ombre. Source unique.
export const espaces = { xs: 4, s: 8, m: 12, l: 16, xl: 24 } as const;
export const rayons = { s: 8, m: 12, l: 16, pilule: 999 } as const;
export const tailles = { boutonHauteur: 52, champHauteur: 48, icone: 22 } as const;

// Une seule ombre, réservée aux éléments flottants (FAB, modales). Le reste utilise des bordures fines.
export const shadow = {
  floating: {
    shadowColor: '#170B2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;
