**No, that does not work.** A mid gray that passes on white often fails on a dark background.

- **#6B7280 on #111827 = 3.67:1** (reference value from the Solver's knowledge base; I haven't run the contrast check tool in this reply).
- Secondary text is normal text, which needs **4.5:1** at AA (criterion 1.4.3). 3.67:1 fails. On white the same gray is 4.83:1 and passes, which is why it looks fine in the light theme.

**Severity: critical** (essential secondary text becomes hard to read).

**Fix: give dark mode its own token value for secondary text.**

| Theme | Token | Value | Ratio on #111827 |
|---|---|---|---|
| Light | `color.text.subtle` | #6B7280 (or #4B5563, 7.56:1) | n/a (on white: 4.83:1) |
| Dark | `color.text.subtle` | #9CA3AF | 6.99:1 |

For the rest of the dark theme, a good starting point:
- Main text: #E5E7EB (14.33:1) to #F9FAFB (16.98:1) on #111827.
- Saturated brand colors also drop: blue #2563EB on #111827 is only 3.43:1; use a lighter tone such as #60A5FA (6.98:1).
- Borders and icons on dark need 3:1 against the surface, too (for example #9CA3AF on #1F2937 is 5.78:1).
- Avoid pure #000 background with pure white text: it causes halation. Your #111827 is a good choice.

**How to structure it so this does not happen again:** the component should reference the semantic token `color.text.subtle`, and each mode (Light and Dark) maps it to a different primitive from the same gray ramp. If you reference the gray directly, the dark theme cannot change it. I can generate the light and dark token files from your colors if you want.

Please confirm the final pair with the contrast check tool (kind `texto`) before shipping, and also test hover, disabled and error states in dark mode.
