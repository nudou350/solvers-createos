# Accessible styles and visual checks template

Use it when the delivery has CSS, themes, gradients, animation or status messages. It ships five pieces: the token CSS, a contrast helper, a test that asserts every token pair, a pause-animations control and a copy button with a live region. All four code files were run together in the verifier environment (3 test files, 15 tests passing). Imports are relative and use only dependencies available in the verifier. Adapt colors and names, keep the patterns.

What this does not cover: contrast over gradients, images or blurred backgrounds, real focus-ring visibility and layout. Those need a browser (axe-core and a per-pixel measurement); say so in the delivery summary.

## `styles.css`

```css
/* Tokens: one per job. Measure every pair (see tokens.contrast.test.ts). */
:root {
  color-scheme: light dark;
  --page: #ffffff;
  --surface: #f6f5fb;
  --text: #1c1b2e;
  --muted: #524f69;
  --accent: #6366f1;       /* decoration and fills only */
  --accent-text: #4338ca;  /* accent used as text */
  --focus: #1d4ed8;
  --field-border: #837f9c;
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-6: 24px; --space-8: 32px;
  --radius-control: 8px; --radius-surface: 14px;
  --ease-out: cubic-bezier(.2, .8, .2, 1);
}
:root[data-theme="dark"] {
  --page: #0f0e1a; --surface: #1a1930; --text: #ecebf7; --muted: #b4b1c9;
  --accent-text: #a5b4fc; --focus: #93c5fd; --field-border: #8f8cab;
}

/* Fill that carries white text: darken the brand color instead of hoping. */
.btn-primary {
  color: #fff;
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--accent) 65%, #000),
    color-mix(in srgb, var(--accent) 50%, #000));
  min-height: 44px; padding: var(--space-2) var(--space-6); border-radius: var(--radius-control);
}

:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
input, select, textarea { border: 1px solid var(--field-border); }
::placeholder { color: var(--muted); opacity: 1; }
html { scroll-padding-top: 5rem; } /* fixed header height: focus is not obscured */

.sr-only {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
  overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0;
}

/* Motion: the media query is not enough, a visible control is required for loops (WCAG 2.2.2). */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
:root[data-motion="off"] *, :root[data-motion="off"] *::before, :root[data-motion="off"] *::after {
  animation: none !important; transition: none !important; scroll-behavior: auto !important;
}
```

## `contrast.ts`

```ts
/** WCAG 2.x relative luminance and contrast ratio for solid #rgb / #rrggbb colors. */
function channel(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function parseHex(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`Not a solid hex color: ${hex}`);
  const raw = match[1]!;
  const full = raw.length === 3 ? [...raw].map((c) => c + c).join("") : raw;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
```

## `tokens.contrast.test.ts`

Add one row per color pair you declare in the CSS, for each theme.

```ts
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

// One row per pair you declare in the CSS. min: 4.5 text, 3 large text and UI parts.
const light = { page: "#ffffff", surface: "#f6f5fb" };
const dark = { page: "#0f0e1a", surface: "#1a1930" };

const pairs = [
  { theme: "light", name: "text on page", fg: "#1c1b2e", bg: light.page, min: 4.5 },
  { theme: "light", name: "muted on surface", fg: "#524f69", bg: light.surface, min: 4.5 },
  { theme: "light", name: "accent text on page", fg: "#4338ca", bg: light.page, min: 4.5 },
  { theme: "light", name: "focus ring on page", fg: "#1d4ed8", bg: light.page, min: 3 },
  { theme: "light", name: "field border on page", fg: "#837f9c", bg: light.page, min: 3 },
  { theme: "dark", name: "muted on surface", fg: "#b4b1c9", bg: dark.surface, min: 4.5 },
  { theme: "dark", name: "accent text on page", fg: "#a5b4fc", bg: dark.page, min: 4.5 },
  { theme: "dark", name: "focus ring on page", fg: "#93c5fd", bg: dark.page, min: 3 },
  { theme: "dark", name: "field border on page", fg: "#8f8cab", bg: dark.page, min: 3 },
] as const;

describe("design token contrast", () => {
  it.each(pairs)("$theme: $name reaches $min:1", ({ fg, bg, min }) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("flags the classic failure: white on a bright brand color", () => {
    expect(contrastRatio("#ffffff", "#6366f1")).toBeLessThan(4.5);
  });
});
```

## `MotionToggle.tsx`

```tsx
import { useEffect, useState } from "react";

/** Reads the same preference the CSS reads, so JS-driven animation also stops. */
export function motionAllowed(): boolean {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  return !reduced && document.documentElement.dataset.motion !== "off";
}

export function MotionToggle({ label = "Pause animations" }: { label?: string }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.motion = paused ? "off" : "on";
  }, [paused]);

  // The label stays constant; aria-pressed carries the state.
  return (
    <button type="button" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
      {label}
    </button>
  );
}
```

## `MotionToggle.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { MotionToggle, motionAllowed } from "./MotionToggle";

afterEach(() => {
  delete document.documentElement.dataset.motion;
});

describe("MotionToggle", () => {
  it("starts unpressed with motion on", () => {
    render(<MotionToggle />);
    expect(screen.getByRole("button", { name: "Pause animations" })).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement.dataset.motion).toBe("on");
  });

  it("pauses and resumes, keeping the same accessible name", async () => {
    const user = userEvent.setup();
    render(<MotionToggle />);
    const button = screen.getByRole("button", { name: "Pause animations" });

    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.motion).toBe("off");
    expect(motionAllowed()).toBe(false);

    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement.dataset.motion).toBe("on");
    expect(motionAllowed()).toBe(true);
  });
});
```

## `CopyButton.tsx`

```tsx
import { useRef, useState } from "react";

export type CopyButtonProps = {
  text: string;
  label?: string;
  doneMessage?: string;
};

export function CopyButton({ text, label = "Copy code", doneMessage = "Copied to clipboard" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button type="button" onClick={copy}>
        {label}
      </button>
      {/* The live region exists from the first render; only its content changes. */}
      <div role="status" className="sr-only">
        {copied ? doneMessage : ""}
      </div>
    </>
  );
}
```

## `CopyButton.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CopyButton } from "./CopyButton";

describe("CopyButton", () => {
  it("has an empty status region before copying", () => {
    render(<CopyButton text="npm i" />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("announces the result in the status region and keeps the button name", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<CopyButton text="npm i" />);

    await user.click(screen.getByRole("button", { name: "Copy code" }));

    expect(writeText).toHaveBeenCalledWith("npm i");
    expect(await screen.findByText("Copied to clipboard")).toBe(screen.getByRole("status"));
    expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument();
  });
});
```
