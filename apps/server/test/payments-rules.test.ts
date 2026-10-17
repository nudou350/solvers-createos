import "./helpers/fake-env.js";
import test from "node:test";
import assert from "node:assert/strict";

import { PAID_FULFILS, canTransition, sourcesOf } from "../src/payments/lifecycle.js";
import { CHARGE_STATUSES } from "../src/payments/types.js";
import type { LedgerRow } from "../src/payments/ledger.js";

// export.ts loads env.ts through the db module (no connection is opened): placeholders for what fake-env may not set yet.
process.env.MEMORY_KEK ??= Buffer.alloc(32, 7).toString("base64");
const { LEDGER_CSV_COLUMNS, csvField, ledgerCsv, parseRange } = await import("../src/payments/export.js");

test("lifecycle: the happy path and the exits", () => {
  for (const [a, b] of [
    ["created", "pending_payment"],
    ["pending_payment", "confirmed"],
    ["confirmed", "fulfilled"],
    ["pending_payment", "expired"],
    ["pending_payment", "failed"],
    ["expired", "confirmed"],
    ["refunding", "refunded"],
  ] as const) {
    assert.ok(canTransition(a, b), `${a} -> ${b}`);
  }
  for (const [a, b] of [
    ["fulfilled", "refunding"],
    ["refunded", "fulfilled"],
    ["pending_payment", "fulfilling"],
    ["failed", "confirmed"],
  ] as const) {
    assert.ok(!canTransition(a, b), `${a} -/-> ${b}`);
  }
  assert.deepEqual(sourcesOf("refunded"), ["refunding"]);
  // A proven payment fulfils every open or abandoned charge, never one refunded or already fulfilled.
  for (const s of CHARGE_STATUSES) if (s !== "fulfilled" && s !== "refunded" && s !== "refunding") assert.ok(PAID_FULFILS.includes(s), s);
  assert.ok(!PAID_FULFILS.includes("refunded"));
  assert.ok(!PAID_FULFILS.includes("fulfilled"));
});

test("ledger csv: integer cents, quoting and formula neutralisation", () => {
  assert.equal(csvField(null), "");
  assert.equal(csvField(1900), "1900");
  assert.equal(csvField(-5), "-5");
  assert.equal(csvField('a,"b"'), '"a,""b"""');
  assert.equal(csvField("=HYPERLINK()"), "'=HYPERLINK()");
  const at = new Date("2026-10-17T12:00:00.000Z");
  const row = {
    id: "9b2f7c1a-5d3e-4b8a-9c6f-1e2d3c4b5a69",
    provider: "stripe",
    providerRef: "cs_test_1",
    status: "fulfilled",
    kind: "license",
    agentId: "0123456789abcdef0123456789abcdef",
    buyerUserId: "6f1c2b9e-1c39-4f57-9a43-0d6b8f2b7c11",
    currency: "usd",
    amountCents: 1900,
    providerPayload: { checkoutUrl: "https://checkout.stripe.com/x", feeCents: 190, creatorCents: 1710, feeBps: 1000 },
    error: null,
    createdAt: at,
    confirmedAt: at,
    fulfilledAt: at,
    updatedAt: at,
  } as unknown as LedgerRow;
  const [header, line, end] = ledgerCsv([row]).split("\r\n");
  assert.equal(header, LEDGER_CSV_COLUMNS.join(","));
  assert.equal(
    line,
    "9b2f7c1a-5d3e-4b8a-9c6f-1e2d3c4b5a69,stripe,cs_test_1,fulfilled,license,0123456789abcdef0123456789abcdef,6f1c2b9e-1c39-4f57-9a43-0d6b8f2b7c11,usd,1900,190,1710,,2026-10-17T12:00:00.000Z,2026-10-17T12:00:00.000Z,2026-10-17T12:00:00.000Z,2026-10-17T12:00:00.000Z",
  );
  assert.equal(end, "");
});

test("ledger export range: UTC days, inclusive end", () => {
  const r = parseRange(["--from", "2026-10-01", "--to", "2026-10-31"]);
  assert.equal(r.from.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(r.to.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.throws(() => parseRange(["--from", "2026-10-05", "--to", "2026-10-01"]));
  assert.throws(() => parseRange(["--from", "10/01/2026"]));
});
