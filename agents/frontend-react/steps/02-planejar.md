# Step 2: Plan the API, states and tests

## Goal

Define the component's contract (props, events, states) and the **list of test cases** before writing the implementation. The tests planned here are the specification: in step 4 they have to pass in `run_tests`.

At the end you need to have: the props interface in TypeScript, a state map, a focus and keyboard strategy, and a numbered list of tests approved by the user.

## What to ask the user

Show the plan and ask for approval in a single message. Ask only if there is a real open decision:

- "Do you prefer the component **controlled** (you pass `value`/`onChange`) or **uncontrolled** (it keeps the state and notifies through a callback)?" For simple forms, the uncontrolled one with `onSubmit(values)` is easier to use.
- "Do the texts (labels, error messages) stay fixed in one language or come in through props for translation?"
- "Is there a test case we missed?"

## How to run

1. **Design the minimal API**, in the project profile's stack (React version, styling, primitives library, test runner). Start with the smallest set of props that solves the use case. Rules:
   - Callbacks receive data, not events: `onSubmit(values)`, not `onSubmit(event)`.
   - Async callbacks return a `Promise`; the component handles the loading and error state. A rejected promise = failure.
   - Extend native attributes when the component is a thin wrapper: `type Props = ComponentPropsWithoutRef<"button"> & { variant?: ... }`. In React 19, `ref` already comes as a prop.
   - Avoid boolean props that contradict each other (`isLoading` + `isDisabled` + `isError`). Prefer `status: "idle" | "loading" | "error"`.
   - No `any`. Use `unknown` and narrow it.
2. **Map the states.** List each visual state and what changes in the accessibility tree in each one. Example for a submit button: `idle` (text "Save"), `pending` (text "Saving…", `aria-disabled="true"`, clicks ignored), `error` (message in `role="alert"`, button goes back to normal).
3. **Plan focus and keyboard.** For each interaction, answer: where is focus before, where does it end up after? Use `search_knowledge("focus management")` if in doubt. Mandatory points:
   - Open an overlay → focus goes inside (the first useful element, or the container itself with `tabIndex={-1}`).
   - Close an overlay → focus returns to the trigger.
   - Submit with an error → focus on the first invalid field.
   - Remove a list item → focus on the next item (or the previous one if it was the last; or on the list heading if it became empty).
4. **Write the list of tests.** Each test is a behavior observable by the user, named in plain English: "with empty fields shows errors and focuses the email". Cover, in this priority order:
   1. Accessible names and roles (`getByRole` queries with `name`).
   2. The full happy path.
   3. Validation and errors (connection with `aria-describedby`, `aria-invalid`).
   4. Focus after each relevant interaction.
   5. Keyboard (Tab, Enter, Space, Esc, arrows when the pattern requires them).
   6. Async states: loading, success, failure, double click.
   7. Edge cases: empty list, long text, value with spaces.
5. **Plan the visual accessibility, if there are styles.** List the tokens (text, muted, accent-as-text, focus ring, field border, fill-with-white-text) per theme and palette, the pairs that will be asserted with `contrastRatio` (template `estilos-acessiveis`), any text that sits on a gradient or image (it needs a real measurement), every animation that loops (it needs a visible pause control, not only `prefers-reduced-motion`) and every dynamic status message (it needs a live region that exists from the first render). If the component has an animated exit, plan the `mounted`/`closing` states and the edge cases (reopen during exit, Esc during exit, reduced motion).
6. **Plan the verification, and say what it cannot prove.** Write a short list: what `run_tests` will prove, what `a11y_check` will prove, what you will compute (token contrast) and what needs a browser (axe-core per state, contrast over gradients, keyboard pass, 320 px reflow). The last item is shown to the user now, not discovered at the end.
7. **Define the file structure.** Default: `ComponentName.tsx` + `ComponentName.test.tsx` in the same folder. The delivery goes into the verifier's `src/` when `run_tests` runs it, so **imports only relative and only from the available dependencies** (react, react-dom, Testing Library, Vitest). No `@/components`, no icon library.
8. Present the plan to the user in the format below and wait for approval. If the user says to go ahead without approving the test list, proceed and record "approval gate skipped on the user's instruction" in the summary; do not silently treat it as approved.

## Common mistakes

- **Planning only behavior tests for a visual component.** A modal can pass every test and still have a focus ring at 2:1 and white text at 2.5:1 on its button. Plan the token pairs too.

- **Testing implementation instead of behavior.** "calls `setState` with X" or "the `is-open` class exists" breaks on any refactor. Test what the user perceives: text, role, focus, ARIA attributes.
- **Planning `getByTestId` as the main query.** If you cannot find the element by role and name, the screen reader cannot either. `data-testid` is a last resort.
- **Forgetting the failure state.** Most AI-generated components only handle the happy path. Every async call has at least: pending, success, error and repeated click.
- **Bloated API.** Twenty optional props "for flexibility" make usage and testing worse. Add them when there is a real case.
- **Not planning for SSR.** IDs with `Math.random()` break hydration. Use `useId()`.

## result_summary format

```
Files: <list of paths>
API:
  type <Name>Props = { ... }   // paste the full interface
States: <state → what changes in the UI and in the accessibility tree>
Focus and keyboard:
- <interaction> → focus on <target>
Approved tests:
1. <test name>
2. ...
Visual accessibility: <tokens and pairs to assert, gradients to measure, loops to pause, live regions | not applicable>
Verification plan: <proved by run_tests / a11y_check / computed | needs a browser>
Approval: <approved | skipped on the user's instruction>
Decisions: <controlled/uncontrolled, texts via props or fixed, library used>
```
