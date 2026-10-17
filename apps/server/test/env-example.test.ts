// apps/server/.env.example documents every variable validated by src/env.ts, and nothing else; plus env.ts's own rules.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

// env.ts validates process.env on import: provide the two required secrets first.
const SECRETS = { JWT_SECRET: "j".repeat(40), MEMORY_KEK: Buffer.alloc(32, 7).toString("base64") };
for (const [k, v] of Object.entries(SECRETS)) process.env[k] ??= v;
const { loadEnv } = await import("../src/env.js");

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("apps/server/.env.example", () => {
  const envKeys = [...read("../src/env.ts").matchAll(/^ {2}([A-Z][A-Z0-9_]+):/gm)].map((m) => m[1]!);
  const example = read("../.env.example");
  const exampleKeys = [...example.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]!);

  it("lists every variable of env.ts", () => {
    assert.ok(envKeys.length > 30, "env.ts keys were parsed");
    assert.deepEqual(envKeys.filter((k) => !exampleKeys.includes(k)), []);
  });

  it("lists nothing env.ts does not know", () => {
    assert.deepEqual(exampleKeys.filter((k) => !envKeys.includes(k)), []);
  });

  it("ships names only, no values", () => {
    for (const m of example.matchAll(/^([A-Z][A-Z0-9_]+)=(.*)$/gm)) assert.equal(m[2]!.trim(), "", `${m[1]} must be empty`);
  });

  it("parses as shipped once the required secrets are filled in (empty lines count as unset)", () => {
    const source: NodeJS.ProcessEnv = {};
    for (const m of example.matchAll(/^([A-Z][A-Z0-9_]+)=(.*)$/gm)) source[m[1]!] = m[2]!.trim();
    const e = loadEnv({ ...source, ...SECRETS });
    assert.equal(e.PORT, 3038);
    assert.equal(e.PUBLIC_WEB_URL, "http://localhost:3041");
    assert.equal(e.CREATEOS_SANDBOX_BASE_URL, "https://api-eu.sb.createos.sh");
    assert.equal(e.SANDBOX_MODE, "simulated");
    assert.equal(e.VERIFIER_MODE, "simulated");
    assert.equal(e.DEV_LOGIN, false);
  });
});

describe("env rules", () => {
  it("DATABASE_URL falls back to the Neon connection string of the root .env; an explicit one wins", () => {
    assert.equal(loadEnv({ ...SECRETS, NEON_POSTGRES_CONNECTION_STRING: "postgres://neon/db" }).DATABASE_URL, "postgres://neon/db");
    assert.equal(loadEnv({ ...SECRETS, NEON_POSTGRES_CONNECTION_STRING: "postgres://neon/db", DATABASE_URL: "postgres://local/db" }).DATABASE_URL, "postgres://local/db");
  });

  it("DEV_LOGIN accepts 1/true", () => {
    assert.equal(loadEnv({ ...SECRETS, DEV_LOGIN: "1" }).DEV_LOGIN, true);
    assert.equal(loadEnv({ ...SECRETS, DEV_LOGIN: "true" }).DEV_LOGIN, true);
  });

  it("refuses a MEMORY_KEK that is not 32 bytes and a short JWT_SECRET", () => {
    assert.throws(() => loadEnv({ ...SECRETS, MEMORY_KEK: Buffer.alloc(16).toString("base64") }), /MEMORY_KEK/);
    assert.throws(() => loadEnv({ ...SECRETS, JWT_SECRET: "short" }), /JWT_SECRET/);
  });

  it("real sandboxes need the CreateOS key", () => {
    assert.throws(() => loadEnv({ ...SECRETS, SANDBOX_MODE: "createos" }), /CREATEOS_SANDBOX_API_KEY/);
    assert.throws(() => loadEnv({ ...SECRETS, VERIFIER_MODE: "createos" }), /CREATEOS_SANDBOX_API_KEY/);
    assert.equal(loadEnv({ ...SECRETS, SANDBOX_MODE: "createos", CREATEOS_SANDBOX_API_KEY: "k" }).SANDBOX_MODE, "createos");
  });
});
