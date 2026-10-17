---
title: WCAG 2.2: the criteria that weigh most on React components
source: W3C, WCAG 2.2 (what's new and the Understanding documents)
source_url: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
source_date: 2026-10-02
tags: [wcag, wcag-2-2, target-size, focus, authentication]
---

## What WCAG 2.2 brought

Nine new criteria: 2.4.11 Focus Not Obscured (Minimum), AA; 2.4.12 Focus Not Obscured (Enhanced), AAA; 2.4.13 Focus Appearance, AAA; 2.5.7 Dragging Movements, AA; 2.5.8 Target Size (Minimum), AA; 3.2.6 Consistent Help, A; 3.3.7 Redundant Entry, A; 3.3.8 Accessible Authentication (Minimum), AA; 3.3.9 Accessible Authentication (Enhanced), AAA. Criterion 4.1.1 Parsing was removed as obsolete. Content that meets 2.2 also meets 2.1 and 2.0.

The published version is from October 5, 2023 (with an update in December 2024), and WCAG 2.2 was approved as the ISO/IEC 40500:2025 standard. WCAG 3 is still in draft: the conformance requirement today is WCAG 2.x.

## What automated checks miss: the CSS-level criteria

These fail often even when the markup is perfect. Details and fixes are in the design tokens guide.

- **1.4.3 Contrast (Minimum), AA:** 4.5:1 for text, 3:1 for large text (24 px, or 18.66 px bold). Text on gradients, images and translucent layers must be measured against the worst pixel behind it.
- **1.4.11 Non-text Contrast, AA:** 3:1 for the border of a form field, the focus ring and an icon that is the only indicator of state.
- **2.4.7 Focus Visible, AA:** a visible indicator, including on the skip link.
- **2.2.2 Pause, Stop, Hide, A:** motion that starts automatically and lasts more than 5 seconds needs a visible control to pause it. `prefers-reduced-motion` alone does not satisfy it.
- **4.1.3 Status Messages, AA:** "Copied", "Saved" and error messages must be announced through a live region (`role="status"` or `role="alert"`) that already exists in the DOM.
- **1.4.10 Reflow, AA:** no two-dimensional scroll at 320 CSS px. **1.4.12 Text Spacing, AA:** nothing is clipped when the user raises line, letter, word and paragraph spacing.

## 2.5.8 Target Size (Minimum)

The pointer target is at least 24 by 24 CSS pixels, with exceptions: **Spacing** (smaller targets are allowed if a 24 px circle centered on each one does not cross another target or the circle of another small target), **Equivalent** (the function exists in another control on the same page that meets the size), **Inline** (a target inside a sentence), **User agent control** (size set by the browser and not changed by the author) and **Essential**.

In the component: icon buttons with `min-width` and `min-height` of at least 24 px (recommend 44 px for touch) and `padding` to enlarge the clickable area without making the icon drawing bigger.

## 2.4.11 Focus Not Obscured (Minimum)

When a component receives keyboard focus, it must not be entirely hidden by author-created content. The sufficient technique from the W3C is `scroll-padding` on the scroll container with the height of the fixed elements. Partially hiding it is acceptable at AA; at AAA (2.4.12) the component must be fully visible. Testing warning: jsdom does not compute layout, so this is a manual check in the browser.

## 2.5.7 Dragging Movements

Every function that uses dragging needs an alternative with a single pointer, unless dragging is essential: "move up" and "move down" buttons in a reorderable list, or click to select and click on the destination. For sorting components and sliders, deliver the alternative and test it with the keyboard.

## 3.3.8 Accessible Authentication (Minimum)

No authentication step requires a cognitive function test (remembering a password, solving a puzzle), unless there is an alternative or a support mechanism; password managers and copy and paste count as support. In a login component: do not block pasting, use the correct `autoComplete` and offer to show the password. See the forms file.

## 3.3.7 Redundant Entry and 3.2.6 Consistent Help

3.3.7 (A): information already provided in the same flow must not be required again; prefill it or let the user choose it. 3.2.6 (A): when there is a help mechanism (contact, chat, help link) on several pages, it appears in the same relative position. In shared header and footer components, keep the order stable.
