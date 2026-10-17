**Short answer: the format is valid, but I would not use it with Style Dictionary yet.**

- Version **2025.10** is the first stable release of the DTCG specification, published in October 2025. In it, a color is an **object** with `colorSpace` and `components` (optionally `alpha` and `hex`), and a dimension is an object `{ "value": 16, "unit": "px" }`.
- **Style Dictionary** has first-class DTCG support since **v4**, but its documentation says that the **2025.10 format is not yet fully supported** (work in progress in v5). This is from my knowledge base, checked on 2026-10-02; verify it against the version you have installed, because it may have changed.
- The **earlier draft format** (color as a hex string, dimension as a string such as `"16px"`) is the one tools read most reliably today.

**My recommendation:** write the file in the draft format and convert later. Pick one format and keep it across the whole file; do not mix the two.

**Same token, both formats:**

Draft (works today):
```json
{
  "color": {
    "$type": "color",
    "blue": { "600": { "$value": "#2563EB" } }
  },
  "space": {
    "$type": "dimension",
    "4": { "$value": "16px" }
  }
}
```

2025.10:
```json
{
  "color": {
    "$type": "color",
    "blue": {
      "600": {
        "$value": { "colorSpace": "srgb", "components": [0.145, 0.388, 0.922], "hex": "#2563eb" }
      }
    }
  },
  "space": {
    "$type": "dimension",
    "4": { "$value": { "value": 16, "unit": "px" } }
  }
}
```

**Converting is mechanical:** `components` are the sRGB channels divided by 255 (R, G, B from 0 to 1), and each dimension string becomes `{ "value": <number>, "unit": "px" }`. Aliases such as `"{color.blue.600}"` stay the same in both.

**If you want to try 2025.10 anyway:** convert one or two tokens and run your Style Dictionary build before converting the whole file, and check that the CSS output comes out as expected (for example `--color-blue-600: #2563eb`).

One question that decides this: which Style Dictionary version (and Node version) are you on? And are the outputs CSS variables, Tailwind or something else? With that, I can set up the file and naming for it.
