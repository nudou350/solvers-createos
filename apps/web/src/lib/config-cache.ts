// Module cache of the public config (`GET /api/config`), without React (lib/config.ts holds the hook). One request per
// page load; a failed load is retried on the next call.
import type { PublicConfig } from "@solvers/api-client";
import { api } from "./api";

let cached: PublicConfig | null = null;
let inflight: Promise<PublicConfig> | null = null;

/** `/api/config`, cached in the module. */
export function loadPublicConfig(): Promise<PublicConfig> {
  if (cached) return Promise.resolve(cached);
  inflight ??= api.getConfig().then(
    (c) => {
      cached = c;
      inflight = null;
      return c;
    },
    (e: unknown) => {
      inflight = null;
      throw e;
    },
  );
  return inflight;
}

/** The config if it was already loaded, else null (never fetches). */
export function loadPublicConfigSync(): PublicConfig | null {
  return cached;
}
