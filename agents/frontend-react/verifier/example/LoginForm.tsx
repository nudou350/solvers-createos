import { useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";

export type LoginValues = { email: string; password: string };

type Field = keyof LoginValues;
type Errors = Partial<Record<Field, string>>;

export type LoginFormProps = {
  /** Chamado só com dados válidos. Rejeite a promise para sinalizar falha de login. */
  onSubmit: (values: LoginValues) => Promise<void> | void;
  /** Tamanho mínimo da senha. Padrão: 8. */
  minPasswordLength?: number;
  /** Título visível do formulário. Padrão: "Sign in". */
  title?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mensagem genérica de propósito: não revela se o e-mail existe ou se a senha está errada.
export const GENERIC_SUBMIT_ERROR =
  "We couldn't sign you in. Check your email and password and try again.";

function validateField(field: Field, value: string, minPasswordLength: number): string | undefined {
  if (field === "email") {
    const email = value.trim();
    if (!email) return "Enter your email.";
    if (!EMAIL_PATTERN.test(email)) return "Enter a valid email, like name@example.com.";
    return undefined;
  }
  if (!value) return "Enter your password.";
  if (value.length < minPasswordLength) {
    return `Your password must be at least ${minPasswordLength} characters long.`;
  }
  return undefined;
}

export function validateLogin(values: LoginValues, minPasswordLength = 8): Errors {
  const errors: Errors = {};
  const email = validateField("email", values.email, minPasswordLength);
  const password = validateField("password", values.password, minPasswordLength);
  if (email) errors.email = email;
  if (password) errors.password = password;
  return errors;
}

export function LoginForm({ onSubmit, minPasswordLength = 8, title = "Sign in" }: LoginFormProps) {
  const baseId = useId();
  const ids = {
    title: `${baseId}-title`,
    email: `${baseId}-email`,
    emailError: `${baseId}-email-error`,
    password: `${baseId}-password`,
    passwordError: `${baseId}-password-error`,
    passwordHint: `${baseId}-password-hint`,
  };

  const [values, setValues] = useState<LoginValues>({ email: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  // Guarda síncrona contra duplo envio (o estado só atualiza no próximo render).
  const inFlight = useRef(false);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const field = event.target.name as Field;
    const value = event.target.value;
    setValues((prev) => ({ ...prev, [field]: value }));
    // Revalida em tempo real apenas campos que já mostram erro: não acusa quem ainda está digitando.
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: validateField(field, value, minPasswordLength) }));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    const nextErrors = validateLogin(values, minPasswordLength);
    setErrors(nextErrors);
    setSubmitError(null);

    // Foco no primeiro campo inválido, na ordem visual.
    if (nextErrors.email) {
      emailRef.current?.focus();
      return;
    }
    if (nextErrors.password) {
      passwordRef.current?.focus();
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      await onSubmit({ email: values.email.trim(), password: values.password });
    } catch {
      setSubmitError(GENERIC_SUBMIT_ERROR);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  const passwordDescribedBy = [ids.passwordHint, errors.password ? ids.passwordError : null]
    .filter(Boolean)
    .join(" ");

  return (
    <form noValidate aria-labelledby={ids.title} aria-busy={submitting} onSubmit={handleSubmit}>
      <h2 id={ids.title}>{title}</h2>

      <div role="alert">{submitError ? <p>{submitError}</p> : null}</div>

      <div>
        <label htmlFor={ids.email}>Email</label>
        <input
          ref={emailRef}
          id={ids.email}
          name="email"
          type="email"
          autoComplete="email"
          required
          value={values.email}
          onChange={handleChange}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? ids.emailError : undefined}
        />
        {errors.email ? <p id={ids.emailError}>{errors.email}</p> : null}
      </div>

      <div>
        <label htmlFor={ids.password}>Password</label>
        <input
          ref={passwordRef}
          id={ids.password}
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          value={values.password}
          onChange={handleChange}
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={passwordDescribedBy}
        />
        <button
          type="button"
          aria-pressed={showPassword}
          aria-controls={ids.password}
          onClick={() => setShowPassword((prev) => !prev)}
        >
          Show password
        </button>
        <p id={ids.passwordHint}>Minimum {minPasswordLength} characters.</p>
        {errors.password ? <p id={ids.passwordError}>{errors.password}</p> : null}
      </div>

      <button type="submit" aria-disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
