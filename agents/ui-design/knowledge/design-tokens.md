---
title: Three-layer design tokens and the DTCG format
source: Design Tokens Community Group (Design Tokens Format Module 2025.10) and the Style Dictionary documentation
source_url: https://www.designtokens.org/TR/2025.10/format/
source_date: 2026-10-02
valid_until: 2027-01-31
tags: [tokens, dtcg, style-dictionary, figma, themes]
---

## Why three layers

Tokens are named design decisions, stored in a format that design and code tools can read. The three-layer structure separates what is a value from what is an intent:

1. **Primitives (or global, or "options"):** the catalog of available values. `color.blue.600 = #2563EB`, `space.4 = 16px`. The name describes the value. Nobody uses them directly in components.
2. **Semantic (or "decisions", or "alias"):** the role. `color.text.default = {color.gray.900}`, `color.action.primary.bg = {color.blue.600}`. The name describes the intent. This is the layer that changes between themes (light, dark, brand B).
3. **Component:** decisions specific to one component, which reference semantic tokens. `button.primary.bg = {color.action.primary.bg}`. Create these only when needed.

Golden rule: **components reference semantic tokens, semantic tokens reference primitives.** Skipping the semantic layer is the number one cause of dark themes that are impossible to implement.

## Naming convention

Recommended structure, from general to specific:

`[category].[property].[role/concept].[variant].[state]`

Examples:

- `color.text.default`, `color.text.subtle`, `color.text.disabled`, `color.text.inverse`, `color.text.link`
- `color.bg.canvas` (page background), `color.bg.surface` (cards), `color.bg.surface-raised` (menus, popovers), `color.bg.overlay` (modal scrim)
- `color.border.default`, `color.border.strong`, `color.border.focus`
- `color.action.primary.bg`, `color.action.primary.bg-hover`, `color.action.primary.bg-active`, `color.action.primary.text`
- `color.feedback.error.text`, `color.feedback.error.bg`, `color.feedback.error.border` (same for success, warning, info)
- `space.inset.sm|md|lg` (padding), `space.stack.xs..xl` (vertical), `space.inline.xs..md` (horizontal)
- `radius.sm|md|lg|full`, `shadow.sm|md|lg`, `duration.fast|normal|slow`, `easing.standard|enter|exit`
- `text.heading.lg`, `text.body.md`, `text.label.md` (composite typography tokens)

Good naming practices:

- Pick one language for the names and do not mix. English makes integration with libraries easier; if the team prefers another language, keep everything in that language.
- States as a suffix (`-hover`, `-active`, `-disabled`) or as the last segment; choose one and be consistent.
- Avoid names that describe appearance in the semantic layer: `color.text.gray` and `color.button.blue` lie as soon as the theme changes.
- A numeric scale for primitives (50 to 950 for color; 1, 2, 3... or 100, 200 for space) makes it easy to insert intermediate values.

## W3C DTCG format

The Design Tokens Community Group (DTCG) format is the interchange standard between design and code tools. The first stable version, 2025.10, was published in October 2025 (checked on 2026-10-02); Style Dictionary has first-class DTCG support since version 4 (5.5.5 requires Node 22 or higher) and its documentation says that the 2025.10 format is not yet fully supported, work in progress in v5. Recommended file extension: `.tokens` or `.tokens.json`; media type `application/design-tokens+json`. Essential rules:

- Each token is an object with `$value`. `$type` can be on the token or on the group (inherited by the children). `$description` is optional and recommended on semantic tokens.
- Properties that start with `$` are reserved; token and group names cannot start with `$` or contain `{`, `}` or `.`.
- Aliases use curly braces with the dot-separated path: `"$value": "{color.blue.600}"`.
- Main types: `color`, `dimension`, `fontFamily`, `fontWeight`, `duration`, `cubicBezier`, `number`; composite: `typography`, `shadow`, `border`, `transition`, `strokeStyle`, `gradient`.
### Color and dimension values, references and conversion

