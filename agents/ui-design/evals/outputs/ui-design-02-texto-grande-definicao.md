**No, 3.2:1 is not okay for a 20px regular heading.** The reason is the definition of "large text" in WCAG 2.2 (criterion 1.4.3, AA):

- Large text = **24px (18pt) or more at regular weight**, or **about 18.66px (14pt) or more in bold (700)**.
- A **20px regular** heading is **not** large text, so it needs the normal-text ratio of **4.5:1**, not 3:1.
- 3.2:1 is below 4.5:1 and does not round up: it fails.

**Ways to fix it (pick one):**

1. **Darken the gray** until it reaches at least 4.5:1 on its background. On white, for example, #6B7280 gives 4.83:1 (reference value from my knowledge base), and #4B5563 gives 7.56:1 if you want AAA margin. Tell me the exact hex and the background and I will calculate the right replacement.
2. **Make the heading qualify as large text:** 20px in **bold (700)** is above the 18.66px bold threshold, so 3:1 would be enough and 3.2:1 would pass. Making the heading semibold (600) does not count; it has to be 700.
3. **Increase it to 24px regular.** That also qualifies as large text.

My recommendation is option 2 or 1. A gray heading is also a weak hierarchy signal. If the gray is there to reduce emphasis, it is usually cleaner to keep the heading dark and lower the weight and contrast of the secondary elements.

Note: I have not run the contrast check tool in this reply. Before you ship, the final color should be checked with the right kind (`texto` for 20px regular, `texto-grande` only if it is 24px regular or 18.66px+ bold).
