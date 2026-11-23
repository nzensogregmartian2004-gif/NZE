import { apiRequest } from "./api";

export type Store = {
  id: string;
  nom: string;
  typeEtablissement?: "commerce" | "restaurant";
  description: string | null;
  photo: string | null;
  couverture: string | null;
  latitude: number | null;
  longitude: number | null;
  adresseLibre: string | null;
  quartier: string | null;
  horaires: Record<string, string> | null;
  livraisonActive: boolean;
  modeLivraison: "nze" | "propre" | "mixte";
  retraitActive: boolean;
  rayonLivraisonKm: number;
  tarifLivraisonBase: string;
  tarifLivraisonKm: string;
  statutValidation: string;
  distanceKm?: number;
};

export type ProductPhoto = { id?: string; url: string; ordre?: number };
export type ProductCategory = { id: string; nom: string; type?: "produit" | "service" };
export type ProductVariant = { nom: string; options: string[] };
export type ProductCharacteristic = { nom: string; valeur: string };
export type ProductState = "neuf" | "occasion" | "reconditionne";
export type Product = {
  id: string;
  storeId: string;
  nom: string;
  description: string | null;
  marque?: string | null;
  modele?: string | null;
  reference?: string | null;
  etat?: ProductState;
  caracteristiques?: ProductCharacteristic[] | null;
  variantes?: ProductVariant[] | null;
  prix: string;
  categorieId?: string | null;
  categorie?: ProductCategory | null;
  stock: number;
  disponible: boolean;
  photos?: ProductPhoto[];
  store?: Pick<Store, "id" | "nom" | "photo" | "quartier">;
};

