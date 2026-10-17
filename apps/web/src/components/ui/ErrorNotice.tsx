"use client";
// Error notice (already translated by lib/error-text), with the action that makes sense: sign in again or try again.
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Toast";
import type { ErrorInfo } from "@/lib/error-text";
import { useSession } from "@/lib/session";

export function ErrorNotice({ error, onRetry, extraActions }: { error: ErrorInfo; onRetry?: () => void; extraActions?: ReactNode }) {
  const { signIn } = useSession();
  const t = useTranslations("common.errorNotice");
  const actions =
    error.action === "login" ? (
      <Button size="sm" onClick={() => signIn()}>
        {t("signIn")}
      </Button>
    ) : error.action === "retry" && onRetry ? (
      <Button size="sm" icon="refresh" onClick={onRetry}>
        {t("retry")}
      </Button>
    ) : null;
  return (
    <Notice
      tone="bad"
      role="alert"
      title={error.title}
      actions={
        actions || extraActions ? (
          <>
            {actions}
            {extraActions}
          </>
        ) : undefined
      }
    >
      {error.text}
    </Notice>
  );
}
