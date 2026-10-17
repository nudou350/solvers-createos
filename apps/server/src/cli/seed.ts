// Demo seed: fills the store with test buyers, licenses, reviews and usage history (database only).
// Prerequisite: the Solvers published (cli:publish).
//
//   pnpm --filter @solvers/server cli:seed
//
// Test buyers are placeholder accounts (`<name>@buyers.solvers.invalid`, never reachable by e-mail). Each paid Solver
// gets 2 to 6 licenses (marked with a `seed:` checkout id, never a real Stripe session), up to 4 reviews and 14 days of
// usage for the weekly trend; the store counters (sales, rating) are recomputed from those rows. Idempotent: a second
// run skips what already exists.

import { randomUUID } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, pool, schema } from "../db/index.js";
import { runMigrations } from "../db/migrate.js";
import { sha256Hex } from "../lib/crypto.js";

const BUYERS = ["ana", "bruno", "carla", "diego", "elisa", "fabio", "gabi", "novato"];

const REVIEWS: Record<string, Array<[number, string]>> = {
  Development: [
    [5, "It produced a component with real tests and accessibility. Saved me a whole afternoon."],
    [5, "The review checklist caught two focus bugs I would have missed."],
    [4, "Very good. Sometimes it asks too much before starting, but the result pays off."],
    [5, "Finally the AI writes tests that test behaviour, not implementation."],
    [4, "Great for people who know the basics and want senior-level standards."],
  ],
  Design: [
    [5, "The contrast and spacing audit of my Figma file was spot on."],
    [4, "It helped me organise the tokens. I had to connect Figma first; the walkthrough helped."],
    [5, "The visual hierarchy of my landing page improved a lot with the suggestions."],
  ],
  Everyday: [
    [5, "Planned my trip to Portugal remembering I hate waking up early. Amazing."],
    [5, "The budget per category gave me a real sense of how much to take."],
    [4, "Very useful. I liked that it tells me what to double-check on official sites."],
  ],
  Business: [
    [4, "It pointed out penalty clauses I had not read properly. It is clear it does not replace a lawyer."],
    [5, "Turned my messy spreadsheet into a simple dashboard."],
  ],
  Writing: [
    [5, "The ads sound like my brand, without that generic text."],
    [4, "Good title variations to test."],
  ],
};

/** Test buyer account (created once). */
async function buyer(name: string): Promise<string> {
  const email = `${name}@buyers.solvers.invalid`;
  const [user] = await db
    .insert(schema.users)
    .values({ email })
    .onConflictDoUpdate({ target: schema.users.email, set: { email } })
    .returning({ id: schema.users.id });
  return user!.id;
}

async function main() {
  await runMigrations();
  const agents = await db.select().from(schema.agents).where(and(eq(schema.agents.listed, true), eq(schema.agents.platformStatus, "active"), gt(schema.agents.priceCents, 0)));
  if (agents.length === 0) throw new Error("no paid Solver published; run cli:publish first");
  console.log(`${agents.length} published Solvers`);

  const buyers: Record<string, string> = {};
  for (const n of BUYERS) buyers[n] = await buyer(n);
  console.log("test buyers:", BUYERS.join(", "));

  // Licenses and reviews: each Solver gets 2 to 6 buyers ("novato" buys nothing).
  const veterans = BUYERS.filter((b) => b !== "novato");
  for (const [i, a] of agents.entries()) {
    const count = 2 + ((i * 3) % 5);
    const pool = REVIEWS[a.category] ?? REVIEWS.Development!;
    for (let k = 0; k < count; k++) {
      const name = veterans[(i + k) % veterans.length]!;
      const userId = buyers[name]!;
      await db
        .insert(schema.licenses)
        .values({ id: randomUUID(), agentId: a.id, userId, versionHash: a.versionHash, stripeCheckoutSessionId: `seed:${name}:${a.id}` })
        .onConflictDoNothing();
      if (k < 4) {
        const [rating, text] = pool[(i + k) % pool.length]!;
        await db
          .insert(schema.reviews)
          .values({ id: `${a.id}:${userId}`, agentId: a.id, authorUserId: userId, rating, text, contentHash: sha256Hex(text), versionHash: a.versionHash })
          .onConflictDoNothing();
      }
    }
    console.log(`  ${a.name}: ${count} licenses`);
  }

  // 14 days of usage history for the weekly trend.
  for (const [i, a] of agents.entries()) {
    const base = 40 + ((i * 97) % 600);
    const previous = Math.round(base / 2);
    const recent = Math.round(previous * (0.75 + ((i * 3) % 7) / 10));
    const [already] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(schema.usageEvents).where(eq(schema.usageEvents.agentId, a.id));
    if ((already?.n ?? 0) >= 20) continue;
    const rows = [];
    for (let day = 0; day < 14; day++) {
      const perDay = Math.max(1, Math.round((day < 7 ? recent : previous) / 7 / 3));
      for (let k = 0; k < perDay; k++) {
        rows.push({
          userId: buyers[veterans[k % veterans.length]!]!,
          agentId: a.id,
          sessionId: null,
          tool: "activate_solver",
          responseHash: sha256Hex(`${a.id}:${day}:${k}`),
          createdAt: new Date(Date.now() - day * 86400_000 - k * 3600_000),
        });
      }
    }
    await db.insert(schema.usageEvents).values(rows);
  }
  console.log("  usage history recorded");

  // Store counters from the rows above (and any real ones).
  for (const a of agents) {
    const [sales] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(schema.licenses).where(eq(schema.licenses.agentId, a.id));
    const [rated] = await db
      .select({ sum: sql<number>`coalesce(sum(${schema.reviews.rating}), 0)`.mapWith(Number), n: sql<number>`count(*)`.mapWith(Number) })
      .from(schema.reviews)
      .where(eq(schema.reviews.agentId, a.id));
    await db
      .update(schema.agents)
      .set({ totalSales: BigInt(sales?.n ?? 0), ratingSum: BigInt(rated?.sum ?? 0), ratingCount: rated?.n ?? 0 })
      .where(eq(schema.agents.id, a.id));
  }
  console.log("\nSeed finished.");
}

if (/cli[\\/]seed\.(ts|js)$/.test(process.argv[1] ?? "")) {
  try {
    await main();
  } finally {
    await pool.end();
  }
  process.exit(0);
}
