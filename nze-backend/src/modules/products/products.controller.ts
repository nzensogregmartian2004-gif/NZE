import type { Request, Response, NextFunction } from "express";
import { eq, and, ilike } from "drizzle-orm";
import { db } from "../../db/index.js";
import { products, productPhotos, stores } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { ensureOwnedStore } from "../stores/stores.controller.js";
import {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
} from "./products.validation.js";

export async function listStoreProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listProductsQuerySchema.parse(req.query);
    const conditions = [eq(products.storeId, req.params.storeId)];

    if (query.q) conditions.push(ilike(products.nom, `%${query.q}%`));
    if (query.categorieId) conditions.push(eq(products.categorieId, query.categorieId));
    if (query.disponible !== undefined) conditions.push(eq(products.disponible, query.disponible));

    const results = await db
      .select()
      .from(products)
      .where(and(...conditions))
      .limit(100);

    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await db.query.products.findFirst({ where: eq(products.id, req.params.id) });
    if (!product) throw new AppError(404, "Produit introuvable");

    const [photos, store] = await Promise.all([
      db.query.productPhotos.findMany({ where: eq(productPhotos.productId, product.id) }),
      db.query.stores.findFirst({ where: eq(stores.id, product.storeId) }),
    ]);

    res.json({ ...product, photos, store });
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureOwnedStore(req.params.storeId, req.activity!.id);
    const input = createProductSchema.parse(req.body);
    const { photos, ...productData } = input;

    const [product] = await db
      .insert(products)
      .values({
        ...productData,
        prix: productData.prix.toString(),
        storeId: req.params.storeId,
      })
      .returning();

    if (photos?.length) {
      await db.insert(productPhotos).values(
        photos.map((url, ordre) => ({ productId: product.id, url, ordre }))
      );
    }

    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await db.query.products.findFirst({ where: eq(products.id, req.params.id) });
    if (!product) throw new AppError(404, "Produit introuvable");
    await ensureOwnedStore(product.storeId, req.activity!.id);

    const input = updateProductSchema.parse(req.body);
    const { photos, prix, ...rest } = input;

    const [updated] = await db
      .update(products)
      .set({
        ...rest,
        ...(prix !== undefined ? { prix: prix.toString() } : {}),
        majLe: new Date(),
      })
      .where(eq(products.id, product.id))
      .returning();

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await db.query.products.findFirst({ where: eq(products.id, req.params.id) });
    if (!product) throw new AppError(404, "Produit introuvable");
    await ensureOwnedStore(product.storeId, req.activity!.id);

    await db.delete(products).where(eq(products.id, product.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
