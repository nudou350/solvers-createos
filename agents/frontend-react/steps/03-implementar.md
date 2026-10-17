# Step 3: Implement the component and tests

## Goal

Write the component and the full tests, exactly as planned in step 2, ready to run in the verifier. "Complete" means: whole files, no `// ...rest of the code`, no `TODO`, no nonexistent imports.

At the end you need to have the final files for the component and the tests, covering all the approved cases.

## What to ask the user

In this step, normally nothing. Implement. Ask only if a real conflict with the plan comes up (for example, the approved behavior is impossible with the project's library). In that case, explain the conflict in two sentences and offer two alternatives.

## How to run

1. **Start from the templates.** Request `componente-react` and `teste-do-componente` with `get_template` and use them as the skeleton. They already bring `useId`, the connected error structure and the `setup()` with `userEvent.setup()`. Adapt them to the style and primitives library from the project profile. In the free trial the templates are not unlocked: write the component following the same patterns.
2. **Write the semantic HTML first**, then the state, then the styles. Markup checklist:
   - Every control has an accessible name: `<label htmlFor>`, visible button text, or `aria-label` when there is only an icon (and the icon gets `aria-hidden="true"`).
   - Buttons that do not submit a form have `type="button"`. Forgetting this is the number one cause of "the form submits when I click show password".
   - IDs generated with `useId()`, never fixed (two components on the same page collide) and never random (they break SSR).
   - Field error messages: an element with an ID, tied by `aria-describedby`, and `aria-invalid={error ? true : undefined}` on the field.
   - General error (submit failure): a `role="alert"` container that is **always present in the DOM**, filled when there is an error. A live region that is born together with its text is not always announced.
   - Loading state on a button: prefer `aria-disabled="true"` + a guard in the handler over `disabled`. A `disabled` button leaves the Tab order and loses focus in the middle of the interaction.
   - Color: use the tokens from the plan, never the raw brand color, for text, focus ring and field borders. White text only on a fill you have darkened and asserted. Placeholder: set the color, never lower the `opacity`.
   - Motion: loops get a visible pause control (`aria-pressed`, constant label) that sets `data-motion="off"` on `<html>`; the CSS and any JS animation read it, together with `prefers-reduced-motion`.
   - Status: "Copied", "Saved" and similar messages go into a `role="status"` region that exists from the first render.
   - Skip link and every focusable control use the same `:focus-visible` ring.
3. **Implement the state with the minimum of `useState`.** Derive in render whatever can be derived. Do not use `useEffect` to sync derived state. Use `useRef` for synchronous guards (for example `inFlight.current` against a double submit, because state only updates on the next render).
4. **Implement focus with refs, in the event handler**, not in a `useEffect` triggered by state, whenever possible. Focus in the handler is predictable and easy to test. For focus after mount (for example opening a panel), use `useEffect` with an explicit dependency or `autoFocus` on the right element.
5. **React 19 features you can use:** `ref` as a prop (no `forwardRef`), `useActionState` for forms with `action`, `useFormStatus` for submit buttons inside `<form action>`, `useOptimistic` for optimistic updates. Use them only if the project is React 19 (confirmed in step 1).
6. **Write the tests with Testing Library + user-event:**
   - `const user = userEvent.setup()` at the start of each test (or in a local `setup()`). Always `await` `user.click`, `user.type`, `user.keyboard`, `user.tab`.
   - Queries in order: `getByRole` with `name` → `getByLabelText` → `getByText`. `getByLabelText` is needed for `<input type="password">`, which has no role.
   - Assertions with jest-dom: `toHaveAccessibleName`, `toHaveAccessibleDescription`, `toHaveFocus`, `toHaveAttribute("aria-invalid", "true")`, `toBeRequired`, `toBeEmptyDOMElement`.
   - Async: `findBy*` for what shows up later; `waitFor` only for assertions that are not "appear". Never `setTimeout` in the test.
   - Controlled promises: create a `deferred()` to test the pending state and resolve it afterwards.
   - Mocks: `vi.fn()`, `mockResolvedValue`, `mockRejectedValueOnce`. No `jest.*` (the verifier uses Vitest).
7. **Mentally run each test against the code.** For each `expect`, point at the line of the component that satisfies it. This catches most errors before `run_tests`.
8. **Make the look deliberate, not decorative.** Use the spacing, type and radius scales, a restrained palette and a designed state for every control (default, hover, focus-visible, disabled, loading, error, empty), as in the visual polish guide. If you add a gradient, decide where text may sit on it. If the dialog has an animated exit, keep it open until the animation ends, then `close()`, restore the body scroll and return focus.
9. **Never invent proof.** No made-up testimonials, customer logos or usage metrics in a page. Numbers printed in the page ("18 tests") come from a real run or are not printed.
10. Show the complete files to the user, each in a code block with the path at the top.

## Common mistakes

- **`dialog.close()` before the exit animation.** It hides the dialog at once and the animation never plays. Keep it mounted and open during the exit.
- **Backdrop click that closes on any `click` event.** Dragging a selection out of a field then closes the modal. Require `pointerdown` and `click` on the `<dialog>` itself.
- **A CSS rule that wins by order.** Equal-specificity rules (`.icon-btn` after `.menu-btn`) override each other silently. Scope the selector.
- **Derived palette tokens defined on `:root`.** They resolve there and ignore `data-accent`. Define them on the element that carries the palette.

- **`fireEvent` instead of `user-event`.** `fireEvent.click` does not move focus or fire the real sequence of events; tests pass and the component fails in the browser.
- **Forgetting `await` on user-event.** The test ends before the interaction and passes by mistake (or fails intermittently).
- **Manual `act()` around everything.** Testing Library already wraps the interactions. An `act` warning usually indicates a promise that was not awaited: use `findBy*`.
- **`role="alert"` on every field error message.** On an empty submit, the screen reader announces all of them at once. Field errors go in `aria-describedby`; focus on the first invalid field makes the announcement.
- **Showing the raw server message** (`error.message`) to the user. It leaks details ("user not found") and can reveal whether an email exists. Use a generic message; log the detail.
- **Imports the verifier does not have** (`@/lib/utils`, `clsx`, `lucide-react`). The container has no network; the test breaks on the import.
- **`toBeInTheDocument()` as the only assertion.** It proves it rendered, not that it works.

## result_summary format

```
Files delivered:
- <path>: <n lines> — <what it contains>
- <path>: <n tests>
Test → requirement map:
1. <test name> → <ready-when criterion>
Dependencies used: <list>
Points of attention for the review: <short list or "none">
```

Include the complete files in the context, because step 4 sends exactly that content to `run_tests`.
