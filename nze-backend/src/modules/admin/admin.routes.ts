import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  stores,
  deliverers,
  serviceProfiles,
  servicePosts,
  vehicles,
  drivers,
  userActivities,
  reports,
  orders,
  deliveries,
  rides,
} from "../../db/schema/index.js";
import { createNotification } from "../notifications/notifications.service.js";
import { requireAuth, requireAdmin } from "../../middleware/auth.js";
import { AppError } from "../../middleware/errorHandler.js";
import { logAdminAction } from "../../lib/adminLog.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

const validateStoreSchema = z.object({
  statutValidation: z.enum(["valide", "refuse", "suspendu"]),
});

adminRouter.get("/stores/pending", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const results = await db.query.stores.findMany({ where: eq(stores.statutValidation, "en_attente") });
    res.json(results);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/stores/:id/validate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { statutValidation } = validateStoreSchema.parse(req.body);
    const store = await db.query.stores.findFirst({ where: eq(stores.id, req.params.id) });
    if (!store) throw new AppError(404, "Magasin introuvable");

    const [updated] = await db
      .update(stores)
      .set({ statutValidation, majLe: new Date() })
      .where(eq(stores.id, store.id))
      .returning();

    await logAdminAction(req.auth!.userId, `store.${statutValidation}`, "magasin", store.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const validateDelivererSchema = z.object({
  statutValidation: z.enum(["valide", "refuse", "suspendu"]),
});

adminRouter.get("/deliverers/pending", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const results = await db.query.deliverers.findMany({
      where: eq(deliverers.statutValidation, "en_attente"),
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/deliverers/:id/validate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { statutValidation } = validateDelivererSchema.parse(req.body);
    const deliverer = await db.query.deliverers.findFirst({ where: eq(deliverers.id, req.params.id) });
    if (!deliverer) throw new AppError(404, "Livreur introuvable");

    const [updated] = await db
      .update(deliverers)
      .set({ statutValidation, majLe: new Date() })
      .where(eq(deliverers.id, deliverer.id))
      .returning();

    await logAdminAction(req.auth!.userId, `deliverer.${statutValidation}`, "livreur", deliverer.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const validateServiceProfileSchema = z.object({
  statutValidation: z.enum(["valide", "refuse", "suspendu"]),
});

adminRouter.get("/service-profiles/pending", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const results = await db.query.serviceProfiles.findMany({
      where: eq(serviceProfiles.statutValidation, "en_attente"),
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/service-profiles/:id/validate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { statutValidation } = validateServiceProfileSchema.parse(req.body);
    const profile = await db.query.serviceProfiles.findFirst({ where: eq(serviceProfiles.id, req.params.id) });
    if (!profile) throw new AppError(404, "Profil prestataire introuvable");

    const [updated] = await db
      .update(serviceProfiles)
      .set({ statutValidation, majLe: new Date() })
      .where(eq(serviceProfiles.id, profile.id))
      .returning();

    await logAdminAction(req.auth!.userId, `service_profile.${statutValidation}`, "prestataire", profile.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const moderatePostSchema = z.object({
  statutModeration: z.enum(["publie", "refuse"]),
});

adminRouter.patch("/service-posts/:id/moderate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { statutModeration } = moderatePostSchema.parse(req.body);
    const post = await db.query.servicePosts.findFirst({ where: eq(servicePosts.id, req.params.id) });
    if (!post) throw new AppError(404, "Publication introuvable");

    const [updated] = await db
      .update(servicePosts)
      .set({ statutModeration })
      .where(eq(servicePosts.id, post.id))
      .returning();

    await logAdminAction(req.auth!.userId, `service_post.${statutModeration}`, "publication", post.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const validateVehicleSchema = z.object({
  statutValidation: z.enum(["valide", "refuse", "suspendu"]),
});

adminRouter.get("/vehicles/pending", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const results = await db.query.vehicles.findMany({ where: eq(vehicles.statutValidation, "en_attente") });
    res.json(results);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/vehicles/:id/validate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { statutValidation } = validateVehicleSchema.parse(req.body);
    const vehicle = await db.query.vehicles.findFirst({ where: eq(vehicles.id, req.params.id) });
    if (!vehicle) throw new AppError(404, "Véhicule introuvable");

    const [updated] = await db
      .update(vehicles)
      .set({ statutValidation, majLe: new Date() })
      .where(eq(vehicles.id, vehicle.id))
      .returning();

    await logAdminAction(req.auth!.userId, `vehicle.${statutValidation}`, "vehicule", vehicle.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const validateDriverSchema = z.object({
  statutValidation: z.enum(["valide", "refuse", "suspendu"]),
});

adminRouter.get("/drivers/pending", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const results = await db.query.drivers.findMany({ where: eq(drivers.statutValidation, "en_attente") });
    res.json(results);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/drivers/:id/validate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { statutValidation } = validateDriverSchema.parse(req.body);
    const driver = await db.query.drivers.findFirst({ where: eq(drivers.id, req.params.id) });
    if (!driver) throw new AppError(404, "Chauffeur introuvable");

    const [updated] = await db
      .update(drivers)
      .set({ statutValidation, majLe: new Date() })
      .where(eq(drivers.id, driver.id))
      .returning();

    await logAdminAction(req.auth!.userId, `driver.${statutValidation}`, "chauffeur", driver.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Point 15 du prompt maître : messagerie admin, annonces à un groupe entier.
const announcementSchema = z.object({
  cible: z.enum([
    "tous_livreurs",
    "tous_magasins",
    "tous_prestataires",
    "tous_chauffeurs",
    "tous_proprietaires_vehicules",
    "tous_clients",
  ]),
  message: z.string().min(1).max(1000),
});

const CIBLE_TO_ACTIVITY_TYPE = {
  tous_livreurs: "livreur",
  tous_magasins: "commercant",
  tous_prestataires: "prestataire",
  tous_chauffeurs: "chauffeur",
  tous_proprietaires_vehicules: "proprietaire_vehicule",
  tous_clients: "client",
} as const;

adminRouter.post("/announcements", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = announcementSchema.parse(req.body);
    const activityType = CIBLE_TO_ACTIVITY_TYPE[input.cible];

    const targets = await db.query.userActivities.findMany({
      where: eq(userActivities.type, activityType),
    });
    const uniqueUserIds = Array.from(new Set(targets.map((t) => t.userId)));

    await Promise.all(
      uniqueUserIds.map((userId) => createNotification(userId, "annonce_administrative", input.message))
    );

    await logAdminAction(req.auth!.userId, "announcement.sent", input.cible);
    res.json({ message: `Annonce envoyée à ${uniqueUserIds.length} utilisateur(s)` });
  } catch (err) {
    next(err);
  }
});

// Point 27/34 : signalements et modération
const updateReportSchema = z.object({
  statut: z.enum(["traite", "rejete"]),
});

adminRouter.get("/reports", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const statut = req.query.statut as string | undefined;
    const results = await db.query.reports.findMany({
      where: statut ? eq(reports.statut, statut as any) : undefined,
      orderBy: (r, { desc }) => [desc(r.creeLe)],
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/reports/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { statut } = updateReportSchema.parse(req.body);
    const report = await db.query.reports.findFirst({ where: eq(reports.id, req.params.id) });
    if (!report) throw new AppError(404, "Signalement introuvable");

    const [updated] = await db.update(reports).set({ statut }).where(eq(reports.id, report.id)).returning();
    await logAdminAction(req.auth!.userId, `report.${statut}`, report.cibleType, report.cibleId);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Point 27 : statistiques simples pour le dashboard admin
adminRouter.get("/stats", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      clientsCount,
      commercantsCount,
      prestatairesCount,
      livreursCount,
      chauffeursCount,
      storesPending,
      deliverersPending,
      ordersTotal,
      deliveriesEnCours,
      ridesEnCours,
      reportsPending,
    ] = await Promise.all([
      db.$count(userActivities, eq(userActivities.type, "client")),
      db.$count(userActivities, eq(userActivities.type, "commercant")),
      db.$count(userActivities, eq(userActivities.type, "prestataire")),
      db.$count(userActivities, eq(userActivities.type, "livreur")),
      db.$count(userActivities, eq(userActivities.type, "chauffeur")),
      db.$count(stores, eq(stores.statutValidation, "en_attente")),
      db.$count(deliverers, eq(deliverers.statutValidation, "en_attente")),
      db.$count(orders),
      db.$count(deliveries, eq(deliveries.statut, "livraison_terminee")),
      db.$count(rides, eq(rides.statut, "terminee")),
      db.$count(reports, eq(reports.statut, "en_attente")),
    ]);

    res.json({
      utilisateurs: {
        clients: clientsCount,
        commercants: commercantsCount,
        prestataires: prestatairesCount,
        livreurs: livreursCount,
        chauffeurs: chauffeursCount,
      },
      validationsEnAttente: {
        magasins: storesPending,
        livreurs: deliverersPending,
      },
      activite: {
        commandesTotal: ordersTotal,
        livraisonsTerminees: deliveriesEnCours,
        coursesTerminees: ridesEnCours,
      },
      signalementsEnAttente: reportsPending,
    });
  } catch (err) {
    next(err);
  }
});
