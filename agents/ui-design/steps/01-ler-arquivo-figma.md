# Step 1: Read the Figma file

Always reply in the user's language.

## Goal

Get an accurate read of what is in the user's file before offering any opinion. By the end of this step you need: the exact scope (which pages and frames), the usage context (product, audience, platform) and an objective inventory of styles, variables, components and loose values. The whole audit in step 2 depends on this inventory. No "it looks like": you work with the values Figma returns.

## What to ask the user

Before asking anything, call `get_memory`. If the profile comes back (platform, token destination, conformance level, design system), use it and do not ask again. If `needs_onboarding` comes back, ask the calibration questions in at most two messages, explain in one sentence why each matters, accept "skip", and save with `save_memory` (`kind: "profile"`; if skipped, `{"skipped": true}`).

Then ask only what is missing, in a single short message:

1. **File or frame link.** Ask for the link with a `node-id` (right-click the frame, "Copy link to selection"). A whole-file link without a `node-id` forces you to scan too many pages. Without the connector, the link is not enough: ask for screenshots and values (see Path B).
2. **Scope.** One screen, a flow (e.g. a 4-screen signup) or a component library? If it is a flow, ask for the order of the screens.
3. **Platform and breakpoints.** Responsive web, iOS/Android app or desktop. This changes touch target size, type scales and grids.
4. **Audience and context.** Who uses it and in what situation (e.g. "a call-center operator on a 1366px monitor all day" is different from "a consumer on a phone on the bus").
5. **Constraints.** Is there a mandatory brand or design system? Brand colors that cannot be touched? A component library already in code (MUI, shadcn, Tailwind)?
6. **Goal of the work.** Audit, tokens, handoff or all three. If they do not know, follow the full method.

If the user already gave part of this in the conversation, do not ask again.

## How to run

1. **Read the profile and choose the path.** Use the platform, design system and conformance level from the profile as the defaults for the work; with no profile (skipped, or memory unavailable), assume responsive web, WCAG 2.2 AA and CSS variables, and say that you assumed so. Check whether the Figma connector is available in this conversation, with the read functions `get_metadata`, `get_design_context`, `get_variable_defs` and `get_screenshot`.
   - **Path A, with the connector:** follow steps 2 to 7.
   - **Path B, without the connector:** do not stall the conversation waiting for an install. Say in one sentence that the connector makes the read exact and faster (Settings > Connectors > Figma) and, in the same message, offer to go ahead now with whatever the user can send. Follow the "Path B" section below and then return to step 6.
2. **Structure first.** Call `get_metadata` on the given node to get the tree (names, types, positions, sizes). Use it to locate frames, components and instances without pulling heavy context.
3. **Design context.** Call `get_design_context` on the target frames (one at a time if they are large). Extract: fonts, sizes, weights, line heights, fill and border colors, radii, shadows, paddings and auto layout gaps.
4. **Variables and styles.** Call `get_variable_defs` to list the variables and styles already defined. Note which values on the screens are bound to variables and which are loose (hardcoded). The share of loose values is an important indicator of file health.
5. **Visual capture.** Call `get_screenshot` on the main frames to judge hierarchy and grouping visually. Never judge hierarchy from the numbers alone.
6. **Build the inventory.** Organize it in a table:
   - Unique colors used (hex), where they appear and whether they are bound to a variable.
   - Unique font sizes, with weight and line height.
   - Unique spacing values (padding, gap, margins between blocks).
   - Unique radii and shadows.
   - Components and instances; detached instances count as a problem.
7. **Summarize for the user** in 5 to 8 lines: what you read, the inventory numbers (e.g. "14 unique colors, 9 font sizes, 11 spacing values, 38% of values without a variable") and what comes in the next step. Confirm the scope is right before moving on.

## Path B: without the Figma connector

The audit goes on with whatever is available; what changes is the source and the confidence of each value.

1. **Ask for the material in a single message**, from most useful to least useful:
   - A screenshot of each frame, whole and at actual size (1x or 2x, no cropping).
   - The values from the inspect panel (Dev Mode or the Inspect tab), pasted as text: text and background colors in hex, font, size, weight and line height, paddings and gaps. CSS copied from Dev Mode works too.
   - If they exist, the list of variables or styles (a screenshot of the Local variables panel or a JSON export).
   If the user only has the screenshot, go ahead with it.
2. **Mark the source of each value** in the inventory: **read** (pasted by the user from Figma or from code) or **estimated** (taken from the image). A color sampled from a screenshot is approximate (compression, color profile, anti-aliasing) and measurements taken from an image suffer from scaling.
3. **Contrast with an estimated value** goes into the audit as an estimate: run `contrast_check` anyway, say that the hex was estimated, and ask the user to confirm any pair that lands near the limit (between 4 and 5:1 for text, between 2.5 and 3.5:1 for `ui`).
4. **What the image cannot tell you** (which values are bound to variables, detached instances, variable modes) becomes "not read" in the inventory, and step 2 covers the rest as usual.
5. If the user installs the connector midway through, re-read the frames through Path A and replace the estimated values.

## Common mistakes

- **Auditing the wrong file or the wrong frame.** Real files have pages like "Draft", "Old", "Explorations". Confirm that the frame is the current version.
- **Pulling the whole file at once.** Large files blow up the context. Use `get_metadata` to map and then read only the nodes you need.
- **Confusing a layer style with a component.** A rectangle with the brand color is not a componentized button. Record whether the element is a component instance or a loose layer.
- **Ignoring variable modes.** If there are modes (light/dark, brands), record which ones exist; the contrast audit has to cover all of them.
- **Rounding values.** If Figma returns a 13px gap, record 13, not 12. The "odd" value is exactly what the audit is going to flag.
- **Inventing data that did not come from the tool.** If a value did not show up in the response, mark it "not read" instead of guessing.
- **Stopping everything because the connector is not installed.** Without the connector, follow Path B; refusing to audit leaves the user with nothing.
- **Presenting an estimated screenshot value as exact.** Always say when the hex or the measurement came from the image.

## result_summary format

Pass `next_step` a compact text in this format:

```
PROFILE: <memory | answered now | skipped>
SOURCE: <Figma connector | no connector: screenshots + pasted values>
SCOPE: <file> / <frames with node-id>
PLATFORM: <responsive web | iOS | Android | desktop>; breakpoints: <list>
AUDIENCE/CONTEXT: <one line>
CONSTRAINTS: <brand, existing DS, code lib>
MODES: <light, dark, ...>
INVENTORY:
- colors (<n>): <main hexes and use; mark "(estimated)" the ones that came from an image>
- fonts: <family>; sizes (<n>): <list px/weight/line height>
- spacing (<n>): <list px>
- radii: <list>; shadows: <n>
- % values without a variable: <n>%
- components: <n>; detached instances: <n>
GOAL: <audit | tokens | handoff | full>
```
