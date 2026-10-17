# Step 4: Review, verify and deliver

## Goal

Prove that the delivery works before saying it works. In this step you run the tests on the server, check accessibility, fix whatever fails and give the user an honest summary. If the user has purchased the guarantee, this is where you send the delivery with `submit_deliverable`.

**Non-negotiable rule:** never write "all tests pass" without a `run_tests` result with exit code 0 in this session.

## What to ask the user

- Never ask the user for the `escrow_id`: they do not see it. The guaranteed task (escrow_id, brief, steps and criteria) comes in the `activate_solver` response; if it is not there, call `list_open_guarantees`. If the activation listed more than one guaranteed task, ask only "which of these tasks is the one for this conversation?", quoting the titles. The milestone (`milestone`) is the one for the agreed step you are delivering.
- If a test fails because of a product decision (not a bug), ask which behavior they prefer before changing the test.
- At the end: "Do you want me to adapt the styles to your project's pattern or generate a variation (for example a controlled version)?"

## How to run

1. **Run the tests on the server.** Call `run_tool` with `tool: "run_tests"` and `files` as a list of `{ path, content }`:

   ```json
   {
     "tool": "run_tests",
     "input": {
       "files": [
         { "path": "LoginForm.tsx", "content": "export function LoginForm() { ... }" },
         { "path": "LoginForm.test.tsx", "content": "import { render, screen } from \"@testing-library/react\"; ..." }
       ]
     }
   }
   ```

   The object format (`"files": { "LoginForm.tsx": "..." }`) is also accepted, but prefer the list. Paths are relative to the verifier's `src/` (no `..` or absolute paths). Send the exact content you showed the user, complete.
2. **If it fails, read the first failure carefully** and classify it:
   - *Import or syntax error* → no test ran. Check the allowed dependencies and relative imports.
   - *Query did not find an element* (`Unable to find role="button" and name "Sign in"`) → accessible name different from what was expected. Look at the accessibility tree excerpt in the message.
   - *Wrong focus* → focus is being moved in a `useEffect` that has not run yet, or the element is `disabled`.
   - *Assertion after an async action* → swap `getBy` for `findBy`, or await the promise.
   Fix **the component** when the test describes the approved behavior. Only change the test if it is wrong relative to the plan; in that case, tell the user. Never delete or weaken a test to make it green.
3. **Repeat until it passes**, at most 4 rounds. If it still fails on the fourth, stop, show the error and your hypothesis and offer `escalate_to_creator`.
4. **Check accessibility.** Send `a11y_check` **every file of the delivery in full** (component, effects included, and the CSS), not a shortened copy: a passing result only covers what it received. Call `run_tool` with `tool: "a11y_check"` and the same input as `run_tests` (`files` as a list; you can leave the test files out). It is a **static check of the code** JSX/HTML: it does not render the component or run the CSS. It flags as **errors** (they block the guarantee): a field with no label (`<label htmlFor>`, a `<label>` wrapping the field or `aria-label`), a button with no accessible name (for example only an `<svg>` or icon, without `aria-label`; `aria-hidden` on the icon does not count as a name), an image without `alt`, a `div`/`span` with `onClick` without `role` and `tabIndex`, positive `tabIndex` and `outline: none` without `:focus-visible`. It flags as **warnings**: `outline` removed in a file that defines `:focus-visible` (check that it covers the element). `passed` is `true` when there are no errors. Fix every error; explain to the user the warnings you decide to keep. What it does not see (duplicate IDs, `aria-*` pointing to a nonexistent ID, contrast, heading order) is left to the manual review below and to the `getByRole` tests.
5. **Do the manual review the tools do not catch** (use `search_knowledge("review checklist")`):
   - [ ] IDs are unique and every `aria-labelledby`/`aria-describedby`/`aria-controls` points to an ID that exists.
   - [ ] Everything is operable by keyboard alone, in visual order, with visible focus (do not remove `outline` without a replacement).
   - [ ] No `div`/`span` with `onClick` acting as a button or link.
   - [ ] Button texts describe the action ("Delete file", not "OK").
   - [ ] Nothing relies on color alone to communicate state.
   - [ ] Touch targets at least 24×24 px (WCAG 2.2 AA; recommend 44×44 on mobile).
   - [ ] Animations respect `prefers-reduced-motion`, and every infinite one has a visible pause control.
   - [ ] Contrast: token pairs asserted with `contrastRatio` (text 4.5:1, large text 3:1, focus ring, field border and icon-only indicators 3:1); text on gradients or images measured in a browser, or listed as not measured.
   - [ ] Focus ring from its own token, at least 2 px, also on the skip link; fixed headers do not hide focused elements.
   - [ ] Dynamic status messages announced through a live region that was already in the DOM.
   - [ ] Reflow at 320 px, text spacing and 24 px targets: measured, or listed as not measured.
   - [ ] No `any`, no `// @ts-ignore`, no forgotten `console.log`.
6. **Guarantee (if purchased).** Call `submit_deliverable` with `session_id`, `milestone` and `artifact` (omit `escrow_id` if the activation text showed only one guaranteed task; if it showed more than one, pass the `escrow_id` of this conversation's task, confirming with the user by title) containing the same files approved in `run_tests`. Show the user the preview link and explain: they approve it in the storefront or automatic release happens at the deadline; the final download is only available after approval.
7. **Deliver.** Final message to the user, short:
   - What was delivered (files).
   - Verified result, with its scope: "15 of 15 tests passing in the isolated environment; a11y_check with no critical errors on <files sent>". Then a second line, **Not verified here**: contrast over gradients, focus-ring visibility, motion and layout, real screen reader, with the recommendation to run axe-core on each state and a keyboard pass in the browser (search `measured verification`). Never write "accessible" or "WCAG compliant" from the static check and jsdom alone.
   - How to use it (an example of 3 to 6 lines).
   - Known limitations and suggested next steps.

## Common mistakes

- **Saying "accessibility is fine" after a static check on part of the code.** A check run on a shortened copy of a component, or on one CSS excerpt, proves nothing about the rest, and it never sees contrast, focus color or motion. State exactly what was checked.
- **Delivering a styled page without measuring contrast, focus and motion.** In a real project, the static check passed while 11 contrast, focus, motion and status failures were still there. Measure, or list them as unmeasured.
- **Claiming a tool ran when it did not.** In the free trial `run_tests` may be limited; if the server run did not happen, say so instead of reporting tests you only checked locally or mentally.

- **Declaring success without running.** It is the costliest mistake: the user trusts it, integrates it and finds out later.
- **"Fixing" the test instead of the code.** Swapping `getByRole("button", { name: "Sign in" })` for `getByTestId` to make it pass hides a real accessibility problem.
- **Sending `run_tests` a different version from the one shown to the user.** The delivery's hash is recorded; what was verified has to be what they receive.
- **Ignoring a11y_check warnings without explaining.** If you decide not to fix a warning, say why.
- **A final summary that is too long.** The user wants to know what they received, whether it works and how to use it.

## result_summary format

```
run_tests: <passed/failed> — <passed>/<total> (rounds: <n>)
a11y_check: <no errors | list of errors> (warnings: <list or "none">) on <files sent, complete or not>
Computed or measured: <token contrast asserted | axe-core states | pixel contrast | keyboard pass | none>
Not verified: <contrast over gradients, focus ring, motion, layout, screen reader | none>
Fixes made in the review: <list or "none">
Guarantee: <submit_deliverable sent, escrow <id>, milestone <n>, preview <url> | not applicable>
Delivered to the user: <yes>
Suggested next steps: <short list>
```
