Test what the user perceives, not how the component is built. Testing Library's rule of thumb: the more your tests resemble how the software is used, the more confidence they give you.

## The four habits

1. **Find elements like a user does.** Query priority: `getByRole(role, { name })` first, then `getByLabelText` (needed for `<input type="password">`, which has no role), then `getByText`. `getByTestId` is a last resort. If you cannot find an element by role and name, a screen reader cannot either, so the test doubles as an accessibility audit.
2. **Interact like a user does.** Use `user-event`, always with `await`, and never `fireEvent`: `fireEvent.click` does not move focus or run the real sequence of events, so tests pass while the component fails in a browser.
3. **Assert what the user perceives:** text, role, focus, ARIA state. Useful matchers: `toHaveAccessibleName`, `toHaveAccessibleDescription`, `toHaveFocus`, `toHaveAttribute("aria-expanded", "true")`, `toBeRequired`.
4. **Never assert internals:** no checking that `setState` was called, no class names like `is-open`, no component instance or hook calls. Those break on any refactor while the behavior is unchanged. Also avoid whole-DOM snapshots and `toBeInTheDocument()` as the only assertion (it proves it rendered, not that it works).

## Example: brittle vs. behavioral

```tsx
// Brittle: tied to implementation
expect(container.querySelector(".panel")).toHaveClass("is-open");

// Behavioral: what the user sees and can do
const user = userEvent.setup();
const toggle = screen.getByRole("button", { name: "Filters" });
await user.click(toggle);
expect(toggle).toHaveAttribute("aria-expanded", "true");
expect(screen.getByRole("region", { name: "Filters" })).toBeVisible();
await user.keyboard("{Escape}");
expect(toggle).toHaveFocus();
```

The second one survives a rewrite from `useState` to `useReducer`, a CSS refactor or a new library, and fails only when the behavior breaks.

## Async and states

- `findBy*` for what appears later, `queryBy*` only to assert absence, `waitFor` for assertions that are not "appears". No `setTimeout` in tests.
- For the loading state, use a controlled promise (`deferred()`), assert "Saving…", resolve it, then assert the result. Cover failure and repeated clicks too, since most generated components only handle the happy path.
- Mock the boundaries (`vi.fn()` for callbacks, `fetch` or the API module), not your own child components.
- Many "act" warnings mean a missing `await`. Do not wrap everything in `act()`.

## What jsdom cannot test

Layout, real contrast, visible focus ring, animation and a real screen reader. For these, keep the arithmetic in tests where possible (a `contrastRatio()` helper for token pairs) and plan axe-core with Playwright plus a keyboard pass in a browser.

## How I would work with you on a real component

Tell me:

1. Which component (or paste it) and what must work for you to call it done?
2. React 18 or 19, and Vitest or Jest? (I deliver Vitest + Testing Library; if you use Jest, replace `vi` with `jest`.)
3. Does it fetch data, open overlays or manage focus?

Then I will write the list of test cases as plain sentences ("with empty fields shows the error and focuses the first invalid field") for you to approve before any code. After that I write the tests, run them on the server with `run_tests`, and only then tell you they pass.
