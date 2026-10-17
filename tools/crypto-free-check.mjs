#!/usr/bin/env node
// Fails when a crypto/blockchain term shows up in the source tree (the product is crypto-free: email identity, Stripe
// payments). Scans apps/, packages/, agents/ and docs/ (or the paths given as arguments) and prints `file:line: text`
// for every hit. Exceptions go in tools/crypto-free-allowlist.txt, one `path-regex:line-regex` per line (`#` starts a
// comment); a hit is skipped when its file path (forward slashes, relative to the repo root) matches the first regex
// and the line matches the second. No dependencies.
//
//   node tools/crypto-free-check.mjs            # whole tree
//   node tools/crypto-free-check.mjs agents     # one folder

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative, resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DIRS = ["apps", "packages", "agents", "docs"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo", ".git", "coverage", "build", "out"]);
const BINARY_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg", ".pdf", ".zip", ".woff", ".woff2", ".ttf", ".otf", ".mp4", ".mov", ".lock", ".tsbuildinfo", ".map"]);
const MAX_BYTES = 2 * 1024 * 1024;

const PATTERN =
  /viem|siwe|privy|wallet|blockchain|on-?chain|\bnft\b|erc-?721|token_?id|tx_?hash|usdc|stablecoin|solana|\bpix\b|escrow|indexer|faucet|\btempo\b/i;

function loadAllowlist() {
  const file = join(ROOT, "tools", "crypto-free-allowlist.txt");
  if (!existsSync(file)) return [];
  const rules = [];
  readFileSync(file, "utf8")
    .split(/\r?\n/)
    .forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith("#")) return;
      // Split at the first ":" that is not escaped; paths never contain ":" (relative, forward slashes).
      const at = line.search(/(?<!\\):/);
      if (at < 0) throw new Error(`crypto-free-allowlist.txt:${i + 1}: expected "path-regex:line-regex"`);
      rules.push({ path: new RegExp(line.slice(0, at)), text: new RegExp(line.slice(at + 1).replace(/\\:/g, ":"), "i") });
    });
  return rules;
}

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) yield* walk(full);
    } else if (e.isFile() && !BINARY_EXT.has(extname(e.name).toLowerCase())) {
      yield full;
    }
  }
}

const targets = (process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_DIRS).map((p) => resolve(ROOT, p));
const allow = loadAllowlist();
let hits = 0;

for (const target of targets) {
  if (!existsSync(target)) continue;
  const files = statSync(target).isDirectory() ? walk(target) : [target];
  for (const file of files) {
    if (statSync(file).size > MAX_BYTES) continue;
    const text = readFileSync(file, "utf8");
    if (text.includes("\u0000") || !PATTERN.test(text)) continue;
    const rel = relative(ROOT, file).split("\\").join("/");
    text.split(/\r?\n/).forEach((line, i) => {
      if (!PATTERN.test(line)) return;
      if (allow.some((r) => r.path.test(rel) && r.text.test(line))) return;
      hits++;
      const shown = line.trim();
      console.log(`${rel}:${i + 1}: ${shown.length > 200 ? `${shown.slice(0, 200)}…` : shown}`);
    });
  }
}

if (hits > 0) {
  console.error(`\n${hits} crypto reference(s) found. Remove them or, for a legitimate use, add a rule to tools/crypto-free-allowlist.txt.`);
  process.exit(1);
}
console.error("crypto-free check passed.");
