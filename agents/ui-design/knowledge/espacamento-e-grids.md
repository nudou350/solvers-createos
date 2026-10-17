---
title: Spacing, grids and touch targets
source: W3C WCAG 2.2 (criterion 2.5.8) and established interface design practice (the creator's synthesis)
source_url: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
source_date: 2026-10-02
tags: [spacing, grid, touch-target, breakpoints, density]
---

## The 4 and 8 point grid

Use a base unit of 4px and prefer multiples of 8 for larger spaces. Practical reasons: most screens have dimensions divisible by 8, density scales (1.5x, 2x, 3x) do not produce half pixels, and the team chooses among a few options instead of inventing 13px or 22px.

Recommended scale, with t-shirt names and typical use:

| Token | px | Typical use |
|---|---|---|
| space.1 (2xs) | 4 | icon and text, fine adjustments |
| space.2 (xs) | 8 | label and field, compact list items |
| space.3 (sm) | 12 | padding of chips, tags, small buttons |
| space.4 (md) | 16 | button and card padding, gap between fields |
| space.6 (lg) | 24 | large card padding, gap between groups |
| space.8 (xl) | 32 | separation between sections within a screen |
| space.12 (2xl) | 48 | page sections |
| space.16 (3xl) | 64 | landing page blocks |
| space.24 (4xl) | 96 | hero and large separations on desktop |

A well-resolved interface usually uses between 6 and 9 spacing values. If the inventory found 12 or more, there is a missing scale. Values like 6, 10, 14 and 20 are acceptable as exceptions (2 or 4 grid), but need a reason.

## Proximity and grouping

Spacing communicates relationship. Operational rules:

- **Inner space smaller than outer space.** The space between elements of the same group must be smaller than the space between groups. Aim for a ratio of at least 1:2 (e.g. 8px inside, 16px or 24px between). Ratios of 1:1.25 (e.g. 16 and 20) are not perceived as different groups.
- **Label close to the field it describes.** Label 8px from the field and 16 to 24px from the previous field. The classic mistake is a label equidistant from two fields.
- **Section title closer to the content it introduces** than to the previous content (e.g. 32px above, 12 to 16px below).
- **Inner card padding** equal to or greater than the gap between cards, otherwise the content looks like it is leaking.
- **Relationship consistency.** The same relationship (field to field) needs the same value on every screen. In the audit, list the relationships and the values found; divergences are a high-severity problem.

## Inner spacing of components

Reference numbers for desktop and responsive web:

- **Medium button:** height 40px, horizontal padding 16px, icon-text gap 8px. Small: 32px height and 12px padding. Large: 48px and 20 to 24px.
- **Form field:** height 40 to 48px (48px on mobile), horizontal padding 12 to 16px.
- **Table cell:** height 40px (compact 32px, comfortable 52 to 56px), horizontal padding 16px.
- **Tappable list item on mobile:** minimum 48px height.
- **Card:** padding 16px (mobile) to 24px (desktop).

## Touch targets

- **WCAG 2.2, criterion 2.5.8 (AA):** pointer target of at least 24x24 CSS px. Exceptions: **spacing** (smaller targets are accepted if a 24px circle centered on each one does not cross another target or the circle of another small target), **equivalent** (the function exists in another control on the page that meets the size), **inline** (a link within running text), **user agent control** (size not modified by the author) and **essential**.
- **Platform recommendations:** 44x44pt on iOS (Human Interface Guidelines) and 48x48dp on Android (Material). For mobile products, use these as the goal, not 24px.
- A 16px icon can have a 44px clickable area with transparent padding; what matters is the interactive area, not the drawing.
- Action icons very close together (trash next to edit) with less than 8px between areas cause mis-taps; increase the space or move destructive actions into a menu.

## Layout grids

Column references by width:

| Breakpoint | Width | Columns | Gutter | Side margin |
|---|---|---|---|---|
| Mobile | 360 to 599px | 4 | 16px | 16px |
| Tablet | 600 to 1023px | 8 | 16 to 24px | 24 to 32px |
| Desktop | 1024 to 1439px | 12 | 24px | 32 to 48px |
| Wide desktop | 1440px or more | 12 | 24 to 32px | auto, with a max width |

- Define a **maximum content width** (1200 to 1280px is common in products; 680 to 720px for running-text reading). Without it, 1920px screens stretch lines until they become unreadable.
- **Forms** should rarely exceed 480 to 560px wide, even on desktop. Fields that are too wide for short data (postal code, ID number, date) hurt reading; the field size should hint at the size of the answer.
- Dense **admin panels** benefit from a fluid grid with a fixed sidebar (240 to 280px) and a 12-column content area.
- Reference mobile: design at 360px (the most common Android) and check at 320px (first-generation iPhone SE, zoom) to make sure nothing is clipped.

## Figma auto layout and translation to CSS

- Vertical auto layout with gap = `flex-direction: column; gap`.
- "Space between" = `justify-content: space-between`.
- "Fill container" = `flex: 1 1 0` or `width: 100%`; "Hug contents" = intrinsic width.
- Auto layout padding = `padding`. Different values per side often indicate a manual adjustment to compensate for something; investigate.
- **Warning sign:** frames without auto layout with hand-positioned elements. In these cases the measured spacing values vary by 1 to 3px between screens and do not reflect intent; normalize in the audit.

## Density

Products with tables and panels usually need two modes: comfortable and compact. Do not create new tokens for this; create a mode in the semantic spacing tokens (e.g. `space.inset.md` = 16px in comfortable and 12px in compact) and keep the primitives. Never reduce touch targets below 24px in compact mode.

## Quick spacing audit checklist

1. How many unique values exist? More than 9 indicates a missing scale.
2. How many are off the 4 grid? List each one with its layer.
3. Is the inner/outer ratio of the groups at least 1:2?
4. Does the same relationship have the same value on every screen?
5. Is there a maximum content width and form width?
6. Do touch targets meet 24px (AA) and, on mobile, 44 to 48px?
7. Do the frames use auto layout or manual positioning?
