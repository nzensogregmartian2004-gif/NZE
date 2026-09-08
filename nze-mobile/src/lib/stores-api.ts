import { apiRequest } from "./api";

export type Store = {
  id: string;
  nom: string;
  description: string | null;
  photo: string | null;
  couverture: string | null;
  latitude: number | null;
  longitude: number | null;
  adresseLibre: string | null;
  quartier: string | null;
  horaires: Record<string, string> | null;
  statutValidation: string;
  distanceKm?: number;
};

export type StoreDetail = Store & { photos: Array<{ id: string; url: string }> };

export type Product = {
  id: string;
  storeId: string;
  nom: string;
  description: string | null;
  prix: string;
  stock: number;
  disponible: boolean;
};

export type ProductDetail = Product & {
  photos: Array<{ id: string; url: string }>;
  store: Store;
};

export function listStores(params: { near?: string; radiusKm?: number; q?: string } = {}) {
  const search = new URLSearchParams();
  if (params.near) search.set("near", params.near);
  if (params.radiusKm) search.set("radiusKm", String(params.radiusKm));
  if (params.q) search.set("q", params.q);
  const qs = search.toString();
  return apiRequest<Store[]>(`/stores${qs ? `?${qs}` : ""}`);
}

export function listMyStores(token: string) {
  return apiRequest<Store[]>("/stores/mine", { token });
}

export type CreateStoreInput = {
  nom: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  adresseLibre?: string;
  quartier?: string;
};

export function createStore(token: string, input: CreateStoreInput) {
  return apiRequest<Store>("/stores", { method: "POST", body: input, token });
}

export type CreateProductInput = {
  nom: string;
  description?: string;
  prix: number;
  stock?: number;
  disponible?: boolean;
};

export function createProduct(token: string, storeId: string, input: CreateProductInput) {
  return apiRequest<Product>(`/stores/${storeId}/products`, { method: "POST", body: input, token });
}

export function updateProduct(token: string, productId: string, input: Partial<CreateProductInput>) {
  return apiRequest<Product>(`/products/${productId}`, { method: "PATCH", body: input, token });
}

export type StoreOrder = {
  id: string;
  statut: "nouvelle" | "confirmee" | "produit_pret" | "terminee" | "annulee";
  total: string;
  creeLe: string;
  livraisonLatitude: number | null;
  livraisonLongitude: number | null;
};

export function listStoreOrders(token: string, storeId: string) {
  return apiRequest<StoreOrder[]>(`/stores/${storeId}/orders`, { token });
}

export function updateOrderStatus(token: string, orderId: string, statut: StoreOrder["statut"]) {
  return apiRequest<StoreOrder>(`/orders/${orderId}/status`, { method: "PATCH", body: { statut }, token });
}

export function getStore(id: string) {
  return apiRequest<StoreDetail>(`/stores/${id}`);
}

export function listStoreProducts(storeId: string) {
  return apiRequest<Product[]>(`/stores/${storeId}/products`);
}

export function getProduct(id: string) {
  return apiRequest<ProductDetail>(`/products/${id}`);
}

export type CreateOrderInput = {
  storeId: string;
  items: Array<{ productId: string; quantite: number }>;
  livraison?: { latitude: number; longitude: number; indication?: string };
};

export function createOrder(token: string, input: CreateOrderInput) {
  return apiRequest<{ id: string; total: string; statut: string }>("/orders", {
    method: "POST",
    body: input,
    token,
  });
}
