import { HttpError } from "../lib/http.js";

/**
 * Pure rule: only what the storefront lists AND the server can load is sold. A Solver whose publication failed
 * (`publish_failed`, `listed = false`, no folder on disk) would charge for something that cannot be delivered.
 */
export function notListedBlock(input: { listed: boolean; hasPackage: boolean }): HttpError | null {
  if (input.listed && input.hasPackage) return null;
  return new HttpError(409, "This specialist is not available in the catalog yet.", "agent_not_listed");
}
