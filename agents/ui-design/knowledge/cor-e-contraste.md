---
title: Color and contrast (WCAG 2.2)
source: W3C, WCAG 2.2 (success criteria 1.4.1, 1.4.3, 1.4.6 and 1.4.11) and the contrast ratio calculation
source_url: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
source_date: 2026-10-02
trial: true
tags: [contrast, wcag, color, dark-mode, apca]
---

## WCAG 2.2 criteria that matter day to day

The WCAG 2.x contrast ratio runs from 1:1 (same color) to 21:1 (black on white). It is calculated from relative luminance: `(L1 + 0.05) / (L2 + 0.05)`, where L1 is the lighter color. The criteria you will apply in almost every audit:

- **1.4.3 Contrast (Minimum) (AA):** normal text 4.5:1; large text 3:1. Large text = 18pt (24px) or more at regular weight, or 14pt (about 18.66px) or more in bold (700). A 20px regular text is NOT large. Exempt are incidental text (inactive component, pure decoration), logotypes and content where the user themself chooses the colors. A ratio of 2.999:1 does not reach 3:1: do not round up.
- **1.4.6 Contrast (Enhanced) (AAA):** 7:1 for normal text and 4.5:1 for large text. Recommend AAA for long reading text (articles, contracts, terms).
- **1.4.11 Non-text Contrast (AA):** 3:1 for interface components (input border, toggle track, checkbox) and the parts of graphics required to understand the information, against the adjacent colors. It also applies to the focus indicator.
- **Exemptions:** text in a disabled component, purely decorative text, text inside a logotype. Even when exempt, disabled text that is too hard to read causes confusion; record it as a note.
- **1.4.1 Use of Color:** color cannot be the only means of conveying information. A field with an error needs an icon or text in addition to the red border; a link in the middle of a paragraph needs an underline or 3:1 contrast with the surrounding text, plus an indication on focus and hover.

## Reference pairs already calculated

