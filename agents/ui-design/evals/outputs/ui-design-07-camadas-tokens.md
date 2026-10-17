**You can, but I recommend you do not.** Binding components straight to palette colors (blue-600) means skipping the semantic layer, and that is the number one reason dark themes become impossible to implement later.

**Why it hurts:**
- `blue-600` describes a *value*. If a button is bound to it, the dark theme cannot change that button without editing every component, because the component has no notion of "this is the primary action".
- The same tone does not work in both modes. White on blue-600 is 5.17:1 on a light page, but blue-600 as a color on #111827 gives only 3.43:1. In dark mode you need a lighter tone (blue-400, 6.98:1). Only a semantic layer can swap that per mode.
- Renames and rebrands touch every component instead of one alias.

**The three layers:**

1. **Primitives** (raw values; the name describes the value): `color.blue.600 = #2563EB`, `space.4 = 16px`. Nobody uses these directly in components.
2. **Semantic** (the role; the name describes the intent): `color.action.primary.bg = {color.blue.600}`, `color.text.default`, `color.border.focus`. **This is the layer that changes between themes.**
3. **Component** (optional and selective): `button.primary.bg = {color.action.primary.bg}`. Only when a component needs to vary without affecting the rest.

**Golden rule:** components reference semantic tokens, semantic tokens reference primitives.

**In Figma:** a "Primitives" collection (one mode, hidden from publishing, so designers do not pick from it by accident), a "Semantics" collection with **Light** and **Dark** modes aliased to the primitives, and a "Components" collection only if needed. Bind your component fills and strokes to the Semantics variables.

**What to name things:** `color.action.primary.bg`, not `button.blue` or `color.text.gray-700`: names that describe appearance lie as soon as a theme changes the value.

If you are in a hurry and have no dark theme planned, the shortcut still costs you later. The semantic layer for a first version is small (a few dozen tokens), and I can generate it from your palette. If you send me the colors you are using, I will propose the aliases and check the text and border pairs.
