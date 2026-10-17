**There is no single number for this, and I can't measure it reliably.** Text over a photo is outside what this Solver measures: the contrast changes pixel by pixel with the image. The contrast check tool also needs an **opaque background**, and here the background is a 30% black card sitting on top of a photo, so the real background color depends on which part of the photo is behind the text.

What I can tell you is the range, to show why this design is risky. These are hand calculations for the two extremes, not tool output:

- **If the photo behind the text is white:** the 30% black card gives about #B3B3B3, and 60% white text on it gives about #E0E0E0. That is roughly **1.6:1**, a clear failure.
- **If the photo is black:** the card stays black and the 60% white text becomes about #999999, which is roughly **7.4:1**.
- Any real photo will land somewhere between those, and bright areas (sky, clothing, highlights) are likely to fail the 4.5:1 required for normal text (WCAG 1.4.3 AA).

So, as designed, it is **not safe to claim it passes**. Treat it as a critical risk.

**How to fix it so the contrast stops depending on the photo:**
1. Use a **stronger, uniform scrim**: a dark overlay at about **40% to 60% opacity**, or a gradient that is darkest where the text sits.
2. Better still, put the text in a **solid box** (opaque background) over the photo.
3. Make the **text fully opaque** (white, 100%) rather than 60%. Transparency on text lowers the contrast further.
4. **Test against the lightest region** of the image the text can appear on, and test several images if the photo is dynamic.

If you can sample the **actual resulting solid color** behind the text in the lightest area (a flattened screenshot color picked in Figma), send me the hex and I will calculate the ratio exactly for that case. With the solid box or scrim solution, I can check the final pair with the contrast check tool.
