# Handoff: <screen or flow name>

- **Figma file:** <link with node-id>
- **Design version:** <date or version>
- **Design owner:** <name>
- **Component library in code:** <e.g. shadcn/ui, MUI, in-house>
- **Tokens:** tokens.json (+ tokens.dark.json)

## 1. Context

- Screen goal: <one sentence>
- Main user task: <one sentence>
- Primary action: <exact button label>
- Entry: <where the user comes from> | Exit: <where they go after success>

## 2. Layout by breakpoint

| Breakpoint | Columns / gutter / margin | Max width | What changes |
|---|---|---|---|
| 360px | 4 / 16px / 16px | 100% | <e.g. single-column form, footer with a fixed button> |
| 768px | 8 / 24px / 32px | <px> | <...> |
| 1280px | 12 / 24px / auto | <px> | <...> |

- [ ] Reflow at 320px with no horizontal scroll
- [ ] 200% zoom with no clipping

## 3. Components

| Component | Library / variant | Props | Differences from the library |
|---|---|---|---|
| <Button> | <primary, md> | <loading, fullWidth on mobile> | <none> |

## 4. States (per interactive component)

| Component | Default | Hover | Visible focus | Active | Disabled | Loading | Error |
|---|---|---|---|---|---|---|---|
| <Primary button> | <tokens> | <tokens> | <2px ring border.focus, offset 2px> | <tokens> | <tokens + reason> | <text "Saving…", aria-disabled="true", result in role="status"/"alert"> | n/a |

States marked **proposed** do not exist in Figma yet and need design validation.

## 5. Edge cases

- [ ] Long text: <wrapping or truncation rule per element>
- [ ] Empty state: <title, explanation, action>
- [ ] Loading: <skeleton or spinner, where>
- [ ] Field error: <exact messages>
- [ ] Page error / offline: <message and action>
- [ ] Extreme data: <currency $1,234,567.89 (Brazil: R$ 1.234.567,89), dates in the locale's format (Brazil: dd/mm/yyyy), lists of 1 and 500 items>
- [ ] Dark mode: <yes/no>

## 6. Accessibility

- [ ] Focus order matches visual order: <sequence>
- [ ] Landmarks: header, nav, main, footer
- [ ] Visible labels associated with every field
- [ ] Errors with `aria-invalid` and `aria-describedby`; focus on the first error on submit
- [ ] Icons without text have an accessible name; decorative ones have `aria-hidden`
- [ ] Targets at least 24x24px (goal 44x44px on touch)
- [ ] Contrast verified with contrast_check: <list of pairs, kind (texto, texto-grande, ui) and ratios>
- [ ] `prefers-reduced-motion` respected

## 7. Motion

| Element | Property | Duration | Curve | With reduced motion |
|---|---|---|---|---|
| <Modal> | opacity + scale 0.96 to 1 | duration.normal | easing.enter | opacity only |

## 8. Assets

| Asset | Format | Sizes | Alt text |
|---|---|---|---|
| <cart-icon> | SVG, currentColor | 24px | decorative |

## 9. Design open items

| Open item | Owner | Suggested deadline |
|---|---|---|
| <e.g. upload error state not designed> | <name> | <date> |
