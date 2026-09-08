import type { Request, Response, NextFunction } from "express";
import { eq, and, ilike, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { stores, storePhotos } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { distanceKmExpr } from "../../lib/geo.js";
import { createStoreSchema, updateStoreSchema, listStoresQuerySchema } from "./stores.validation.js";

export async function listStores(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listStoresQuerySchema.parse(req.query);
    const conditions = [eq(stores.statutValidation, "valide")];

    if (query.q) {
      conditions.push(ilike(stores.nom, `%${query.q}%`));
    }

    if (query.near) {
      const [lat, lng] = query.near.split(",").map(Number);
      const radius = query.radiusKm ?? 10;
      const distance = distanceKmExpr(lat, lng);

      const results = await db
        .select({ store: stores, distanceKm: distance })
        .from(stores)
        .where(and(...conditions, sql`${distance} <= ${radius}`))
        .orderBy(distance)
        .limit(50);

      return res.json(results.map((r) => ({ ...r.store, distanceKm: Number(r.distanceKm.toFixed(2)) })));
    }

    const results = await db
      .select()
      .from(stores)
      .where(and(...conditions))
      .limit(50);

    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function listMyStores(req: Request, res: Response, next: NextFunction) {
  try {
    const results = await db.query.stores.findMany({ where: eq(stores.userActivityId, req.activity!.id) });
    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function getStore(req: Request, res: Response, next: NextFunction) {
  try {
    const store = await db.query.stores.findFirst({ where: eq(stores.id, req.params.id) });
    if (!store) throw new AppError(404, "Magasin introuvable");

    const photos = await db.query.storePhotos.findMany({
      where: eq(storePhotos.storeId, store.id),
    });

    res.json({ ...store, photos });
  } catch (err) {
    next(err);
  }
}

export async function createStore(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createStoreSchema.parse(req.body);

    const [store] = await db
      .insert(stores)
      .values({ ...input, userActivityId: req.activity!.id })
      .returning();

    res.status(201).json({
      ...store,
      message: "Magasin créé, en attente de validation par l'administration",
    });
  } catch (err) {
    next(err);
  }
}

export async function updateStore(req: Request, res: Response, next: NextFunction) {
  try {
    const store = await ensureOwnedStore(req.params.id, req.activity!.id);
    const input = updateStoreSchema.parse(req.body);

    const [updated] = await db
      .update(stores)
      .set({ ...input, majLe: new Date() })
      .where(eq(stores.id, store.id))
      .returning();

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** Vérifie que le magasin appartient bien à l'activité "commercant" de l'utilisateur connecté. */
export async function ensureOwnedStore(storeId: string, activityId: string) {
  const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) });
  if (!store) throw new AppError(404, "Magasin introuvable");
  if (store.userActivityId !== activityId) {
    throw new AppError(403, "Ce magasin ne t'appartient pas");
  }
  return store;
}
