import { HttpError } from "../lib/http.js";

// Availability of a specialist (PACKAGE_SPEC.md 15.4). `platformStatus` is the platform suspension (kill switch) set by
// admins: it only SELLS and SERVES while it is "active".

export type AgentAvailabilityFields = { platformStatus: string };

export const PLATFORM_ACTIVE = "active";
export const PLATFORM_SUSPENDED = "suspended";

export function agentIsAvailable(a: AgentAvailabilityFields): boolean {
  return a.platformStatus === PLATFORM_ACTIVE;
}

export const UNAVAILABLE_TEXT = "This specialist is temporarily unavailable.";

/** Who can be served (pure decision): everyone with access while active; a suspended specialist cuts everything off. */
export type ServePolicy = "all" | "closed";
export type AccessKind = "license" | "platform" | "trial" | "none";

export function servePolicy(a: AgentAvailabilityFields): ServePolicy {
  return agentIsAvailable(a) ? "all" : "closed";
}

/** The free trial only exists for a live solver (not suspended). */
export const trialAllowed = (a: AgentAvailabilityFields): boolean => servePolicy(a) === "all";

export function agentCanServe(a: AgentAvailabilityFields, _access: AccessKind): boolean {
  return servePolicy(a) === "all";
}

export function assertAgentCanServe(a: AgentAvailabilityFields, access: AccessKind): void {
  if (agentCanServe(a, access)) return;
  throw new HttpError(403, UNAVAILABLE_TEXT, "agent_unavailable");
}

export function assertAgentAvailable(a: AgentAvailabilityFields): void {
  if (!agentIsAvailable(a)) throw new HttpError(403, UNAVAILABLE_TEXT, "agent_unavailable");
}
