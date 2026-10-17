No. In React 19, `ref` is a regular prop for function components, so you can drop `forwardRef` in new code. The React docs say `forwardRef` is no longer needed and will be deprecated in a future release. It still works today, so existing code won't break.

**React 19 version**

```tsx
import { useId, type ComponentProps } from "react";

type InputProps = ComponentProps<"input"> & {
  label: string;
};

export function Input({ label, id, ref, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <>
      <label htmlFor={inputId}>{label}</label>
      <input id={inputId} ref={ref} {...rest} />
    </>
  );
}
```

Usage:

```tsx
const emailRef = useRef<HTMLInputElement>(null);
// ...
<Input label="Email" ref={emailRef} type="email" autoComplete="email" />
// emailRef.current?.focus() on the first invalid field
```

**Details that matter**

- Use `ComponentProps<"input">`, which includes `ref` in React 19. `ComponentPropsWithoutRef` would leave it out.
- Pass an initial value to `useRef`. In the React 19 types, `useRef()` with no argument is a type error, and `useRef<HTMLInputElement>(null)` gives `RefObject<HTMLInputElement | null>`.
- A ref callback can now return a cleanup function. So `ref={(el) => (x = el)}` with an implicit return is a type error. Use braces: `ref={(el) => { x = el; }}`.
- Use `useId()` for IDs, not `Math.random()`, which breaks hydration.

**When you still need `forwardRef`**

If any project that consumes this component is still on React 18, `ref` as a prop is dropped there (with a console warning), so keep `forwardRef` in that code, or in a shared library you also publish for 18. Check `react` and `@types/react` are both on 19 before removing it.

**How I'd verify a migration**

A test that renders `<Input label="Email" ref={ref} />` and asserts `ref.current` is the input, plus `getByLabelText("Email")` to confirm the name is connected. If you paste your current component, I'll convert it, write that test and run it on the server before I tell you it passes. Which styling approach and component library do you use? I'd assume plain CSS and none.
