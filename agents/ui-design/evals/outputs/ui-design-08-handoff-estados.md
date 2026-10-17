For the email field, the dev should not have to open Figma again to know what happens. Here is what to specify. I have not read your file, so token names below follow the standard naming of this method; anything that does not yet exist in your design is marked **proposed (validate with design)**.

**1. Anatomy and content**
- Visible **label** "Email" above the field (never a placeholder as a label). Placeholder optional, e.g. "name@domain.com", at 4.5:1 or omit it.
- Help text (if any) below, under 80 characters per line.
- Required or optional marked consistently with the rest of the form.

**2. State matrix (with tokens)**

| State | Border | Text and other | Notes |
|---|---|---|---|
| Default | `color.border.input` (needs 3:1 on the background) | text `color.text.default`, label `color.text.default` | height 48px on mobile (`input.height`), horizontal padding 12 to 16px |
| Hover (pointer only) | `color.border.strong` | | no hover on touch, so nothing may depend on it |
| Focus (`:focus-visible`) | 2px ring `color.border.focus`, offset 2px, 3:1 against the background | | focus must be visible with the keyboard; never remove the outline without a replacement (WCAG 2.4.7) |
| Filled | `color.border.input` | text `color.text.default` | |
| Error | `color.feedback.error.border` | icon + message in `color.feedback.error.text` | not red alone (1.4.1) |
| Disabled | background `color.bg.disabled` | text `color.text.disabled` | **proposed**: avoid disabling unless needed; if used, explain why next to it |
| Read-only | no border or dashed | selectable text | **proposed**, only if it exists in the flow |
| Loading (on submit) | | | the field stays; the button gets `aria-disabled="true"`, text "Creating account…", same width |

**3. Messages (write the exact copy)**
- Empty on submit: "Enter your email."
- Invalid format: "Enter an email in the format name@domain.com."
- Already registered: "This email already has an account. Sign in or reset your password."
- Server/network failure: "Couldn't verify your email. Try again."

**4. Behavior**
- Validate on **blur** or on submit, not on every keystroke.
- On submit with errors, move focus to the first invalid field (or an error summary).
- Error is linked with `aria-describedby` and the field has `aria-invalid="true"`; the message is announced (`role="alert"`).
- Trim spaces on paste, accept uppercase, normalize in code. Do not ask for the email twice (redundant entry, WCAG 3.3.7).

**5. Code attributes:** `type="email"`, `autocomplete="email"`, `inputmode="email"`, `autocapitalize="off"`, `spellcheck="false"`, font size 16px or more (avoids iOS zoom on focus).

**6. Edge cases:** a very long address with no spaces (wrap with `overflow-wrap: anywhere`; do not clip it), 200% zoom and 320px width with no clipping, a translated label that is longer, dark mode (the border and error colors need their own values and 3:1).

**7. Accessibility checklist:** visible label associated with the field, targets of at least 24x24px (44 to 48px on touch), contrast verified with the contrast check tool (`texto` for text, `ui` for the border and focus ring) in every state and in light and dark.

**8. Design open items:** list the states that are missing in Figma (typically error, disabled, loading) with an owner and a deadline.

If you send me the frame link with a node-id (or screenshots and the inspector values), plus the component library the dev uses (shadcn/ui, MUI, etc.), I will fill this into the full handoff document with your real tokens and breakpoints.
