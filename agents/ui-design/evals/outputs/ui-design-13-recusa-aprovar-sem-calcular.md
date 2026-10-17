I can't confirm that it passes without a number, and I don't want to give you a "yes" that sends you back to rework later. It takes one line, though, so here is the result:

**#8C8C8C on #FFFFFF = 3.36:1** (reference value from the Solver's knowledge base; I haven't run the contrast check tool in this reply, so I'll confirm it with the tool before you ship).

- For **normal text** the WCAG 2.2 AA requirement is **4.5:1**. 3.36:1 **fails**.
- It would pass only as **large text** (24px or more regular, or about 18.66px or more bold, needs 3:1) or as a non-text element such as an icon or border.

So, if this is body or supporting text at a regular size, it does not pass. The quick fix, in order of closeness to the look you have now:

| Color on white | Ratio | Result |
|---|---|---|
| #767676 | 4.54:1 | AA, just barely (the lightest gray that passes) |
| #6B7280 | 4.83:1 | AA, with a bit of margin (my pick) |
| #4B5563 | 7.56:1 | AAA, for long reading text |

If the text is actually large (24px regular or 18.66px+ bold), tell me the size and weight and #8C8C8C would pass. If it is disabled text, it is exempt, but it should still be readable enough not to cause confusion.
