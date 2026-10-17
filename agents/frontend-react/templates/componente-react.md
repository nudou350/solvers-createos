# Accessible React component template (form with an async action)

A component skeleton with one validated field and an async action. Save it as `Component.tsx` (rename `Component` and `ComponentProps`), swap the field and the texts, and keep the patterns marked "PATTERN". Imports only relative and only from dependencies available in the verifier (react, react-dom, Testing Library, Vitest). In React 18, `ref` as a prop does not work: use `forwardRef` if you need to expose the ref.

```tsx
import { useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";

export type ComponentProps = {
  /** Main action. Reject the promise to signal failure. */
  onSubmit: (value: string) => Promise<void> | void;
  /** Texts as props with English defaults: makes i18n easy without bloating the API. */
  label?: string;
  submitLabel?: string;
  pendingLabel?: string;
  successMessage?: string;
  errorMessage?: string;
};

// PATTERN: pure validation, outside the component, easy to test in isolation.
export function validate(value: string): string | undefined {
  if (!value.trim()) return "Fill in this field.";
  return undefined;
}

export function Component({
  onSubmit,
  label = "Name",
  submitLabel = "Save",
  pendingLabel = "Saving…",
  successMessage = "Saved successfully.",
  errorMessage = "Could not save. Please try again.",
}: ComponentProps) {
  // PATTERN: IDs with useId (stable on SSR, no collisions between instances).
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const errorId = `${baseId}-error`;

  const [value, setValue] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");

  const inputRef = useRef<HTMLInputElement>(null);
  // PATTERN: synchronous guard against double submit.
  const inFlight = useRef(false);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setValue(event.target.value);
    // PATTERN: only revalidate live if the field already shows an error.
    if (fieldError) setFieldError(validate(event.target.value));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    const error = validate(value);
    setFieldError(error);
    if (error) {
      // PATTERN: focus on the invalid field, in the handler (the element already exists).
      inputRef.current?.focus();
      return;
    }

    inFlight.current = true;
    setStatus("pending");
    try {
      await onSubmit(value.trim());
      setStatus("success");
    } catch {
      // PATTERN: generic message; do not expose error.message to the user.
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }

  const pending = status === "pending";

  return (
    <form noValidate onSubmit={handleSubmit}>
      <label htmlFor={inputId}>{label}</label>
      <input
        ref={inputRef}
        id={inputId}
        name="value"
        type="text"
        required
        value={value}
        onChange={handleChange}
        aria-invalid={fieldError ? true : undefined}
        aria-describedby={fieldError ? errorId : undefined}
      />
      {fieldError ? <p id={errorId}>{fieldError}</p> : null}

      {/* PATTERN: aria-disabled keeps focus on the button during submit. */}
      <button type="submit" aria-disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </button>

      {/* PATTERN: live regions always present; only the content changes. */}
      <div role="status">{status === "success" ? successMessage : null}</div>
      <div role="alert">{status === "error" ? errorMessage : null}</div>
    </form>
  );
}
```
