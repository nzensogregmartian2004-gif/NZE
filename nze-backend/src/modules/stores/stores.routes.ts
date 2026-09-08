import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireActivity } from "../../middleware/activity.js";
import * as storesController from "./stores.controller.js";
import * as productsController from "../products/products.controller.js";
import * as ordersController from "../orders/orders.controller.js";

export const storesRouter = Router();

// Lecture publique
storesRouter.get("/", storesController.listStores);
storesRouter.get("/mine", requireAuth, requireActivity("commercant"), storesController.listMyStores);
storesRouter.get("/:id", storesController.getStore);
storesRouter.get("/:storeId/products", productsController.listStoreProducts);

// Écriture réservée à l'activité "commercant" propriétaire
storesRouter.post("/", requireAuth, requireActivity("commercant"), storesController.createStore);
storesRouter.patch("/:id", requireAuth, requireActivity("commercant"), storesController.updateStore);
storesRouter.post(
  "/:storeId/products",
  requireAuth,
  requireActivity("commercant"),
  productsController.createProduct
);
storesRouter.get(
  "/:storeId/orders",
  requireAuth,
  requireActivity("commercant"),
  ordersController.listStoreOrders
);
