import { apiRequest } from "@/lib/api";

export type LegalLang = "fr" | "en";
export type LegalSection = { heading: string; paragraphs: string[] };
export type LegalDocument = {
  slug: string;
  title: string;
  version: string;
  effectiveDate: string;
  language: LegalLang;
  sections: LegalSection[];
};

/** Conditions et politique publiées par le backend : pas besoin de publier une nouvelle version de l'app. */
export function fetchLegalDocument(slug: string, lang: LegalLang) {
  return apiRequest<LegalDocument>(`/legal/${encodeURIComponent(slug)}?lang=${lang}`);
}

/** Enregistre l'acceptation de la version actuelle des conditions pour le compte connecté. */
export function acceptLegalTerms(token: string) {
  return apiRequest<{ conditionsVersion: string; conditionsAcceptees: boolean }>("/legal/accept", { method: "POST", token });
}
