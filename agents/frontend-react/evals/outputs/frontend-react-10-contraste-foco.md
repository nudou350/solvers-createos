I would put it back, but not as it was. Keyboard users rely on that outline to know where they are. Without it, someone pressing Tab sees nothing change, which fails WCAG 2.4.7 (Focus Visible, level AA). The good news is you can make it look good instead of removing it.

## Replace it instead of deleting it

```css
:root {
  --focus: #1d4ed8;               /* its own token: not the brand color */
}
:root[data-theme="dark"] {
  --focus: #93c5fd;
}

:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 2px;
}
```

- **`:focus-visible`** shows the ring for keyboard navigation and not on mouse clicks on buttons, which usually addresses the "ugly" complaint. Style it, do not hide it.
- **A dedicated `--focus` token, not `--accent`.** A brand-colored ring in amber, emerald or sky on white is often below 3:1. The ring needs at least 3:1 against both the control and the page around it (WCAG 1.4.11), at least 2 px thick, and a separate value per theme.
- **`outline-offset: 2px`** keeps the ring off the button edge and looks cleaner; rounded buttons follow their `border-radius` in current browsers.
- Use the same ring on every control, including the "skip to content" link, so the interface feels like one system.
- If you have a sticky header, add `scroll-padding-top` equal to its height so a focused element is not hidden underneath it (2.4.11).

If you use Tailwind, the equivalent is to drop `outline-none` and use `focus-visible:outline-2 focus-visible:outline-offset-2` with a focus color token.

## What I can and cannot verify

I can send your complete CSS and components to the static check, which flags `outline: none` without a `:focus-visible` replacement as an error:

```json
{
  "tool": "a11y_check",
  "input": { "files": [
    { "path": "Button.tsx", "content": "…full file…" },
    { "path": "Button.css", "content": "…full file…" }
  ] }
}
```

I can also add a test that asserts `contrastRatio(focus, pageBackground) >= 3` and `contrastRatio(focus, buttonBackground) >= 3` for each theme. What I cannot prove from code is how the ring actually looks (visibility on every background, gradients, clipping by `overflow: hidden`). That needs a keyboard pass in a browser: reload, press Tab from the top and confirm each stop has a visible ring, then run axe-core.

## To fix it for your project, tell me

1. How you style (Tailwind, CSS Modules, styled-components, plain CSS)?
2. Do you have light and dark themes, or a switchable brand color?
3. Can you paste the button CSS (or component) where the outline was removed? Also check for a global reset like `* { outline: 0 }` or `button:focus { outline: none }`, which often causes this site-wide.
