# Step 3: Define design tokens

## Goal

Turn the interface values (already corrected in the audit) into an organized, predictably named set of design tokens, delivered as JSON in the W3C Design Tokens (DTCG) format. The result has to work for both Figma (variables) and code (CSS custom properties, Tailwind, Style Dictionary). Good tokens reduce decisions: whoever designs or codes picks from a few options with names that state the intent.

## What to ask the user

If the profile already answers destination, themes and design system, do not ask again: confirm in one line.

1. **Where will the tokens live in code?** Plain CSS variables, Tailwind, Style Dictionary, styled-components, React Native. This defines the exported naming convention (kebab-case for CSS, camelCase for JS).
2. **Themes.** Light only, light and dark, multiple brands? Themes change only the semantic layer; confirm how many.
3. **Existing naming.** If the team already uses names (e.g. `primary-500`), keep what works and explain what changes.
4. **Density.** Is there a compact version (tables, admin panels)? If so, plan spacing tokens per mode.

If the user does not know, adopt the default: CSS variables, light and dark themes, no alternate density.

## How to run

1. **Layer 1: primitives (raw values).** Names describe the value, not the use. Color palette on a 50 to 950 scale (or 100 to 900), numeric spacing scale, font sizes, radii, shadows, durations.
   - `color.blue.600`, `space.4` (16px if the base is 4), `font.size.300`, `radius.md`.
   - Generate the color ramps from the colors corrected in step 2. Make sure each ramp has at least one tone that passes 4.5:1 on white and one that passes on the dark background. Confirm with `run_tool` `contrast_check` the pairs that will be used as text (`kind: "texto"`) and as border or focus (`kind: "ui"`).
2. **Layer 2: semantic (intent).** Names describe the role, and the value is a reference to a primitive using the alias syntax `{color.blue.600}`.
   - Recommended structure: `category.property.role.variant.state`, for example `color.text.default`, `color.text.subtle`, `color.text.inverse`, `color.bg.surface`, `color.bg.surface-raised`, `color.border.default`, `color.border.focus`, `color.action.primary.bg`, `color.action.primary.bg-hover`, `color.feedback.error.text`.
   - Dark mode redefines only this layer. Components never reference primitives directly.
   - Semantic spacing: `space.inset.sm/md/lg` (inner padding), `space.stack.xs..xl` (vertical between elements), `space.inline.xs..md` (horizontal).
   - Semantic typography as composite tokens of type `typography`: `text.display`, `text.heading.lg/md/sm`, `text.body.md/sm`, `text.label`, `text.caption`.
3. **Layer 3: component (optional and selective).** Create these only when a component needs to vary without affecting the rest: `button.primary.bg`, `button.height.md`, `input.border.default`, `input.border.error`. Do not create a component token for every property of every component; that becomes a second stylesheet nobody can maintain.
4. **DTCG format.** Each token is an object with `$value` and `$type` (`color`, `dimension`, `fontFamily`, `fontWeight`, `duration`, `cubicBezier`, `shadow`, `typography`, `number`). `$type` can be declared on the group and inherited. Use `$description` on the semantic tokens to say when to use them. There are two value formats, and you must pick one and keep it across the whole file: the draft format (color as hexadecimal, dimension as a string like `"16px"`), which tools read today, and the stable 2025.10 version of the specification (color as an object with `colorSpace` and `components`, dimension as `{ "value": 16, "unit": "px" }`). Ask or confirm which one the profile's destination reads: Style Dictionary only has full support for the draft format from version 4 onward, and 2025.10 is in progress there. When in doubt, deliver the draft format and say that converting to 2025.10 is mechanical. Themes: one file per mode or one group per mode, depending on the destination tool.
5. **Start from the templates** `tokens` and `tokens-escuro` (the dark-theme tokens; `get_template`) and adapt the values to the colors corrected in step 2. Do not hand over the template without adapting it. They use hexadecimal color and string dimensions with a unit (the draft format, the most widely accepted by tools); if the profile's destination already reads version 2025.10, convert as described in the knowledge base (`search_knowledge` "DTCG 2025.10").
6. **Map to Figma.** Explain how to create the variable collections: a "Primitives" collection (one mode, hidden from publishing), a "Semantics" collection (Light and Dark modes, with aliases to the primitives), and the right scopes (text colors only in the text fill scope, `TEXT_FILL`; spacing only in "Gap", `GAP`, which in Figma covers both the gap and the padding of auto layout; there is no separate scope for padding).
7. **Show the CSS output** for 5 to 10 example tokens, so the dev can see how it looks (`--color-text-default: var(--color-gray-900);`).
8. **Validate the JSON** mentally and, if possible, confirm that every alias points to an existing token. A broken alias breaks the Style Dictionary build.

## Common mistakes

- **Naming by value in the semantic layer** (`color.text.gray-700`). When the dark theme changes the value, the name starts to lie.
- **Naming by color in the action layer** (`button.blue`). Use `action.primary`.
- **Too many tokens.** More than 30 to 40 semantic color tokens in a first version usually means one-off variations became tokens. Consolidate.
- **Skipping the semantic layer** and binding components straight to primitives. That rules out a dark theme.
- **Mixing px and rem with no rule.** Recommend rem for typography in code (it respects user zoom) and document the 16px base.
- **Forgetting focus, disabled and error tokens.** These are the ones most often missing from the handoff.
- **Circular alias** (`a -> b -> a`) or an alias to a group instead of a token.

## result_summary format

```
DESTINATION: <CSS vars | Tailwind | Style Dictionary | ...>; THEMES: <list>
PRIMITIVES: <n> (colors: <ramps>; space: <scale>; font: <scale>; radius; shadow)
SEMANTIC: <n> (list of the main ones with alias)
COMPONENT: <n> (list)
CONTRAST OF TEXT PAIRS: <pair> = <ratio> (contrast_check)
FILE: tokens.json delivered (DTCG, <dimension format>)
FIGMA MAPPING: <collections and modes>
```
