import { db } from "../db/index.js";
import { payments } from "../db/schema/index.js";
import { env } from "../config/env.js";

/**
 * Initie un paiement (abonnement ou publicité).
 *
 * ⚠️ STUB — aucune passerelle de paiement mobile money (MyPVit, Airtel Money,
 * Moov Money...) n'est branchée pour l'instant. En développement, le paiement
 * est directement marqué "reussi" pour ne pas bloquer le reste du flux. À
 * remplacer avant la mise en production par un vrai appel à l'agrégateur choisi,
 * avec vérification de webhook (voir le projet Mars Runner pour un exemple
 * d'intégration Moneroo déjà réalisé, si tu veux réutiliser la même approche).
 */
export async function initiatePayment(
  userId: string,
  montant: number,
  type: "abonnement" | "publicite" | "autre",
  reference?: string
) {
  const statut = env.NODE_ENV !== "production" ? "reussi" : "en_attente";
  const [payment] = await db
    .insert(payments)
    .values({ userId, montant: montant.toString(), type, statut, reference })
    .returning();
  return payment;
}
