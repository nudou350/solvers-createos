import { env } from "./env.js";
import { createApp } from "./app.js";
import { runMigrations } from "./db/migrate.js";
import { pool } from "./db/index.js";
import { mounts, startJobs, stopJobs } from "./modules.js";
import { warmEmbeddings } from "./knowledge/embeddings.js";
import { packages } from "./runtime/packages.js";

async function main() {
  await runMigrations();

  const pkgCount = new Set([...packages().values()].map((p) => p.manifest.id)).size;
  console.log(`[runtime] ${pkgCount} Solver packages loaded`);
  console.log(`[sandbox] SANDBOX_MODE=${env.SANDBOX_MODE} VERIFIER_MODE=${env.VERIFIER_MODE}`);
  if (env.DEV_LOGIN) console.warn("[auth] DEV_LOGIN=1: magic links are logged and returned by the API (anyone can sign in as any e-mail)");
  warmEmbeddings();

  const app = createApp(mounts);
  const server = app.listen(env.PORT, env.HOST, () => {
    console.log(`[server] listening on ${env.HOST}:${env.PORT} (${env.PUBLIC_API_URL})`);
  });

  startJobs();

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    console.log(`[server] ${signal}, shutting down`);
    stopJobs();
    // Stop accepting connections; idle keep-alive sockets do not hold the exit for more than 5 s.
    await Promise.race([new Promise<void>((r) => server.close(() => r())), new Promise<void>((r) => setTimeout(r, 5000))]);
    await pool.end().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((e) => {
  console.error("[server] failed to start", e);
  process.exit(1);
});
