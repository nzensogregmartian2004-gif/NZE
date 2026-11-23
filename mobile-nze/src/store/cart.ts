import { create } from "zustand";
import type { ProductDetail } from "@/lib/stores-api";
import type { RestaurantOptionGroup, SelectedRestaurantOption } from "@/lib/restaurants-api";

type ProductWithRestaurantOptions = ProductDetail & { optionGroups?: RestaurantOptionGroup[]; gestionStock?: boolean };
export type CartItem = {
  cartItemId: string;
  productId: string;
  storeId: string;
  storeName: string;
  productName: string;
  price: string; // prix unitaire avec suppléments/formule sélectionnés
  basePrice: string;
  stock: number;
  stockManaged: boolean;
  available: boolean;
  photoUrl?: string;
  quantity: number;
  options?: SelectedRestaurantOption[];
  optionsSummary?: string;
};

type CartState = {
  items: CartItem[];
  addProduct: (product: ProductWithRestaurantOptions, quantity?: number, options?: SelectedRestaurantOption[]) => boolean;
  setQuantity: (cartItemId: string, quantity: number) => void;
  removeProduct: (cartItemId: string) => void;
  clearCart: () => void;
};

function selectedDetails(product: ProductWithRestaurantOptions, selections: SelectedRestaurantOption[]) {
  const rows: string[] = [];
  let extra = 0;
  for (const selection of selections) {
    const group = product.optionGroups?.find((entry) => entry.id === selection.groupId);
    if (!group) continue;
    for (const choiceId of selection.choiceIds) {
      const choice = group.choices.find((entry) => entry.id === choiceId);
      if (!choice) continue;
      extra += Number(choice.price);
      rows.push(`${choice.label}${Number(choice.price) > 0 ? ` (+${Number(choice.price).toLocaleString("fr-FR")} FCFA)` : ""}`);
    }
  }
  return { extra, summary: rows.join(", ") };
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  addProduct: (product, quantity = 1, options = []) => {
    const manageStock = product.gestionStock ?? true;
    if (!product.disponible || (manageStock && product.stock < 1) || quantity < 1 || (manageStock && quantity > product.stock)) return false;
    const sortedOptions = [...options].map((item) => ({ groupId: item.groupId, choiceIds: [...item.choiceIds].sort() }))
      .sort((a, b) => a.groupId.localeCompare(b.groupId));
    const cartItemId = `${product.id}:${JSON.stringify(sortedOptions)}`;
    const current = get().items.find((item) => item.cartItemId === cartItemId);
    const nextQuantity = (current?.quantity ?? 0) + quantity;
    if (manageStock && nextQuantity > product.stock) return false;
    const pricing = selectedDetails(product, sortedOptions);
    const item: CartItem = {
      cartItemId,
      productId: product.id,
      storeId: product.storeId,
      storeName: product.store.nom,
      productName: product.nom,
      basePrice: String(product.prix),
      price: (Math.round((Number(product.prix) + pricing.extra) * 100) / 100).toFixed(2),
      stock: product.stock,
      stockManaged: manageStock,
      available: product.disponible,
      photoUrl: product.photos[0]?.url,
      quantity: nextQuantity,
      options: sortedOptions.length ? sortedOptions : undefined,
      optionsSummary: pricing.summary || undefined,
    };
    set((state) => ({
      items: current
        ? state.items.map((existing) => existing.cartItemId === cartItemId ? item : existing)
        : [...state.items, item],
    }));
    return true;
  },
  setQuantity: (cartItemId, quantity) => set((state) => ({
    items: quantity <= 0
      ? state.items.filter((item) => item.cartItemId !== cartItemId)
      : state.items.map((existing) => existing.cartItemId === cartItemId
          ? { ...existing, quantity: Math.min(Math.floor(quantity), existing.stock) }
          : existing),
  })),
  removeProduct: (cartItemId) => set((state) => ({ items: state.items.filter((item) => item.cartItemId !== cartItemId) })),
  clearCart: () => set({ items: [] }),
}));
