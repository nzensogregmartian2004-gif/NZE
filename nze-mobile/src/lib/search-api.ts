import { apiRequest } from "./api";

export type SearchResults = {
  produits: Array<{ id: string; nom: string; prix: string }>;
  magasins: Array<{ id: string; nom: string }>;
  services: Array<{ id: string; metier: string }>;
  vehicules: Array<{ id: string; marque: string | null; modele: string | null; type: string }>;
  transport: unknown[];
};

export function search(q: string) {
  return apiRequest<SearchResults>(`/search?q=${encodeURIComponent(q)}`);
}
