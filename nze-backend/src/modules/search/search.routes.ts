import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { and, eq, ilike } from "drizzle-orm";
import { db } from "../../db/index.js";
import { products, stores, serviceProfiles, vehicles } from "../../db/schema/index.js";

const searchQuerySchema = z.object({
  q: z.string().min(1).max(150),
});

export const searchRouter = Router();

searchRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q } = searchQuerySchema.parse(req.query);
    const pattern = `%${q}%`;

    // Recherche par catégorie de résultat en parallèle. Le "transport" (taxi/moto
    // disponibles) n'est pas une recherche par mot-clé classique — il sera exposé
    // via GET /rides/available côté chauffeur ; laissé vide ici.
    const [matchedProducts, matchedStores, matchedServices, matchedVehicles] = await Promise.all([
      db
        .select()
        .from(products)
        .where(and(ilike(products.nom, pattern), eq(products.disponible, true)))
        .limit(20),
      db
        .select()
        .from(stores)
        .where(and(ilike(stores.nom, pattern), eq(stores.statutValidation, "valide")))
        .limit(20),
      db
        .select()
        .from(serviceProfiles)
        .where(and(ilike(serviceProfiles.metier, pattern), eq(serviceProfiles.statutValidation, "valide")))
        .limit(20),
      db
        .select()
        .from(vehicles)
        .where(and(ilike(vehicles.marque, pattern), eq(vehicles.statutValidation, "valide")))
        .limit(20),
    ]);

    res.json({
      produits: matchedProducts,
      magasins: matchedStores,
      services: matchedServices,
      vehicules: matchedVehicles,
      transport: [],
    });
  } catch (err) {
    next(err);
  }
});
