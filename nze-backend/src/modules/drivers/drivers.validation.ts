import { z } from "zod";

export const registerDriverSchema = z.object({
  typeService: z.enum(["taxi", "moto"]),
  vehicleId: z.string().uuid().optional(),
});

export const updateAvailabilitySchema = z.object({
  disponible: z.boolean(),
});
