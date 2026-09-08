import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { notifications, userActivities } from "../../db/schema/index.js";
import { emitToUser } from "../../realtime/socket.js";

export async function createNotification(
  userId: string,
  type: string,
  contenu: string,
  donnees?: Record<string, unknown>
) {
  const [notification] = await db
    .insert(notifications)
    .values({ userId, type, contenu, donnees })
    .returning();

  emitToUser(userId, "notification:new", notification);
  return notification;
}

/** Retrouve le user_id propriétaire d'une activité (ex. pour notifier le commerçant d'un magasin). */
export async function getUserIdForActivity(activityId: string): Promise<string | null> {
  const activity = await db.query.userActivities.findFirst({ where: eq(userActivities.id, activityId) });
  return activity?.userId ?? null;
}
