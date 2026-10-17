// Connector texts shared by the MCP tools. Pure: no env nor database, tested in test/agent-tools.test.ts.

/**
 * Honest label of the performance score (PACKAGE_SPEC.md §12.2): no score (0 bps) = "no ratings yet"; an existing score
 * = internal team test. "Verified" would only apply to an evalMethod "verified", which does not exist yet.
 */
export function evalLabel(evalScoreBps: number): string {
  if (!Number.isFinite(evalScoreBps) || evalScoreBps <= 0) return "performance: no ratings yet";
  return `internal team test (automated checks): ${(evalScoreBps / 100).toFixed(0)}%`;
}
