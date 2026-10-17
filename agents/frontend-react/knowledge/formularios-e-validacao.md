---
title: Accessible forms and validation in React
source: WCAG 2.2 (W3C), React 19 documentation and the error summary pattern from the GOV.UK Design System
source_url: https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html
source_date: 2026-10-02
valid_until: 2027-01-31
tags: [forms, validation, authentication, useactionstate, wcag]
---

# Accessible forms and validation in React

Forms are where most AI-generated components fail: a placeholder instead of a label, an error shown only in red, focus lost after submit, a button that submits twice. This guide gives the full pattern and the details that separate a form that "works" from one that passes an audit.

## Minimum structure of a field

```tsx
<label htmlFor={id}>Email</label>
<input
  id={id}
  name="email"
  type="email"
  autoComplete="email"
  required
  aria-invalid={error ? true : undefined}
  aria-describedby={[hintId, error ? errorId : null].filter(Boolean).join(" ") || undefined}
/>
<p id={hintId}>We'll use it to send your receipt.</p>
{error ? <p id={errorId}>{error}</p> : null}
```

Details that matter:
- **`htmlFor` + `id`** (or the input inside the `<label>`). Clicking the label focuses the field and enlarges the click area.
- **The right `type`** changes the mobile keyboard: `email`, `tel`, `url`, `number` (careful, see below), `search`.
- **`autoComplete`** is WCAG criterion 1.3.5 (AA) for personal data: `name`, `given-name`, `email`, `tel`, `street-address`, `postal-code`, `cc-number`, `one-time-code`, `current-password`, `new-password`. `new-password` makes the password manager suggest a strong password; `one-time-code` enables SMS code autofill.
- **`aria-invalid` only when there is an error.** `aria-invalid="false"` is valid but noisy; removing the attribute is cleaner.
- **Order of `aria-describedby`**: hint before error. The screen reader reads in the order of the IDs.
- **Native `required`** tells the screen reader the field is mandatory even with `noValidate` on the form. Mark it visually too (an asterisk with the legend "* required", or "(optional)" on the few optional fields, which is usually clearer).

## `type="number"`: when not to use it

Use `inputMode="numeric"` with `type="text"` for ID numbers, postal codes, card numbers and codes (for example the Brazilian CPF taxpayer ID and CEP postal code). `type="number"` accepts `e`, `+`, `-`, strips leading zeros, changes the value with the mouse wheel and has arrows that are useless for these cases. Use `type="number"` only for real quantities (age, number of items). For money in a locale that uses a decimal comma (such as pt-BR), use `type="text" inputMode="decimal"` and your own parsing (decimal comma).

## When to validate

Recommended strategy (the same as the `LoginForm` example component):

1. **On submit**, validate everything. Show all the errors at once.
2. **Focus the first invalid field**, in visual order. The screen reader announces the label, "invalid" and the description (the error). No `role="alert"` is needed on the fields.
3. **Once a field shows an error, revalidate on every change** so the error disappears as soon as the user fixes it.
4. **Do not validate untouched fields while the user is typing.** "Invalid email" appearing at the first letter is hostile.
5. Validating on `blur` is acceptable for fields with a format (email, postal code), but never move focus on `blur`.

For long forms (more than about 6 fields), add an **error summary** at the top: a container with a heading like "Fix 3 fields", a list of anchor links to each field, and focus moved to the summary (with `tabIndex={-1}`) instead of the first field. This is the GOV.UK Design System pattern, widely tested.

## Error messages

- Say what to do, not just what is wrong: "Enter a valid email, like name@example.com" instead of "Invalid email".
- Do not rely on color (WCAG 1.4.1): text plus an optional icon. The icon gets `aria-hidden="true"`; the text already says everything.
- Do not use a generic "required field": "Enter your ID number".
- Server errors about credentials: a **generic message** ("We couldn't sign you in. Check your email and password"). Different messages for "email not registered" and "wrong password" allow account enumeration.

## Async submit

```tsx
const inFlight = useRef(false);
async function handleSubmit(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  if (inFlight.current) return;
  // validate...
  inFlight.current = true;
  setPending(true);
  try { await onSubmit(values); }
  catch { setSubmitError(GENERIC); }
  finally { inFlight.current = false; setPending(false); }
}
```

