// Import THIS file first in tests that load modules reading env.ts at import time (no .env, as in CI).
// Placeholder values are enough: nothing here connects to the database.
Object.assign(process.env, {
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://x:x@127.0.0.1:1/x",
  JWT_SECRET: process.env.JWT_SECRET ?? "j".repeat(40),
  MEMORY_KEK: process.env.MEMORY_KEK ?? Buffer.alloc(32, 7).toString("base64"),
});
