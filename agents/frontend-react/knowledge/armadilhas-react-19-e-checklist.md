---
title: React 19 pitfalls with TypeScript and the review checklist
source: React documentation (react.dev) and WCAG 2.2 (W3C)
source_url: https://react.dev/reference/react/forwardRef
source_date: 2026-10-02
valid_until: 2027-01-31
tags: [react-19, typescript, pitfalls, checklist, accessibility]
---

# React 19 pitfalls with TypeScript and the review checklist

Mistakes that show up often in components generated in a hurry, with the fix. At the end, the checklist used in the review step. The points about `ref`, form actions and `useId` apply to React 19 projects; in a React 18 project, confirm the version before applying them.

## React 19 changes that affect components

**`ref` is a regular prop.** In function components, `function Input({ ref, ...props }: ComponentProps<"input">)` receives the ref without `forwardRef`. The official documentation says that in React 19 `forwardRef` is no longer needed and "will be deprecated in a future release": it still works, but do not use it in new code for React 19. In a React 18 project, `ref` without `forwardRef` is dropped (and React warns in the console).

**Ref typing.** `useRef<HTMLInputElement>(null)` returns `RefObject<HTMLInputElement | null>` in the React 19 types. `useRef()` with no argument is a type error in 19: always pass the initial value.

**Ref callbacks can return a cleanup.** Because of that, `ref={(el) => (this.x = el)}` with an implicit return is now a type error (the return value is interpreted as a cleanup). Use braces: `ref={(el) => { x = el; }}`.

**`useActionState`, `useFormStatus`, `useOptimistic` and `<form action>`.** See the forms guide. Watch out for the automatic reset of uncontrolled fields after the action.

**`use(promise)`** reads a promise during render with Suspense. The promise must be stable (created outside the render or cached); creating the promise inside the render causes a suspense loop.

**Metadata in the component.** `<title>`, `<meta>` and `<link>` rendered anywhere are hoisted to the `<head>`. Useful for pages, irrelevant for UI components.

**`element.ref` and `propTypes`/`defaultProps` on function components** were removed or deprecated. Use default parameters in the destructuring: `function Button({ variant = "primary" })`.

**Hydration.** Hydration errors now show a single diff. Common causes in components: `Math.random()`/`Date.now()` in render, `typeof window` deciding the markup, browser extensions. Always generate IDs with `useId()`. Starting with React 19.2 the `useId` prefix changed to `_r_` (it was `:r:`), which makes it safe in CSS selectors; even so, do not depend on the ID format in tests or in CSS.

## State and effect pitfalls

- **Derived state in `useState` + `useEffect`.** If it can be computed from props/state, compute it in render. `useEffect(() => setFullName(first + last), [first, last])` causes a double render and out-of-sync bugs.
- **Resetting state when a prop changes:** use `key` on the component (`<Profile key={userId} />`), not an effect.
- **Stale closure in async handlers.** After the `await`, the state you read is the one from the render in which the handler was created. Use a functional update (`setX(prev => ...)`) or refs.
- **Double-submit guard in state only.** Two clicks in the same tick both read `pending === false`. Use `useRef`.
- **`useEffect` for user events.** Logic triggered by a click belongs in the click handler, not in an effect that watches state.
- **Effect with no cleanup** for listeners, timers, `AbortController`. In development, Strict Mode mounts, unmounts and mounts again: effects without cleanup show up duplicated.
- **Request with no cancellation:** an old response overwrites the new one when the user types fast. Use `AbortController` in the effect cleanup or compare a request counter.
- **Index as list key** in lists that reorder, filter or remove items: internal state (and focus) goes to the wrong item. Use a stable ID.

## Large lists: performance without breaking accessibility

Before virtualizing, measure: the cause of a slow list is usually re-rendering items that did not change (item memoization, or the React Compiler), state at the wrong level (every keystroke re-renders the whole list) or an unstable `key`. Use a `key` with the item's id, never the index in lists that change order. For thousands of items, apply virtualization with a mature library (TanStack Virtual, react-window): only the visible items stay in the DOM.

Virtualizing has an accessibility and product cost: the browser's find (Ctrl+F) does not find what is not in the DOM, and the screen reader loses the item count. Compensate with `aria-setsize` and `aria-posinset` on the items and your own search or filter. For lists of up to a few hundred simple items, prefer rendering everything with pagination or "load more", which keeps the native semantics. With "load more", move focus to the first new item.

## TypeScript pitfalls in components

