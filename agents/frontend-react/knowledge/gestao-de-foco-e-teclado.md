---
title: Focus and keyboard management in React
source: WCAG 2.2 (W3C), React 19 documentation and the ARIA Authoring Practices Guide
source_url: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
source_date: 2026-10-02
valid_until: 2027-01-31
tags: [focus, keyboard, roving-tabindex, dialog, spa]
---

# Focus and keyboard management in React

Focus is the "cursor position" of someone navigating by keyboard or screen reader. When React removes, swaps or moves elements, focus can fall to `<body>` and the user is sent back to the top of the page without warning. This guide lists where focus should go in each situation and how to implement it without hacks.

## Principles

1. **Focus never disappears.** If the focused element is about to vanish, move focus before (or right after) to a logical destination.
2. **Focus only moves because of a user action.** Do not steal focus on data loading, timers or background updates (WCAG 3.2.1 and 3.2.2).
3. **Tab order = visual order.** Do not use positive `tabIndex` (1, 2, 3...): it creates a parallel order that is impossible to maintain. Only `0` (joins the natural order) and `-1` (focusable by code, outside Tab).
4. **Visible focus, always** (WCAG 2.4.7). Never `outline: none` without a replacement. Use `:focus-visible` to show the ring only for keyboard navigation:
   ```css
   :focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
   ```
   WCAG 2.2 added 2.4.11 (AA): when a component receives keyboard focus, it must not be entirely hidden by author-created content (a sticky header, a cookie banner). Partially hiding it is allowed at AA; AAA (2.4.12) requires it to be fully visible. The sufficient technique from the W3C is `scroll-padding` (for example, `html { scroll-padding-top: 5rem }` matching the header height); other ways out: make the sticky element dismissible, move focus to it, or push the content instead of overlapping it.

## Table of focus destinations

| Situation | Where focus goes |
|---|---|
| Open a modal | The first useful control inside it; in a destructive confirmation, "Cancel" |
| Close a modal (any way) | The button that opened the modal |
| Open a menu | The first menu item |
| Close a menu with Esc | The menu button |
| Form submit with an error | The first invalid field (or the error summary, in long forms) |
| Delete a list item | The next item; if it was the last, the previous one; if the list became empty, the list heading or the "Add" button |
| Route navigation in an SPA | The `<h1>` of the new page (with `tabIndex={-1}`) or a "skip to content" link |
| Load more items ("Show more") | The first new item |
| Next step of a wizard | The heading of the new step |
| Close a toast/banner | The previously focused element, if it still exists; otherwise the main content |

## Implementation: refs and the right moment

**Focus in the handler, when the element already exists:**
```tsx
function handleSubmit() {
  if (errors.email) { emailRef.current?.focus(); return; }
}
```
It works because the input is already in the DOM. It is synchronous and easy to test.

**Focus on an element that is about to mount:** the element only exists after the render. Options:
- `autoFocus` on the element that mounts (React calls `focus()` on mount). Good for the first field of a modal.
- `useEffect(() => { if (open) firstRef.current?.focus(); }, [open]);`
- `flushSync(() => setOpen(true)); firstRef.current?.focus();` when you need to focus right after the update inside the same handler (use sparingly).

**Ref callback (React 19 lets it return a cleanup):**
```tsx
<input ref={(node) => { node?.focus(); return () => {/* cleanup */}; }} />
```
Careful: an inline callback is recreated on every render and runs again. For focus, that refocuses on every render. Use `useCallback` or prefer `autoFocus`.

**Return focus to the trigger:**
```tsx
const triggerRef = useRef<HTMLElement | null>(null);
function open() { triggerRef.current = document.activeElement as HTMLElement; setOpen(true); }
function close() { setOpen(false); triggerRef.current?.focus(); }
```
If the trigger may have been unmounted (for example, the item was deleted by the modal itself), have a fallback destination.

## Roving tabindex

Used in tabs, toolbars, custom radio groups, grids. Only one item in the group has `tabIndex={0}`; the others have `-1`. Arrows change which one is `0` and call `.focus()`.

```tsx
function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
  const last = items.length - 1;
  const next =
    e.key === "ArrowRight" ? (active === last ? 0 : active + 1) :
    e.key === "ArrowLeft"  ? (active === 0 ? last : active - 1) :
    e.key === "Home" ? 0 : e.key === "End" ? last : null;
  if (next === null) return;
  e.preventDefault();
  setActive(next);
  refs.current[next]?.focus();
}
```

Result: Tab enters the group once and leaves; arrows navigate inside it. Alternative: `aria-activedescendant` (focus stays on the container, used in combobox and listbox).

## Focus trap

Only for modals. Prefer `<dialog>.showModal()`, which traps focus and makes the rest inert natively. Without `<dialog>`, use the `inert` attribute on the content outside the modal (supported in modern browsers since 2023; in React 19, `inert` is accepted as a boolean prop). Avoid a hand-written focus trap that only intercepts Tab: it does not stop screen readers from leaving the modal with the virtual cursor.

## Keys: what each pattern requires

- **Button:** Enter and Space. A native `<button>` already does both. A `div` with `onClick` does neither.
- **Link:** Enter only. Do not intercept Space (it scrolls the page).
- **Checkbox/switch:** Space. Switch = `<button role="switch" aria-checked>`.
- **Dialog:** Esc closes.
- **Menu, tabs, listbox, radio group:** arrows, Home, End.
- **Grid/interactive table:** arrows in two dimensions, Page Up/Down optional.

Single-key shortcuts (for example "j" for next) must be possible to turn off or remap, or only work while the component is focused (WCAG 2.1.4).

## SPA navigation (Next.js, React Router)

After a route change, focus stays on the link that was clicked, which may no longer exist, and the screen reader does not announce the new page. Solutions:
- The Next.js App Router already announces the route change through a live region (the route announcer) using the `<title>` or the first `<h1>`; make sure they exist and are unique.
- In React Router, move focus to the new page's `<h1>` (with `tabIndex={-1}` and the `outline` handled) in a layout effect of the page.
- Always have "Skip to main content" as the first link on the page.

## Testing focus

```ts
await user.tab();
expect(screen.getByRole("textbox", { name: "Email" })).toHaveFocus();
await user.keyboard("{Escape}");
expect(screen.getByRole("button", { name: "Open filters" })).toHaveFocus();
```

- `user.tab()` respects `tabIndex` and disabled elements, like the browser.
- `fireEvent.keyDown` does not move focus; use `user.keyboard`.
- jsdom does not compute layout: tests for "visible focus" and for overlap by a sticky header are not possible at unit level. Record them as a manual check.
- To test the full Tab order, run a sequence of `user.tab()` with `toHaveFocus()` at each step; it is cheap and catches stray `tabIndex`.