- `dimension`: in the earlier draft, a string with a unit (`"16px"`, `"1rem"`); in the stable 2025.10 version, an object `{ "value": 16, "unit": "px" }` (units `px` or `rem`).
- `color`: in the earlier draft, a hexadecimal string (`"#2563EB"`); in 2025.10, an object with `colorSpace` and `components`, and optionally `alpha` and `hex`: `{ "colorSpace": "srgb", "components": [0.145, 0.388, 0.922], "hex": "#2563eb" }`.
- References: curly braces for the whole token (`"{color.blue.600}"`) or a JSON pointer with `$ref` to a property (`"#/color/blue/600/$value/components/0"`). A circular reference is an error. Groups can inherit from another with `$extends`.
- Check which format the destination tool accepts and be consistent across the whole file. This Solver's templates use the draft format (hex and `"16px"`), the most widely accepted today; converting is mechanical: `components` are the sRGB channels from 0 to 1 (R, G and B divided by 255) and the dimension becomes `{ "value": <number>, "unit": "px" }`.
- The specification covers only the file format. Applying themes, transforming and generating per-platform output belong to a separate module (the resolver) or to the tool.

Minimal example (draft format, with hex):

```json
{
  "color": {
    "$type": "color",
    "blue": { "600": { "$value": "#2563EB" } },
    "text": {
      "link": { "$value": "{color.blue.600}", "$description": "Links in running text on light backgrounds" }
    }
  }
}
```

## Themes and modes

- **One set of primitives for all themes.** The dark theme does not create a new blue; it picks another tone from the same ramp.
- **One semantic file (or group) per mode**: `semantic.light.json`, `semantic.dark.json`, with the same token names and different values. In Style Dictionary, generate one CSS per mode under `:root` and `[data-theme="dark"]` selectors, or with `@media (prefers-color-scheme: dark)`.
- **In Figma:** a "Primitives" collection with one mode and hidden publishing (so designers do not use them directly), a "Semantics" collection with "Light" and "Dark" modes using aliases to the primitives, and a "Components" collection only if needed. Configure the variable scopes to reduce misuse (e.g. text colors only in the text fill scope, `TEXT_FILL`; spacing only in "Gap", `GAP`). Figma's "Gap" scope covers both the gap and the padding of auto layout; there is no separate padding scope, so you cannot restrict a token to padding alone.
- **Multi-brand:** same logic, with per-brand modes in the semantic layer.

## From audit to tokens: procedure

1. Start from the inventory of unique values (colors, spaces, sizes, radii, shadows).
2. Group close values (e.g. #1F2937 and #1E293B → a single gray 800). Differences under ~3% lightness are not intentional.
3. Fit each value onto a primitive scale; the ones that do not fit become candidates for elimination.
4. For each real use (main text, help text, field border...), create a semantic token and point it at the primitive corrected by the audit.
5. Check the contrast of all semantic text and border pairs with `contrast_check`, in each mode, using `kind: "texto"` for text and `kind: "ui"` for border and focus.
6. Only then create component tokens for specific variations.

Size goal for a first product version: 60 to 120 primitives (most of them colors), 30 to 50 semantic, 0 to 40 component.

## Output for code

Example of generated CSS:

```css
:root {
  --color-blue-600: #2563eb;
  --color-gray-900: #111827;
  --color-text-default: var(--color-gray-900);
  --color-action-primary-bg: var(--color-blue-600);
  --space-stack-md: 1rem;
}
[data-theme="dark"] {
  --color-text-default: var(--color-gray-50);
  --color-action-primary-bg: var(--color-blue-400);
}
```

- Keep the references (`var(--color-blue-600)`) in the generated CSS instead of resolving to hex; this makes it easier to debug where a color comes from. Style Dictionary does this with the `outputReferences: true` option.
- Tailwind: map the semantic tokens in `theme.extend` (or in `@theme` in Tailwind 4) as `bg-surface`, `text-subtle`, `border-focus`, pointing to the CSS variables, so the theme works without scattered `dark:` classes.

## Frequent mistakes

- Tokens for one-off values ("logo margin on the pricing page").
- An alias pointing to a group, not to a leaf token.
- Circular aliases or chains that are too long (more than 3 levels make debugging harder).
- Semantic tokens without `$description`: months later, nobody knows the difference between `subtle` and `muted`. Define and document just one.
- Forgetting state tokens: focus, disabled, selected, error.
- Renaming a published token without a deprecation period; keep the old one as an alias of the new one for one version.
