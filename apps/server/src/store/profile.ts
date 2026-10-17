import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";

/** Creates the profile on first access (its date becomes "member since") and returns the row. */
export async function ensureProfile(userId: string) {
  await db.insert(schema.userProfiles).values({ userId }).onConflictDoNothing();
  const [row] = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId));
  return row!;
}
