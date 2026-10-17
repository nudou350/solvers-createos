"use client";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useErrorText } from "@/lib/error-text";
import { initials } from "@/lib/format";
import { useSession } from "@/lib/session";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { ThemeToggle } from "./ThemeToggle";

// `key` points to common.json -> nav.<key> (label) and nav.<key>Short (short label of the bottom bar).
type NavItem = { href: string; key: "explore" | "library" | "creators"; icon: IconName };

export const NAV: NavItem[] = [
  { href: "/", key: "explore", icon: "home" },
  { href: "/library", key: "library", icon: "library" },
  { href: "/creator", key: "creators", icon: "pen" },
];

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/solvers") || pathname.startsWith("/creators");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Logo() {
  const t = useTranslations("common.header");
  return (
    <Link className="logo" href="/" aria-label={t("logoLabel")}>
      <span className="logo-mark">
        <Icon name="diamond" size="s" />
      </span>
      <span>Solvers</span>
    </Link>
  );
}

/** Name shown for the signed-in person: the display name, else the part of the email before the @. */
export function displayNameOf(me: { displayName: string | null; email: string }): string {
  return me.displayName ?? me.email.split("@")[0] ?? me.email;
}

function Account() {
  const { status, me, signIn, signOut } = useSession();
  const toast = useToast();
  const t = useTranslations("common.header");
  const errorText = useErrorText();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Closes on navigation, outside click and Esc.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status === "loading") return <span className="me-pill" aria-hidden style={{ width: 44, padding: 4 }} />;
  // The sign-in page itself has no "Sign in" button in the header.
  if (!me) return pathname === "/login" ? null : <Button variant="primary" onClick={() => signIn()}>{t("signIn")}</Button>;
  const name = displayNameOf(me);
  const first = name.split(" ")[0] ?? name;

  const doSignOut = async () => {
    setBusy(true);
    try {
      await signOut();
      setOpen(false);
    } catch (e) {
      toast({ tone: "bad", title: t("signOutFailed"), text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="acct" ref={box}>
      <button type="button" className="me-pill" aria-expanded={open} aria-controls="account-menu" onClick={() => setOpen(!open)} aria-label={t("myAccount", { name })}>
        <span className="av av-s">{initials(name)}</span>
        <span className="me-name">{first}</span>
      </button>
      {open ? (
        <div className="acct-menu card" id="account-menu">
          <div className="acct-who">
            <b className="trunc" style={{ display: "block" }}>
              {me.displayName ?? t("yourAccount")}
            </b>
            <span className="tiny faint trunc">{me.email}</span>
          </div>
          <div className="only-m">
            <div className="acct-extras">
              <ThemeToggle />
            </div>
          </div>
          <Link href="/profile">
            <Icon name="user" size="s" />
            {t("myProfile")}
          </Link>
          <Link href="/library">
            <Icon name="library" size="s" />
            {t("myLibrary")}
          </Link>
          <button type="button" disabled={busy} onClick={() => void doSignOut()}>
            <Icon name="arrow-right" size="s" />
            {t("signOut")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Header() {
  const pathname = usePathname() ?? "/";
  const t = useTranslations("common");
  return (
    <header className="nav">
      <div className="wrap">
        <Logo />
        <nav className="nav-links" aria-label={t("header.mainNav")}>
          {NAV.map((n) => {
            const on = isActive(pathname, n.href);
            return (
              <Link key={n.href} href={n.href} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>
                {t(`nav.${n.key}`)}
              </Link>
            );
          })}
        </nav>
        <div className="nav-actions">
          {/* On phones the header only fits the language switch and the account button: the theme toggle moves into the
              account menu (`only-m` block there). */}
          <LocaleSwitcher />
          <span className="hide-m">
            <ThemeToggle />
          </span>
          <Account />
        </div>
      </div>
    </header>
  );
}

/** Bottom navigation bar (mobile only, by the design's CSS). */
export function TabBar() {
  const pathname = usePathname() ?? "/";
  const t = useTranslations("common");
  return (
    <nav className="tabbar" aria-label={t("header.tabbar")}>
      {NAV.map((n) => {
        const on = isActive(pathname, n.href);
        return (
          <Link key={n.href} href={n.href} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>
            <Icon name={n.icon} size="l" />
            <span>{t(`nav.${n.key}Short`)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
