I checked for a saved project profile first (`get_memory`). Nothing is stored yet, so I need a few details before writing code. A login form looks simple, but a few decisions change the component and its tests.

## What I understood

A **login form** (email + password) with client-side validation, an async submit that can fail, and tests. It is built on native HTML (`<form>`, `<label>`, `<input>`, `<button>`), so there is no ARIA pattern to add. Native elements come first.

## Questions (answer what you can, or say "do it your way")

1. **Stack:** React 19 or 18? TypeScript or JavaScript? Framework (Next.js App Router, Vite, Remix)? In Next.js the component needs `"use client"`.
2. **Styling:** Tailwind, CSS Modules, styled-components or plain CSS? Do you already use a component library (Radix, shadcn/ui, MUI, React Aria)? If so, I build on its inputs and buttons.
3. **Tests:** is Vitest or Jest with Testing Library already set up? If not, I deliver Vitest + Testing Library.
4. **Behavior:** is `onSubmit(values)` a promise that rejects on bad credentials? Do you need "Forgot password?", "Remember me" or a "Sign up" link? Should the component be controlled or keep its own state (my default is own state)?
5. **Look and feel:** light and dark theme? A brand color you must keep? I ask because the brand color is usually not safe for text, focus ring or field borders, and I plan separate tokens for those.
6. **Ready when:** what has to work for you to call it done?

## Draft of the behavior I plan to deliver

- Labels via `<label htmlFor>` with IDs from `useId()`, never placeholders as labels.
- `autoComplete="username"` / `"current-password"`, so password managers work. **Pasting is never blocked** (blocking it fails WCAG 2.2 criterion 3.3.8).
- A "Show password" button with `type="button"` and `aria-pressed`.
- Validation on submit. All errors appear together, each tied to its field with `aria-describedby` + `aria-invalid`, and focus goes to the first invalid field. After that, a field with an error revalidates as the user types. There is no `role="alert"` on each field, which avoids stacked announcements.
- Invalid credentials give one **generic** message ("We couldn't sign you in. Check your email and password") in a `role="alert"` container that is always in the DOM. I never show `error.message`, so the form doesn't reveal whether an email exists.
- During submit the button uses `aria-disabled` plus a `useRef` guard, with the text "Signing in…". Focus stays on the button and a double click calls `onSubmit` once.

## Draft test list (you approve it in the next step)

1. Fields are found by role/label and name.
2. Empty submit shows the errors, sets `aria-invalid`, and focuses the email field.
3. An invalid email shows an actionable message ("Enter an email like name@example.com").
4. The error disappears once the user fixes the field.
5. The happy path calls `onSubmit` with the trimmed values.
6. A double click calls `onSubmit` once, and the pending text shows.
7. A rejection shows the generic message in `role="alert"`, with no leaked detail.
8. The show-password toggle flips `type` and `aria-pressed` without submitting the form.
9. Enter in the password field submits.
10. Pasting into the password field works.

## How I'll verify

When it is done, I run `run_tool` with `run_tests` and `a11y_check` on the complete files and report the real results. Those cover roles, names, focus and behavior. Contrast, focus ring visibility and a real screen reader need a browser pass (axe-core plus a keyboard pass), and I'll list them as not verified here.

If you say "do it your way", I'll assume React 19 + TypeScript + Vitest + Testing Library with neutral CSS, and I'll state that I assumed it.
