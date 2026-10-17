"use client";
import { useTranslations } from "next-intl";
import { useId, useState, type CSSProperties } from "react";
import { gap } from "@/lib/style";
import { Icon } from "./Icon";

export type TechRow = { label: string; value: string; mono?: boolean };

/** "Want to check the technical details?": opens a list of identifiers (account id, package id...). */
export function TechCard({ text, rows, style }: { text: string; rows: TechRow[]; style?: CSSProperties }) {
  const t = useTranslations("common.ui");
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="card pad col" style={gap(6, { alignItems: "flex-start", ...style })}>
      <div className="row wrapx" style={gap(12)}>
        <span className="brand">
          <Icon name="shield-check" size="l" />
        </span>
        <div>
          <b>{t("techTitle")}</b>
          <div className="small muted">{text}</div>
        </div>
      </div>
      <button type="button" className="link-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        {open ? t("techHide") : t("techShow")}
      </button>
      {open ? (
        <dl className="tech" id={id} style={{ width: "100%" }}>
          {rows.map((r) => (
            <div key={r.label} style={{ display: "contents" }}>
              <dt>{r.label}</dt>
              <dd className={r.mono ? "mono" : undefined}>{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
