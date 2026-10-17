**Short answer: as described, no.** Two 16 x 16 px buttons with no gap fail WCAG 2.2 criterion 2.5.8 Target Size (Minimum, level AA).

## Why it fails

The minimum target is 24 x 24 CSS px. Smaller targets are allowed only through exceptions, and the one that could apply to you is **Spacing**: a 24 px circle centered on each small target must not touch another target or another small target's circle.

For two 16 px buttons, the circle centers are 16 px + gap apart. The circles need at least 24 px between centers, so:

| Gap between buttons | Center distance | Result |
|---|---|---|
| 0 px ("right next to each other") | 16 px | Fails |
| 4 px | 20 px | Fails |
| 8 px or more | 24 px or more | Passes via the spacing exception |

The other exceptions (equivalent control elsewhere on the page, inline in a sentence, browser-controlled, essential) rarely fit a row of icon buttons.

## The fix: enlarge the hit area, not the icon

Keep the 16 px drawing and give the button its own size. This also removes the gap problem, because each target is already 24 px or larger:

```css
.icon-btn {
  display: inline-grid;
  place-items: center;
  min-width: 24px;   /* WCAG 2.5.8 floor */
  min-height: 24px;
  padding: 4px;      /* 16px icon + 2*4px = 24px */
}
/* Touch screens: aim for 44px (my recommendation, beyond the AA minimum) */
@media (pointer: coarse) {
  .icon-btn { min-width: 44px; min-height: 44px; padding: 14px; }
}
.icon-btn svg { width: 16px; height: 16px; }
```

Two things to remember with icon-only buttons: each one needs an accessible name (`aria-label="Delete"`, with `aria-hidden="true"` on the SVG) and `type="button"` if it lives inside a form. Also, the focus ring must be at least 2 px and visible at that size (`:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }`); adjacent 24 px buttons need a little `gap` so the rings do not overlap.

## What I can and cannot verify

- `a11y_check` (static) can confirm that every icon button has a name, but it **does not see sizes or spacing**.
- `run_tests` (jsdom) does not compute layout, so a test cannot prove 24 px either.
- The real check is in a browser: `button.getBoundingClientRect()` for each button, or axe-core with the `target-size` rule enabled, in every state and at your smallest breakpoint.

## To go further, tell me

1. Which styling approach do you use (Tailwind, CSS Modules, styled-components)? I will give you the fix in that syntax.
2. Is this a toolbar or a table row of actions? If it is a toolbar, a roving tabindex (one Tab stop, arrow keys between buttons) also reduces the visual density problem.
3. Can you paste the component? I will review it, run `a11y_check` on the complete files and send back the corrected version.
