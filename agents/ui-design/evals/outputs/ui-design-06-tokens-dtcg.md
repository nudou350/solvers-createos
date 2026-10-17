Here are the text color tokens in the W3C DTCG format, in three layers, with a light file and a dark file. I assumed **CSS variables** as the destination and the **draft DTCG format** (colors as hex), which is the one most tools read today. If you tell me your tool (Tailwind, Style Dictionary, etc.), I can adapt names and format.

**Mapping of your request to the naming convention:** "primary text" is `color.text.default` and "secondary text" is `color.text.subtle`. Semantic names describe the role, so they stay the same in both themes; only the value changes.

**tokens.json (light theme: primitives + semantic)**

```json
{
  "$description": "Text color tokens (W3C DTCG, draft format). Primitives, then light-theme semantics.",
  "color": {
    "$type": "color",
    "white": { "$value": "#FFFFFF" },
    "gray": {
      "50":  { "$value": "#F9FAFB" },
      "400": { "$value": "#9CA3AF", "$description": "Do not use as text on white (2.54:1). Safe as text on gray.900 (6.99:1)." },
      "600": { "$value": "#4B5563" },
      "800": { "$value": "#1F2937" },
      "900": { "$value": "#111827" }
    },
    "text": {
      "default": { "$value": "{color.gray.900}", "$description": "Primary text. 17.74:1 on white." },
      "subtle":  { "$value": "{color.gray.600}", "$description": "Secondary and help text. 7.56:1 on white." }
    },
    "bg": {
      "surface": { "$value": "{color.white}", "$description": "Cards, forms, tables." }
    }
  }
}
```

**tokens.dark.json (dark theme: overrides the semantic layer only; load after tokens.json)**

```json
{
  "$description": "Dark theme overrides. Redefines semantic tokens only. Contrast measured on bg.canvas #111827.",
  "color": {
    "$type": "color",
    "text": {
      "default": { "$value": "{color.gray.50}",  "$description": "Primary text. 16.98:1 on gray.900." },
      "subtle":  { "$value": "{color.gray.400}", "$description": "Secondary text. 6.99:1 on gray.900." }
    },
    "bg": {
      "canvas":  { "$value": "{color.gray.900}" },
      "surface": { "$value": "{color.gray.800}" }
    }
  }
}
```

**Contrast of the text pairs** (values from the Solver's reference table and templates; I have not run the contrast check tool in this reply, so confirm them with `kind: "texto"` before shipping):

| Theme | Token | Pair | Ratio |
|---|---|---|---|
| Light | text.default | #111827 on #FFFFFF | 17.74:1 (AAA) |
| Light | text.subtle | #4B5563 on #FFFFFF | 7.56:1 (AAA) |
| Dark | text.default | #F9FAFB on #111827 | 16.98:1 (AAA) |
| Dark | text.subtle | #9CA3AF on #111827 | 6.99:1 (AAA) |

Why the dark value is different: the light secondary gray does not survive on a dark background (#6B7280, which passes on white at 4.83:1, falls to 3.67:1 on #111827). That is exactly why the semantic layer exists and why components must reference `color.text.subtle`, never a primitive.

**CSS output**

```css
:root {
  --color-gray-900: #111827;
  --color-gray-600: #4B5563;
  --color-text-default: var(--color-gray-900);
  --color-text-subtle: var(--color-gray-600);
}
[data-theme="dark"] {
  --color-text-default: var(--color-gray-50);
  --color-text-subtle: var(--color-gray-400);
}
```

**Figma mapping:** a "Primitives" collection (one mode, hidden from publishing) and a "Semantics" collection with **Light** and **Dark** modes, aliased to the primitives. Set the scope of the text variables to the text fill (`TEXT_FILL`) only.

**Notes**
- Every alias points to an existing token, so it should build without broken references.
- The file uses the draft format (hex colors). Converting to the stable 2025.10 version (color as an object with `colorSpace` and `components`) is mechanical; ask if your tool needs it.
- If your brand has its own grays, send me the hex values and I will rebuild the ramps from them and verify each pair.