export type StoreDetail = Store & { photos: Array<{ id: string; url: string }> };
export type ProductOffer = {
  id: string; nom: string; prix: string; stock: number; etat: string; storeId: string;
  store: { id: string; nom: string; quartier: string | null };
};
export type ProductDetail = Product & { photos: ProductPhoto[]; store: Store; offres: ProductOffer[] };
export type ProductSort = "recent" | "price_asc" | "price_desc";
export type ProductListResponse = {
  items: Product[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export function listStores(params: { near?: string; radiusKm?: number; q?: string } = {}) {
  const search = new URLSearchParams();
  if (params.near) search.set("near", params.near);
  if (params.radiusKm) search.set("radiusKm", String(params.radiusKm));
  if (params.q) search.set("q", params.q);
  const qs = search.toString();
  return apiRequest<Store[]>(`/stores${qs ? `?${qs}` : ""}`);
}

export function listProducts(params: {
  q?: string; categorieId?: string; storeId?: string; etat?: ProductState; prixMin?: string; prixMax?: string;
  sort?: ProductSort; page?: number; limit?: number;
} = {}) {
  const search = new URLSearchParams();
  for (const key of ["q", "categorieId", "storeId", "etat", "prixMin", "prixMax", "sort", "page", "limit"] as const) {
    const value = params[key];
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return apiRequest<ProductListResponse>(`/products${qs ? `?${qs}` : ""}`);
}

export function listProductCategories() {
  return apiRequest<ProductCategory[]>("/categories?type=produit");
}
export function listMyStores(token: string) {
  return apiRequest<Store[]>("/stores/mine", { token });
}

export type CreateStoreInput = { nom: string; typeEtablissement?: "commerce" | "restaurant"; description?: string; latitude?: number; longitude?: number; adresseLibre?: string; quartier?: string };
export function createStore(token: string, input: CreateStoreInput) {
  return apiRequest<Store>("/stores", { method: "POST", body: input, token });
}

export function updateStore(token: string, storeId: string, input: Partial<CreateStoreInput>) {
  return apiRequest<Store>(`/stores/${storeId}`, { method: "PATCH", body: input, token });
}

export type StoreDeliverySettingsInput = {
  livraisonActive: boolean;
  modeLivraison: "nze" | "propre" | "mixte";
  retraitActive: boolean;
  rayonLivraisonKm: number;
  tarifLivraisonBase: number;
  tarifLivraisonKm: number;
};
export function updateStoreDeliverySettings(token: string, storeId: string, input: StoreDeliverySettingsInput) {
  return apiRequest<StoreDeliverySettingsInput & { id: string; majLe: string }>(
    `/stores/${storeId}/delivery-settings`, { method: "PATCH", body: input, token }
  );
}

export type StoreDashboardStats = {
  storeId: string;
  products: { total: number; available: number; lowStock: number };
  orders: { total: number; new: number; confirmed: number; ready: number; completed: number; cancelled: number };
  completedOrderAmount: string;
  calculatedAt: string;
};

export function getStoreDashboardStats(token: string, storeId: string) {
  return apiRequest<StoreDashboardStats>(`/stores/${storeId}/dashboard`, { token });
}

export type CreateProductInput = {
  nom: string; description?: string; marque?: string; modele?: string; reference?: string; etat?: ProductState;
  caracteristiques?: ProductCharacteristic[]; variantes?: ProductVariant[];
  prix: number; categorieId?: string; stock?: number; disponible?: boolean; photos?: string[];
};
export function createProduct(token: string, storeId: string, input: CreateProductInput) {
  return apiRequest<Product>(`/stores/${storeId}/products`, { method: "POST", body: input, token });
}
export function updateProduct(token: string, productId: string, input: Partial<CreateProductInput>) {
  return apiRequest<Product>(`/products/${productId}`, { method: "PATCH", body: input, token });
}

export function deleteProduct(token: string, productId: string) {
  return apiRequest<void>(`/products/${productId}`, { method: "DELETE", token });
}

export type StoreOrder = {
  id: string; statut: "nouvelle" | "confirmee" | "produit_pret" | "terminee" | "annulee"; total: string; creeLe: string;
  livraisonLatitude: number | null; livraisonLongitude: number | null;
};
export function listStoreOrders(token: string, storeId: string) {
  return apiRequest<StoreOrder[]>(`/stores/${storeId}/orders`, { token });
}
export function updateOrderStatus(token: string, orderId: string, statut: StoreOrder["statut"]) {
  return apiRequest<StoreOrder>(`/orders/${orderId}/status`, { method: "PATCH", body: { statut }, token });
}
export function getStore(id: string) { return apiRequest<StoreDetail>(`/stores/${id}`); }
export function listStoreProducts(storeId: string) { return apiRequest<Product[]>(`/stores/${storeId}/products`); }
export function listMyStoreProducts(token: string, storeId: string) {
  return apiRequest<Product[]>(`/stores/${storeId}/products/mine`, { token });
}
export function importProductsCsv(token: string, storeId: string, csv: string) {
  return apiRequest<{ imported: number; products: Product[] }>(`/stores/${storeId}/products/import-csv`, {
    method: "POST", token, body: { csv },
  });
}
export function getProduct(id: string) { return apiRequest<ProductDetail>(`/products/${id}`); }

export type CreateOrderInput = { storeId: string; items: Array<{ productId: string; quantite: number }>; livraison?: { latitude: number; longitude: number; indication?: string; prestataire?: "nze" | "propre" } };
export function createOrder(token: string, input: CreateOrderInput, idempotencyKey?: string) {
  return apiRequest<{ id: string; total: string; statut: string; checkoutGroupId: string | null }>("/orders", {
    method: "POST", body: input, token,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
}

export type CheckoutOrder = { id: string; storeId: string; total: string; statut: string; checkoutGroupId: string | null };
export type CheckoutResult = { checkoutGroupId: string; replayed: boolean; orders: CheckoutOrder[]; total: number };
export function checkoutCart(token: string, items: Array<{ productId: string; quantite: number; options?: Array<{ groupId: string; choiceIds: string[] }> }>, idempotencyKey: string, livraison?: { latitude: number; longitude: number; indication?: string; prestataire?: "nze" | "propre" }) {
  return apiRequest<CheckoutResult>("/orders/checkout", {
    method: "POST", token, headers: { "Idempotency-Key": idempotencyKey },
    body: { items, ...(livraison ? { livraison } : {}) },
  });
}
