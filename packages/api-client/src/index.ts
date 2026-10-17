/**
 * Typed client of the Solvers API for the web app, scripts and agents. Every response is validated with the
 * `@solvers/shared` schemas, so a contract drift fails early.
 *
 * Identity is the user's email: `authEmail` sends a single-use sign-in link, opening it sets the httpOnly
 * `solvers_session` cookie (agents and SSR pass a bearer `token` instead). Payments are Stripe Checkout:
 * `createCheckout` returns the hosted page URL and the license is granted by the server's webhook.
 *
 * | Method | Path | Body / query | Response | Client method |
 * |---|---|---|---|---|
 * | POST | `/api/auth/email` | `AuthEmailInput` (`{ email }`) | `AuthEmailResponse` (`{ ok, devLink? }`) | `authEmail` |
 * | GET | `/api/auth/verify` | `?token=` (the link in the email; the browser opens it) | redirect + session cookie | |
 * | GET | `/api/auth/me` | | `SessionUser` (`{ userId, email }`), 401 without a session | `me` |
 * | POST | `/api/auth/logout` | | `{ ok }` | `logout` |
 * | GET | `/api/config` | | `PublicConfig` (currency, fee, min price, Stripe publishable key, devLogin) | `getConfig` |
 * | POST | `/api/checkout` | `CheckoutInput` (`{ agentSlug }`) | `CheckoutResponse` (`{ url }`); 409 `already_owned` | `createCheckout` |
 * | GET | `/api/purchases/:chargeId` | | `ChargeView` (status of the buyer's own charge) | `getCharge` |
 * | POST | `/api/agents/:idOrSlug/reviews` | `{ rating, text }` (needs a license) | `Review` | `submitReview` |
 */
import {
  AdminSubmissionDetail,
  AdminSubmissionRow,
  Agent,
  AgentAccess,
  type CatalogLang,
  AgentDetail,
  AuthEmailResponse,
  ChargeView,
  CheckoutResponse,
  ConnectorStatus,
  Creator,
  CreatorDashboard,
  CreatorMe,
  CreatorProfile,
  type CreatorProfileInput,
  type AdminReviewInput,
  type SubmissionStatus,
  SubmissionView,
  PublicationResult,
  License,
  Memory,
  MyTrial,
  Profile,
  PublicConfig,
  ImageRef,
  Review,
  SessionUser,
  TelegramLink,
  UsageSummary,
  UserReputation,
} from "@solvers/shared";
import { z, type ZodTypeAny } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public body: Record<string, unknown>,
  ) {
    super(message);
  }
}

export type ApiOptions = {
  /** API base. On the same domain as the web app, leave it empty ("") and use relative paths. */
  baseUrl?: string;
  /** Bearer token (SSR/tests/agents). In the browser the httpOnly session cookie is enough. */
  token?: string;
  fetch?: typeof fetch;
};

/** `?lang=` for catalog texts (en = manifest, pt = locales/pt.json); without it the server uses Accept-Language. */
const withLang = (path: string, lang?: CatalogLang): string => (lang ? `${path}${path.includes("?") ? "&" : "?"}lang=${lang}` : path);

const enc = encodeURIComponent;

