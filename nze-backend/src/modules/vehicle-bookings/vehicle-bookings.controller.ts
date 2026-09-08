import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { vehicleBookings, vehicles } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { ensureOwnedVehicle } from "../vehicles/vehicles.controller.js";
import { createBookingSchema } from "./vehicle-bookings.validation.js";

export async function createBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const vehicle = await db.query.vehicles.findFirst({ where: eq(vehicles.id, req.params.vehicleId) });
    if (!vehicle || vehicle.statutValidation !== "valide") {
      throw new AppError(404, "Véhicule introuvable ou non disponible");
    }

    const input = createBookingSchema.parse(req.body);

    const [booking] = await db
      .insert(vehicleBookings)
      .values({ ...input, vehicleId: vehicle.id, clientActivityId: req.activity!.id })
      .returning();

    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
}

export async function listVehicleBookings(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureOwnedVehicle(req.params.vehicleId, req.activity!.id);
    const results = await db.query.vehicleBookings.findMany({
      where: eq(vehicleBookings.vehicleId, req.params.vehicleId),
      orderBy: (b, { desc }) => [desc(b.creeLe)],
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
}

async function respondToBooking(req: Request, statut: "acceptee" | "refusee") {
  const booking = await db.query.vehicleBookings.findFirst({ where: eq(vehicleBookings.id, req.params.id) });
  if (!booking) throw new AppError(404, "Réservation introuvable");
  await ensureOwnedVehicle(booking.vehicleId, req.activity!.id);

  const [updated] = await db
    .update(vehicleBookings)
    .set({ statut })
    .where(eq(vehicleBookings.id, booking.id))
    .returning();
  return updated;
}

export async function acceptBooking(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await respondToBooking(req, "acceptee"));
  } catch (err) {
    next(err);
  }
}

export async function rejectBooking(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await respondToBooking(req, "refusee"));
  } catch (err) {
    next(err);
  }
}
