import { z } from "zod";

export const createRideSchema = z.object({
  typeService: z.enum(["taxi", "moto"]),
  positionDepart: z.object({ latitude: z.number(), longitude: z.number() }),
  // Requis : le prix est calculé automatiquement à partir de la distance
  // départ → arrivée (2000 FCFA les 15 km), donc la destination doit être connue.
  positionArrivee: z.object({ latitude: z.number(), longitude: z.number() }),
});