- **Guard in `useRef`**, not just in state: two clicks in the same tick see the old state.
- **Button with `aria-disabled="true"`** during submit, not `disabled`: `disabled` removes the button from the Tab order and, if it was focused, focus falls to `body`. With `aria-disabled` focus stays, the screen reader announces "unavailable" and the guard prevents the double submit.
- **The button text changes** ("Sign in" → "Signing in…"). Optional: `aria-busy` on the form.
- **General error** in a persistent `role="alert"` container, cleared on resubmit.
- **Success**: if the page does not navigate, announce it with `role="status"` ("Changes saved") and decide where focus goes (usually it stays where it is).

## Forms with React 19

React 19 accepts a function in `<form action={fn}>`. With `useActionState`:

```tsx
const [state, formAction, isPending] = useActionState(
  async (prev: State, formData: FormData) => {
    const email = String(formData.get("email") ?? "");
    // validate, call the API, return the new state
    return { errors: {}, ok: true };
  },
  { errors: {}, ok: false },
);
return <form action={formAction}>...</form>;
```

- `isPending` replaces the manual loading state.
- `useFormStatus()` inside a child component of the `<form>` gives `pending` to the submit button without prop drilling.
- **Pitfall:** after the action, React **resets the uncontrolled fields** of the form. If there is a validation error, the user loses what they typed. Fix: return the values in the state and use `defaultValue={state.values.email}`, or use controlled fields.
- Focusing the first invalid field is still your responsibility: do it in a `useEffect` that depends on `state.errors`, or validate on the client before the action.
- In Vitest/jsdom, `<form action={fn}>` works with React 19, but remember to wait with `findBy*`, because the action runs in a transition.

## Login and password: what WCAG 2.2 requires

Criterion 3.3.8 (Accessible Authentication, level AA) says no authentication step may require a cognitive function test (remembering a password, solving a puzzle) unless there is an alternative or a support mechanism. Password managers and copy and paste count as a support mechanism. In practice, for the login component:

- **Never block pasting** in the email, password and code fields (`onPaste` with `preventDefault` is a failure).
- **Mark the fields for the password manager**: `type="email"` or `type="text"` with `autoComplete="username"`, `type="password"` with `autoComplete="current-password"` (or `new-password` on sign-up) and a consistent `name`.
- **Offer to show the password** (a button with `aria-pressed` and the name "Show password"), which reduces typos.
- One-time code: `autoComplete="one-time-code"` and `inputMode="numeric"`.

Criterion 3.3.7 (Redundant Entry, level A) asks not to require users to type again information they already gave in the same flow: prefill it or offer to select what was already provided (for example, a delivery address that is the same as the billing address).

## Groups: radio and checkbox

```tsx
<fieldset aria-describedby={error ? errorId : undefined}>
  <legend>Delivery method</legend>
  <label><input type="radio" name="delivery" value="pickup" /> Pick up in store</label>
  <label><input type="radio" name="delivery" value="home" /> Deliver to my address</label>
</fieldset>
```

- `<legend>` is announced together with each option. Without a `fieldset`, loose "Yes/No" options have no context.
- Native radios with the same `name` already navigate with arrows. Do not rebuild them with `div`.
- For a group error, `aria-invalid` is not supported on `fieldset`; tie the message with `aria-describedby` on the `fieldset` and focus the first radio.

## Input masks

Masks for ID numbers, phone numbers and dates that rewrite the value on every keystroke break pasting, undo and screen readers (the cursor jumps to the end). Preferences, in order:
1. No mask, with a format hint ("E.g. 123.456.789-09", the format of a Brazilian CPF) and normalization on submit (remove everything that is not a digit).
2. A mask that only formats on `blur`.
3. A mature mask library (for example react-imask) tested with a screen reader.

Always accept the value with or without punctuation and normalize it in code.

## Essential form tests

- `getByRole("textbox", { name: "Email" })` passes → label connected.
- `toHaveAccessibleDescription("...")` → error tied by `aria-describedby`.
- `toHaveAttribute("aria-invalid", "true")` after an invalid submit.
- `toHaveFocus()` on the first invalid field.
- A double click calls `onSubmit` once (use a controlled promise).
- A rejection shows a generic message in `getByRole("alert")` and does not leak `error.message`.
- Enter in the last field submits.
