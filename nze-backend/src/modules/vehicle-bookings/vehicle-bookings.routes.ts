import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireActivity } from "../../middleware/activity.js";
import * as bookingsController from "./vehicle-bookings.controller.js";

export const vehicleBookingsRouter = Router();

vehicleBookingsRouter.use(requireAuth, requireActivity("proprietaire_vehicule"));
vehicleBookingsRouter.patch("/:id/accept", bookingsController.acceptBooking);
vehicleBookingsRouter.patch("/:id/reject", bookingsController.rejectBooking);
