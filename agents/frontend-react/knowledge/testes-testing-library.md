---
title: Testing with Testing Library and Vitest
source: Testing Library documentation and package metadata from the npm registry (Vitest 5, Testing Library 16)
source_url: https://registry.npmjs.org/vitest/latest
source_date: 2026-10-02
valid_until: 2027-01-31
tags: [testing, testing-library, vitest, user-event, jsdom]
---

# Testing with Testing Library and Vitest

The Testing Library philosophy: "the more your tests resemble the way your software is used, the more confidence they can give you". In practice, that means finding elements the way the user finds them (role and name), interacting the way the user interacts (user-event) and asserting what the user perceives (text, focus, ARIA state). A bonus: queries by role fail when accessibility is broken, so the tests become a continuous audit.

## Reference configuration (the verifier's)

- `vitest` 5 (5.0.3 on the npm registry on 2026-10-02; requires Node `^22.12.0 || ^24.0.0 || >=26.0.0`), `environment: "jsdom"`, `globals: true`, `setupFiles: ["./setup.ts"]`.
- `setup.ts`: `import "@testing-library/jest-dom/vitest"` and `afterEach(cleanup)`.
- Packages: `@testing-library/react` 16.3.3 (supports React 18 and 19; requires `@testing-library/dom` 10 as an explicit dependency), `@testing-library/user-event` 14.6.7, `@testing-library/jest-dom`.
- With React 19, use `@testing-library/react` 16 or later. Versions before 16 were made for React 18 and can fail with `act`-related errors.

## Query priority

1. `getByRole(role, { name })`: the default for almost everything. `name` accepts an exact string or a regex.
2. `getByLabelText`: form fields, especially `<input type="password">`, which has no ARIA role.
3. `getByPlaceholderText`: only if there is no label (and that is already a problem to fix).
4. `getByText`: non-interactive content (paragraphs, messages).
5. `getByDisplayValue`: a filled field.
6. `getByAltText`, `getByTitle`.
7. `getByTestId`: last resort, for elements with no perceivable semantics.

Useful roles: `button`, `link`, `textbox` (input text/email/tel/url and textarea), `searchbox` (type="search"), `spinbutton` (type="number"), `checkbox`, `radio`, `switch`, `combobox` (includes a simple `<select>`), `listbox`, `option`, `dialog`, `alertdialog`, `alert`, `status`, `tab`, `tabpanel`, `heading` (with `{ level: 2 }`), `list`, `listitem`, `img`, `form` (only with an accessible name), `region` (only with a name), `navigation`, `main`.

`getByRole` options that solve hard cases: `{ hidden: true }` includes elements outside the accessibility tree, `{ expanded: true }`, `{ pressed: true }`, `{ selected: true }`, `{ checked: true }`, `{ current: "page" }`.

## Variants: get, query, find

- `getBy*`: must exist now; throws an error if it does not. Use by default.
- `queryBy*`: returns `null`; use it **only** to assert absence: `expect(screen.queryByRole("alert")).not.toBeInTheDocument()`.
- `findBy*`: returns a promise, waits up to 1000 ms by default. Use it for what appears after something asynchronous.
- `*AllBy*`: lists.

## user-event instead of fireEvent

```ts
const user = userEvent.setup();
await user.click(button);
await user.type(input, "text");
await user.keyboard("{Enter}");
await user.tab();
await user.clear(input);
await user.selectOptions(select, "sp");
```

`user-event` simulates the real sequence (pointerdown, mousedown, focus, pointerup, mouseup, click; keydown, keypress, input, keyup), moves focus, and respects `disabled` and `pointer-events: none`. `fireEvent` fires an isolated event: a `fireEvent.click` on a `disabled` button can still call handlers in some cases, and it never moves focus.

Always `await`. Call `userEvent.setup()` before rendering, once per test.

With fake timers (`vi.useFakeTimers()`), pass `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`, otherwise the interactions hang.

## The most valuable jest-dom matchers

