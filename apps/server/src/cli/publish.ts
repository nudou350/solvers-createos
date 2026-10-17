// Publishes the platform-folder packages (agents/): computes the versionHash, ingests the knowledge, records the approved
// version and writes the catalog in the database (live and listed). Idempotent: running it again only changes
// what differs.
//
//   pnpm --filter @solvers/server cli:publish                          # every agents/ package
//   pnpm --filter @solvers/server cli:publish frontend-react ui-design
//
// Platform Solvers (PLATFORM_AGENTS, e.g. criador-de-solvers) are free (price 0); the others keep the manifest price.
// Third-party creators NEVER come here (they publish through the site, PACKAGE_SPEC.md 15). The catalog is built by
// publish/catalog.ts, the same code as the site's finalization. `--no-chain` from older scripts is accepted and ignored.

import { eq } from "drizzle-orm";
import { db, pool, schema } from "../db/index.js";
import { runMigrations } from "../db/migrate.js";
import { ingestPackage } from "../knowledge/ingest.js";
import { isPlatformPair } from "../runtime/platform-agents.js";
import { packages, type SolverPackage } from "../runtime/packages.js";
import { formatCents } from "../runtime/price.js";
import { relist, upsertCatalog } from "../publish/catalog.js";

/**
 * What the review "approved": in `cli:publish` the admin is the publisher, so recording the version here is the
 * equivalent of the site's approval. Older versions stay (the creator may revert to them).
 */
export async function recordApprovedVersion(pkg: SolverPackage, priceCents: number) {
  const v = { agentId: pkg.manifest.id, version: pkg.manifest.version, versionHash: pkg.versionHash, priceCents };
  await db
    .insert(schema.agentPublishedVersions)
    .values(v)
    .onConflictDoUpdate({
      target: [schema.agentPublishedVersions.agentId, schema.agentPublishedVersions.version],
      set: { versionHash: v.versionHash, priceCents: v.priceCents },
    });
}

/**
 * User that owns a platform package's creator row: the existing profile's, otherwise a placeholder account
 * (`<creator.id>@creators.solvers.invalid`, never reachable by e-mail) created once.
 */
export async function creatorUserFor(creatorId: string): Promise<string> {
  const [creator] = await db.select({ userId: schema.creators.userId }).from(schema.creators).where(eq(schema.creators.id, creatorId));
  if (creator) return creator.userId;
  const email = `${creatorId}@creators.solvers.invalid`;
  const [user] = await db
    .insert(schema.users)
    .values({ email })
    .onConflictDoUpdate({ target: schema.users.email, set: { email } })
    .returning({ id: schema.users.id });
  return user!.id;
}

/** Packages of the platform folder (AGENTS_DIR), without the id/slug double entries. Creator packages (PUBLISHED_DIR) never come here. */
function platformFolderPackages(): SolverPackage[] {
  return [...new Map([...packages().values()].map((p) => [p.manifest.id, p])).values()].filter((p) => (p.source ?? "agents") === "agents");
}

/** Picks what to publish: every platform-folder package, or the named ones (slug or id). */
export function selectPackages(all: SolverPackage[], slugs: string[]): SolverPackage[] {
  if (!slugs.length) return all;
  const missing = slugs.filter((x) => !all.some((p) => p.manifest.slug === x || p.manifest.id === x));
  if (missing.length) throw new Error(`no platform package found for: ${missing.join(", ")} (creator packages are published through the site)`);
  return all.filter((p) => slugs.includes(p.manifest.slug) || slugs.includes(p.manifest.id));
}

/** Publishes one package: knowledge, approved version and only then the catalog (the store keeps the previous version if something fails midway). */
export async function publishPackage(pkg: SolverPackage) {
  const m = pkg.manifest;
  const platform = isPlatformPair(m);
  const priceCents = platform ? 0 : m.pricing.priceCents;
  if (platform && m.pricing.priceCents !== 0) console.warn(`  ! the manifest asks for ${formatCents(m.pricing.priceCents)}; a platform Solver is free (published with price 0)`);
  const chunks = await ingestPackage(pkg);
  console.log(`  knowledge: ${chunks} chunks`);
  await recordApprovedVersion(pkg, priceCents);
  const creatorUserId = await creatorUserFor(m.creator.id);
  await upsertCatalog(pkg, { creatorUserId, priceCents });
  await relist(m.id);
  console.log(`  ${platform ? "platform Solver (free)" : formatCents(priceCents)}, live and listed`);
}

export async function publish(slugs: string[]) {
  const selected = selectPackages(platformFolderPackages(), slugs);
  if (selected.length === 0) throw new Error(slugs.length ? `no package found for: ${slugs.join(", ")}` : "no package to publish");
  for (const pkg of selected) {
    const m = pkg.manifest;
    console.log(`\n> ${m.name} (${m.slug}) v${m.version}`);
    await publishPackage(pkg);
    console.log(`  versionHash ${pkg.versionHash.slice(0, 16)}...  ok`);
  }
}

if (/cli[\\/]publish\.(ts|js)$/.test(process.argv[1] ?? "")) {
  const args = process.argv.slice(2);
  await runMigrations();
  try {
    await publish(args.filter((a) => !a.startsWith("--")));
  } finally {
    await pool.end();
  }
  process.exit(0);
}
