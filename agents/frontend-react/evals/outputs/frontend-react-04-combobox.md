I checked for a saved project profile first (`get_memory`). Nothing is stored yet, so I need to ask a few things. An autocomplete is the **combobox** pattern, the hardest one in WAI-ARIA and the one that most often ships broken, so the answers matter here.

## What I understood

A search field that suggests options as the user types. Markup and behavior for the pattern:
- `<input role="combobox" aria-expanded aria-controls aria-autocomplete="list" aria-activedescendant>` plus a `role="listbox"` with `role="option"` items and `aria-selected`.
- **Real focus stays on the input.** The highlighted option is shown through `aria-activedescendant`.
- ArrowDown/ArrowUp change the active option, Enter selects it, and Esc closes the list (a second Esc may clear).
- The count of results is announced in a `role="status"` region ("5 suggestions available"), debounced about 300 ms. Otherwise every keystroke produces an announcement.

My strong recommendation: **use a library** (React Aria `useComboBox`, Downshift, or the combobox of Radix/shadcn, MUI or Headless UI if you already have one). Reimplementing it usually comes out worse. I will hand-write it only if you have no library and don't want a new dependency.

## Questions

1. **Library:** do you already use Radix/shadcn, React Aria, Headless UI or MUI? If yes, I build on it.
2. **Data source:** a local array, or an async API? If async, how fast is it, and how should it behave on a network error?
3. **Selection model:** must the user pick one of the suggestions (select-only), or can they also submit free text, like a search box? What happens on selection (callback, navigation, fill the field)?
4. **Details:** minimum characters before suggesting? Show a "No results" message? Highlight the matched text?
5. **Stack:** React 19 or 18, TypeScript or JavaScript, Next.js/Vite/Remix, and your styling approach.
6. **Tests and ready-when:** are Vitest + Testing Library set up? What has to work for you to call it done?

## Draft behavior and edge cases

- Typing filters the options (or fetches them). Late responses are discarded using an `AbortController` or a request counter, so a slow old response can't overwrite a new one.
- Arrow keys wrap around, `aria-activedescendant` always points to an option ID that exists, and IDs come from `useId()`.
- Enter selects the active option and closes the list. Enter with no active option submits the typed text, if free text is allowed.
- Esc closes the list and keeps focus on the input.
- Click on an option selects it without the input losing focus (`onMouseDown` preventDefault).
- A loading state and an empty state ("No results for X") are announced through the status region, which exists from the first render.
- A visible label on the input, not only a placeholder, and `autoComplete="off"` so the browser's own list doesn't cover ours.

## Draft test list

1. The input has role `combobox` with its accessible name, and starts with `aria-expanded="false"`.
2. Typing opens the listbox and shows the matching options.
3. ArrowDown/ArrowUp move `aria-activedescendant` and wrap, while focus stays on the input.
4. Enter selects the active option, calls the callback and closes the list.
5. Esc closes the list and focus stays on the input.
6. The status region announces the result count, and "No results" for an empty search.
7. A click on an option selects it.
8. With an async source, a stale response doesn't replace a newer one, and an API failure shows a message.
9. Clearing the input closes the list.

## How I'll verify

I'll run `run_tests` and `a11y_check` on the complete files and report what really passed. Real screen reader behavior for `aria-activedescendant` varies, and contrast and the visible focus/active-option highlight need a browser check (axe-core plus a keyboard pass). I'll list those as not verified here.

Answer what you can, or say "do it your way" and I'll assume React 19 + TypeScript + Vitest, a local list, no extra library, and say so explicitly.
