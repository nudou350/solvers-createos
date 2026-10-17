I checked for a saved project profile first (`get_memory`). Nothing is stored yet. Here is the pattern first, then a few questions so I can fit it to your code.

## The short answer

Separate the kinds of server error, because each one is announced differently.

**1. A general failure** (network down, 500, wrong credentials). Use one `role="alert"` container that **always exists in the DOM** and only its content changes. A live region that is created together with its text is not reliably announced. Show a **generic, actionable message** ("We couldn't save. Check your connection and try again") and never `error.message`. Raw server text leaks details and can reveal, for example, whether an email exists. Log the detail instead.

**2. A field error from the server** ("this email is already taken"). Treat it like client validation. Put the message in an element with an ID, point to it from the field with `aria-describedby`, and set `aria-invalid="true"`. Then **move focus to the first invalid field**. The screen reader reads label, "invalid" and the error, so you don't need `role="alert"` on each field. With several, that makes it announce all of them at once.

**3. Pending and repeat clicks.** Guard with a `useRef`, because state only updates on the next render. Use `aria-disabled="true"` on the button instead of `disabled`, so focus doesn't fall to `body`. Change the text to "Saving…", and clear the previous error on resubmit.

**4. Keep what the user typed.** Don't clear the fields on failure. With React 19 `<form action>` and `useActionState`, uncontrolled fields reset after the action. Return the values in the state and use `defaultValue`, or use controlled fields.

```tsx
const inFlight = useRef(false);

async function handleSubmit(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  if (inFlight.current) return;
  inFlight.current = true;
  setPending(true);
  setFormError(undefined);
  try {
    const result = await save(values);        // returns { fieldErrors } or throws
    if (result.fieldErrors?.email) {
      setFieldErrors(result.fieldErrors);
      emailRef.current?.focus();              // first invalid field, in the handler
    }
  } catch {
    setFormError("We couldn't save. Check your connection and try again.");
  } finally {
    inFlight.current = false;
    setPending(false);
  }
}

// always rendered, content swaps
<div role="alert">{formError}</div>
<input aria-invalid={fieldErrors.email ? true : undefined}
       aria-describedby={fieldErrors.email ? emailErrorId : undefined} />
```

Don't convey the error with red alone. The text carries the meaning, and an icon, if any, gets `aria-hidden="true"`.

## To adapt it to your code

1. Can you paste the form component (or describe it)? Which React version, 18 or 19, and TypeScript or JavaScript?
2. Do you submit with `onSubmit` + `fetch`, or with a React 19 `<form action>` / `useActionState`?
3. What errors can your API return: field-level validation, credentials, conflicts, a server failure, a timeout?
4. Which framework and styling, and do you use a form library (React Hook Form, Formik)? If so, I wire it into that.
5. Are tests set up (Vitest or Jest + Testing Library)?

## What I would test

1. A rejection shows the generic message in `getByRole("alert")` and doesn't contain the server's text.
2. A field error from the server sets `aria-invalid`, `toHaveAccessibleDescription` has the message, and that field has focus.
3. A double click sends one request, and the button keeps focus and shows the pending text.
4. The typed values survive a failure.
5. A retry clears the previous error.

I run `run_tests` and `a11y_check` on the complete files once we write it and report the real results. They don't cover the real screen reader or contrast of your error text, so I'll mark those for a browser check (axe-core in the error state plus a keyboard pass).
