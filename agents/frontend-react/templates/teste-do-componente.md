# Component test template (Testing Library + Vitest)

Behavior tests: each test describes something the user perceives, with queries by role and accessible name and `user-event` always with `await`. Save it as `Component.test.tsx` next to the component from the `componente-react` template. Add one test for each ready-when criterion agreed in the planning step.

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Component, validate } from "./Component";

// Controlled promise to test the pending state.
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(onSubmit: (value: string) => Promise<void> | void = vi.fn()) {
  const user = userEvent.setup();
  render(<Component onSubmit={onSubmit} />);
  return {
    user,
    onSubmit,
    input: screen.getByRole("textbox", { name: "Name" }),
    submit: screen.getByRole("button", { name: "Save" }),
  };
}

describe("Component", () => {
  it("exposes the field and the button with accessible names", () => {
    const { input, submit } = setup();
    expect(input).toBeRequired();
    expect(submit).toHaveAttribute("type", "submit");
  });

  it("empty: shows an error tied to the field, focuses the field and does not submit", async () => {
    const { user, onSubmit, input, submit } = setup();
    await user.click(submit);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Fill in this field.");
    expect(input).toHaveFocus();
  });

  it("the error goes away when the user fixes it", async () => {
    const { user, input, submit } = setup();
    await user.click(submit);
    await user.type(input, "Ana");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAccessibleDescription();
  });

  it("submits with Enter, signals loading, ignores a double submit and announces success", async () => {
    const pending = deferred();
    const onSubmit = vi.fn(() => pending.promise);
    const { user, input, submit } = setup(onSubmit);

    await user.type(input, "  Ana  {Enter}");
    await user.click(submit);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("Ana");
    expect(submit).toHaveTextContent("Saving…");
    expect(submit).toHaveAttribute("aria-disabled", "true");

    pending.resolve();
    expect(await screen.findByText("Saved successfully.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Saved successfully.");
    expect(submit).toHaveAttribute("aria-disabled", "false");
  });

  it("failure: announces a generic error in role=alert", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("500 internal: stack trace"));
    const { user, input } = setup(onSubmit);

    await user.type(input, "Ana{Enter}");

    const alert = await screen.findByRole("alert");
    expect(await screen.findByText("Could not save. Please try again.")).toBeInTheDocument();
    expect(alert).not.toHaveTextContent("stack trace");
  });
});

describe("validate", () => {
  it.each(["", "   "])("rejects an empty value: %j", (value) => {
    expect(validate(value)).toBeDefined();
  });

  it("accepts a filled value", () => {
    expect(validate("Ana")).toBeUndefined();
  });
});
```
