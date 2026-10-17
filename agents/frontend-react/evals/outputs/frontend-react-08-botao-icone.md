Not as it is. A button with only an icon has no accessible name unless you give it one, so a screen reader announces just "button" (and voice-control users cannot say "click delete"). That is one of the most common failures in React code.

## The fix

```tsx
<button type="button" aria-label="Delete invoice 1042" onClick={onDelete} className="icon-btn">
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20">
    {/* trash can path */}
  </svg>
</button>
```

What matters here:

- **Name on the button, not the icon.** `aria-label` goes on the `<button>`; the SVG gets `aria-hidden="true"` so it is not read twice. Make the name specific ("Delete invoice 1042"), not "OK" or just "Delete" when there are many rows. If the button ever shows visible text too, the name must contain that text (WCAG 2.5.3).
- **`type="button"`** so it never submits a surrounding form.
- **Use a real `<button>`**, not a `div` with `onClick`.

## The parts a name alone does not fix

- **Target size:** at least 24x24 CSS px (WCAG 2.2 AA, 2.5.8); aim for 44x44 on touch. Enlarge it with padding, not by enlarging the drawing: `.icon-btn { min-width: 44px; min-height: 44px; display: inline-grid; place-items: center; }`.
- **Contrast:** an icon that is the only indicator needs 3:1 against its background, and the focus ring needs 3:1 too.
- **Visible focus:** keep a `:focus-visible` ring from its own token; do not remove the outline.
- **A destructive action:** confirm it (a dialog that focuses "Cancel" first) or offer undo, and after the item is removed, move focus to the next item (or the previous one if it was last) and announce "Invoice deleted" in a `role="status"` region that already exists in the DOM.

## How I would check it

If you paste your component, I will send the complete files, CSS included, to the static check:

```json
{
  "tool": "a11y_check",
  "input": { "files": [{ "path": "InvoiceRow.tsx", "content": "…your full file…" }] }
}
```

That check flags a button with no accessible name as an error (note that `aria-hidden` on the icon does not count as a name). It is static: it does not see contrast, ring color or target size, so those I verify by computing token contrast in tests and listing the rest as "needs a browser" (axe-core and a keyboard pass).

## A test that locks it in

```tsx
it("the icon button has a specific accessible name", () => {
  render(<DeleteButton invoiceId="1042" onDelete={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Delete invoice 1042" })).toBeInTheDocument();
});
```

If the icon-only button were unnamed, that `getByRole` query would fail, which is exactly why queries by role double as an accessibility audit.

## Questions so I can give you the exact version

1. React 18 or 19, TypeScript or JavaScript?
2. How do you style it (Tailwind, CSS Modules, styled-components) and do you use an icon library or a component library (Radix, MUI, shadcn/ui)?
3. Is this button in a list or table, and does deleting need confirmation or undo?
