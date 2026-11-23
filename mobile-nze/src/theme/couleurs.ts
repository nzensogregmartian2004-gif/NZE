// Palette NZE, tirée du logo : violet #7B2DE7, blanc dominant. Source unique des couleurs de l'application.
export const couleurs = {
  violet: '#7B2DE7',
  violetFonce: '#1F0465',
  violetClair: '#F2EAFD',
  blanc: '#FFFFFF',
  texte: '#1E1B24',
  texteSecondaire: '#5F5968',
  bordure: '#E4DEEB',
  fond: '#F7F7F9',
  succes: '#1F7A4D',
  succesClair: '#E7F4EC',
  avertissement: '#D97706',
  avertissementClair: '#FEF3E2',
  danger: '#B42318',
  dangerClair: '#FDECEA',
} as const;

export type ColorToken = keyof typeof couleurs;
