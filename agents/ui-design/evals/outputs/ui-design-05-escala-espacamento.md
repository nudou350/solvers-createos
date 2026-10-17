**Short version:** you have 6 values (6, 10, 13, 16, 22, 24). The count is fine, but four of them are off the 4px grid (6, 10, 13, 22), and it looks like each was chosen by eye. The fix is to adopt one scale, then map each value **by the relationship it expresses** (not just by rounding).

**Recommended scale (4/8 grid, with token names):**

| Token | px | Typical use |
|---|---|---|
| space.1 | 4 | icon and text, fine adjustments |
| space.2 | 8 | label to field, compact lists |
| space.3 | 12 | chips, small buttons |
| space.4 | 16 | button and card padding, gap between fields |
| space.6 | 24 | large card padding, gap between groups |
| space.8 | 32 | separation between sections |
| space.12 / 16 | 48 / 64 | page sections |

**How I would map your values (to be confirmed against where each one is used):**

| Current | Likely → | Why |
|---|---|---|
| 6 | 8 (or 4) | usually label to field or icon to text |
| 10 | 8 or 12 | pick by whether it is "inside a group" (8) or "padding" (12) |
| 13 | 12 or 16 | almost always an auto-layout accident or a manual adjustment |
| 16 | 16 | keep |
| 22 | 24 | between groups or card padding |
| 24 | 24 | keep |

**Organize by relationship, with semantic tokens on top:**
- `space.stack.xs` = 8: label to field
- `space.stack.md` = 16: field to field in the same group
- `space.stack.lg` = 24: between groups
- `space.inset.md` = 16 and `space.inset.lg` = 24: padding of buttons/fields and of cards

**Three rules to apply while you do it:**
1. The space inside a group must be smaller than the space between groups, ideally at a ratio of **1:2 or more** (8 inside, 16 or 24 between). 16 and 20, for example, will not read as separate groups.
2. The same relationship (field to field) needs the **same value on every screen**.
3. Values such as 6 or 10 are acceptable only as documented exceptions.

In Figma, bind spacing to variables in a "Primitives" collection and alias them in a semantic one; set the scope to **Gap** (in Figma it covers both gap and padding of auto layout; there is no separate padding scope).

I have not read your file, so the mapping above is a proposal. If you send the frame link with a node-id (or screenshots plus the inspector values), I can check which value sits where and give an exact before/after list. Two quick questions that change the answer: which platform is this for, and do you need a compact density mode?
