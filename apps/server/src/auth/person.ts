// Person identity: one user per mailbox. `users.email` stores the canonical form, so aliases of the same mailbox
// (Gmail dots, "+tag") sign in to the same user and share one free trial. Pure (no env/database), tested in
// test/person.test.ts.

const GMAIL = new Set(["gmail.com", "googlemail.com"]);

/**
 * Canonical e-mail, or null when it does not look like an e-mail. Drops the "+tag" of the local part on any domain and,
 * on Gmail, also the dots (a.b@gmail.com and ab+x@googlemail.com are the same mailbox).
 */
export function normalizeEmail(raw: string): string | null {
  const s = raw.normalize("NFKC").trim().toLowerCase();
  const at = s.lastIndexOf("@");
  if (at < 1 || at === s.length - 1) return null;
  const domain = s.slice(at + 1).replace(/\.$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) return null;
  const host = GMAIL.has(domain) ? "gmail.com" : domain;
  let local = s.slice(0, at);
  if (/[\s@]/.test(local)) return null;
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  if (host === "gmail.com") local = local.replaceAll(".", "");
  if (!local) return null;
  return `${local}@${host}`;
}
