import { apiRequest } from "./api";
import type { Product, ProductState } from "./stores-api";

export type SearchResults = {
  produits: Array<{ id: string; nom: string; prix: string }>;
  magasins: Array<{ id: string; nom: string }>;
  services: Array<{ id: string; metier: string }>;
  vehicules: Array<{ id: string; marque: string | null; modele: string | null; type: string }>;
  hebergements?: Array<{ id: string; nom: string; type: string; ville: string; quartier: string | null; prixParNuit: string }>;
};

export function search(q: string) {
  return apiRequest<SearchResults>(`/search?q=${encodeURIComponent(q)}`);
}

// ---------------------------------------------------------------------------
// Recherche produits paginée, triée et filtrée ; suggestions ; produits recommandés.
// ---------------------------------------------------------------------------

export type SearchSort = "pertinence" | "prix_asc" | "prix_desc" | "recent" | "distance";

export type ProductSearchParams = {
  q?: string;
  categorieId?: string;
  storeId?: string;
  marque?: string;
  etat?: ProductState;
  modeRemise?: "livraison" | "retrait";
  /** Position au format "latitude,longitude". */
  near?: string;
  rayonKm?: number;
  prixMin?: string | number;
  prixMax?: string | number;
  sort?: SearchSort;
  page?: number;
  limit?: number;
};

export type CatalogProduct = Product & { raison?: "populaire" | "nouveau"; distanceKm?: number | null };
type RawCatalogProduct = Product & { photo: string | null; raison?: "populaire" | "nouveau"; distanceKm?: number | null };
export type CatalogPagination = { page: number; limit: number; total: number; totalPages: number };
export type CatalogPage = { items: CatalogProduct[]; pagination: CatalogPagination; approximatif: boolean };
export type SearchSuggestion = { type: "produit" | "marque" | "categorie"; value: string };

/** L'API renvoie une seule photo (`photo`) ; l'écran produit et la carte attendent la liste `photos`. */
function toCatalogProduct({ photo, ...rest }: RawCatalogProduct): CatalogProduct {
  return { ...rest, photos: photo ? [{ url: photo }] : [] };
}

export async function searchProducts(params: ProductSearchParams): Promise<CatalogPage> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const raw = await apiRequest<{ items: RawCatalogProduct[]; pagination: CatalogPagination; approximatif?: boolean }>(
    `/search/products?${query.toString()}`,
  );
  return { items: raw.items.map(toCatalogProduct), pagination: raw.pagination, approximatif: raw.approximatif ?? false };
}

export function fetchSearchSuggestions(q: string) {
  return apiRequest<{ suggestions: SearchSuggestion[] }>(`/search/suggestions?q=${encodeURIComponent(q)}`);
}

export async function fetchRecommendedProducts(limit = 12): Promise<{ items: CatalogProduct[] }> {
  const raw = await apiRequest<{ items: RawCatalogProduct[] }>(`/products/recommended?limit=${limit}`);
  return { items: raw.items.map(toCatalogProduct) };
}
