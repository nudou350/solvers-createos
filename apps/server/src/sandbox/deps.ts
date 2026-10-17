import { createosPort, type SandboxPort } from "./client.js";
import { sandboxConfig } from "./config.js";
import { FakeSandboxPort } from "./fake.js";
import { createPool, type Pool } from "./pool.js";

// The server's sandbox pool: the real CreateOS port (SANDBOX_MODE=createos) or the in-memory fake (simulated), with the
// Postgres store. The store module is imported on first use, so importing this file never opens a database connection.

let pool: Promise<Pool> | null = null;
let verifierPort: SandboxPort | null = null;

export function sandboxPool(): Promise<Pool> {
  pool ??= (async () => {
    const { dbSandboxStore } = await import("./store.js");
    const port = sandboxConfig().mode === "createos" ? createosPort() : new FakeSandboxPort();
    return createPool({ port, store: dbSandboxStore() });
  })();
  return pool;
}

/** Port for the verifier's ephemeral boxes (VERIFIER_MODE=createos only; simulated mode never reaches it). */
export function verifierSandboxPort(): SandboxPort {
  verifierPort ??= createosPort();
  return verifierPort;
}
