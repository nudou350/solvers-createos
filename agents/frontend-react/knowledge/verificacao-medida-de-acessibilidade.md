---
title: Measured accessibility verification: what each tool proves and what it does not
source: axe-core and Playwright documentation, W3C WCAG 2.2, and lessons from a real component project (static check passed while axe-core and manual measurements found 11 real failures)
source_url: https://github.com/dequelabs/axe-core/blob/develop/doc/API.md
source_date: 2026-10-08
valid_until: 2027-01-31
tags: [verification, axe-core, playwright, contrast, keyboard, honesty, review]
---

# Measured accessibility verification

In a real project, a static JSX check reported no errors while 11 problems were still there: white text on gradients at 2.25:1 to 4.28:1, a focus ring under 3:1, form borders at 1.6:1, infinite animations with no pause, a "Copied!" message nobody could hear. The static check only reads labels, `alt`, `tabIndex` and `outline` in the code. Only axe-core in a real browser plus manual measurements found the rest.

## 1. What each layer proves

| Layer | Proves | Does not prove |
|---|---|---|
| `a11y_check` (static, server) | Names, labels, `alt`, clickable `div`, positive `tabIndex`, `outline: none` in the files it received | Contrast, focus color, motion, layout, behavior, any file it was not sent |
| `run_tests` (jsdom, server) | Roles, names, ARIA relations, focus order, keyboard handling, state changes | Computed CSS, contrast, layout, animation, real screen reader |
| axe-core in a browser (the user's project) | The machine-detectable subset of WCAG failures, in each rendered state (many criteria need a human) | Contrast over gradients and images (reported as "incomplete"), keyboard flow quality, meaning |
| Per-pixel contrast measurement | Real contrast of text over gradients and images | Anything that is not text |
| Keyboard pass, manual | Order, visible ring, no trap, no hidden focus | Screen reader speech |

## 2. axe-core, state by state

Run it on every state that changes the DOM, not once on the landing page: light, dark, mobile width, each dialog open, each menu open.

```ts
import AxeBuilder from "@axe-core/playwright";

const results = await new AxeBuilder({ page })
  .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
  .analyze();
// results.violations must be []; read results.incomplete by hand (contrast over gradients lands there)
```
Report the count per state ("0 violations in 14 states") and list the states. "0 violations" without the list of states proves nothing.

## 3. Contrast over gradients, pixel by pixel

axe marks contrast on gradients and images as inconclusive, so measure it:
1. Hide the text: `color: transparent` and turn off `background-clip: text`.
2. Take a screenshot of the area.
3. For each line of text (use `Range.getClientRects()`), compare the text color with the **worst** background pixel inside that rectangle.
4. Require 4.5:1 for normal text and 3:1 for large text (24 px and up, or 18.66 px bold and up).
5. Repeat for every palette and both themes. The worst case is usually the lightest palette.

False positives to filter out:
- `sr-only` text is 1 px; skip it.
- Rotated, `aria-hidden` decorative cards have a rectangular box that catches neighboring pixels.
- Behind a modal the page is blurred and inert; measure only the content inside the dialog.
- With `scroll-behavior: smooth`, wait about 650 ms before reading positions.
- A reload restores scroll position and distorts skip-link tests; scroll to the top first.

## 4. Keyboard pass

1. Load fresh, scroll to top, press Tab from the start. Sequential focus navigation begins from the last click, so a Tab after a click does not start at the top.
2. Confirm the order matches the visual order and the ring is at least 2 px and visible on every stop, including the skip link.
3. Confirm focus is never hidden under a fixed header.
4. Open a dialog, Tab through it, close it with Esc and with the button; focus must return to the trigger.
5. With `showModal()`, Tab can leave the dialog for the browser chrome (`document.body`). That is normal. The correct assertion is that **no page element outside the dialog receives focus**.

## 5. Other measurements

- Reflow at 320 px (no horizontal scroll), text spacing override (1.4.12), targets of 24 px or more (2.5.8).
- Count infinite animations before and after pressing the pause control.
- Heading outline (no skipped levels) and landmarks (one `main`, labeled `nav`s).

## 6. Honest reporting (this is a rule, not a style)

- State exactly what was verified and on which files: "`a11y_check` on `Modal.tsx` without its effects and on one CSS excerpt" is a different claim from "the component is accessible".
- Never write "accessible" or "WCAG compliant" from static checks or jsdom tests alone. Say "no errors found by the static check and N tests pass; contrast, motion and real-browser behavior were [measured by X | not measured]".
- If you could not measure contrast, focus ring or motion, list them under "manual verification still needed". Do not hide them.
- Quote proof numbers from a measurement you actually ran. A number written in the page copy ("18 tests") goes stale; generate it or review it on every change.
- Never invent testimonials, customer logos or usage metrics for a landing page. Use only verifiable proof (test counts, audit results) or leave the slot out.
- If the user lets you skip an approval gate ("go ahead"), do it, and record in the step summary that the gate was skipped by their instruction.
- Server tools can be rationed (a free trial gives one `run_tests`). If the tool did not run, say the tests were not run on the server, even if you ran them mentally.
