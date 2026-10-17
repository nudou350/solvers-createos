Before I write any code, one thing you should know: **I will not be able to promise "accessible" for this look from tests alone.** White text on a gradient and switchable accent colors are exactly where automated checks go blind, so I plan for it from the start and tell you precisely what was and was not verified.

First I check your project setup: `get_memory` (if nothing is saved I will ask you the setup questions once and store the answers).

## What I already know will matter

- **White on a purple-to-pink gradient is risky.** In a comparable project, white text on accent gradients measured between 2.25:1 and 4.28:1 against the 4.5:1 minimum (WCAG 1.4.3). With 5 switchable accents, the **lightest accent decides**, not the default one.
- **The accent is not a text, focus or border color.** I will plan separate tokens per job, per palette and per theme: `--accent` (fills and decoration only), `--accent-text`, `--focus` (ring at least 3:1 and 2 px), `--field-border` (3:1) and `--on-accent`.
- **Fix for the hero:** darken the fill behind the text (for example `color-mix(in srgb, var(--accent) 65%, #000)`), use pure white (not 85% opacity), and measure against the **worst point** of the gradient.
- **Palette switcher:** a group of 5 buttons with `aria-pressed` (not color alone: each has a text/accessible name such as "Indigo"), and derived tokens defined on the element that carries `data-accent`, not on `:root`.
- If the background moves, it needs a visible **Pause animations** button, not only `prefers-reduced-motion` (WCAG 2.2.2).

## Questions (answer what you can; "your way" is fine)

1. React 18 or 19, TypeScript, and which framework (Next.js, Vite)?
2. How do you style: Tailwind, CSS Modules, styled-components or plain CSS?
3. Light only, or light and dark theme?
4. Which 5 accent colors? If you do not have them, I will propose a set that I assert in code.
5. Is the background animated, or is the gradient static?
6. What must work for you to consider it done? My proposal:
   - Every text/background token pair reaches its minimum, asserted by a `contrastRatio` test for each palette.
   - Choosing an accent updates the page and exposes `aria-pressed` on the chosen one.
   - Focus ring visible on every control, including the skip link.

## Plan and scope

If you have a trial, the agreement is one component per use. I will build the **hero** (headline, call to action, accent picker, pause control) and its tests, and list what the rest of the page would need.

| Layer | What it will prove |
|---|---|
| `run_tests` | Names, `aria-pressed`, focus order, palette switching, pause button |
| `a11y_check` (all files, CSS included) | Labels, names, outline removal |
| Computed in tests | Contrast of every solid token pair, per palette and theme |
| **Needs your browser** | Real contrast of text over the gradient (per-pixel), axe-core in each palette/theme, keyboard pass, 320 px reflow |

Once you confirm, I move on to the props, states and the test list for your approval.
