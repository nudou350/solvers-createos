// Arguments of `cli:suspend` (pure, no env: tested in test/publish-rules.test.ts).

export class CliUsageError extends Error {}

function valueOf(argv: readonly string[], i: number, flag: string, what: string): string {
  const v = argv[i];
  if (!v || v.startsWith("--")) throw new CliUsageError(`${flag} needs ${what}`);
  return v;
}

export const SUSPEND_USAGE = `usage: pnpm --filter @solvers/server cli:suspend <slug> [--resume] [--reason "<text>"] [--actor <admin user id>]

  Suspends the Solver: platform_status = suspended (drops open sessions, the store and sales at once), with an audit row
  in package_reviews. --resume does the reverse. --actor is the admin recorded in the audit trail (default: the first
  id of ADMIN_USER_IDS).`;

export type SuspendArgs = { ref: string; resume: boolean; reason: string | null; actor: string | null };

export function parseSuspendArgs(argv: readonly string[]): SuspendArgs {
  const rest: string[] = [];
  let resume = false;
  let reason: string | null = null;
  let actor: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--resume") resume = true;
    else if (a === "--reason") reason = valueOf(argv, ++i, a, "the reason in quotes");
    else if (a === "--actor") actor = valueOf(argv, ++i, a, "an admin user id");
    else if (a.startsWith("--")) throw new CliUsageError(`unknown option: ${a}`);
    else rest.push(a);
  }
  if (rest.length !== 1) throw new CliUsageError("pass the Solver's slug (or id)");
  return { ref: rest[0]!, resume, reason, actor };
}