export function createApi(opts: ApiOptions = {}) {
  const base = (opts.baseUrl ?? "").replace(/\/$/, "");
  const f = opts.fetch ?? fetch;

  async function req<S extends ZodTypeAny>(schema: S, path: string, init: RequestInit = {}): Promise<z.infer<S>> {
    const res = await f(`${base}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        "content-type": "application/json",
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new ApiError(res.status, String(body.code ?? "error"), String(body.error ?? res.statusText), body);
    return schema.parse(body);
  }
  const post = <S extends ZodTypeAny>(schema: S, path: string, body?: unknown) =>
    req(schema, path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

  const api = {
    // ----- Store (public) -----
    getConfig: () => req(PublicConfig, "/api/config"),
    getAgents: (q: { q?: string; category?: string; sort?: "rating" | "uses" | "trend" | "new"; limit?: number; lang?: CatalogLang } = {}) => {
      const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));
      return req(z.array(Agent), `/api/agents${p.size ? `?${p}` : ""}`);
    },
    getCategories: () => req(z.array(z.object({ category: z.string(), count: z.number() })), "/api/categories"),
    getAgent: (idOrSlug: string, lang?: CatalogLang) => req(AgentDetail, withLang(`/api/agents/${enc(idOrSlug)}`, lang)),
    getReviews: (idOrSlug: string) => req(z.array(Review), `/api/agents/${enc(idOrSlug)}/reviews`),
    search: (need: string, lang?: CatalogLang) => post(z.array(Agent), withLang("/api/search", lang), { need }),
    getCreator: (id: string, lang?: CatalogLang) => req(CreatorProfile, withLang(`/api/creators/${enc(id)}`, lang)),
    /** Creators with a Solver in the storefront: build a map by id for the cards (name and reputation). */
    getCreators: (lang?: CatalogLang) => req(z.array(Creator), withLang("/api/creators", lang)),
    // ----- Sign-in by email -----
    /** Sends a single-use sign-in link to `email` (with `DEV_LOGIN=1` the response carries it as `devLink`). */
    authEmail: (email: string) => post(AuthEmailResponse, "/api/auth/email", { email }),
    /** The signed-in user; `ApiError` 401 without a session. */
    me: () => req(SessionUser, "/api/auth/me"),
    logout: () => post(z.object({ ok: z.boolean() }), "/api/auth/logout"),

    // ----- My account -----
    getMyLicenses: () => req(z.array(License), "/api/me/licenses"),
    getMyUsage: () => req(z.array(UsageSummary), "/api/me/usage"),
    /** Free trials in progress (uses, searches and tool runs left). */
    getMyTrials: () => req(z.array(MyTrial), "/api/me/trials"),
    getMyAccess: (idOrSlug: string) => req(AgentAccess, `/api/me/access/${enc(idOrSlug)}`),
    getMemoriesCount: () =>
      req(z.object({ count: z.number(), agents: z.array(z.object({ agentId: z.string(), updatedAt: z.string() })) }), "/api/me/memories/count"),
    getReputation: () => req(UserReputation, "/api/me/reputation"),
    getProfile: (lang?: CatalogLang) => req(Profile, withLang("/api/me/profile", lang)),
    updateProfile: (data: { displayName?: string | null }) =>
      req(z.object({ ok: z.boolean() }), "/api/me/profile", { method: "PATCH", body: JSON.stringify(data) }),

    getMemories: () => req(z.array(Memory), "/api/me/memories"),
    deleteMemory: (id: string) => req(z.object({ ok: z.boolean() }), `/api/me/memories/${enc(id)}`, { method: "DELETE" }),
    deleteAllMemories: () => req(z.object({ ok: z.boolean() }), "/api/me/memories", { method: "DELETE" }),

    getConnector: () => req(ConnectorStatus, "/api/connector"),
    revokeConnector: () => post(z.object({ revoked: z.number() }), "/api/connector/revoke"),
    getCreatorDashboard: (lang?: CatalogLang) => req(CreatorDashboard, withLang("/api/creator/dashboard", lang)),

    // ----- Purchases (Stripe Checkout) -----
    /**
     * Starts the purchase of a lifetime license (needs a session): the server writes the ledger row and creates the
     * Checkout Session; redirect the browser to `url`. The license appears after the webhook (`/library?bought=`).
     * `ApiError` 409 `already_owned` (body carries `licenseId`) when the user already has it.
     */
    createCheckout: (agentSlug: string) => post(CheckoutResponse, "/api/checkout", { agentSlug }),
    /** Status of a purchase. */
    getCharge: (chargeId: string) => req(ChargeView, `/api/purchases/${enc(chargeId)}`),

    // ----- Reviews and help -----
    /** Reviews this Solver (needs a license; one review per user, sending again replaces it). */
    submitReview: (idOrSlug: string, rating: number, text: string) => post(Review, `/api/agents/${enc(idOrSlug)}/reviews`, { rating, text }),
    /** Attaches a photo to MY review of this Solver (up to 3; the review must exist). Returns the current photos. */
    uploadReviewImage: (idOrSlug: string, file: Blob) =>
      req(z.array(ImageRef), `/api/agents/${enc(idOrSlug)}/reviews/mine/images`, { method: "POST", headers: { "content-type": file.type }, body: file }),
    deleteReviewImage: (idOrSlug: string, imageId: string) =>
      req(z.array(ImageRef), `/api/agents/${enc(idOrSlug)}/reviews/mine/images/${enc(imageId)}`, { method: "DELETE" }),
    /** Asks this Solver's creator for help. Returns the ticket; the creator is notified and their contact stays hidden. */
    requestHelp: (idOrSlug: string, message: string, contact?: string) =>
      post(z.object({ protocol: z.string(), notified: z.boolean() }), `/api/agents/${enc(idOrSlug)}/help`, { message, contact: contact || undefined }),

    // ----- Admin -----
    /** Relists a Solver the admin had delisted. */
    adminApprove: (agentId: string) => post(z.object({ agentId: z.string(), listed: z.boolean() }), `/api/admin/agents/${enc(agentId)}/approve`),

    // ----- Creator: sign-up, package submission and tracking (docs/package-spec.md 14.4) -----
    getCreatorMe: () => req(CreatorMe, "/api/creator/me"),
    saveCreatorProfile: (input: CreatorProfileInput) => post(CreatorMe, "/api/creator/profile", input),
    /** Code to link the creator's Telegram (single use, 15 min, 5 per hour). 503 `telegram_unavailable` when the bot is down. */
    createTelegramLink: () => post(TelegramLink, "/api/creator/telegram-link"),
    /** The server returns the ARRAY of submissions (newest first). `slug` and `version` are "" until the worker opens the ZIP. */
    listMySubmissions: () => req(z.array(SubmissionView), "/api/creator/submissions"),
    getMySubmission: (id: string) => req(SubmissionView, `/api/creator/submissions/${enc(id)}`),
    /**
     * Uploads the package ZIP (raw application/zip body; 202 `{ id, status }`). Uses XMLHttpRequest to report upload
     * progress (`onProgress` gets 0..1). `resubmit` = id of the submission with requested changes (same version).
     * Errors become `ApiError` (413 too large, 429 limits, 400/409 validation and conflict).
     */
    uploadSubmission: (file: Blob, up: { resubmit?: string; onProgress?: (fraction: number) => void; signal?: AbortSignal } = {}) =>
      new Promise<{ id: string; status: SubmissionStatus }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const qs = up.resubmit ? `?resubmit=${enc(up.resubmit)}` : "";
        xhr.open("POST", `${base}/api/creator/submissions${qs}`);
        xhr.withCredentials = true;
        xhr.setRequestHeader("content-type", "application/zip");
        if (opts.token) xhr.setRequestHeader("authorization", `Bearer ${opts.token}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) up.onProgress?.(Math.min(1, e.loaded / e.total));
        };
        xhr.onerror = () => reject(new ApiError(0, "network", "The connection dropped during the upload.", {}));
        xhr.ontimeout = () => reject(new ApiError(0, "timeout", "The upload took too long.", {}));
        xhr.onabort = () => reject(new ApiError(0, "aborted", "Upload cancelled.", {}));
        xhr.onload = () => {
          let body: Record<string, unknown> = {};
          try {
            body = JSON.parse(xhr.responseText) as Record<string, unknown>;
          } catch {
            /* non-JSON response (e.g. an nginx 413) */
          }
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new ApiError(xhr.status, String(body.code ?? "error"), String(body.error ?? xhr.statusText), body));
            return;
          }
          const parsed = z.object({ id: z.string(), status: z.string() }).safeParse(body);
          if (!parsed.success) reject(new ApiError(xhr.status, "bad_response", "Unexpected server response.", body));
          else resolve({ id: parsed.data.id, status: parsed.data.status as SubmissionStatus });
        };
        if (up.signal) {
          if (up.signal.aborted) xhr.abort();
          else up.signal.addEventListener("abort", () => xhr.abort(), { once: true });
        }
        xhr.send(file);
      }),

    // ----- Review queue (admin users only; CreatorMe.isAdmin says whether to show it) -----
    /** The server returns the ARRAY (oldest first when `pending_review`). */
    adminListSubmissions: (status?: SubmissionStatus) =>
      req(z.array(AdminSubmissionRow), `/api/admin/submissions${status ? `?${new URLSearchParams({ status })}` : ""}`),
    adminGetSubmission: (id: string) => req(AdminSubmissionDetail, `/api/admin/submissions/${enc(id)}`),
    /** Content of a package file as TEXT (never render it as HTML). */
    adminGetSubmissionFile: (id: string, path: string) =>
      req(z.object({ path: z.string(), content: z.string() }), `/api/admin/submissions/${enc(id)}/file?${new URLSearchParams({ path })}`),
    /** Test search over the package's staging ingestion. */
    adminSearchSubmissionKnowledge: (id: string, q: string) =>
      req(
        z.object({ query: z.string(), hits: z.array(z.object({ source: z.string(), content: z.string(), score: z.number() })) }),
        `/api/admin/submissions/${enc(id)}/knowledge-search?${new URLSearchParams({ q })}`,
      ),
    /** Approving freezes hash, price and version and starts the publication: answers `{ id, status, approved }`. */
    adminApproveSubmission: (id: string, input: AdminReviewInput) =>
      post(
        z.object({ id: z.string(), status: z.string(), approved: z.object({ versionHash: z.string(), priceCents: z.number().int(), name: z.string(), version: z.string() }) }),
        `/api/admin/submissions/${enc(id)}/approve`,
        input,
      ),
    adminRequestChanges: (id: string, input: AdminReviewInput) => post(z.object({ id: z.string(), status: z.string() }), `/api/admin/submissions/${enc(id)}/request-changes`, input),
    adminRejectSubmission: (id: string, input: AdminReviewInput) => post(z.object({ id: z.string(), status: z.string() }), `/api/admin/submissions/${enc(id)}/reject`, input),
    /** Revokes an approval whose publication failed (back to `changes_requested`; note required). */
    adminRevokeSubmission: (id: string, input: AdminReviewInput) => post(z.object({ id: z.string(), status: z.string() }), `/api/admin/submissions/${enc(id)}/revoke`, input),
    /** Retries the publication of an approved submission (e.g. after `publish_failed`); idempotent. */
    adminFinishSubmission: (id: string) => post(PublicationResult, `/api/admin/submissions/${enc(id)}/finish`),
  };
  return api;
}

export type SolversApi = ReturnType<typeof createApi>;
export * from "@solvers/shared";
