// The admin kill switch (PACKAGE_SPEC.md 15.4): suspends (or resumes with --resume) a Solver on the platform.
//
//   pnpm --filter @solvers/server cli:suspend <slug> [--reason "<text>"] [--actor <admin user id>]
//   pnpm --filter @solvers/server cli:suspend <slug> --resume
//
// agents.platform_status drops open sessions, the store and sales at once; an audit row goes to package_reviews
// (suspend/resume) and the submission moves published <-> suspended.

import { env } from "../env.js";
import { pool } from "../db/index.js";
import { parseAdminUserIds } from "../publish/admin-rules.js";
import { CliUsageError, parseSuspendArgs, SUSPEND_USAGE } from "../publish/cli-args.js";
import { suspendSolver, SuspendError } from "../publish/suspend.js";

async function main() {
  const args = parseSuspendArgs(process.argv.slice(2));
  const actor = args.actor ?? [...parseAdminUserIds(env.ADMIN_USER_IDS)][0];
  if (!actor) throw new SuspendError("no admin to record in the audit trail: pass --actor <user id> or set ADMIN_USER_IDS");
  const r = await suspendSolver(args.ref, { actor, resume: args.resume, reason: args.reason ?? undefined });
  console.log(`${r.action === "suspend" ? "Suspended" : "Resumed"}: ${r.slug} (${r.agentId})`);
  console.log(`  platform: ${r.platformChanged ? "platform_status changed" : "already like this"}`);
  if (r.submissionId) console.log(`  submission: ${r.submissionId}`);
}

try {
  await main();
} catch (e) {
  if (e instanceof CliUsageError) {
    console.error(`${e.message}\n\n${SUSPEND_USAGE}`);
    process.exitCode = 2;
  } else {
    console.error(`Failed: ${e instanceof SuspendError ? e.message : ((e as Error)?.message ?? String(e))}`);
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}
process.exit(process.exitCode ?? 0);
