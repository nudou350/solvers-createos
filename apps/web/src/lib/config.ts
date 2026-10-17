"use client";
// Public config (`GET /api/config`), loaded once per page load (lib/config-cache.ts) and shared by every component
// through `usePublicConfig()`.
import type { PublicConfig } from "@solvers/api-client";
import { useEffect, useState } from "react";
import { loadPublicConfig, loadPublicConfigSync } from "./config-cache";

export type { PublicConfig };
export { loadPublicConfig };

/** The public config, or null while it loads (or when the API is unreachable). */
export function usePublicConfig(): PublicConfig | null {
  const [config, setConfig] = useState<PublicConfig | null>(loadPublicConfigSync);
  useEffect(() => {
    if (config) return;
    let alive = true;
    loadPublicConfig().then(
      (c) => alive && setConfig(c),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [config]);
  return config;
}
