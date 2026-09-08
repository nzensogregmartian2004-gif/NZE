import { db } from "../db/index.js";
import { adminActions } from "../db/schema/index.js";

export async function logAdminAction(
  adminId: string,
  action: string,
  cibleType?: string,
  cibleId?: string
) {
  await db.insert(adminActions).values({ adminId, action, cibleType, cibleId });
}
