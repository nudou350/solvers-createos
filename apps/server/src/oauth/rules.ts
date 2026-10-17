// Pure OAuth rules (no env/database), tested in test/oauth.test.ts.

export type RefreshTokenRow = { clientId: string; revoked: boolean; expiresAt: Date };

/**
 * Can the refresh token be rotated? Everything is validated BEFORE revoking: an invalid request (wrong client_id, expired
 * token) never consumes the legitimate client's token. null = may rotate.
 */
export function refreshRejection(tok: RefreshTokenRow | undefined, clientId: string | undefined, now: Date): string | null {
  if (!tok || tok.revoked || tok.expiresAt < now) return "Invalid or expired refresh token";
  if (clientId && clientId !== tok.clientId) return "Refresh token belongs to another client";
  return null;
}

/** Does the request's `Origin` header name the web app's origin? A missing or malformed one does not. */
export function sameOrigin(origin: string | undefined, webUrl: string): boolean {
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(webUrl).origin;
  } catch {
    return false;
  }
}
