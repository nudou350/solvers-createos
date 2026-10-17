**Not for a mobile list, no.** There are two different yardsticks, and 20x20px falls short of both unless the spacing is generous.

1. **WCAG 2.2 AA, criterion 2.5.8 (Target Size, Minimum):** the minimum is **24x24 CSS px**. A 20x20 target fails, **unless the spacing exception applies**: a 24px circle centered on each target must not cross another target (or another small target's circle). For 20px icons in a row, that means roughly **4px or more of clear space** between them, and more if they are next to other tappable things such as the row itself. Without that spacing, it fails.
2. **Platform goal for mobile:** **44x44pt on iOS** and **48x48dp on Android**. For a mobile product, treat that as the target, not 24px. 20px is far under it.

**What I recommend (severity: high):**
- Keep the **icon drawing at 20px if you like it** and give it a **44px (iOS) or 48px (Android) tappable area** with transparent padding. What matters is the interactive area, not the drawing.
- Keep **at least 8px between targets**. Action icons that sit very close together (for example trash next to edit) cause mis-taps.
- Put **destructive actions** (delete) in an overflow menu, or give them less emphasis than edit.
- In the handoff, specify the hit area explicitly (`min-width/min-height: 44px` or a padding token), because a dev who reads "20x20" from Dev Mode will build a 20px button.
- Each icon-only button also needs an accessible name (`aria-label`) and a visible focus state.

If you tell me which platform it is (iOS, Android or both) and how many icons are in each row, I can propose the exact sizes and spacing, mapped to tokens.
