# Step 2: Audit hierarchy, spacing, typography and contrast

## Goal

Produce an objective, actionable audit. Every issue needs: where it is (frame and layer), the current value, why it is a problem (criterion or principle), the suggested value and the severity. "Improve the contrast" is not a finding; "supporting text #9CA3AF on #FFFFFF has 2.54:1, needs 4.5:1, use #6B7280 (4.83:1)" is.

## What to ask the user

Usually nothing: you already have the inventory from step 1. Ask only if:

- There is a brand color that cannot change and fails contrast. In that case offer alternatives that preserve the brand (use the color only in large areas, a darker version for text, bold white text on it if it passes).
- The required conformance level differs from the one in the profile or, with no profile, from WCAG 2.2 AA (e.g. the public sector may require formal AA; some clients ask for AAA on long text). Use the profile's platform to choose the touch target goal (24 px is the AA minimum; 44 or 48 in a mobile app).

## How to run

Use `search_knowledge` to look up the reference numbers before stating any threshold. Audit in this order, because hierarchy problems mask the rest:

1. **Visual hierarchy.** With the screenshot, do the squint test: what are the first, second and third points of attention? Compare them with the main task of the screen. Check:
   - There is exactly one primary action per visual context.
   - The screen title is the largest text and the only one at that level.
   - Related information is grouped by proximity (space inside a group smaller than the space between groups, ideally at a ratio of 1:2 or more).
   - The weight contrast between levels is noticeable (size differences under ~20% between neighboring levels do not create hierarchy).
2. **Spacing.** Compare the inventory values against a 4pt grid (8pt for larger blocks). List the off-grid values and group them into a recommended scale (e.g. 4, 8, 12, 16, 24, 32, 48, 64). Check consistency: the same type of relationship (label → field, field → field, section → section) needs the same value on every screen.
3. **Typography.** Check the number of sizes (more than 6 to 7 sizes in one interface usually means a missing scale), the scale ratio, line height (1.4 to 1.6 for body; 1.1 to 1.3 for headings), text measure (45 to 75 characters per line for running text), minimum body size (16px on mobile web; 14px acceptable in dense desktop interfaces; never below 12px for essential information) and the number of weights (2 to 3 are enough).
4. **Contrast.** Build the list of text color/background pairs and of non-text element/background pairs. For each pair, set the `kind`:
   - `"texto"` (default; Portuguese for "text"): regular text, 4.5:1 at AA.
   - `"texto-grande"` (large text): 24px or more, or 18.66px or more in bold (700); 3:1 at AA. A 20px regular text is still `"texto"`.
   - `"ui"`: field borders, icons that carry meaning, focus ring, toggle tracks and thumbs, checkboxes; 3:1 against the adjacent color (criterion 1.4.11).

   The `kind` values and the response keys keep their original names (`texto`, `texto-grande`, `textoGrande`) because the server tool expects them exactly. Use them as written.

   Call `run_tool` with `tool: "contrast_check"`, passing up to 50 pairs in one call, for example:
   ```json
   { "pairs": [
     { "fg": "#9CA3AF", "bg": "#FFFFFF", "use": "supporting text 14px", "kind": "texto" },
     { "fg": "#2563EB", "bg": "#FFFFFF", "use": "title 24px", "kind": "texto-grande" },
     { "fg": "#D1D5DB", "bg": "#FFFFFF", "use": "input border", "kind": "ui" },
     { "fg": "#2563EB", "bg": "#FFFFFF", "use": "focus ring", "kind": "ui" }
   ] }
   ```
   Accepted colors: `#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`, `rgb()` and `rgba()`. An `fg` with transparency is composited over the `bg` by the tool; the `bg` must be opaque, so if the background is translucent, first work out the resulting solid color over the layer beneath.

   How to read the response: `ratio` is the calculated ratio (quote it with two decimals, e.g. 2.54:1); `pass` says whether the pair passes AA for the given `kind`; `aa.texto`, `aa.textoGrande` and `aa.ui` show the result for each AA criterion, and `aaa.texto` (7:1) and `aaa.textoGrande` (4.5:1) for AAA. For borders, icons and focus, the verdict is `pass` with `kind: "ui"` (or `aa.ui`), never the text criterion. A pair that comes back with `error` does not invalidate the others: fix the color format and re-run only that pair.

   Disabled text and logotypes are exempt, but record them as a note. Cover every mode (light and dark) and every state (hover, focus, error).
5. **Targets and focus.** Check touch targets: WCAG 2.2 AA (2.5.8) requires at least 24x24px or equivalent spacing; recommend 44x44px (iOS) or 48x48dp (Android) on mobile. Check that a visible focus state is designed.
6. **Classify the severity:**
   - **Critical:** fails WCAG AA, ambiguous primary action, essential information unreadable.
   - **High:** inconsistency that breaks patterns across screens, missing scale, touch target below 24px.
   - **Medium:** off-grid values, too many weights, long line measure.
   - **Low:** aesthetic refinements.
7. **Deliver the audit** as a table ordered by severity, followed by 3 structural recommendations (e.g. "adopt an 8-value spacing scale", "reduce font sizes from 9 to 6").

## Common mistakes

- **Saying a pair passes or fails without running `contrast_check`.** Contrast calculated "in your head" is often wrong. Always use the tool and quote the number.
- **Forgetting non-text contrast.** Input borders of #E5E7EB on white (1.24:1) are the most common problem in forms and are almost never flagged. Run these pairs with `kind: "ui"`.
- **Getting the `kind` wrong.** Sending a border as `"texto"` produces a false alarm (it demands 4.5:1 instead of 3:1); sending 20px regular text as `"texto-grande"` approves something that fails.
- **Treating a placeholder as a label.** Light gray placeholders usually fail contrast and disappear while typing; flag it and suggest a visible label.
- **Suggesting a new color without checking it.** Every suggested color also has to go through `contrast_check`.
- **Calling an aesthetic opinion critical.** Critical severity is for real barriers to use, not taste.
- **Auditing only light mode.** Dark mode tends to fail on mid grays and on saturated brand colors.
- **Ignoring text over an image.** Text over a photo needs an overlay or a solid area; the contrast varies with the image.

## result_summary format

```
FINDINGS: <n critical> critical, <n> high, <n> medium, <n> low
CONTRAST (contrast_check): <use> <fg>/<bg> [<kind>] = <ratio> <pass/fail>; ... (all pairs tested; "(estimated)" if the color came from an image)
COLOR FIXES: <old hex> -> <new hex> (<new ratio>)
PROPOSED SPACING SCALE: <list px>
PROPOSED TYPE SCALE: <size/line height/weight per level>
TOUCH TARGETS: <issues>
FOCUS: <present/missing>
STRUCTURAL RECOMMENDATIONS: <3 items>
```
