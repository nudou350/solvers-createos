// Where to go after signing in. Only a path of this site is accepted (no scheme, no `//host`), so a crafted
// `?next=` cannot send the person to another site. Pure, unit-tested.

export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/library";
  return next;
}
