---
title: WCAG 2.2: what changes for people who design interfaces
source: W3C, WCAG 2.2 (what's new and the Understanding documents)
source_url: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
source_date: 2026-10-02
tags: [wcag-2-2, focus, authentication, dragging, help]
---

## The nine new criteria in WCAG 2.2

2.4.11 Focus Not Obscured (Minimum), AA; 2.4.12 Focus Not Obscured (Enhanced), AAA; 2.4.13 Focus Appearance, AAA; 2.5.7 Dragging Movements, AA; 2.5.8 Target Size (Minimum), AA; 3.2.6 Consistent Help, A; 3.3.7 Redundant Entry, A; 3.3.8 Accessible Authentication (Minimum), AA; 3.3.9 Accessible Authentication (Enhanced), AAA. Criterion 4.1.1 Parsing was removed as obsolete. WCAG 2.2 was published on October 5, 2023 and approved as the ISO/IEC 40500:2025 standard. Meeting 2.2 also meets 2.1 and 2.0. WCAG 3 is still in an early draft: the conformance requirement is 2.x.

## Focus that does not disappear behind fixed elements (2.4.11)

When a component receives keyboard focus, it cannot be entirely hidden by author-created content. Partially hiding it is accepted at AA; at AAA the component is fully visible. For the designer, the risk is in fixed headers and footers, cookie banners and sticky action bars: design with reserved scroll space (in code, `scroll-padding`), make the fixed element dismissible, move focus to it when it appears, or push the content instead of overlaying it.

## Dragging needs an alternative (2.5.7)

Every function that depends on dragging (reordering a list, moving a card on a board, a slider) needs an alternative with a single pointer, unless dragging is essential. In the handoff, specify the "move up and down" buttons, click to select and click the destination, or the numeric field next to the slider, with their respective states.

## Login and signup: accessible authentication (3.3.8) and redundant entry (3.3.7)

No authentication step should require a cognitive function test (remembering a password, solving a puzzle, transcribing a code) without an alternative or a support mechanism. Password managers and copy and paste count as support. In design: password fields that accept paste, a show-password button, no puzzle CAPTCHA without an alternative, and a one-time code that can be pasted or autofilled.

Redundant entry (3.3.7): do not ask again for what the user already provided in the same flow (billing address same as delivery address, repeated email); prefill it or offer to pick the previous value.

## Consistent help (3.2.6) and focus appearance (2.4.13)

If there is a help mechanism (contact, chat, help link) on several pages, it stays in the same relative position on them: fix this in the header or footer component. Criterion 2.4.13 (AAA) asks that, when the author designs the focus indicator, an area of it be at least as large as a 2 CSS pixel thick outline around the unfocused component, with a contrast ratio of at least 3:1 between the same pixels in the focused and unfocused states; it does not apply to the browser's default indicator when the author has not altered it. As a quality goal, design a 2px ring with an offset and 3:1 against the background: this also meets non-text contrast (1.4.11, AA).
