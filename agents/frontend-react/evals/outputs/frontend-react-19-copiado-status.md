**Cause:** changing a button's text is not announced. Focus stays on the button and screen readers do not re-read a name change. The "Copied!" message (WCAG 4.1.3 Status Messages) must go through a **live region that already exists in the DOM** when the text changes.

## Fix

```tsx
// CopyButton.tsx
import { useRef, useState } from "react";

export type CopyButtonProps = {
  text: string;
  label?: string;
  doneMessage?: string;
  errorMessage?: string;
};

export function CopyButton({
  text,
  label = "Copy code",
  doneMessage = "Copied to clipboard",
  errorMessage = "Could not copy. Select the text and copy it manually.",
}: CopyButtonProps) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(doneMessage);
    } catch {
      setMessage(errorMessage);
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 2000);
  }

  return (
    <>
      {/* The name stays constant; the announcement lives in the region. */}
      <button type="button" onClick={copy}>{label}</button>
      {/* Rendered empty on the first render; only its content changes. */}
      <div role="status" className="sr-only">{message}</div>
    </>
  );
}
```

```css
.sr-only {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
  overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0;
}
```

Key points:
- `role="status"` (polite) for success. A region created **together with** its text is often not announced, so it must be in the DOM empty from the first render.
- Keep the button label constant. If sighted users also need to see "Copied!", show the same message visibly next to the button (drop `sr-only` and style it) so there is one source of truth.
- The clipboard can reject (permissions, non-HTTPS), so the failure is announced too, instead of silent.

## Tests

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

  it("announces a failure when the clipboard rejects", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    render(<CopyButton text="npm i" />);
    await user.click(screen.getByRole("button", { name: "Copy code" }));
    expect(await screen.findByText(/could not copy/i)).toBe(screen.getByRole("status"));
  });
});
```

I would verify with `run_tool` → `run_tests` (`CopyButton.tsx` + `CopyButton.test.tsx`) and `a11y_check` on the same complete files, and report the numbers only after they return.

**What I cannot prove here:** jsdom has no screen reader, so the tests prove the region exists and receives the text, not what NVDA, VoiceOver or JAWS actually speak. Please try it once with a screen reader, ideally VoiceOver and NVDA.

Are you on React 18 or 19, and is the copy button inside a modal? (If it is, I would check the region is inside the dialog so it stays announced.)
