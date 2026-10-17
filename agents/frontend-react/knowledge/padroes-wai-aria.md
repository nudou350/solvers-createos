---
title: WAI-ARIA patterns for React components
source: W3C WAI-ARIA (version 1.2) and the ARIA Authoring Practices Guide (APG)
source_url: https://www.w3.org/WAI/standards-guidelines/aria/
source_date: 2026-10-02
trial: true
tags: [aria, apg, dialog, tabs, combobox, menu, accessibility]
---

# WAI-ARIA patterns for React components

A practical reference to the WAI-ARIA Authoring Practices (APG) patterns that show up most often in React projects. For each one: when to use it, minimum markup, required keyboard behavior and pitfalls. General rule: **native element first**. ARIA changes what the screen reader announces but adds no behavior; every `role` you add becomes a keyboard promise you have to keep. The current recommendation is WAI-ARIA 1.2 (June 2023); 1.3 is in draft.

## The five rules of ARIA, in practice

1. If a native element with the right semantics and behavior exists, use it: `<button>`, `<a href>`, `<input type="checkbox">`, `<select>`, `<dialog>`, `<details>/<summary>`.
2. Do not change native semantics unnecessarily: `<h2 role="button">` is wrong; use `<h2><button>...</button></h2>` (the accordion pattern).
3. Every interactive control with ARIA must be operable by keyboard.
4. Do not use `role="presentation"` or `aria-hidden="true"` on a focusable element. A button hidden from the screen reader but reachable by Tab becomes a "ghost focus".
5. Every interactive element needs an accessible name.

Consequence: "no ARIA is better than bad ARIA". The 2026 WebAIM Million report (February) measured 59.1 detected errors per page on pages with ARIA against 42 on pages without ARIA, and more than 133 ARIA attributes per page on average. The report itself notes this is a correlation: pages with ARIA tend to be more complex. The practical message still holds: every ARIA attribute is a behavior promise that the code has to keep.

## Dialog (modal)

**When:** content that blocks interaction with the rest of the page until it is resolved (a confirmation, a short form).

**Recommended markup:** a native `<dialog>` opened with `ref.current.showModal()`. The browser gives you: focus trapped inside the modal, an inert background (implicit `inert`), Esc fires the `cancel` event and closes it, a stylable `::backdrop`, and the `dialog` role with implicit `aria-modal`.

```tsx
<dialog ref={ref} aria-labelledby={titleId} onClose={onClose}>
  <h2 id={titleId}>Delete file?</h2>
  <p id={descId}>This action cannot be undone.</p>
  ...
</dialog>
```

**Focus:** on open, it goes to the first focusable element, or to the element with `autoFocus`. In a destructive confirmation, focus "Cancel", never "Delete". On close, a modal `<dialog>` returns focus to the element that was focused before in current browsers; even so, keep the trigger in a ref and return focus explicitly if the trigger may have been removed from the DOM.

**Pitfalls:**
- jsdom has partial support for `<dialog>`: `showModal()` may not exist. In tests, add a minimal polyfill in the setup (`HTMLDialogElement.prototype.showModal = function () { this.open = true }`) or test through the `open` attribute. Do not conclude the component is wrong just because jsdom does not implement it.
- Do not render `<dialog open>` directly through the attribute: it opens as non-modal (no focus trap, no inert).
- Closing by clicking the backdrop is not required by the APG, but if you implement it, check that a click inside the content does not close it (compare `event.target === dialogRef.current`).
- An animated exit needs the dialog to stay open while the animation plays, then `close()`, restoring scroll and returning focus (see the visual polish guide, section 6). Reopening during the exit cancels the timer, Esc during the exit must not call `onClose` twice, and with reduced or paused motion the exit phase is skipped.
- For backdrop click, require `pointerdown` and `click` on the `<dialog>` itself; otherwise dragging a text selection out of a field closes the modal.
- Avoid scrolling the page behind it: `document.body.style.overflow = "hidden"` while open, restored on close.

**Alert dialog:** for critical confirmations, `role="alertdialog"` with `aria-describedby` pointing at the message. The screen reader announces the description automatically on open.

## Disclosure (show/hide)

**When:** a section that expands (a simple FAQ, "show more filters").