Useful values for a quick conversation (always confirm with `contrast_check` before delivering, with `kind: "texto"`, `"texto-grande"` or `"ui"` according to how the pair is used; these are the tool's fixed values for text, large text and UI components):

| Foreground | Background | Ratio | Verdict |
|---|---|---|---|
| #111827 | #FFFFFF | 17.74:1 | AAA |
| #374151 | #FFFFFF | 10.31:1 | AAA |
| #4B5563 | #FFFFFF | 7.56:1 | AAA |
| #6B7280 | #FFFFFF | 4.83:1 | AA normal text |
| #767676 | #FFFFFF | 4.54:1 | lightest gray that passes AA on white |
| #8C8C8C | #FFFFFF | 3.36:1 | large text or non-text only |
| #9CA3AF | #FFFFFF | 2.54:1 | fails even for large text |
| #D1D5DB | #FFFFFF | 1.47:1 | fails as an input border |
| #E5E7EB | #FFFFFF | 1.24:1 | decorative divider only |
| #FFFFFF | #2563EB | 5.17:1 | AA |
| #FFFFFF | #3B82F6 | 3.68:1 | large text only |
| #FFFFFF | #16A34A | 3.30:1 | large text only |
| #FFFFFF | #15803D | 5.02:1 | AA |
| #FFFFFF | #DC2626 | 4.83:1 | AA |
| #F59E0B | #FFFFFF | 2.15:1 | never as text |
| #FFFFFF | #FF6B00 | 2.86:1 | fails; use dark text |
| #1F2937 | #FF6B00 | 5.14:1 | AA |

Patterns these numbers reveal: the "500" tone of popular palettes rarely passes 4.5:1 with white text; "600" usually passes in blue and red, but not in green; orange, yellow and lime green almost always call for dark text.

## The most common traps in audits

1. **Placeholder as information.** Placeholders in #9CA3AF (2.54:1) are the factory default of many kits. If the placeholder carries an instruction ("DD/MM/YYYY"), it needs 4.5:1 or has to become help text outside the field.
2. **Invisible field border.** Borders of #E5E7EB or #D1D5DB on white fail 1.4.11. The field is identifiable only by its border; use at least something like #8C8C8C (3.36:1) or a field background with 3:1 contrast.
3. **Button in a light brand color.** Orange brand #FF6B00 with white text (2.86:1). Solutions that preserve the brand: dark text #1F2937 (5.14:1); a darker version of the orange only for buttons; or white text from 24px up, which is rarely realistic in buttons.
4. **Text over an image.** The contrast varies per pixel. Use a dark overlay (a black gradient at 40% to 60% opacity in the text area) or a solid box. Test against the lightest region of the image.
5. **Forgotten states.** The primary button's hover often lightens the color and drops below 4.5:1. Error text in light red on a pink background (alert) often fails. Test every state.
6. **Focus ring.** Needs 3:1 against the adjacent background. A blue #3B82F6 ring on white has 3.68:1 and passes; a light blue #93C5FD ring does not. A robust technique is the double ring: 2px in the focus color with 2px of white space (offset).
7. **Opacity.** Text with transparency changes contrast depending on the background. If the text color has alpha (`rgba()` or `#RRGGBBAA`), pass it as is: `contrast_check` composites the `fg` over the `bg`. The `bg` must be opaque: with a translucent background or `opacity` applied to the whole element, first work out the resulting solid color.

## Dark mode

- **Do not invert the palette.** A pure black #000000 background with pure white text causes halation on OLED screens and for people with astigmatism. Prefer backgrounds between #111827 and #1F2937 (or #121212 as in Material) and main text around #E5E7EB to #F9FAFB (14.33:1 and 16.98:1 on #111827).
- **Mid grays break.** #6B7280, which passes on white (4.83:1), drops to 3.67:1 on #111827. Each mode needs its own semantic `color.text.subtle` token: in dark, something like #9CA3AF (6.99:1 on #111827).
- **Saturated brand colors vibrate.** Blue #2563EB on #111827 has only 3.43:1. In dark mode use the lighter tone of the ramp (#60A5FA gives 6.98:1).
- **Elevation through lightness, not shadow.** In dark mode, higher surfaces get lighter (e.g. background #111827, card #1F2937, menu #374151). Shadows barely show.
- **Reduce the saturation** of feedback colors in dark mode; very saturated green and red look neon.

## APCA: when to mention it

APCA (Accessible Perceptual Contrast Algorithm) is a contrast model under study for a future WCAG 3, which according to the W3C is still in an early draft. It takes polarity into account (light on dark is perceived differently from dark on light), as well as font size and weight, and tends to be more faithful in dark mode and with mid-tone colors. Values are given in Lc. Do not quote Lc thresholds as a requirement: they are not part of any standard in force. Rules for you:

- The legal and contractual requirement today is WCAG 2.x. Always audit with the WCAG 2 ratio and cite conformance by it.
- Mention APCA as complementary information when a pair passes WCAG 2 but looks bad (typical in dark mode with thin light text) or when it fails WCAG 2 but is clearly legible (e.g. white on mid orange in large bold).
- Never say a pair "passes accessibility" based on APCA alone.

## Color blindness and color as meaning

According to the US National Eye Institute, about 1 in 12 men has a color vision deficiency, most of them in distinguishing red from green. Practical consequences:

- Charts with red and green series need direct labels, patterns or different shapes.
- Status (success, error, warning) always with an icon and text, not color alone.
- Test with protanopia and deuteranopia simulation (Figma plugins or browser filters) on screens with charts and status.

## How to build color ramps that work

- Generate 10 to 11 tones (50 to 950) with a stable hue and well-distributed lightness; OKLCH-based tools produce more even ramps than HSL.
- Make sure each ramp has at least one tone with 4.5:1 on white (text in light mode) and one with 4.5:1 on the dark background (text in dark mode).
- Document on the ramp itself which tones are safe for text. This prevents most future mistakes by whoever uses the system.
