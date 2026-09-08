import { z } from "zod";

export const registerDelivererSchema = z.object({
  typeVehicule: z.enum(["moto", "voiture", "camionnette", "pick-up", "camion", "velo"]),
  vehiculeInfos: z.record(z.unknown()).optional(),
  documents: z.array(z.string().url()).optional(),
});

export const updateAvailabilitySchema = z.object({
  disponible: z.boolean(),
});

export const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const validateDelivererSchema = z.object({
  statutValidation: z.enum(["valide", "refuse", "suspendu"]),
});
