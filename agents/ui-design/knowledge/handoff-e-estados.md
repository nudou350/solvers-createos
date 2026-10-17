---
title: Handoff, states and edge cases
source: W3C WCAG 2.2 (1.4.4, 1.4.10, 2.4.7) and established design-to-code handoff practice (the creator's synthesis)
source_url: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
source_date: 2026-10-02
tags: [handoff, states, edge-cases, responsive, motion]
---

## What a handoff needs to answer

A complete handoff lets the developer implement the screen without asking anything visual. Minimum structure:

1. **Context:** screen goal, main task, where the user comes from and where they go.
2. **Layout by breakpoint:** grid, maximum width, what stacks, what hides.
3. **Components:** which library component is used, with which variants and props; differences from the library.
4. **State matrix** for each interactive element, with tokens.
5. **Edge cases:** long content, empty, error, loading, extreme data.
6. **Accessibility:** focus order, labels, screen reader announcements, targets.
7. **Motion:** what animates, duration, curve, reduced-motion alternative.
8. **Assets:** icons and images, formats and alt text.
9. **Open items:** what has not been decided yet.

## Reference state matrix

| State | Button | Text field | Checkbox/Toggle | Link |
|---|---|---|---|---|
| Default | bg action.primary | border border.default (3:1) | border 3:1 | text.link underlined |
| Hover | bg action.primary-hover | border border.strong | border strong | thicker underline or hover color |
| Visible focus | 2px ring border.focus with 2px offset | ring or 2px border.focus border | ring on the control | ring or outline |
| Active/pressed | bg action.primary-active | n/a | n/a | active color |
| Filled | n/a | text text.default | checked: action.primary fill | visited (optional) |
| Disabled | bg and text disabled, cursor not-allowed | background disabled, text disabled | disabled | usually does not exist |
| Loading | spinner + text "Saving…", width kept, `aria-disabled="true"` | n/a | n/a | n/a |
| Error | n/a | border feedback.error + icon + message | group message | n/a |
| Read-only | n/a | no border or dashed border, selectable text | n/a | n/a |

### Rules tied to the states

- **Hover is not focus.** Both need to exist and be different; focus must be visible with the keyboard (`:focus-visible`) and have 3:1 against the background.
- **Disabled, sparingly.** A disabled button with no explanation is frustrating ("why can't I continue?"). Prefer to keep the button enabled and show the errors on submit, or explain the reason next to it. Disabled elements do not receive focus and a screen reader may skip them.
- **Loading keeps the button's width** (avoids layout jump) and blocks double submission. In code: `aria-disabled="true"` on the button, not `disabled` (`disabled` takes the button out of the Tab order and, if it was focused, focus falls to `body`); the text changes ("Save" → "Saving…"); the result is announced in a live region: `role="status"` for success ("Data saved") and `role="alert"` for error. If you want to use `aria-busy`, it goes on the form or on the region being updated, not on the button.
- **Field error:** message below the field, with an icon, saying what to do ("Enter an email in the format name@domain.com"), linked by `aria-describedby` and with `aria-invalid="true"`. Do not rely on red alone.
- **Validation:** validate on leaving the field (blur) or on submit, not on every keystroke; on submit with errors, move focus to the first invalid field or to an error summary at the top.

## Edge cases that always apply

Five groups, detailed below: text and content, data, quantity, time and network, and environment. Every variable text needs an explicit rule (wrap, truncate or scroll), and every list needs at least three states (empty, one item, many).

### Text and content

- A long person name ("Maria da Conceição Albuquerque dos Santos Pereira"), a product title with 120 characters, a long email with no spaces (wrap with `overflow-wrap: anywhere`).
- Define for each variable text: wrap at N lines, truncate with an ellipsis, or scroll. If truncating, the full text has to be accessible (a keyboard-accessible tooltip, a detail page or an accessible attribute).
- Translations are usually longer than the English source: Portuguese tends to run 20% to 30% longer, and for German reserve up to 35% more.

### Data

- Currency: use the locale's own format (`Intl.NumberFormat(locale, { style: 'currency', currency })`). Brazil-specific example: `R$ 1.234,56`, with `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`. Large amounts (R$ 1,234,567.89 in the US style, `R$ 1.234.567,89` in Brazil) must not break the card.
- Dates: use the locale's format. Brazilian example: `30/09/2026` (day/month/year) or `30 de set. de 2026`; times in 24h. Relative dates ("3 hours ago") with the full date accessible.
- Numbers: the thousands and decimal separators depend on the locale (in Brazil, a dot for thousands and a comma for decimals). Counters above 999 (e.g. "1.2k"; in Brazil, "1,2 mil").
- Phone, national ID and postal code (Brazil-specific examples: telephone, CPF and CEP): a `type="text"` field with `inputmode="numeric"` (numeric keyboard on mobile), a visible format hint (e.g. "Ex.: 123.456.789-09" for a Brazilian CPF), accept the value typed or pasted with or without punctuation and normalize it in code. Format on leaving the field (blur) and in display, not with a mask that rewrites the value on every keystroke: that breaks paste, undo and screen readers (the cursor jumps to the end).

### Quantity

- A list with 0 items (empty state), 1 item, a typical amount and many items (pagination, infinite scroll or "load more").
- Tables with many columns on mobile: turn them into cards, pin the first column with horizontal scroll, or hide secondary columns with a see-more option.

### Time and network

- Initial loading: a skeleton when the layout is predictable; a spinner for short actions; progress text for operations over 10 seconds.
- Slow response (over 1 second): immediate feedback on the control that was triggered.
- Network failure: a message with an action ("Couldn't load. Try again"). Never just "Error".
- Success: proportional confirmation (a toast for small actions, a success screen for purchases).

### Environment

- 200% zoom and system-enlarged text (WCAG 1.4.4) and reflow at 320px width with no horizontal scroll (WCAG 1.4.10).
- Dark mode, if it exists.
- `prefers-reduced-motion`: movement animations become a fade or nothing.
- Keyboard: every action reachable with Tab, Enter and Space; Esc closes modals and menus; focus trapped inside the modal while open and returned to the element that opened it on close.

## Motion

- Micro-interactions (hover, toggle): 100 to 150ms.
- Entry of menus and popovers: 150 to 200ms; panels and modals: 200 to 300ms. Exits about 20% to 30% faster than entries.
- Curves: `ease-out` (decelerating) for entries, `ease-in` for exits, `ease-in-out` for position changes on screen.
- Nothing above 400ms in frequent interactions; the product feels slow.

## Translating Figma for the dev

- Cite **tokens**, not values: "padding `space.inset.lg` (24px)".
- Convert auto layout into flexbox (direction, gap, padding, alignment, fill/hug).
- Point out **constraints** and resize behavior: what stretches, what stays fixed.
- List **component variants** as props: `<Button variant="primary" size="md" loading>`.
- Say what should **not** be copied from Dev Mode: absolute positions, fixed text widths, decimal values (15.5px) resulting from resizing.

## Assets

- Icons: SVG, 24px grid (16 and 20 for dense), consistent stroke (1.5 or 2px), `currentColor` to inherit the color. A decorative icon with `aria-hidden="true"`; an icon that is the only content of a button needs an accessible name.
- Images: WebP or AVIF with a fallback, 1x and 2x, a defined aspect ratio (avoids layout jump), alt text that describes the function rather than the appearance when the image is a link.
- Empty-state illustrations: optimized SVG.

## Open items: how to record them

List them at the end of the document, with an owner and a suggested deadline: "Upload error state not designed (proposed: feedback.error banner above the list, validate with design)". A handoff that is honest about what is missing is worth more than one that pretends to be complete.
