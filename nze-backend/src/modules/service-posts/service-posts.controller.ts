import type { Request, Response, NextFunction } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  servicePosts,
  servicePostPhotos,
  servicePostLikes,
  servicePostComments,
  verifiedJobs,
} from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { ensureOwnedServiceProfile } from "../service-profiles/service-profiles.controller.js";
import {
  createServicePostSchema,
  createCommentSchema,
  listServicePostsQuerySchema,
} from "./service-posts.validation.js";

export async function listServicePosts(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listServicePostsQuerySchema.parse(req.query);
    const conditions = [eq(servicePosts.statutModeration, "publie")];

    if (query.categorieId) conditions.push(eq(servicePosts.categorieId, query.categorieId));
    if (query.serviceProfileId) conditions.push(eq(servicePosts.serviceProfileId, query.serviceProfileId));

    const results = await db
      .select()
      .from(servicePosts)
      .where(and(...conditions))
      .orderBy(sql`${servicePosts.creeLe} desc`)
      .limit(50);

    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function getServicePost(req: Request, res: Response, next: NextFunction) {
  try {
    const post = await db.query.servicePosts.findFirst({ where: eq(servicePosts.id, req.params.id) });
    if (!post) throw new AppError(404, "Publication introuvable");

    const [photos, likesCount, verifiedJob] = await Promise.all([
      db.query.servicePostPhotos.findMany({ where: eq(servicePostPhotos.postId, post.id) }),
      db.select({ count: sql<number>`count(*)::int` }).from(servicePostLikes).where(eq(servicePostLikes.postId, post.id)),
      db.query.verifiedJobs.findFirst({
        where: and(
          eq(verifiedJobs.serviceProfileId, post.serviceProfileId),
          eq(verifiedJobs.statutConfirmation, "confirmee")
        ),
      }),
    ]);

    res.json({ ...post, photos, likes: likesCount[0]?.count ?? 0, travailVerifie: Boolean(verifiedJob) });
  } catch (err) {
    next(err);
  }
}

export async function createServicePost(req: Request, res: Response, next: NextFunction) {
  try {
    // req.params.serviceProfileId vient de la route imbriquée /service-profiles/:id/posts
    await ensureOwnedServiceProfile(req.params.serviceProfileId, req.activity!.id);
    const input = createServicePostSchema.parse(req.body);
    const { photos, localisation, ...postData } = input;

    const [post] = await db
      .insert(servicePosts)
      .values({
        ...postData,
        serviceProfileId: req.params.serviceProfileId,
        localisationLatitude: localisation?.latitude,
        localisationLongitude: localisation?.longitude,
      })
      .returning();

    if (photos?.length) {
      await db
        .insert(servicePostPhotos)
        .values(photos.map((url, ordre) => ({ postId: post.id, url, ordre })));
    }

    res.status(201).json({
      ...post,
      message: "Publication créée, en attente de modération",
    });
  } catch (err) {
    next(err);
  }
}

export async function likePost(req: Request, res: Response, next: NextFunction) {
  try {
    await db
      .insert(servicePostLikes)
      .values({ postId: req.params.id, userId: req.auth!.userId })
      .onConflictDoNothing();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function unlikePost(req: Request, res: Response, next: NextFunction) {
  try {
    await db
      .delete(servicePostLikes)
      .where(and(eq(servicePostLikes.postId, req.params.id), eq(servicePostLikes.userId, req.auth!.userId)));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function addComment(req: Request, res: Response, next: NextFunction) {
  try {
    const { contenu } = createCommentSchema.parse(req.body);
    const [comment] = await db
      .insert(servicePostComments)
      .values({ postId: req.params.id, userId: req.auth!.userId, contenu })
      .returning();
    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
}

export async function listComments(req: Request, res: Response, next: NextFunction) {
  try {
    const results = await db.query.servicePostComments.findMany({
      where: eq(servicePostComments.postId, req.params.id),
      orderBy: (c, { asc }) => [asc(c.creeLe)],
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
}
