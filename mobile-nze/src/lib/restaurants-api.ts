import { apiRequest } from "./api";
import type { Product, ProductDetail, ProductPhoto, Store } from "./stores-api";

export type RestaurantOptionChoice = { id: string; label: string; price: number };
export type RestaurantOptionGroup = {
  id: string; label: string; kind: "supplement" | "formule"; required: boolean;
  minSelections: number; maxSelections: number; choices: RestaurantOptionChoice[];
};
export type SelectedRestaurantOption = { groupId: string; choiceIds: string[] };
export type RestaurantProfile = {
  id: string; storeId: string; typeCuisine: string; description: string | null; telephone: string | null;
  tempsPreparationMoyen: number; commandesActives: boolean; montantMinimum: string;
};
export type RestaurantMenuSection = { id: string; storeId: string; nom: string; description: string | null; ordre: number; actif: boolean };
export type RestaurantDish = Product & {
  photos: ProductPhoto[]; store?: Store; offres: []; section: RestaurantMenuSection | null; sectionId: string | null;
  tempsPreparationMinutes: number; ingredients: string | null; allergenes: string[];
  optionGroups: RestaurantOptionGroup[]; gestionStock: boolean; misEnAvant: boolean;
};
export type PublicRestaurant = Store & { profile: RestaurantProfile | null };
export type RestaurantMenu = { store: Store; profile: RestaurantProfile | null; sections: RestaurantMenuSection[]; dishes: RestaurantDish[] };
export type RestaurantDashboard = {
  store: Store; profile: RestaurantProfile | null; sections: RestaurantMenuSection[]; dishes: RestaurantDish[];
  stats: { totalOrders: number; newOrders: number; preparingOrders: number; readyOrders: number; completedOrders: number; todayOrders: number; availableDishes: number; unavailableDishes: number; calculatedAt: string };
};
export type RestaurantOrder = {
  id: string; storeId: string; statut: "nouvelle" | "confirmee" | "produit_pret" | "terminee" | "annulee";
  total: string; creeLe: string; tempsPreparationEstimeMinutes: number | null;
  items: Array<{ id: string; quantite: number; prixUnitaire: string; options: Array<{ groupId: string; groupLabel: string; kind: string; choices: RestaurantOptionChoice[] }>; productName: string }>;
};

export function listRestaurants() { return apiRequest<PublicRestaurant[]>("/restaurants"); }
export function getRestaurantMenu(storeId: string) { return apiRequest<RestaurantMenu>(`/restaurants/${storeId}/menu`); }
export function getRestaurantDashboard(token: string, storeId: string) { return apiRequest<RestaurantDashboard>(`/restaurants/${storeId}/dashboard`, { token }); }
export function saveRestaurantProfile(token: string, storeId: string, input: { typeCuisine: string; description?: string; telephone?: string; tempsPreparationMoyen?: number; commandesActives?: boolean; montantMinimum?: number }) {
  return apiRequest<RestaurantProfile>(`/restaurants/${storeId}/profile`, { method: "POST", token, body: input });
}
export function updateRestaurantProfile(token: string, storeId: string, input: Partial<{ typeCuisine: string; description: string; telephone: string; tempsPreparationMoyen: number; commandesActives: boolean; montantMinimum: number }>) {
  return apiRequest<RestaurantProfile>(`/restaurants/${storeId}/profile`, { method: "PATCH", token, body: input });
}
export function createRestaurantSection(token: string, storeId: string, input: { nom: string; description?: string; ordre?: number }) {
  return apiRequest<RestaurantMenuSection>(`/restaurants/${storeId}/sections`, { method: "POST", token, body: input });
}
export function createRestaurantDish(token: string, storeId: string, input: {
  nom: string; description?: string; prix: number; photos?: string[]; sectionId?: string;
  tempsPreparationMinutes?: number; ingredients?: string; allergenes?: string[]; gestionStock?: boolean; stock?: number;
  disponible?: boolean; misEnAvant?: boolean; supplements?: Array<{ nom: string; prix: number }>; formules?: Array<{ nom: string; prix: number }>;
}) { return apiRequest<RestaurantDish>(`/restaurants/${storeId}/dishes`, { method: "POST", token, body: input }); }
export function updateRestaurantDish(token: string, productId: string, input: Partial<{
  nom: string; description: string; prix: number; photos: string[]; sectionId: string;
  tempsPreparationMinutes: number; ingredients: string; allergenes: string[]; gestionStock: boolean; stock: number;
  disponible: boolean; misEnAvant: boolean; supplements: Array<{ nom: string; prix: number }>; formules: Array<{ nom: string; prix: number }>;
}>) {
  return apiRequest<RestaurantDish>(`/restaurants/dishes/${productId}`, { method: "PATCH", token, body: input });
}
export function setRestaurantDishAvailability(token: string, productId: string, disponible: boolean) {
  return apiRequest<RestaurantDish>(`/restaurants/dishes/${productId}/availability`, { method: "PATCH", token, body: { disponible } });
}
export function listRestaurantOrders(token: string, storeId: string) { return apiRequest<RestaurantOrder[]>(`/restaurants/${storeId}/orders`, { token }); }
export function setRestaurantOrderPreparationTime(token: string, storeId: string, orderId: string, tempsPreparationEstimeMinutes: number) {
  return apiRequest<RestaurantOrder>(`/restaurants/${storeId}/orders/${orderId}/preparation-time`, { method: "PATCH", token, body: { tempsPreparationEstimeMinutes } });
}
