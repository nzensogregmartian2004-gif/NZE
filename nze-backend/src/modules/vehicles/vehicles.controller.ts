import type { Request, Response, NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { vehicles, vehiclePhotos } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createVehicleSchema, updateVehicleSchema, listVehiclesQuerySchema } from "./vehicles.validation.js";

export async function listVehicles(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listVehiclesQuerySchema.parse(req.query);
    const conditions = [eq(vehicles.statutValidation, "valide")];

    if (query.type) conditions.push(eq(vehicles.type, query.type));
    if (query.disponible !== undefined) conditions.push(eq(vehicles.disponible, query.disponible));

    const results = await db
      .select()
      .from(vehicles)
      .where(and(...conditions))
      .limit(50);

    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function getVehicle(req: Request, res: Response, next: NextFunction) {
  try {
    const vehicle = await db.query.vehicles.findFirst({ where: eq(vehicles.id, req.params.id) });
    if (!vehicle) throw new AppError(404, "Véhicule introuvable");

    const photos = await db.query.vehiclePhotos.findMany({ where: eq(vehiclePhotos.vehicleId, vehicle.id) });
    res.json({ ...vehicle, photos });
  } catch (err) {
    next(err);
  }
}

export async function createVehicle(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createVehicleSchema.parse(req.body);
    const { photos, prix, ...vehicleData } = input;

    const [vehicle] = await db
      .insert(vehicles)
      .values({ ...vehicleData, prix: prix?.toString(), userActivityId: req.activity!.id })
      .returning();

    if (photos?.length) {
      await db.insert(vehiclePhotos).values(photos.map((url, ordre) => ({ vehicleId: vehicle.id, url, ordre })));
    }

    res.status(201).json({
      ...vehicle,
      message: "Véhicule créé, en attente de validation par l'administration",
    });
  } catch (err) {
    next(err);
  }
}

export async function ensureOwnedVehicle(vehicleId: string, activityId: string) {
  const vehicle = await db.query.vehicles.findFirst({ where: eq(vehicles.id, vehicleId) });
  if (!vehicle) throw new AppError(404, "Véhicule introuvable");
  if (vehicle.userActivityId !== activityId) throw new AppError(403, "Ce véhicule ne t'appartient pas");
  return vehicle;
}

export async function updateVehicle(req: Request, res: Response, next: NextFunction) {
  try {
    const vehicle = await ensureOwnedVehicle(req.params.id, req.activity!.id);
    const input = updateVehicleSchema.parse(req.body);
    const { photos, prix, ...rest } = input;

    const [updated] = await db
      .update(vehicles)
      .set({ ...rest, ...(prix !== undefined ? { prix: prix.toString() } : {}), majLe: new Date() })
      .where(eq(vehicles.id, vehicle.id))
      .returning();

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function listMyVehicles(req: Request, res: Response, next: NextFunction) {
  try {
    const results = await db.query.vehicles.findMany({ where: eq(vehicles.userActivityId, req.activity!.id) });
    res.json(results);
  } catch (err) {
    next(err);
  }
}
