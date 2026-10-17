import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index.js";

/** Applies the pending migrations. The baseline creates the extensions it needs (citext, vector, pgcrypto). */
export async function runMigrations() {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("./migrations", import.meta.url)) });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await runMigrations();
  console.log("migrations applied");
  await pool.end();
}