**Option 1:** native `<details><summary>`. Zero JavaScript, keyboard solved. Limitation: animation and external state control are harder.

**Option 2:** button + region.

```tsx
<button type="button" aria-expanded={open} aria-controls={panelId} onClick={toggle}>Filters</button>
<div id={panelId} hidden={!open}>...</div>
```

Keyboard: Enter and Space (free with `<button>`). Use `hidden` (not just an opacity CSS rule) to take the content out of the accessibility tree when closed.

## Accordion

A group of disclosures with headings. Each heading is `<hN><button aria-expanded aria-controls>`. The panel optionally has `role="region"` and `aria-labelledby` pointing at the button (use `region` only with up to about 6 panels; more than that clutters landmark navigation). Up/down arrows between headings are **optional** in the APG; Tab is already enough.

## Tabs

**When:** alternating panels in the same space, where only one appears at a time. If each "tab" leads to a different URL, it is not tabs: it is navigation with links and `aria-current="page"`.

**Markup:** `role="tablist"` (with `aria-label` or `aria-labelledby`), children `role="tab"` with `aria-selected` and `aria-controls`, panels `role="tabpanel"` with `aria-labelledby` and `tabIndex={0}` if the panel has no focusable element at the start.

**Keyboard (required):** only the active tab is in the Tab order (`tabIndex={0}`; the others `-1`; the *roving tabindex* technique). Left/right arrows move between tabs (wrapping around), Home/End go to the first/last one. Automatic activation (on focus) is the recommended default when the panel loads fast; manual activation (Enter/Space) when loading the panel is expensive.

**Classic pitfall:** all tabs with `tabIndex={0}` and no arrow keys. It works "sort of" with Tab, but contradicts the `tab` role, and the screen reader announces arrow-key instructions that do not work.

## Menu button

**When:** a button that opens a list of **actions** (Edit, Duplicate, Delete), like a desktop application menu.

**Do not use it for:** site navigation (use a list of links in a disclosure) or for choosing a value in a form (use `<select>` or listbox/combobox).

**Markup:** a button with `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`; a `role="menu"` list with `role="menuitem"` items. Keyboard: Enter/Space/down arrow open it and focus the first item; arrows navigate; Esc closes it and returns focus to the button; Tab closes the menu. Typing a letter moves to the item that starts with it (*typeahead*). That is a lot: if the project has Radix or React Aria, use their `DropdownMenu`/`Menu`.

## Combobox (autocomplete)

The hardest pattern and the one that shows up broken most often. Markup: `<input role="combobox" aria-expanded aria-controls aria-autocomplete="list" aria-activedescendant>` + `role="listbox"` with `role="option"` and `aria-selected`. Real focus **stays on the input**; the "active" option is indicated by `aria-activedescendant`. Arrows change the active option, Enter selects, Esc closes (and a second Esc optionally clears).

Strong recommendation: use React Aria `useComboBox`, Downshift or the combobox from the project's library. If you implement it by hand, announce the result count in a `role="status"` region ("5 suggestions available") with a debounce of about 300 ms, otherwise every keystroke produces an announcement.

## Live regions (status and alert)

- `role="status"` (equivalent to `aria-live="polite"`): non-urgent messages, "Saved", "3 results".
- `role="alert"` (equivalent to `aria-live="assertive"`): interrupting errors, "Failed to save".
- The region must **exist in the DOM before** the text goes in. Render the empty container and swap the content. Mounting `<div role="alert">Error</div>` from scratch works in most current screen readers, but not all; the persistent container is the safe pattern.
- Toasts that disappear on their own: at least 5 s visible, pause on hover/focus, and never put an important action only in the toast (WCAG 2.2.1, timing adjustable).

## Accessible name: order of computation

The browser uses, in this order: `aria-labelledby` → `aria-label` → native content (`<label>`, button text, `alt`) → `title`. Consequences:
- `aria-label` on a button with visible text **replaces** the text. If they differ, voice-command users ("click Save") fail. WCAG 2.5.3 requires the name to contain the visible text.
- Icon-only button: `<button aria-label="Close"><svg aria-hidden="true" /></button>`.
- `placeholder` is not a reliable label: it disappears when typing and has low contrast.