- **Native element props:** `ComponentPropsWithoutRef<"button">` (or `ComponentProps<"button">` in React 19, which already includes `ref`). Spread `...rest` on the element, **before** the props you control if they must not be overridable, or after if they can be.
- **`children: React.ReactNode`**, not `JSX.Element` (which rejects strings, `null` and arrays).
- **Events:** `ChangeEvent<HTMLInputElement>`, `FormEvent<HTMLFormElement>`, `KeyboardEvent<HTMLDivElement>` imported from `react`, not the global DOM ones.
- **Discriminated unions for exclusive variants:** `type Props = { as: "link"; href: string } | { as: "button"; onClick: () => void }`. It rules out invalid combinations at compile time.
- **`as` and `!`** hide bugs. `event.target.name as Field` is acceptable when the names come from your own JSX; `data!.user!.name` is not.
- **UI texts as props with defaults** (`label = "Save"`) make i18n easier without bloating the API.

## Most frequent accessibility pitfalls

1. `div`/`span` with `onClick`. Replace it with `<button type="button">`. If the look gets in the way, reset the style: `all: unset; cursor: pointer;` and put the visible focus back.
2. A link with no `href`, or with `href="#"`, running an action. Action = button; navigation = link.
3. An icon button with no name. `aria-label` on the button, `aria-hidden="true"` on the SVG.
4. An informative image with no `alt`; a decorative image without `alt=""`.
5. Headings skipping levels for looks (`h2` → `h4`). A reusable component should accept the level as a prop (`headingLevel`).
6. `aria-hidden="true"` on a container with focusable elements.
7. `aria-describedby`/`aria-labelledby`/`aria-controls` pointing to an ID that does not exist in the DOM in that state. Render the attribute conditionally.
8. Information by color alone (error in red, required in red).
9. `outline: none` with no replacement.
10. Touch targets smaller than 24×24 CSS px (WCAG 2.2, 2.5.8 AA) without enough spacing. Recommend 44×44 on mobile.
11. Content that appears on hover (tooltip) that cannot be dismissed with Esc and does not appear on focus (WCAG 1.4.13).
12. Animations without `@media (prefers-reduced-motion: reduce)`.
13. `autoFocus` on the whole page at load, stealing the screen reader's context. Acceptable inside a freshly opened modal.
14. Dragging as the only way to do something (WCAG 2.2, 2.5.7): offer an alternative with click or buttons.

## Contrast: reference numbers

- Normal text: 4.5:1. Large text (24 px and up, or 18.66 px bold): 3:1.
- UI components and states (input border, focus ring, an icon that is the only indicator): 3:1 against the adjacent colors.
- Common Tailwind grays on white: `gray-400` (#9CA3AF) ≈ 2.5:1 (fails for text); `gray-500` (#6B7280) ≈ 4.8:1 (passes, barely); `gray-600` (#4B5563) ≈ 7.6:1. A placeholder in `gray-400` is the most common contrast error.

## Review checklist (step 4)

**Semantics**
- [ ] Native elements used where they exist (`button`, `a`, `dialog`, `label`, `fieldset`).
- [ ] Every interactive control has an accessible name and it contains the visible text.
- [ ] ARIA roles only where needed, with the matching states (`aria-expanded`, `aria-selected`, `aria-pressed`, `aria-checked`).
- [ ] ID references exist in the DOM in the state where they are used; IDs come from `useId()`.

**Keyboard and focus**
- [ ] Everything operable by keyboard, Tab order matches the visual order, no positive `tabIndex`.
- [ ] Keys from the pattern implemented (Esc, arrows, Home/End when applicable).
- [ ] Focus moved to a logical destination after open/close/delete/error; it never falls to `body`.
- [ ] Visible focus preserved.

**Visual accessibility (not seen by `a11y_check` or jsdom)**
- [ ] Brand color is not reused as text, focus or border color: separate tokens, per theme and palette.
- [ ] Contrast measured, not assumed: text 4.5:1 (large 3:1), focus ring, field border and icon-only indicators 3:1. Text over gradients measured against the worst pixel.
- [ ] Focus ring from its own token, at least 2 px, also on the skip link.
- [ ] Infinite animations have a visible pause control (`aria-pressed`) in addition to `prefers-reduced-motion`.
- [ ] Dynamic status ("Copied", "Saved") lives in a `role="status"` region that exists from first render.
- [ ] The final message says exactly what was measured and what was not.

**States**
- [ ] Loading, empty, error and success handled and announced (`role="status"`/`role="alert"`).
- [ ] Double click/double submit prevented.
- [ ] Error messages say what to do; credential errors are generic.

**Code**
- [ ] TypeScript with no `any`, `@ts-ignore` or unjustified `!`.
- [ ] No derived state in an effect; effects with cleanup.
- [ ] No `console.log`, no dead code, no TODO.
- [ ] Imports only from dependencies available in the project (and in the verifier, if there is a guarantee).

**Tests**
- [ ] Every ready-when criterion has at least one test.
- [ ] Queries by role and name; `getByTestId` only with a justification.
- [ ] user-event with `await`; no `setTimeout` in the test.
- [ ] `run_tests` passed in this session; `a11y_check` with no critical errors.
