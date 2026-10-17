"use client";
// "Switch account": ends the session and opens the sign-in page, returning to the current page.
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "@/lib/session";

export function SwitchAccount({ disabled, label }: { disabled?: boolean; label?: string }) {
  const t = useTranslations("common.switchAccount");
  const { signIn, signOut } = useSession();
  const [busy, setBusy] = useState(false);

  async function switchAccount() {
    setBusy(true);
    await signOut().catch(() => undefined);
    signIn();
  }

  return (
    <button type="button" className="link-btn" onClick={() => void switchAccount()} disabled={disabled || busy}>
      {label ?? t("label")}
    </button>
  );
}
