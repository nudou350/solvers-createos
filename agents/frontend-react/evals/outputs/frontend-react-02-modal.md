I checked for a saved project profile first (`get_memory`). Nothing is stored yet, so I have a few quick questions before coding.

## What I understood

A **confirmation modal** that blocks the page until the user decides. The pattern is **dialog (modal)**, ideally the native `<dialog>` opened with `showModal()`. If the confirmation is destructive (delete, discard), it becomes an **alert dialog** (`role="alertdialog"` with `aria-describedby` on the message).

The native element gives the following for free:
- Focus is trapped inside the dialog.
- The page behind it is inert.
- Esc fires `cancel`.
- Browsers return focus to the trigger on close, and I'll also return it explicitly.

## Questions

1. **Stack:** React 19 or 18? TypeScript or JavaScript? Next.js, Vite or Remix?
2. **Primitives library:** do you already use Radix/shadcn (AlertDialog), React Aria, Headless UI or MUI? If so I build on that instead of hand-writing a dialog, so it matches the rest of the project.
3. **Action:** what does Confirm do? If it is async (an API call), the component handles pending ("Deleting…") and failure.
4. **API shape:** do you prefer the parent to control it (`open` / `onClose`), or a self-contained component with a trigger button inside?
5. **Texts:** fixed in English, or passed as props for i18n? (Default: props with English defaults.)
6. **Styling and motion:** which styling approach? Do you want an animated exit? That changes the implementation, because the dialog must stay open until the animation ends.
7. **Ready when:** anything beyond the behaviors below?

## Draft behavior (testable)

- Opening moves focus inside the dialog, to **Cancel** and never to the destructive button.
- `aria-labelledby` points at the title and `aria-describedby` at the message. Both IDs come from `useId()`.
- Esc closes it and focus returns to the button that opened it.
- Clicking the backdrop closes it, but only if `pointerdown` and `click` both land on the `<dialog>` itself. Dragging a text selection out of the dialog does not close it.
- Clicking inside the content does not close it.
- Confirm calls `onConfirm` once. A double click does nothing the second time (`useRef` guard).
- While pending, the button shows "Deleting…" with `aria-disabled="true"` instead of `disabled`, so focus is not lost.
- A failure shows a generic message in an always-present `role="alert"` container, and the dialog stays open for a retry.
- Button texts describe the action ("Delete file" and "Cancel", not "OK").
- Page scroll is locked while open and restored on close.

## Draft test list

1. The dialog has role `alertdialog`/`dialog` with its accessible name and description.
2. Opening focuses Cancel.
3. Esc closes it and the trigger has focus.
4. Cancel closes it without calling `onConfirm`.
5. Confirm calls `onConfirm` once, including after a double click.
6. The pending state shows its text and `aria-disabled`.
7. A rejection shows the alert and keeps the dialog open.
8. Backdrop click closes it, while a click inside the content does not.
9. Reopening works and the body scroll is restored.

jsdom does not implement `showModal()`, `close()` or Esc for `<dialog>`, so the test setup polyfills them and fires `cancel` by hand. A missing method in jsdom does not mean the component is wrong.

## What I will and won't be able to prove

I'll run `run_tests` and `a11y_check` on the complete files and tell you the real result. They don't cover contrast of the buttons, focus ring visibility or a real screen reader, so I'll list those for an axe-core run and a keyboard pass in the browser.

Reply with your answers, or "do it your way" and I'll assume React 19 + TypeScript + Vitest + Testing Library, neutral CSS, and a parent-controlled `open`, and say so in the summary.