- `toHaveAccessibleName("Delete file")`, `toHaveAccessibleDescription(/required/)`
- `toHaveFocus()`
- `toHaveAttribute("aria-expanded", "true")`, `toHaveAttribute("aria-invalid", "true")`
- `toBeDisabled()` / `toBeEnabled()` (note: `aria-disabled` does **not** count for `toBeDisabled`; assert the attribute)
- `toBeRequired()`, `toBeInvalid()` (considers `aria-invalid` and native validation)
- `toBeChecked()`, `toBePartiallyChecked()`
- `toHaveTextContent`, `toBeEmptyDOMElement`, `toBeVisible` (considers `hidden`, inline `display:none` and ancestors)
- `toHaveValue`, `toHaveDisplayValue`, `toHaveFormValues`

## Patterns for async code

**Controlled promise** to test the pending state:
```ts
function deferred() {
  let resolve!: () => void, reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const pending = deferred();
const onSave = vi.fn(() => pending.promise);
// ... click save
expect(button).toHaveTextContent("Saving…");
pending.resolve();
expect(await screen.findByText("Saved")).toBeInTheDocument();
```

**Failure and retry:** `vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce(undefined)`.

**Waiting for something to disappear:** `await waitForElementToBeRemoved(() => screen.queryByText("Loading…"))`.

**Do not use** `await new Promise(r => setTimeout(r, 100))`. It is slow and flaky.

## `act(...)` warnings

"An update to X inside a test was not wrapped in act(...)" almost always means: a state update happened **after** the test stopped waiting. Fixes, in order:
1. A user-event call is missing `await`.
2. A promise resolved after the last assertion: add `await screen.findBy...` for the final state.
3. An effect with a timer: use fake timers and advance them.
Wrapping everything in `act()` manually hides the symptom and does not solve it.

## Mocks

- Callbacks: `vi.fn()`. Assert with `toHaveBeenCalledTimes(1)` and `toHaveBeenCalledWith({...})`.
- Modules: `vi.mock("./api", () => ({ getUser: vi.fn() }))`. `vi.mock` is hoisted to the top of the file.
- `fetch`: `vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(data)))` and `vi.restoreAllMocks()` in `afterEach`. For many endpoints, MSW is better, but it is not available in the verifier.
- APIs that jsdom lacks: `window.matchMedia`, `ResizeObserver`, `IntersectionObserver`, `HTMLDialogElement.prototype.showModal`, `scrollIntoView`. Stub them in the test file itself with `vi.stubGlobal` or a prototype assignment, and document it.

## Anatomy of a good test file

1. A `setup()` function that renders and returns `user`, mocks and the main elements already queried by role.
2. One `describe` per component, tests named as behavior sentences in plain English.
3. One test per behavior; several `expect`s in the same test are normal when they describe the same behavior.
4. No snapshots of the whole DOM: they break on any markup change and nobody reviews the diff. A small, intentional snapshot is acceptable.
5. Coverage target: all the agreed ready-when criteria. Line percentage is not a criterion.

## What cannot be tested in jsdom

Layout, contrast, real computed CSS, visible focus, scroll, responsiveness, animations, real screen readers. Record them in the summary as "manual verification recommended" and, if possible, suggest Playwright with `@axe-core/playwright` for the user's project (see the measured verification guide).

What you can test instead of contrast: the arithmetic. A pure `contrastRatio()` helper asserting each declared token pair (see the `estilos-acessiveis` template) runs in jsdom and in the verifier.

## Other test traps seen in practice

- jsdom implements neither `showModal()`, `close()` nor the Esc behavior of `<dialog>`: polyfill them in the test setup and fire the `cancel` event yourself.
- Tests written for an immediate dialog removal break when the exit is animated. Make them async (`await waitFor(...)` or `findBy*`) and cover: reopen during exit, Esc during exit, and the reduced-motion shortcut.
- Styled radios with an invisible `<input>` on top time out when you click the label text; use `getByRole("radio", { name }).check()` (Playwright) or `user.click(screen.getByRole("radio", { name }))`.
- Test the pause-animations control through its state: `aria-pressed` toggles and `document.documentElement.dataset.motion` becomes `"off"`.
- Test a live region by asserting the **region** (`getByRole("status")`) gets the text, not the button.
- Hard-coded numbers in copy ("18 tests") go stale; derive them or do not print them.
