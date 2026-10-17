**It is acceptable for the accessibility minimum, but it is not good for a mobile app.**

- **WCAG 2.2 AA, criterion 2.5.8 (Target Size, Minimum):** at least **24x24 CSS px**. A 28px clickable area **passes** this.
- **Mobile platform goal:** **44x44pt on iOS** and **48x48dp on Android**. For a mobile product, that is the number to aim for, not 24px. 28px is well below it, and it causes mis-taps, especially for people with motor impairments or when walking.

**Recommendation (severity: medium; it is a usability gap rather than a WCAG failure):**
- Keep the **icon drawing as it is** (for example 20 to 24px) and enlarge the **interactive area** to 44px (iOS) or 48px (Android) with transparent padding. What matters is the clickable area, not the drawing.
- Keep **at least 8px between adjacent buttons**, particularly when one of them is destructive (trash next to edit).
- Move **destructive actions** into a menu, or give them less emphasis.
- In the handoff, state the **hit area** explicitly (`min-width` and `min-height` of 44 or 48px, or a padding token), because a dev reading "28px" from Dev Mode will build a 28px button.
- Every icon-only button needs an accessible name (`aria-label`) and a visible focus state.

Which platform is it (iOS, Android or both)? That sets the exact goal. If the 28px is a hard constraint because of dense layouts, tell me where it appears and I can suggest how to increase the tappable area without changing the visual design.
