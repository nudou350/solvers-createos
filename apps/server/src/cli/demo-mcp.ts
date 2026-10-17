// End-to-end demo of the CreateOS Builder Solver over real MCP. Plays the model's role against a running API: signs in
// the way a connector does (OAuth 2.1 + PKCE, magic link), activates the Solver and follows next_step through the 5
// steps. The code runs in the session's CreateOS sandbox: the step 3 gate blocks on a failing test and passes after the
// fix (with a checkpoint and a restore in between), the app starts in the background and its preview URL answers 200.
// Prints a readable transcript and destroys the sandbox at the end (unless --keep).
//
//   pnpm --filter @solvers/server cli:demo-mcp -- --api http://localhost:3048 [--email buyer@solvers.dev] [--keep]
//
// The API needs DEV_LOGIN=1 (the magic link is returned by the API), or pass an MCP access token in SOLVERS_MCP_TOKEN.
// The user must own a CreateOS Builder license. The script uses the API's database (same env files) only to start from
// step 1 (it closes the user's unfinished CreateOS Builder session) and to destroy the session's sandboxes.

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { env } from "../env.js";
import { db, pool, schema } from "../db/index.js";
import { expireSession } from "../runtime/engine.js";
import { createosPort } from "../sandbox/client.js";
import { dbSandboxStore } from "../sandbox/store.js";

const USAGE = "Usage: cli:demo-mcp -- [--api <url>] [--email <address>] [--keep]";

function parseArgs(argv: string[]) {
  const out = { api: env.PUBLIC_API_URL, email: "buyer@solvers.dev", keep: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") continue;
    if (a === "--keep") out.keep = true;
    else if (a === "--api" && argv[i + 1]) out.api = argv[++i]!;
    else if (a === "--email" && argv[i + 1]) out.email = argv[++i]!;
    else throw new Error(`Unknown argument: ${a}\n${USAGE}`);
  }
  out.api = out.api.replace(/\/$/, "");
  return out;
}

// ---- transcript ----

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string) => (s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = paint("1");
const dim = paint("2");
const red = paint("31");
const green = paint("32");
const yellow = paint("33");
const cyan = paint("36");

const say = (s = "") => console.log(s);
const note = (s: string) => say(`  ${dim(s)}`);
const ok = (s: string) => say(`  ${green("✓")} ${s}`);
const bad = (s: string) => say(`  ${red("✗")} ${s}`);
const model = (s: string) => say(`\n${yellow("Model:")} ${s}`);
const banner = (s: string) => say(`\n${bold(cyan(`━━ ${s} ${"━".repeat(Math.max(3, 76 - s.length))}`))}`);
const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** Prints up to `max` lines (the last ones), skipping blanks and stack frames. */
function block(text: string, max = 12, keep: (l: string) => boolean = () => true) {
  const lines = text.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim() && !/^\s+at /.test(l) && keep(l));
  if (lines.length > max) say(`  ${dim(`│ … ${lines.length - max} more lines`)}`);
  for (const l of lines.slice(-max)) say(`  ${dim("│")} ${l}`);
}

/** Lines that tell the story of a node:test run (spec or TAP reporter): results, counts and the assertion diff. */
const testLine = (l: string) => /[✔✖]|^ℹ (tests|pass|fail) |^(not )?ok \d+ - |^# (tests|pass|fail) |SyntaxError|Expected values|^\s*[+-] {2,}\S|^> /.test(l);

// ---- sign-in (what Claude/ChatGPT do when the user adds the connector) ----

async function jsonOf(res: Response, what: string): Promise<Record<string, unknown>> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`${what} failed (${res.status}): ${String(body.error_description ?? body.error ?? body.message ?? "")}`);
  return body;
}

