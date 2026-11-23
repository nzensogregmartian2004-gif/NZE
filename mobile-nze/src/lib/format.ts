import type { Langue } from '../i18n/dictionnaire';

const LOCALES: Record<Langue, string> = {
  fr: 'fr-FR',
  en: 'en',
  ar: 'ar',
  'zh-Hans': 'zh-CN',
};

// La devise métier reste FCFA ; seuls les chiffres et séparateurs suivent la langue.
export function formatFcfa(montant: number, langue: Langue = 'fr'): string {
  const valeur = new Intl.NumberFormat(LOCALES[langue], { maximumFractionDigits: 0 }).format(Math.round(montant));
  return `${valeur} FCFA`;
}

export function formatDateHeure(iso: string, langue: Langue = 'fr'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALES[langue], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatSigne(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
