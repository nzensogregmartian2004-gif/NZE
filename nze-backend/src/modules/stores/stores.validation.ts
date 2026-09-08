import { z } from "zod";

export const createStoreSchema = z.object({
  nom: z.string().min(1).max(150),
  description: z.string().max(2000).optional(),
  photo: z.string().url().optional(),
  couverture: z.string().url().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  adresseLibre: z.string().max(255).optional(),
  quartier: z.string().max(100).optional(),
  horaires: z.record(z.string()).optional(),
});

export const updateStoreSchema = createStoreSchema.partial();

export const listStoresQuerySchema = z.object({
  near: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, "Format attendu : lat,lng")
    .optional(),
  radiusKm: z.coerce.number().positive().max(200).default(10).optional(),
  q: z.string().max(150).optional(),
});
