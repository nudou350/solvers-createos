# Step 4: Prepare the handoff

## Goal

Give the development team a specification that removes guesswork. A good handoff answers, without having to open Figma again: which tokens to use, which states exist, how the layout behaves at each width, what happens with real content (long, empty, with an error, slow) and which accessibility requirements the code has to meet. This is the step that saves the most rework, because roughly half of visual bugs come from states and edge cases that were never designed.

## What to ask the user

1. **Who receives it and with what tool?** Web dev (React, Vue), native mobile or low-code. This changes the language of the spec (props, variants, constraints).
2. **Is there a component library in code?** If the team uses, for example, shadcn/ui or MUI, map each Figma component to its equivalent and point out only the differences.
3. **Real content.** Are there character limits, additional languages or data coming from an API? Ask for real worst-case examples (the longest name, an empty list).
4. **Delivery format.** A Markdown document, a Figma comment, a task in the project manager. Default: Markdown using the `handoff-checklist` template (`get_template`).

## How to run

1. **Re-read the frames** with `get_design_context` if anything changed since step 1 (without the connector, ask for updated screenshots and values). If the user applied the fixes, check the new values instead of assuming.
2. **Screen overview:** goal, main task, primary action, entry and exit navigation.
3. **Layout and responsiveness.** For each breakpoint (suggested default: 360, 768, 1024, 1280px, or the project's own):
   - Grid: columns, gutter, side margin, maximum content width.
   - What changes: columns that stack, elements that hide or become a menu, tables that become cards or gain horizontal scroll.
   - Translate auto layout to CSS: "vertical auto layout, gap 16, padding 24" becomes `display:flex; flex-direction:column; gap: var(--space-stack-md); padding: var(--space-inset-lg)`. "Fill container" becomes `flex: 1` or `width: 100%`; "Hug contents" becomes automatic width.
4. **Components and states.** For each interactive component, specify the state matrix with the tokens for each: default, hover (pointer only), visible focus (`:focus-visible`, a ring with 3:1 against the background and at least 2px), active/pressed, disabled, loading, error, success, selected. If a state does not exist in Figma, say so clearly and propose the look using existing tokens, marking it "proposed, validate with design".
5. **Mandatory edge cases:**
   - Long text: truncate with an ellipsis (and a tooltip or accessible full text) or wrap? Define a maximum number of lines.
   - Empty state: illustration or text, with an action that resolves it ("No orders yet. Explore products").
   - Loading: a skeleton for content with a predictable layout, a spinner only for short actions; buttons in a loading state keep their width, swap the text ("Save" → "Saving…") and get `aria-disabled="true"` instead of `disabled` (so focus is not lost); the result is announced in a live region (`role="status"` for success, `role="alert"` for error).
   - Error: field message (what happened and how to fix it), page-level error and lost connection.
   - Extreme data: a 7-digit number, currency formatting (`$1,234.56` in the US; in Brazil, `R$ 1.234,56`), dates in the locale's format (in Brazil, day/month/year), lists with 1 and with 500 items.
   - Locale-specific ID, postal code and phone fields (Brazil-specific example: CPF, CEP and phone): `inputmode="numeric"`, accept pasted values with or without punctuation and format on blur and in display, with no mask that rewrites on every keystroke.
   - 200% zoom and system-enlarged text: nothing may be clipped.
6. **Accessibility in code:** focus order matching visual order, landmarks (`header`, `nav`, `main`), field labels always visible and associated, error messages linked by `aria-describedby` and announced, icons without text given an `aria-label`, targets of at least 24x24px (44x44px recommended for touch), respect for `prefers-reduced-motion`.
7. **Motion:** durations and curves as tokens (e.g. 150ms for micro-interactions, 200 to 300ms for panels; exit faster than entry).
8. **Assets:** list the icons and images to export, format (SVG for icons, WebP/AVIF for photos), sizes (1x and 2x) and suggested alt text.
9. **Assemble the document** from the `handoff-checklist` template, filled in with the real data, the platform and the component library from the profile. Close with a list of design open items (what needs to be designed or decided before development).

## Common mistakes

- **Loose px measurements instead of tokens.** The handoff should cite `space.stack.md`, not "16px", except as a reference in parentheses.
- **Hover as the only indicator.** There is no hover on touch; any information shown on hover needs an alternative.
- **Forgetting `:focus-visible`.** Removing the default outline with no replacement is a WCAG failure (2.4.7).
- **Assuming the dev will "deduce" mobile** from desktop.
- **Specifying only the happy path.** Without error, empty and loading states the handoff is incomplete.
- **Copying the CSS auto-generated** by Dev Mode without reviewing it: it brings absolute positions and non-tokenized values.

## result_summary format

This is the last step. Pass:

```
HANDOFF: <n screens>, <n components>, breakpoints <list>
SPECIFIED STATES: <component: states>
PROPOSED STATES (validate): <list>
EDGE CASES: <short list>
A11Y: <main requirements>
ASSETS: <n icons/images>
DESIGN OPEN ITEMS: <list>
FINAL DELIVERABLES: audit, tokens.json, handoff document
```

Then ask the user whether they want to save the tokens as variables in Figma or review another screen.
