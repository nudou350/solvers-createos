// CreateOS Sandbox settings. Read lazily from process.env (same names as env.ts / .env.example) so the module works on
// its own (smoke script, tests that flip modes) and never fails at import time. The API key stays on the server.

export type SandboxMode = "createos" | "simulated";

export type SandboxConfig = {
  mode: SandboxMode;
  verifierMode: SandboxMode;
  apiKey: string | undefined;
  baseUrl: string;
  shape: string;
  rootfs: string;
};

export const DEFAULT_BASE_URL = "https://api-eu.sb.createos.sh";

/** Simulated by default (as in env.ts); `createos` only with an API key (env.ts refuses to boot otherwise). */
export function sandboxConfig(e: NodeJS.ProcessEnv = process.env): SandboxConfig {
  const apiKey = e.CREATEOS_SANDBOX_API_KEY?.trim() || undefined;
  const pick = (v: string | undefined): SandboxMode => (v === "createos" && apiKey ? "createos" : "simulated");
  return {
    mode: pick(e.SANDBOX_MODE),
    verifierMode: pick(e.VERIFIER_MODE),
    apiKey,
    baseUrl: e.CREATEOS_SANDBOX_BASE_URL?.trim() || DEFAULT_BASE_URL,
    // s-1vcpu-1gb is the largest shape on the Free plan.
    shape: e.SANDBOX_SHAPE?.trim() || "s-1vcpu-1gb",
    // Node, Python, Bun, Go, Rust. The catalog default is alpine, so it is explicit.
    rootfs: "devbox:1",
  };
}
