import type { Request, Response, NextFunction } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { orders, orderItems, products, stores, deliveries, userActivities } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { ensureOwnedStore } from "../stores/stores.controller.js";
import { createOrderSchema, updateOrderStatusSchema } from "./orders.validation.js";
import { createNotification, getUserIdForActivity } from "../notifications/notifications.service.js";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  nouvelle: ["confirmee", "annulee"],
  confirmee: ["produit_pret", "annulee"],
  produit_pret: ["terminee", "annulee"],
  terminee: [],
  annulee: [],
};

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createOrderSchema.parse(req.body);

    const store = await db.query.stores.findFirst({ where: eq(stores.id, input.storeId) });
    if (!store || store.statutValidation !== "valide") {
      throw new AppError(404, "Magasin introuvable ou non disponible");
    }

    const productIds = input.items.map((i) => i.productId);
    const foundProducts = await db.query.products.findMany({
      where: inArray(products.id, productIds),
    });

    if (foundProducts.length !== productIds.length) {
      throw new AppError(400, "Un ou plusieurs produits sont introuvables");
    }
    for (const p of foundProducts) {
      if (p.storeId !== store.id) throw new AppError(400, `Le produit ${p.nom} n'appartient pas à ce magasin`);
      if (!p.disponible) throw new AppError(400, `Le produit ${p.nom} n'est pas disponible`);
    }

    const productById = new Map(foundProducts.map((p) => [p.id, p]));
    let total = 0;
    const itemsToInsert = input.items.map((item) => {
      const product = productById.get(item.productId)!;
      const prixUnitaire = Number(product.prix);
      total += prixUnitaire * item.quantite;
      return { productId: item.productId, quantite: item.quantite, prixUnitaire: prixUnitaire.toString() };
    });

    const order = await db.transaction(async (tx) => {
      const [createdOrder] = await tx
        .insert(orders)
        .values({
          clientActivityId: req.activity!.id,
          storeId: store.id,
          total: total.toString(),
          livraisonLatitude: input.livraison?.latitude,
          livraisonLongitude: input.livraison?.longitude,
          livraisonIndication: input.livraison?.indication,
        })
        .returning();

      await tx.insert(orderItems).values(
        itemsToInsert.map((item) => ({ ...item, orderId: createdOrder.id }))
      );

      return createdOrder;
    });

    const storeOwnerUserId = await getUserIdForActivity(store.userActivityId);
    if (storeOwnerUserId) {
      await createNotification(storeOwnerUserId, "nouvelle_commande", `Nouvelle commande reçue (#${order.id.slice(0, 8)})`, {
        orderId: order.id,
      });
    }

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}

async function getOrderOr404(orderId: string) {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) throw new AppError(404, "Commande introuvable");
  return order;
}

async function assertOrderAccess(orderId: string, req: Request) {
  const order = await getOrderOr404(orderId);
  if (req.auth?.isAdmin) return order;
  if (req.activity && order.clientActivityId === req.activity.id) return order;

  const store = await db.query.stores.findFirst({ where: eq(stores.id, order.storeId) });
  if (req.activity && store?.userActivityId === req.activity.id) return order;

  throw new AppError(403, "Accès non autorisé à cette commande");
}

export async function getOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await assertOrderAccess(req.params.id, req);
    const items = await db.query.orderItems.findMany({ where: eq(orderItems.orderId, order.id) });
    res.json({ ...order, items });
  } catch (err) {
    next(err);
  }
}

export async function listMyOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const results = await db.query.orders.findMany({
      where: eq(orders.clientActivityId, req.activity!.id),
      orderBy: (o, { desc }) => [desc(o.creeLe)],
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function listStoreOrders(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureOwnedStore(req.params.storeId, req.activity!.id);
    const results = await db.query.orders.findMany({
      where: eq(orders.storeId, req.params.storeId),
      orderBy: (o, { desc }) => [desc(o.creeLe)],
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await assertOrderAccess(req.params.id, req);
    const { statut } = updateOrderStatusSchema.parse(req.body);

    if (!ALLOWED_TRANSITIONS[order.statut]?.includes(statut)) {
      throw new AppError(400, `Transition "${order.statut}" → "${statut}" non autorisée`);
    }

    const [updated] = await db
      .update(orders)
      .set({ statut, majLe: new Date() })
      .where(eq(orders.id, order.id))
      .returning();

    // Création automatique de la mission de livraison dès que le produit est prêt,
    // si des coordonnées de livraison ont été fournies à la commande.
    if (statut === "produit_pret" && order.livraisonLatitude != null && order.livraisonLongitude != null) {
      const store = await db.query.stores.findFirst({ where: eq(stores.id, order.storeId) });
      await db.insert(deliveries).values({
        orderId: order.id,
        statut: "nouvelle",
        positionDepartLatitude: store?.latitude ?? null,
        positionDepartLongitude: store?.longitude ?? null,
        positionClientLatitude: order.livraisonLatitude,
        positionClientLongitude: order.livraisonLongitude,
        typeLivraison: "produit",
        description: `Livraison de la commande ${order.id}`,
      });
    }

    const clientUserId = await getUserIdForActivity(order.clientActivityId);
    if (clientUserId) {
      const messagesByStatus: Record<string, string> = {
        confirmee: "Ta commande a été confirmée par le magasin",
        produit_pret: "Ton produit est prêt",
        terminee: "Ta commande est terminée",
        annulee: "Ta commande a été annulée",
      };
      if (messagesByStatus[statut]) {
        await createNotification(clientUserId, "commande_statut", messagesByStatus[statut], { orderId: order.id });
      }
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
}
