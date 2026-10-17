I'd recommend not blocking paste. It makes the form less secure and less accessible.

**Why not**

- **WCAG 2.2, criterion 3.3.8 (Accessible Authentication, AA):** a login step can't depend on remembering a password unless there is a support mechanism. Password managers and copy and paste are exactly that support. An `onPaste` handler with `preventDefault` is a documented failure of this criterion.
- **Security:** blocking paste pushes people toward short, memorable, reused passwords, because a long random one from a password manager can't be pasted in. It also does nothing against an attacker, who isn't pasting into your form anyway.

**What to do instead**

```tsx
import { useId, useState } from "react";

export function PasswordField({ error }: { error?: string }) {
  const id = useId();
  const errorId = `${id}-error`;
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id}>Password</label>
      <input
        id={id}
        name="password"
        type={visible ? "text" : "password"}
        autoComplete="current-password"
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      <button type="button" aria-pressed={visible} onClick={() => setVisible((v) => !v)}>
        Show password
      </button>
      {error ? <p id={errorId}>{error}</p> : null}
    </div>
  );
}
```

- No paste handler at all.
- `autoComplete="current-password"` on the password field (`new-password` on sign-up) and `autoComplete="username"` on the email field, so password managers can fill it.
- A show-password button that keeps a constant label and uses `aria-pressed`, which cuts typos.
- For wrong credentials, show one generic message ("We couldn't sign you in. Check your email and password") so the form doesn't reveal which accounts exist.

**Test that paste works**

```tsx
it("accepts pasted passwords", async () => {
  const user = userEvent.setup();
  render(<PasswordField />);
  await user.click(screen.getByLabelText("Password"));
  await user.paste("correct horse battery staple");
  expect(screen.getByLabelText("Password")).toHaveValue("correct horse battery staple");
});
```

**Better ways to harden the login (server side)**

Rate limiting and lockout with backoff, a breached-password check on sign-up, a sensible minimum length without forced symbol rules, and offering passkeys or 2FA.

If you paste your current login component, I'll fix it in place and run the tests on the server before I tell you they pass. Which React version and test setup are you on? I'd assume React 19, TypeScript and Vitest + Testing Library unless you say otherwise.
