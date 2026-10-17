import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GENERIC_SUBMIT_ERROR, LoginForm, validateLogin } from "./LoginForm";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(onSubmit = vi.fn()) {
  const user = userEvent.setup();
  render(<LoginForm onSubmit={onSubmit} />);
  return {
    user,
    onSubmit,
    form: screen.getByRole("form", { name: "Sign in" }),
    email: screen.getByRole("textbox", { name: "Email" }),
    password: screen.getByLabelText("Password"),
    toggle: screen.getByRole("button", { name: "Show password" }),
    submit: screen.getByRole("button", { name: "Sign in" }),
  };
}

describe("LoginForm", () => {
  it("exposes the form, fields and buttons with accessible names", () => {
    const { form, email, password, submit } = setup();
    expect(form).toBeInTheDocument();
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(email).toBeRequired();
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    expect(password).toHaveAccessibleDescription("Minimum 8 characters.");
    expect(submit).toHaveAttribute("type", "submit");
  });

  it("with empty fields shows errors tied to the fields, focuses the email and does not submit", async () => {
    const { user, onSubmit, email, password, submit } = setup();
    await user.click(submit);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Enter your email.");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAccessibleDescription(/Enter your password./);
    expect(email).toHaveFocus();
  });

  it("with a valid email and a short password focuses the password", async () => {
    const { user, onSubmit, email, password, submit } = setup();
    await user.type(email, "ana@example.com");
    await user.type(password, "123");
    await user.click(submit);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(email).not.toHaveAttribute("aria-invalid");
    expect(password).toHaveAccessibleDescription(/at least 8 characters/);
    expect(password).toHaveFocus();
  });

  it("clears the error while the user fixes the field", async () => {
    const { user, email, submit } = setup();
    await user.type(email, "ana@");
    await user.click(submit);
    expect(email).toHaveAccessibleDescription(/valid email/);

    await user.type(email, "example.com");
    expect(email).not.toHaveAttribute("aria-invalid");
    expect(email).not.toHaveAccessibleDescription();
  });

  it("submits with the keyboard alone using Enter and trims spaces from the email", async () => {
    const { user, onSubmit, email, password, toggle, submit } = setup(
      vi.fn().mockResolvedValue(undefined),
    );

    await user.tab();
    expect(email).toHaveFocus();
    await user.keyboard("  ana@example.com ");
    await user.tab();
    expect(password).toHaveFocus();
    await user.keyboard("secret123");
    await user.tab();
    expect(toggle).toHaveFocus();
    await user.tab();
    expect(submit).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ email: "ana@example.com", password: "secret123" });
  });

  it("while submitting signals loading and ignores repeated clicks", async () => {
    const pending = deferred();
    const { user, onSubmit, email, password, form } = setup(vi.fn(() => pending.promise));
    await user.type(email, "ana@example.com");
    await user.type(password, "secret123");

    const submit = screen.getByRole("button", { name: "Sign in" });
    await user.click(submit);
    await user.click(submit);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveTextContent("Signing in…");
    expect(submit).toHaveAttribute("aria-disabled", "true");
    expect(form).toHaveAttribute("aria-busy", "true");

    pending.resolve();
    expect(await screen.findByRole("button", { name: "Sign in" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
  });

  it("when the login fails announces a generic error and allows trying again", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error("user not found: ana@example.com"))
      .mockResolvedValueOnce(undefined);
    const { user, email, password, submit } = setup(onSubmit);
    await user.type(email, "ana@example.com");
    await user.type(password, "secret123");
    await user.click(submit);

    const alert = screen.getByRole("alert");
    expect(await screen.findByText(GENERIC_SUBMIT_ERROR)).toBeInTheDocument();
    expect(alert).toHaveTextContent(GENERIC_SUBMIT_ERROR);
    expect(alert).not.toHaveTextContent("user not found");

    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(alert).toBeEmptyDOMElement();
  });

  it("the show password button toggles the field type and the pressed state", async () => {
    const { user, password, toggle } = setup();
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    await user.click(toggle);
    expect(password).toHaveAttribute("type", "password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("the show password button does not submit the form", async () => {
    const { user, onSubmit, toggle, email } = setup();
    await user.click(toggle);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(email).not.toHaveAttribute("aria-invalid");
  });
});

describe("validateLogin", () => {
  it("accepts valid data", () => {
    expect(validateLogin({ email: " ana@example.com ", password: "12345678" })).toEqual({});
  });

  it("respects the configured minimum length", () => {
    expect(validateLogin({ email: "ana@example.com", password: "1234" }, 4)).toEqual({});
    expect(validateLogin({ email: "ana@example.com", password: "123" }, 4).password).toMatch(
      /at least 4/,
    );
  });

  it.each(["ana", "ana@", "ana@example", "ana @example.com"])("rejects an invalid email: %s", (email) => {
    expect(validateLogin({ email, password: "12345678" }).email).toBeDefined();
  });
});
