---
title: Accessible design tokens: contrast, focus ring, motion and status
source: W3C WCAG 2.2 (Understanding 1.4.3, 1.4.11, 2.4.7, 2.2.2, 4.1.3) and measurements from a real component project (React 19, CSS Modules, five accent palettes, light and dark theme)
source_url: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
source_date: 2026-10-08
valid_until: 2027-01-31
tags: [contrast, tokens, focus-ring, motion, reduced-motion, live-region, wcag, css]
trial: true
---

# Accessible design tokens: contrast, focus ring, motion and status

A component can pass every `getByRole` test and a static check and still fail people, because those tools never see the computed colors, the focus ring, the animation or the layout. This guide is the part of accessibility that lives in CSS. The rule behind all of it: **the brand color is not a text color, a focus color or a border color.** Give each job its own token, per theme and per palette.

## 1. One token per job

```css
:root {
  --accent: #6366f1;        /* brand: fills, gradients, decoration */
  --accent-text: #4338ca;   /* accent used AS TEXT (kicker, link): measure it on the page background */
  --on-accent: #ffffff;     /* text on an accent fill: only if the FILL is darkened enough (see section 2); white on a bright brand color usually misses 4.5:1 */
  --text: #1c1b2e;
  --muted: #524f69;         /* secondary text: still 4.5:1 on every surface it sits on */
  --focus: #1d4ed8;         /* focus ring: its own color, 3:1 against the page AND against the control */
  --field-border: #837f9c;  /* form control border: 3:1 against the surface */
}
:root[data-theme="dark"] {
  --accent-text: #a5b4fc;
  --muted: #b4b1c9;
  --focus: #93c5fd;
  --field-border: #8f8cab;
}
```

Why separate tokens:

| Job | Minimum | WCAG | What goes wrong when it reuses `--accent` |
|---|---|---|---|
| Text, normal size | 4.5:1 | 1.4.3 | A small label in the accent color was 4.30:1 in light and 4.46:1 in dark |
| Text, large (24 px, or 18.66 px bold) | 3:1 | 1.4.3 | Gradient headings in emerald and amber fell below 3:1 |
| Focus ring, input border, icon that is the only indicator | 3:1 against adjacent colors | 1.4.11, 2.4.7 | An accent ring in amber, emerald or sky on white is below 3:1 |
| Placeholder | 4.5:1 | 1.4.3 | `opacity: .7` pushes a passing gray under 4.5:1; set the color, not the opacity |

Derived tokens (a shadow built from the accent, for example) must be defined on the element that carries the palette (`[data-accent="amber"]`), not on `:root`. A `var()` in `:root` resolves at `:root`, so the derived value stays stuck on the default palette.

## 2. Never put text on a gradient without measuring

When the palette can change, the worst case is the light palette (amber, emerald, sky). Measured on white text over an accent gradient in one project: 4.09:1 on indigo, 3.03 on sky, 3.57 on pink, 2.50 on emerald and 2.25 on amber, against a 4.5:1 minimum.

Fixes that worked:
- Darken the fill the text sits on: `background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 65%, #000), …)`. Use pure white text, not white at 85% opacity (4.28:1 on a purple-to-pink gradient).
- For large gradient text (`background-clip: text`), darken the gradient stops until the lightest stop still reaches 3:1 on the background (72% of the accent was enough in the project above).
- Check the weakest point of the gradient, not its middle. Contrast on a gradient is the contrast against the **worst pixel behind each line of text**.

## 3. Check the pair in code, not by eye

Contrast is arithmetic, so it fits in a test. The template `estilos-acessiveis` ships `contrastRatio(foreground, background)` and a Vitest file that asserts every token pair for each theme. Add one `expect` per pair you declare. This covers solid colors; it does not replace measuring text on gradients, images or blurred backgrounds (see the measured-verification guide).

## 4. Focus ring

```css
:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 2px;
}
```
- Use the dedicated `--focus` token, set per theme (and `--modal-focus` if the dialog surface differs).
- A skip link needs the same ring as the other controls. The browser default ring is thin and dark, nearly invisible on a dark page.
- The ring must be at least 2 px and keep 3:1 against both the control and the page around it.
- Fixed headers can hide the focused element (2.4.11): add `scroll-padding-top` equal to the header height.

## 5. Motion: reduced-motion is not enough

`@media (prefers-reduced-motion: reduce)` covers people who already set the preference. WCAG 2.2.2 (level A) separately requires that anything that **moves, blinks or scrolls automatically for more than 5 seconds** can be paused, stopped or hidden. Background gradients, glows and floating cards that loop forever need a **visible control**.

```tsx
const [paused, setPaused] = useState(false);
useEffect(() => {
  document.documentElement.dataset.motion = paused ? "off" : "on";
}, [paused]);

<button type="button" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
  Pause animations
</button>
```
```css
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
:root[data-motion="off"] *, :root[data-motion="off"] *::before, :root[data-motion="off"] *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
```
- Keep the label constant and let `aria-pressed` carry the state ("Pause animations" pressed), instead of swapping the text.
- JavaScript that animates (counters, confetti, `requestAnimationFrame`) must read the same preference: check `matchMedia("(prefers-reduced-motion: reduce)").matches` **and** `document.documentElement.dataset.motion === "off"`.
- Count infinite animations before and after pressing the button; the "after" number must be zero.
- Short transitions triggered by the user (a 150 ms hover) are fine; the problem is loops and long auto-play.

## 6. Dynamic status needs a live region that already exists

"Copied!", "Saved", "3 results" and error messages that only change a button's text are not announced (WCAG 4.1.3). Keep a live region in the DOM from the first render and only change its content:

```tsx
<div role="status" className="sr-only">{copied ? "Copied to clipboard" : ""}</div>
```
- `role="status"` (polite) for success and progress; `role="alert"` for errors that need immediate attention.
- A live region created together with its text is often not announced. Render it empty first.
- Visually hidden text (`sr-only`) is 1 px by design: filter it out when measuring text size or contrast.

## 7. Target size and spacing

- Interactive targets are at least 24×24 CSS px (2.5.8). Prefer 44×44 for touch.
- A form field border at about 1.6:1 (the common light gray) fails 1.4.11. Use a dedicated `--field-border` token at 3:1 or more.
- Text spacing (1.4.12): the layout must survive `line-height: 1.5`, `letter-spacing: .12em`, `word-spacing: .16em` and paragraph spacing of 2× with no clipped or overlapping text. Avoid fixed heights on text containers.
- Reflow (1.4.10): no horizontal scroll at 320 CSS px width.
