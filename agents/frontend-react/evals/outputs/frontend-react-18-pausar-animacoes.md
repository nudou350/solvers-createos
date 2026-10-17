**Not yet.** `prefers-reduced-motion` is necessary, but it is not enough.

## Why

That media query only helps people who already turned on "reduce motion" in their OS. WCAG 2.2.2 (Pause, Stop, Hide, level A) is a separate rule: anything that moves automatically for **more than 5 seconds** needs a **visible control** to pause, stop or hide it. An infinite hero animation is exactly that case. Everyone else, including people with attention or vestibular difficulties who never touched that setting, has no way to stop it.

## Fix: a visible pause control that the CSS and JS both obey

```tsx
// MotionToggle.tsx
import { useEffect, useState } from "react";

/** Reads the same preferences the CSS reads, so JS-driven animation also stops. */
export function motionAllowed(): boolean {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  return !reduced && document.documentElement.dataset.motion !== "off";
}

export function MotionToggle({ label = "Pause animations" }: { label?: string }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.motion = paused ? "off" : "on";
  }, [paused]);

  // Constant label; aria-pressed carries the state.
  return (
    <button type="button" aria-pressed={paused} onClick={() => setPaused((v) => !v)}>
      {label}
    </button>
  );
}
```

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
:root[data-motion="off"] *, :root[data-motion="off"] *::before, :root[data-motion="off"] *::after {
  animation: none !important; transition: none !important; scroll-behavior: auto !important;
}
```

Notes:
- Keep the label constant ("Pause animations") and let `aria-pressed` say whether it is on. Do not swap the text.
- Place the button early in the tab order (near the top of the page) and use the same `:focus-visible` ring as your other controls.
- If part of your animation is JavaScript (`requestAnimationFrame`, canvas, a counter), call `motionAllowed()` before each frame/start so it stops too.

## Tests I would add

```tsx
it("starts unpressed with motion on", () => {
  render(<MotionToggle />);
  expect(screen.getByRole("button", { name: "Pause animations" })).toHaveAttribute("aria-pressed", "false");
});
it("pauses and resumes, keeping the same accessible name", async () => {
  const user = userEvent.setup();
  render(<MotionToggle />);
  const b = screen.getByRole("button", { name: "Pause animations" });
  await user.click(b);
  expect(b).toHaveAttribute("aria-pressed", "true");
  expect(document.documentElement.dataset.motion).toBe("off");
  expect(motionAllowed()).toBe(false);
});
```

I would then run `run_tool` with `tool: "run_tests"` and `files: [MotionToggle.tsx, MotionToggle.test.tsx]`, and `a11y_check` on the same component and your complete CSS. I will only tell you the result after those calls return.

## What tests cannot prove

jsdom does not run CSS animations. To confirm the fix, in a real browser count the running infinite animations (`document.getAnimations().filter(a => a.effect.getComputedTiming().iterations === Infinity)`) **before** and **after** pressing the button; the second number must be 0.

Is the hero animation CSS-only, or is there JS or canvas involved? And which styling approach (Tailwind, CSS Modules) do you use, so I adapt the selector?
