import { z } from "zod";

export const createOrderSchema = z.object({
  storeId: z.string().uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantite: z.number().int().positive(),
      })
    )
    .min(1),
  livraison: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      indication: z.string().max(500).optional(),
    })
    .optional(),
});

export const updateOrderStatusSchema = z.object({
  statut: z.enum(["confirmee", "produit_pret", "terminee", "annulee"]),
});
