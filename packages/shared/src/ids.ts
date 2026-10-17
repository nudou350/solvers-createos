// Package ids (docs/package-spec.md 4.1): the manifest `id` is 16 random bytes as 32 lowercase hex characters.

const AGENT_ID_RE = /^[0-9a-f]{32}$/;

export function isAgentId(value: unknown): value is string {
  return typeof value === "string" && AGENT_ID_RE.test(value);
}
