import type { Request, Response, NextFunction } from "express";
import { eq, and, ilike } from "drizzle-orm";
import { db } from "../../db/index.js";
import { serviceProfiles, serviceSkills, userActivities } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import {
  createServiceProfileSchema,
  updateServiceProfileSchema,
  listServiceProfilesQuerySchema,
} from "./service-profiles.validation.js";

export async function listServiceProfiles(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listServiceProfilesQuerySchema.parse(req.query);
    const conditions = [eq(serviceProfiles.statutValidation, "valide")];

    if (query.metier) conditions.push(ilike(serviceProfiles.metier, `%${query.metier}%`));
    if (query.disponible !== undefined) conditions.push(eq(serviceProfiles.disponible, query.disponible));

    const results = await db
      .select()
      .from(serviceProfiles)
      .where(and(...conditions))
      .limit(50);

    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function getMyServiceProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await db.query.serviceProfiles.findFirst({
      where: eq(serviceProfiles.userActivityId, req.activity!.id),
    });
    if (!profile) return res.json(null);

    const skills = await db.query.serviceSkills.findMany({ where: eq(serviceSkills.serviceProfileId, profile.id) });
    res.json({ ...profile, competences: skills });
  } catch (err) {
    next(err);
  }
}

export async function getServiceProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await db.query.serviceProfiles.findFirst({
      where: eq(serviceProfiles.id, req.params.id),
    });
    if (!profile) throw new AppError(404, "Profil prestataire introuvable");

    const skills = await db.query.serviceSkills.findMany({
      where: eq(serviceSkills.serviceProfileId, profile.id),
    });

    const activity = await db.query.userActivities.findFirst({ where: eq(userActivities.id, profile.userActivityId) });

    res.json({ ...profile, competences: skills, userId: activity?.userId ?? null });
  } catch (err) {
    next(err);
  }
}

export async function createServiceProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await db.query.serviceProfiles.findFirst({
      where: eq(serviceProfiles.userActivityId, req.activity!.id),
    });
    if (existing) throw new AppError(409, "Profil prestataire déjà créé pour cette activité");

    const input = createServiceProfileSchema.parse(req.body);
    const { competences, ...profileData } = input;

    const [profile] = await db
      .insert(serviceProfiles)
      .values({ ...profileData, userActivityId: req.activity!.id })
      .returning();

    if (competences?.length) {
      await db
        .insert(serviceSkills)
        .values(competences.map((competence) => ({ serviceProfileId: profile.id, competence })));
    }

    res.status(201).json({
      ...profile,
      message: "Profil créé, en attente de validation par l'administration",
    });
  } catch (err) {
    next(err);
  }
}

export async function ensureOwnedServiceProfile(profileId: string, activityId: string) {
  const profile = await db.query.serviceProfiles.findFirst({
    where: eq(serviceProfiles.id, profileId),
  });
  if (!profile) throw new AppError(404, "Profil prestataire introuvable");
  if (profile.userActivityId !== activityId) {
    throw new AppError(403, "Ce profil ne t'appartient pas");
  }
  return profile;
}

export async function updateServiceProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await ensureOwnedServiceProfile(req.params.id, req.activity!.id);
    const input = updateServiceProfileSchema.parse(req.body);

    const [updated] = await db
      .update(serviceProfiles)
      .set({ ...input, majLe: new Date() })
      .where(eq(serviceProfiles.id, profile.id))
      .returning();

    res.json(updated);
  } catch (err) {
    next(err);
  }
}
