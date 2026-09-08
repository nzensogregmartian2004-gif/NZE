import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireActivity } from "../../middleware/activity.js";
import * as vehiclesController from "./vehicles.controller.js";
import * as bookingsController from "../vehicle-bookings/vehicle-bookings.controller.js";

export const vehiclesRouter = Router();

// Lecture publique
vehiclesRouter.get("/", vehiclesController.listVehicles);
vehiclesRouter.get("/:id", vehiclesController.getVehicle);

// Propriétaire ("proprietaire_vehicule")
vehiclesRouter.post("/", requireAuth, requireActivity("proprietaire_vehicule"), vehiclesController.createVehicle);
vehiclesRouter.get(
  "/me/mine",
  requireAuth,
  requireActivity("proprietaire_vehicule"),
  vehiclesController.listMyVehicles
);
vehiclesRouter.patch(
  "/:id",
  requireAuth,
  requireActivity("proprietaire_vehicule"),
  vehiclesController.updateVehicle
);
vehiclesRouter.get(
  "/:vehicleId/bookings",
  requireAuth,
  requireActivity("proprietaire_vehicule"),
  bookingsController.listVehicleBookings
);

// Réservation par un client
vehiclesRouter.post("/:vehicleId/book", requireAuth, requireActivity("client"), bookingsController.createBooking);
