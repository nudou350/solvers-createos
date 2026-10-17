---
title: Visual hierarchy, actions and patterns by screen type
source: Established interface design heuristics (the creator's editorial synthesis, no original study)
source_date: 2026-10-02
trial: true
tags: [hierarchy, actions, form, checkout, dashboard]
---

## What it is and how to measure it

Visual hierarchy is the order in which the eye travels across the screen. A screen has good hierarchy when that order matches the order of importance for the user's task. You do not measure hierarchy by opinion; you measure it with three simple tests run on the frame's screenshot (`get_screenshot`):

1. **Squint test.** Imagine the screen blurred (or shrink the screenshot to about 25%). What are the first three points of attention? Write them down. If the first is not the title or the main action, there is a problem.
2. **5-second test.** After seeing the screen for 5 seconds, could someone say what it is about and what to do next?
3. **Primary action test.** Point to the primary action. If there is more than one candidate with the same visual weight, the hierarchy has failed.

## Hierarchy levers, in order of strength

1. **Size.** The strongest. An element with twice the area draws attention even in a neutral color.
2. **Color and contrast.** A saturated color on a neutral background dominates. A single accent color per screen for the main action; if the brand shows up in 10 places, it stops standing out.
3. **Type weight.** 600 or 700 against 400.
4. **Position.** In the Western reading pattern, the top-left corner is read first; on content screens the eye follows an F pattern, on screens with little text a Z pattern.
5. **White space.** An element isolated by empty space gains importance.
6. **Depth.** Shadow and elevation highlight layers (modals, menus), but should not be used for the hierarchy of ordinary content.

Hierarchy is also built by **removing** emphasis: lowering the weight and contrast of secondary elements (instead of raising everything that is important) is almost always the cleanest fix.

## Action hierarchy

- **One primary action per context** (screen, modal, card). A solid button in the action color.
- **Secondary actions:** an outlined or tonal button (light background of the action color).
- **Tertiary actions:** a text button or link.
- **Destructive actions:** the danger color only when the action is the primary one in the context (e.g. a "Delete account?" modal). In lists, delete should not have more emphasis than edit; put it in a menu or make it tertiary.
- **Button order:** choose one pattern and keep it across the whole product. On web and Android, the primary on the right in the footer of dialogs is common; in single-page forms, the primary aligned to the left, along the reading flow. The mistake is varying between screens.
- **Labels with a verb and an object:** "Save changes", "Create account", "Pay $89.90". Avoid generic "OK", "Yes", "Submit", especially in destructive dialogs ("Delete project" instead of "Confirm").

## Patterns by screen type

**Form:** a title that states the goal, fields in a single column (the path is predictable and it works on mobile; exceptions for natural pairs such as city and state), labels above the fields, fields grouped by topic with group titles, the primary action at the end and unambiguously visible. Optional fields marked "(optional)" when they are the minority; required fields marked when they are the minority.

**Checkout:** an order summary with the total as the element of greatest weight after the title; a single primary action ("Pay now"); coupon and notes collapsed by default, because they compete with closing the purchase; security badges near the action, without clutter.

**Dashboard:** at most 3 to 5 indicators at the top, with the number emphasized (large size, high weight) and a discreet label; change (+12%) with color and a direction icon; charts below; tables last. If every card is the same size, nothing is a priority.

**List and table:** the column that identifies the item (name) with greater weight; numeric values right-aligned; discreet row actions (shown on hover on desktop only, and always reachable by keyboard and touch).

**Empty state:** a short title, a one-line explanation and the action that resolves it. It is an onboarding opportunity, not blank space.

## Useful laws and heuristics (with application)

- **Hick's law:** more options increase decision time. In the audit, count the visible actions on a screen; above 7 to 9 actions of the same weight, recommend grouping or hiding them in a menu.
- **Fitts's law:** larger and closer targets are faster. The primary action should be large and near where attention ends (end of the form, a fixed footer on mobile within thumb reach).
- **Proximity (Gestalt):** things that are close are perceived as a group. See the ratios in "Spacing, grids and touch targets".
- **Similarity:** elements with the same style are perceived as belonging to the same category. A link and a bold text in the same color cause confusion.
- **Common region:** a background or border groups items; use cards only when white space does not solve it, to avoid "cardmania" (everything inside a box).
- **Von Restorff effect:** the item that is different is remembered. Use it for the primary action and for alerts, and only for them.

## Typical audit findings (model wording)

- "Two competing primary actions: 'Apply coupon' (solid button, 48px) and 'Place order' (outlined button, 40px). The action for the main task has less weight. Invert: 'Place order' solid 48px and full width on mobile; 'Apply coupon' as a text button inside a collapsible field. Severity: critical."
- "Page title (24px, 600) and total amount (28px, 700) compete for the first level. Reduce the amount to 24px or the title to 20px. Severity: medium."
- "Five accent colors on the same screen (blue, green, orange, purple, red) for categories. The action color loses strength. Use a neutral color for categories with an icon or label and reserve blue for actions. Severity: high."

## Quick checklist

1. Do the first three points of attention match the task?
2. Is there a single primary action per context?
3. Do the action labels have a verb and an object?
4. Is emphasis also achieved by reducing the secondary?
5. Is the button order consistent across the whole product?
6. Are destructive actions protected and without undue emphasis?
