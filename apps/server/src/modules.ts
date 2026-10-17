import type { Mount } from "./app.js";
import { jobs } from "./jobs.js";
import { creatorRouter } from "./creator/routes.js";
import { mountMcp } from "./mcp/routes.js";
import { mountOAuth } from "./oauth/routes.js";
import { publishRouter } from "./publish/routes.js";
import { helpRouter } from "./store/help.js";
import { imagesRouter } from "./store/images.js";
import { meRouter } from "./store/me.js";

// Single place where modules register with the app (extra routes and periodic jobs). The Stripe webhook and checkout
// routes are mounted in app.ts (the webhook needs the raw body, before the JSON parser).

export const mounts: Mount[] = [
  mountOAuth,
  mountMcp,
  (app) => {
    app.use("/api", imagesRouter);
    app.use("/api", helpRouter);
    app.use("/api", meRouter);
    app.use("/api", creatorRouter);
    app.use("/api", publishRouter);
  },
];

export function startJobs(): void {
  for (const j of jobs) j.start();
}

export function stopJobs(): void {
  for (const j of jobs) j.stop();
}
