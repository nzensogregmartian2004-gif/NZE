import type { Langue } from './dictionnaire';

// Langue proposée au premier lancement, d'après la langue du téléphone.
// Arabe -> ar ; chinois simplifié -> zh-Hans ; anglais -> en ; tout le reste -> fr (langue de secours).
// Le chinois traditionnel (Taïwan, Hong Kong, Macao) n'est pas proposé : il retombe sur le français.
export function detecterLangue(code: string, tag: string): Langue {
  const c = code.toLowerCase();
  const t = tag.toLowerCase();
  const traditionnel = t.includes('hant') || t.endsWith('-tw') || t.endsWith('-hk') || t.endsWith('-mo');
  if (c === 'ar') return 'ar';
  if (c === 'zh' && !traditionnel) return 'zh-Hans';
  if (c === 'en') return 'en';
  return 'fr';
}
