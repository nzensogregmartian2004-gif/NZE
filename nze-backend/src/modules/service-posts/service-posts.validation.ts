import { z } from "zod";

export const createServicePostSchema = z.object({
  titre: z.string().min(1).max(150),
  description: z.string().max(2000).optional(),
  categorieId: z.string().uuid().optional(),
  localisation: z
    .object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })
    .optional(),
  photos: z.array(z.string().url()).max(10).optional(),
});

export const createCommentSchema = z.object({
  contenu: z.string().min(1).max(1000),
});

export const listServicePostsQuerySchema = z.object({
  categorieId: z.string().uuid().optional(),
  serviceProfileId: z.string().uuid().optional(),
});
