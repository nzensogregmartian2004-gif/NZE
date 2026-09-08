import { z } from "zod";

export const createBookingSchema = z.object({
  dateDebut: z.string().date(),
  dateFin: z.string().date(),
  message: z.string().max(500).optional(),
});