async function signIn(api: string, email: string): Promise<string> {
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${api}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const redirectUri = "http://127.0.0.1:8976/callback";
  const resource = `${api}/mcp`;
  const client = await jsonOf(await post("/oauth/register", { redirect_uris: [redirectUri], client_name: "Solvers MCP demo" }), "client registration");
  const clientId = String(client.client_id);
  const verifier = randomBytes(32).toString("base64url");
  const authorize = new URL(`${api}/oauth/authorize`);
  for (const [k, v] of Object.entries({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    state: randomBytes(8).toString("hex"),
    resource,
  })) authorize.searchParams.set(k, v);
  const consent = await fetch(authorize, { redirect: "manual" });
  const req = consent.headers.get("location") ? new URL(consent.headers.get("location")!).searchParams.get("req") : null;
  if (!req) throw new Error(`authorize did not redirect to the consent page (${consent.status})`);

  // Magic link: with DEV_LOGIN=1 the API returns it instead of e-mailing it.
  const login = await jsonOf(await post("/api/auth/email", { email }), "magic link");
  if (typeof login.devLink !== "string") throw new Error("The API did not return the magic link: run it with DEV_LOGIN=1 or set SOLVERS_MCP_TOKEN.");
  const verify = await fetch(`${api}/api/auth/verify?token=${encodeURIComponent(new URL(login.devLink).searchParams.get("token") ?? "")}`, { redirect: "manual" });
  const cookie = verify.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  if (!cookie) throw new Error(`magic link was refused (${verify.status})`);

  // Consent, as the web app's /connect page sends it (same origin as PUBLIC_WEB_URL, signed-in cookie).
  const done = await jsonOf(await post("/oauth/authorize/complete", { req }, { origin: new URL(env.PUBLIC_WEB_URL).origin, cookie }), "consent");
  const code = new URL(String(done.redirectTo)).searchParams.get("code");
  if (!code) throw new Error("consent did not return a code");
  const tok = await jsonOf(
    await fetch(`${api}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, code_verifier: verifier, client_id: clientId, redirect_uri: redirectUri, resource }),
    }),
    "token exchange",
  );
  return String(tok.access_token);
}

// ---- database side: a clean start and the final cleanup ----

async function userIdOf(email: string): Promise<string> {
  const [u] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email.trim().toLowerCase()));
  if (!u) throw new Error(`No user ${email} in this database.`);
  return u.id;
}

/** Destroys every sandbox of the session (session box, fork checkpoints) and marks the rows destroyed. */
async function destroySessionSandboxes(userId: string, sessionId: string): Promise<string[]> {
  const store = dbSandboxStore();
  const gone: string[] = [];
  for (const status of ["active", "checkpoint", "snapshot"] as const) {
    for (const row of await store.list(userId, sessionId, status)) {
      // Snapshots live inside the session box; `sim-` boxes belong to a simulated API (nothing to destroy remotely).
      if (row.createosId && status !== "snapshot" && !row.createosId.startsWith("sim-")) {
        await createosPort().destroy(row.createosId);
        gone.push(row.createosId);
      }
      await store.update(row.id, { status: "destroyed" });
    }
  }
  return gone;
}

/** Closes the user's unfinished sessions of this Solver, so the demo starts at step 1. */
async function closeOpenSessions(userId: string, agentId: string, steps: number): Promise<string[]> {
  const t = schema.sessions;
  const open = await db
    .select({ id: t.id })
    .from(t)
    .where(and(eq(t.userId, userId), eq(t.agentId, agentId), gt(t.expiresAt, new Date()), lte(t.stepIndex, steps)));
  for (const s of open) {
    await destroySessionSandboxes(userId, s.id);
    await expireSession(s.id);
  }
  return open.map((s) => s.id);
}

// ---- the app the "model" builds ----

const PACKAGE_JSON = `${JSON.stringify(
  {
    name: "app",
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: { start: "node src/server.js", test: "node --test test/*.test.js", "test:webhook": "node --test test/webhook.test.js" },
    dependencies: { express: "^5.3.0", stripe: "^23.0.0" },
  },
  null,
  2,
)}\n`;

const app = (health: string, webhook = false) => `import express from "express";

// Builds the app without listening, so tests start it on a random port.${webhook ? "\n// The webhook comes BEFORE express.json(): Stripe signs the raw body." : ""}
export function createApp(${webhook ? "{ stripe, webhookSecret } = {}" : ""}) {
  const app = express();${
    webhook
      ? `
  app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], webhookSecret);
    } catch (err) {
      return res.status(400).json({ error: \`Webhook signature check failed: \${err.message}\` });
    }
    res.json({ received: true, type: event.type });
  });`
      : ""
  }
  app.use(express.json());
  app.get("/health", (_req, res) => ${health});
  return app;
}
`;

const SERVER_JS = `import Stripe from "stripe";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder");
createApp({ stripe, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET }).listen(port, "0.0.0.0", () => console.log(\`listening on 0.0.0.0:\${port}\`));
`;

const HEALTH_TEST = `import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { createApp } from "../src/app.js";

test("GET /health answers 200 { ok: true }", async (t) => {
  const server = createApp().listen(0);
  t.after(() => server.close());
  await once(server, "listening");
  const res = await fetch(\`http://127.0.0.1:\${server.address().port}/health\`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});
`;

const WEBHOOK_TEST = `import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import Stripe from "stripe";
import { createApp } from "../src/app.js";

// Signatures are made and checked locally: no call to api.stripe.com (blocked in the sandbox anyway).
const stripe = new Stripe("sk_test_placeholder");
const secret = "whsec_test_demo";
const payload = JSON.stringify({ id: "evt_test_1", object: "event", type: "checkout.session.completed", data: { object: { id: "cs_test_1", payment_status: "paid" } } });

async function deliver(t, headers) {
  const server = createApp({ stripe, webhookSecret: secret }).listen(0);
  t.after(() => server.close());
  await once(server, "listening");
  return fetch(\`http://127.0.0.1:\${server.address().port}/webhook\`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: payload });
}

test("valid Stripe signature -> 200", async (t) => {
  const res = await deliver(t, { "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret }) });
  assert.equal(res.status, 200);
});

test("signature made with another secret -> 400", async (t) => {
  const res = await deliver(t, { "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_wrong" }) });
  assert.equal(res.status, 400);
});

test("missing stripe-signature header -> 400", async (t) => {
  const res = await deliver(t, {});
  assert.equal(res.status, 400);
});
`;

const files = (entries: Record<string, string>) => Object.entries(entries).map(([path, content]) => ({ path: `/workspace/app/${path}`, content }));

// ---- MCP ----

type RunOut = { stdout: string; stderr: string; exit_code: number; exec_ms: number; truncated: boolean; process_id?: string; log_path?: string };

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  say(bold("Solvers × CreateOS: the CreateOS Builder Solver over MCP"));
  note(`API ${opts.api} · user ${opts.email}`);

  banner("Connect");
  let token = process.env.SOLVERS_MCP_TOKEN?.trim();
  if (token) ok("using the MCP access token from SOLVERS_MCP_TOKEN");
  else {
    token = await signIn(opts.api, opts.email);
    ok(`signed in as ${opts.email} (OAuth 2.1 + PKCE, magic link): MCP access token issued`);
  }
  const client = new Client({ name: "solvers-demo", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${opts.api}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
  const { tools } = await client.listTools();
  const toolNames = tools.map((t) => t.name);
  ok(`MCP connected (Streamable HTTP): ${tools.length} tools, including ${toolNames.filter((n) => n.startsWith("sandbox_")).join(", ")}`);

  const userId = await userIdOf(opts.email);
  let sessionId = "";

  /** One tool call, shown as the model would make it. Returns the text, or throws on a tool error unless `allowError`. */
  async function call(name: string, args: Record<string, unknown>, shown: string, allowError = false): Promise<{ text: string; isError: boolean }> {
    say(`\n${cyan("→")} ${bold(name)} ${dim(shown)}`);
    const t0 = Date.now();
    const r = (await client.callTool({ name, arguments: args }, undefined, { timeout: 900_000 })) as { content: { type: string; text?: string }[]; isError?: boolean };
    const text = r.content.map((c) => c.text ?? "").join("\n");
    if (r.isError && !allowError) {
      bad(`tool error after ${secs(Date.now() - t0)}`);
      block(text, 20);
      throw new Error(`${name} failed`);
    }
    note(`answered in ${secs(Date.now() - t0)}`);
    return { text, isError: !!r.isError };
  }

  async function run(command: string, args: string[], extra: { files?: { path: string; content: string }[]; background?: boolean; timeout_ms?: number } = {}): Promise<RunOut> {
    const shown = `${command} ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}${extra.files ? `  (+ ${extra.files.length} file${extra.files.length === 1 ? "" : "s"}: ${extra.files.map((f) => f.path.replace("/workspace/app/", "")).join(", ")})` : ""}${extra.background ? "  [background]" : ""}`;
    const { text } = await call("sandbox_run", { session_id: sessionId, command, args, ...extra }, shown);
    const out = JSON.parse(text) as RunOut;
    if (out.process_id) ok(`started: process ${out.process_id}, log ${out.log_path}`);
    else (out.exit_code === 0 ? ok : bad)(`exit ${out.exit_code} · ${secs(out.exec_ms)} in the sandbox`);
    return out;
  }

  /** next_step: prints the step title, its gate and the server's proof (never the step instructions themselves). */
  async function nextStep(completed: number, summary?: string): Promise<{ text: string; blocked: boolean }> {
    const { text } = await call("next_step", { session_id: sessionId, completed_step: completed, ...(summary ? { result_summary: summary } : {}) }, `completed_step=${completed}`);
    const blocked = /gate checks failed in the sandbox/.test(text);
    if (blocked) {
      bad(text.split("\n")[0]!);
      const fail = text.split("\n").find((l) => l.startsWith("## FAIL"));
      if (fail) say(`  ${red(fail.slice(3))}`);
      const stderr = /stderr:\n```\n([\s\S]*?)\n```/.exec(text)?.[1];
      const stdout = /stdout:\n```\n([\s\S]*?)\n```/.exec(text)?.[1];
      if (stdout) block(stdout, 10, testLine);
      if (stderr) {
        note("stderr:");
        block(stderr, 6);
      }
      return { text, blocked };
    }
    for (const l of text.split("\n")) {
      if (/^## Step \d+ gate proven/.test(l)) say(`  ${green(l.slice(3))}`);
      else if (/^- \[x\]/.test(l)) say(`    ${green("✓")} ${l.slice(6)}`);
      else if (/^# (Step \d+ of \d+|Wrap-up)/.test(l)) say(`\n  ${bold(l.slice(2))}`);
      else if (/^- \[ \]/.test(l)) say(`    ${dim("☐")} ${l.slice(6)}`);
    }
    return { text, blocked };
  }

  let keepNote = "";
  try {
    banner("Activate the Solver");
    const mine = await call("list_my_solvers", {}, "");
    const line = mine.text.split("\n").find((l) => l.includes("CreateOS Builder"));
    const agentId = /agent_id: ([^)]+)\)/.exec(line ?? "")?.[1];
    if (!agentId) throw new Error(`${opts.email} does not own CreateOS Builder:\n${mine.text}`);
    ok(line!.replace(/^- /, "").replace(/\(agent_id: [^)]+\): /, "").trim());
    const closed = await closeOpenSessions(userId, agentId, 5);
    if (closed.length) note(`(closed ${closed.length} unfinished demo session(s) so this run starts at step 1)`);

    const act = await call("activate_solver", { agent_id: agentId }, `agent_id=${agentId}`);
    sessionId = /session_id: (\S+)/.exec(act.text)?.[1] ?? "";
    if (!sessionId) throw new Error(`activate_solver gave no session_id:\n${act.text}`);
    ok(`session ${sessionId}`);
    note(act.text.split("\n")[1] ?? "");
    for (const l of act.text.split("\n").filter((l) => /^\d+\. /.test(l))) note(`  ${l}`);
    const pre = await call("preflight_check", { session_id: sessionId, available_tools: toolNames }, `${toolNames.length} tools`);
    for (const l of pre.text.split("\n").filter((l) => l.startsWith("- ")).slice(0, 4)) note(l);

    // ---- Step 1 ----
    banner("Step 1 · Spec and stack");
    await nextStep(0);
    model('Idea: "a tiny API with a health check and a Stripe webhook". Spec: GET /health, POST /webhook (signature-verified). Node 24 + Express 5, port 3000.');
    const spec = await call("get_template", { session_id: sessionId, name: "app-spec" }, "name=app-spec");
    ok(`template app-spec (${spec.text.split("\n").length} lines)`);
    model("Proving the sandbox is up (the first call creates this session's CreateOS sandbox).");
    const v = await run("bash", ["-lc", "node -v && python3 --version"]);
    block(v.stdout);
    // A simulated API (SANDBOX_MODE=simulated) executes nothing: every command exits 0, so no gate can block.
    const simulated = v.stdout.includes("[simulated]");
    if (simulated) note("(simulated sandbox: commands are not executed, exit codes are always 0)");
    await nextStep(1, `idea: tiny API with health check and Stripe webhook\nspec_confirmed: yes\nruntime: node 24 + express 5; port: 3000\nendpoints: GET /health, POST /webhook\npayment: none in v1 (webhook only)\nservices: none\nsandbox: ${v.stdout.trim().replace(/\n/g, ", ")}\nnot_now: checkout`);

    // ---- Step 2 ----
    banner("Step 2 · Scaffold in the sandbox");
    model("Writing the project and installing it in one call. (It has a bug: /health answers { status: \"up\" }.)");
    const inst = await run("bash", ["-lc", "cd /workspace/app && npm install --no-audit --no-fund"], {
      files: files({ "package.json": PACKAGE_JSON, "src/app.js": app('res.json({ status: "up" })'), "src/server.js": SERVER_JS, "test/health.test.js": HEALTH_TEST }),
      timeout_ms: 240_000,
    });
    block(inst.stdout, 2);
    await nextStep(2, `project: /workspace/app\nfiles: package.json, src/app.js, src/server.js, test/health.test.js\ndependencies: express@^5.3.0, stripe@^23.0.0\ninstall: exit ${inst.exit_code}, ${inst.exec_ms} ms\nscripts: start=node src/server.js; test=node --test test/*.test.js; test:webhook=node --test test/webhook.test.js`);

    // ---- Step 3 ----
    banner("Step 3 · Code and tests: the gate blocks, then passes");
    const t1 = await run("bash", ["-lc", "cd /workspace/app && npm test"]);
    block(t1.stdout, 10, testLine);
    model("Calling next_step anyway: the server runs the gate itself.");
    const gate = await nextStep(3, "tests: 1 total");
    if (!gate.blocked && !simulated) throw new Error("Expected the step 3 gate to block on the failing test.");
    model("The test expects { ok: true } but /health answers { status: \"up\" }. Checkpoint before changing code.");
    const cp = JSON.parse((await call("sandbox_checkpoint", { session_id: sessionId }, "")).text) as { checkpoint_id: string; method: string };
    ok(`checkpoint ${cp.checkpoint_id} (${cp.method})`);
    model("Attempt 1 (a typo slips in):");
    const t2 = await run("bash", ["-lc", "cd /workspace/app && npm test"], { files: files({ "src/app.js": app("res.json(ok: true)") }) });
    block(`${t2.stdout}\n${t2.stderr}`, 4, (l) => /SyntaxError|^ℹ (pass|fail) |^# (pass|fail) /.test(l));
    model("Worse: the app no longer loads. Restoring the checkpoint.");
    const rs = JSON.parse((await call("sandbox_restore", { session_id: sessionId, checkpoint_id: cp.checkpoint_id }, `checkpoint_id=${cp.checkpoint_id}`)).text) as { method: string };
    ok(`restored (${rs.method})`);
    const back = await run("bash", ["-lc", "cd /workspace/app && grep -n health src/app.js"]);
    block(back.stdout, 2);
    model("Attempt 2: the real fix.");
    const t3 = await run("bash", ["-lc", "cd /workspace/app && npm test"], { files: files({ "src/app.js": app("res.json({ ok: true })") }) });
    block(t3.stdout, 6, testLine);
    if (t3.exit_code !== 0) throw new Error("The fix did not make the tests pass.");
    if (!gate.blocked) {
      note("(the gate already passed: skipping to step 4)");
    } else await nextStep(3, `behaviors: GET /health -> "GET /health answers 200 { ok: true }"\ntests: 1 total, 1 pass, 0 fail (npm test, ${t3.exec_ms} ms)\nfix_loop: 2 iterations; checkpoints: 1; restores: 1 (typo broke the module)\nfiles_changed: src/app.js\nopen_questions: none`);

    // ---- Step 4 ----
    banner("Step 4 · Stripe webhook with a verified signature");
    model("Adding POST /webhook (raw body, constructEvent) and its tests, signed locally.");
    const wh = await run("bash", ["-lc", "cd /workspace/app && npm run test:webhook && npm test"], {
      files: files({ "src/app.js": app("res.json({ ok: true })", true), "test/webhook.test.js": WEBHOOK_TEST }),
    });
    block(wh.stdout, 12, testLine);
    if (wh.exit_code !== 0) throw new Error("Webhook tests failed.");
    await nextStep(4, "checkout: not in v1\nwebhook: raw body before json=yes; constructEvent=yes; events=any; dedupe=not in v1\ntests: test:webhook 3 pass; npm test 4 pass, 0 fail\nregressions_caught: valid signature -> moving express.json() above /webhook makes it 400\nnot_verified: real webhook delivery");

    // ---- Step 5 ----
    banner("Step 5 · Live preview");
    const bg = await run("bash", ["-lc", "cd /workspace/app && npm start"], { background: true });
    const h = await run("bash", ["-lc", "sleep 2 && curl -fsS localhost:3000/health"]);
    block(h.stdout || h.stderr, 3);
    if (h.exit_code !== 0 && bg.log_path) block((await run("bash", ["-lc", `tail -n 30 ${bg.log_path}`])).stdout, 30);
    const pv = JSON.parse((await call("sandbox_preview", { session_id: sessionId, port: 3000 }, "port=3000")).text) as { url: string };
    ok(`preview URL: ${bold(pv.url)}`);
    const healthUrl = `${pv.url.replace(/\/$/, "")}/health`;
    say(`\n${cyan("→")} ${bold("GET")} ${healthUrl} ${dim("(from this machine, over the internet)")}`);
    let res: { status: number; body: string } | null = null;
    for (let i = 0; i < (simulated ? 0 : 6); i++) {
      try {
        const r = await fetch(healthUrl, { signal: AbortSignal.timeout(15_000) });
        res = { status: r.status, body: (await r.text()).slice(0, 200) };
        if (r.ok) break;
      } catch (e) {
        res = { status: 0, body: (e as Error).message };
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    if (res) (res.status === 200 ? ok : bad)(`${res.status} ${res.body}`);
    else note("(simulated sandbox: the preview URL is not reachable)");
    const done = await nextStep(5, `server: 0.0.0.0:3000, health exit ${h.exit_code} -> ${h.stdout.trim()}\npreview_url: ${pv.url} (temporary)\ndelivered_files: 5\ndeploy: dashboard; framework=Node.js; port=3000; build=npm install; run=npm start\nenv: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET\nproven: health -> 0`);
    if (done.blocked || !/Wrap-up/.test(done.text)) throw new Error("Step 5 did not complete.");
    if (res?.status !== 200 && !simulated) throw new Error("The preview URL did not answer 200.");
    banner("Done");
    ok("5/5 steps, each gate proven by execution in the CreateOS sandbox");
    keepNote = `The preview stays up while the sandbox runs (it pauses after 5 idle minutes): ${pv.url}`;
  } finally {
    await client.close().catch(() => undefined);
    if (sessionId && opts.keep) note(keepNote || "Sandbox kept (--keep).");
    else if (sessionId) {
      const gone = await destroySessionSandboxes(userId, sessionId);
      note(gone.length ? `Sandbox destroyed: ${gone.join(", ")}` : "Sandbox rows closed (simulated mode: nothing to destroy).");
    }
  }
}

try {
  await main();
} catch (e) {
  console.error(`\n${red("Demo failed:")} ${(e as Error)?.message ?? String(e)}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
process.exit(process.exitCode ?? 0);
