import { z } from "zod";

export const createServiceProfileSchema = z.object({
  metier: z.string().min(1).max(100),
  zoneIntervention: z.string().max(255).optional(),
  tarifIndicatif: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  competences: z.array(z.string().min(1).max(100)).max(20).optional(),
});

export const updateServiceProfileSchema = createServiceProfileSchema
  .omit({ competences: true })
  .partial()
  .extend({ disponible: z.boolean().optional() });

export const listServiceProfilesQuerySchema = z.object({
  metier: z.string().max(100).optional(),
  disponible: z.coerce.boolean().optional(),
});
