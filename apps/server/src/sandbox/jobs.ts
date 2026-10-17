import { sandboxPool } from "./deps.js";

/** Destroys sandboxes idle for more than 30 minutes (session boxes, checkpoints). Returns how many were destroyed. */
export async function destroyIdleSandboxes(): Promise<number> {
  return (await sandboxPool()).destroyIdle();
}
