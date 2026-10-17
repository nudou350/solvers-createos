import { env } from "../env.js";
import { forbidden } from "../lib/http.js";
import { isAdminIn } from "./admin-rules.js";

// Is the authenticated user a site admin? (ADMIN_USER_IDS; rule in admin-rules.ts.)

export const isAdminUser = (userId: string | undefined): boolean => isAdminIn(userId, env.ADMIN_USER_IDS);

export function requireAdminUser(userId: string | undefined): void {
  if (!isAdminUser(userId)) throw forbidden("Only the team can do this");
}
