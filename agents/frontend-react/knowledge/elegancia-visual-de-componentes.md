---
title: Visual polish for components: restraint, rhythm and states
source: Practical design guidance for UI components (type scale, spacing scale, color roles, elevation, motion), checked against WCAG 2.2 constraints
source_url: https://www.w3.org/WAI/WCAG22/Understanding/
source_date: 2026-10-08
valid_until: 2027-01-31
tags: [design, polish, spacing, typography, color, motion, states, css]
---

# Visual polish for components

Elegant UI is mostly restraint: few colors, few sizes, consistent spacing and every state designed. Accessibility is not a cost on top; most of the rules below are why accessible interfaces look calm. The tokens that keep contrast right are in the design tokens guide; this one is about how the component feels.

## 1. Scales instead of numbers

Pick a scale once and use only its steps.

- **Spacing:** 4 px base: 4, 8, 12, 16, 24, 32, 48. Padding inside a control uses the small steps; gaps between groups use the large ones. Related things sit closer than unrelated things.
- **Type:** two families at most (or one). A scale such as 12/14/16/20/24/32, body at 16 px or more, line-height 1.5 for paragraphs and 1.2 to 1.3 for headings. Limit a line to about 65 characters (`max-width: 65ch`).
- **Radius:** one value for controls (6 to 10 px), one for surfaces (12 to 16 px). Nested radii: the inner radius equals the outer radius minus the padding.
- **Weight:** 400 for body, 500 or 600 for emphasis. Bold everywhere is noise.

## 2. Color with roles

- Neutrals do the work: background, surface, border, text, muted text. One accent for the primary action and for focus-related feedback. Semantic colors (success, warning, danger) only for status, and never alone: add an icon or text.
- Build surfaces by lightness steps (a raised card is slightly lighter in dark mode, slightly darker or shadowed in light mode).
- Design dark mode as its own palette, not an inversion. Pure white on pure black glares; use off-white on a very dark neutral and re-measure every pair.
- A gradient is decoration: keep it subtle, keep text off its weak end, and measure (see the tokens guide).

## 3. Hierarchy and layout

- One primary action per view. Secondary actions are quieter (outline or ghost), destructive actions are separate and confirmed.
- Align to a grid and let whitespace group things. Prefer spacing to borders and boxes.
- Make the hit area larger than the drawing: an icon at 20 px inside a 44 px target.
- Check for overlap at small widths and long text: a decorative card must never cover a title (verify at 320 px), and the last item of a grid must not leave an orphan empty column (`grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr))`).
- End backgrounds with a mask or fade, not a hard line (`mask-image: linear-gradient(#000 70%, transparent)`).

## 4. Every state is designed

For each interactive component, define and style: default, hover, focus-visible, active, disabled (`aria-disabled` when it should stay focusable), loading, error, success and empty. Hover is never the only way to discover something. Use the same ring for every control so the interface feels like one system.

Loading: keep the layout stable (reserve the space, skeletons or inline "Saving…"). Empty: say what is missing and what to do next. Error: say what happened and how to fix it, next to where it happened.

## 5. Motion with a purpose

- Motion explains a change (a dialog enters from where it was triggered, a list item slides out when removed). It is not ambient decoration.
- Durations: 120 to 200 ms for small feedback, 200 to 320 ms for entering and leaving surfaces; ease-out to enter, ease-in to leave. Animate `transform` and `opacity`.
- Always provide the reduced-motion path and, for anything that loops, a visible pause control (tokens guide, section 5).

## 6. Animated dialog exit (the part that breaks)

`dialog.close()` hides the dialog immediately and kills any exit animation. Keep it open while the exit plays:

1. State: `mounted` (rendered) and `closing` (playing the exit). Set `closing` when the user dismisses.
2. When the exit animation ends (`onAnimationEnd`, or a timer equal to the duration), call `dialog.close()`, restore the body scroll and return focus to the trigger.
3. Edge cases to handle and test: reopening during the exit cancels the timer; Esc during the exit must not call `onClose` a second time; with reduced motion or paused animations, skip the exit phase (no `animationend` ever fires, so the dialog would never close).
4. Style `[open]` and `[data-state="closing"]` carefully: they have the same specificity, so order decides.
5. Backdrop click: require `pointerdown` **and** `click` on the `<dialog>` itself, otherwise dragging a text selection out of an input closes the modal.
6. Tests that expected immediate removal become async (`await waitFor(...)`).

## 7. CSS pitfalls that cost an hour

- `.icon-btn` declared after `.menu-btn` overrides it with equal specificity and shows the menu button on desktop. Scope the rule (`.nav .menu-btn`) or reorder.
- Use `var()` tokens that depend on the palette on the palette element, not `:root`.
- Do not use a regex to edit CSS blocks; replace literal strings and assert the replacement happened.
