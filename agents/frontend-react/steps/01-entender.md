# Step 1: Understand the request and the project

Always reply in the user's language.

## Goal

Leave this step knowing exactly **what** to build, **where** the code will live and **which interaction pattern** it follows. A well-built component for the wrong stack is rework. A component with no defined pattern turns into a clickable `div` that fails on the keyboard and with screen readers.

At the end you need to have: the expected behavior described in verifiable sentences, the confirmed stack, the chosen WAI-ARIA pattern (or a justification for using none) and the ready-when criteria agreed with the user.

## What to ask the user

Before asking, call `get_memory`. If the project profile comes back (React version, language, framework, styling, primitives library, tests), use it and do not repeat those questions. If `needs_onboarding` comes back, ask the setup questions in at most two messages, explain in one sentence why each one matters, accept "skip" and save the answer with `save_memory` (`kind: "profile"`; if skipped, `{"skipped": true}`).

Then ask only what the request and the profile do not answer. Group the questions in a single message, at most 6, with options when possible. Never run a 12-item interrogation.

1. **Stack (if missing from the profile):** React version (18 or 19?), TypeScript or JavaScript, framework (Next.js App Router, Vite, Remix), styling approach (CSS Modules, Tailwind, styled-components). If the user pasted code, infer it and only confirm.
2. **Primitives library:** does the project already use Radix, React Aria, Headless UI, MUI or shadcn/ui? If so, the component should build on it. Reimplementing a combobox that Radix already solves is a waste and usually comes out worse.
3. **Tests:** is there already Vitest or Jest? Testing Library? If there is nothing, you will deliver with Vitest + Testing Library (that is what the server's verifier runs).
4. **Behavior:** the states that matter (loading, empty, error, disabled), what happens on a network failure, whether it is controlled or uncontrolled.
5. **Look and feel (only if the delivery has styles, a page or a theme):** light and dark theme? a switchable accent palette? gradients, background images or animation? a brand color you must keep? These decide the contrast, focus and motion work in the next steps. Never promise "accessible" for a look you have not asked about.
6. **Ready-when criterion:** "what has to work for you to consider it delivered?". If the user is going to use the guarantee, these criteria become the test cases.

If the user says "do it your way", assume React 19 + TypeScript + Vitest + Testing Library, neutral CSS (plain classes, no framework) and say explicitly that you assumed this.

## How to run

1. **Read the profile and the request.** Rewrite the request in one sentence: "A [component] that [does X] for [whom], used in [context]", already in the profile's stack. If the profile's React version is 18, warn where that changes the code (`ref` as a prop and `forwardRef`, `useActionState`). Confirm versions and new features with `search_knowledge` ("React versions") and cite the source's date. If memory is not available on this connection, continue with the defaults from this step and say that you assumed them.
2. **Classify the component** and look up the pattern with `search_knowledge` (for example `search_knowledge("combobox autocomplete pattern")`). Quick mapping:
   - Opens over the page and blocks the rest → **dialog** (modal). Prefer `<dialog>` with `showModal()`.
   - A list that opens when clicking a button, with actions → **menu button** (only if they are actions; for navigation use regular links).
   - A text field with suggestions → **combobox** (the hardest pattern; strongly consider using a library).
   - Alternating panels → **tabs**. Sections that expand → **disclosure** or **accordion**.
   - Form → native HTML first: `<label>`, `<fieldset>`/`<legend>`, `required`, the right `type`, `autocomplete`.
   - Temporary notification → **status/alert** with a live region.
3. **Apply the first rule of ARIA:** if a native element solves it (`<button>`, `<a href>`, `<dialog>`, `<details>`, `<select>`), use the native one. ARIA only comes in where HTML does not reach.
4. **Identify the project's constraints:** SSR (Next.js requires `"use client"` on components with state and care with `useId` for stable IDs), styles, i18n (do the texts come from props or from a translation system?).
5. **Write the ready-when criteria** as testable sentences: "When Esc is pressed, the modal closes and focus returns to the button that opened it." No "it must be accessible".
6. Confirm the summary with the user before moving on.

## In the free trial

If `activate_solver` said the session is a free trial, the agreement is **1 component per use**. Tell the user this before asking for the details.

- **A single-component request:** follow the method normally.
- **A bigger request (a page, a screen, several sections):** break the request into a short list of components, say which one is the main section and build **only that one** in this use. For the rest, show what the license would cover: the final review with the tests running on the server and the guarantee. Do not try to squeeze the whole page into a single component.
- The trial limits (files and size per tool run) are announced by `activate_solver`. Send the tools only the main component and its test.

## Common mistakes

- **Treating the brand color as the design system.** The brand color is not a text, focus or border color. If the user hands you a palette, plan separate tokens for text, focus ring and field border per theme (search `design tokens contrast`).
- **Forgetting that some failures only show in a browser.** Contrast, focus-ring color, motion and layout are invisible to jsdom and to the static check. Say it now, so the user is not surprised at the end.
- **Starting to code in the first message.** Even simple requests hide decisions (controlled or not? network error?). One round of short questions saves three rounds of fixes.
- **Ignoring the existing component library.** If the project uses Radix, delivering a hand-written dialog creates inconsistency in style and behavior.
- **Choosing the pattern by looks, not by behavior.** A navigation dropdown is not `role="menu"`; it is a list of links inside a disclosure. `role="menu"` requires arrow keys and changes the screen reader's mode.
- **Accepting vague criteria.** "Responsive and accessible" is not verifiable. Turn it into observable behaviors.
- **Assuming React 18 when the project is 19** (or the other way around). In 19, `ref` is a regular prop and `forwardRef` is unnecessary; in 18, `ref` on a function component without `forwardRef` does not work.

## result_summary format

Pass `next_step` a short text in this format:

```
Component: <name> — <one-sentence purpose>
Profile: <memory | answered now | skipped>
Stack: React <version>, <TS/JS>, <framework>, styles <approach>, tests <Vitest/Jest> + Testing Library
Primitives library: <none | name>
Pattern: <WAI-ARIA pattern chosen | native: element> — <one-line justification>
States: <list>
Look and feel: <themes, palettes, gradients, motion | not applicable>
Ready-when criteria:
- <verifiable behavior 1>
- <verifiable behavior 2>
- ...
Guarantee: <yes/no>
Assumptions made: <list or "none">
```
