import { z } from "zod";

export const createProductSchema = z.object({
  nom: z.string().min(1).max(150),
  description: z.string().max(2000).optional(),
  prix: z.number().positive(),
  categorieId: z.string().uuid().optional(),
  stock: z.number().int().min(0).default(0),
  disponible: z.boolean().default(true),
  photos: z.array(z.string().url()).max(10).optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const listProductsQuerySchema = z.object({
  q: z.string().max(150).optional(),
  categorieId: z.string().uuid().optional(),
  disponible: z.coerce.boolean().optional(),
});
