// Site admin = a user id listed in ADMIN_USER_IDS (comma separated), confirmed by login (PACKAGE_SPEC.md 14.4). It grants
// reviewing, finishing and suspending on the site. Pure (no env): tested in test/publish-rules.test.ts.

/** Admin user ids of a "a,b , c" list (empty entries ignored), lowercase (uuids). */
export function parseAdminUserIds(raw: string): Set<string> {
  return new Set(
    raw
      .split(",")
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminIn(userId: string | undefined, raw: string): boolean {
  return !!userId && parseAdminUserIds(raw).has(userId.trim().toLowerCase());
}
