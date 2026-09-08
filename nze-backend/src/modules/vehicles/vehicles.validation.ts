import { z } from "zod";

export const createVehicleSchema = z.object({
  type: z.enum(["voiture", "moto", "camionnette", "pick_up", "camion", "autre"]),
  marque: z.string().max(100).optional(),
  modele: z.string().max(100).optional(),
  annee: z.number().int().min(1970).max(2100).optional(),
  capacite: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  prix: z.number().positive().optional(),
  conditionsLocation: z.string().max(1000).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  photos: z.array(z.string().url()).max(10).optional(),
});

export const updateVehicleSchema = createVehicleSchema.partial().extend({
  disponible: z.boolean().optional(),
});

export const listVehiclesQuerySchema = z.object({
  type: z.enum(["voiture", "moto", "camionnette", "pick_up", "camion", "autre"]).optional(),
  disponible: z.coerce.boolean().optional(),
});
