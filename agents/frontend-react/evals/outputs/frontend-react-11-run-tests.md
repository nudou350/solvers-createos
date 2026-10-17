Happy to. Before I write code, a few quick answers will save rework. If you'd rather skip them, say "do it your way" and I'll use the defaults at the bottom.

**What I'd build**

A toggle button (for example "Mute", "Bold", "Notifications") using a native `<button type="button">` with `aria-pressed`. No `role="switch"` and no `div`. Enter and Space work for free, and the label stays constant ("Mute"), because the pressed state is announced through `aria-pressed`. Changing the text as well would make a screen reader say it twice or say the opposite.

**Questions (reply with just the letters or numbers)**

1. React 19 + TypeScript, or React 18 / JavaScript? (This changes how `ref` is passed.)
2. Controlled (you pass `pressed` and `onPressedChange`) or uncontrolled (it keeps its own state and notifies you)? I'd default to uncontrolled, with an optional `defaultPressed`.
3. Is there a visual label with an icon, or text only? If it has an icon, I'll hide the icon from assistive tech and keep the text as the name.
4. Does it need styles (a pressed look, dark theme), or is neutral CSS enough? If it has styles, I'll also assert the contrast of the color pairs in a test.
5. Is Vitest + Testing Library already set up? If not, I'll deliver exactly that, since it's what the server runs.

**Ready-when criteria I'd test**

1. The button is found by `getByRole("button", { name: "Mute" })` and starts with `aria-pressed="false"`.
2. Click, Enter and Space each flip `aria-pressed`.
3. `onPressedChange` is called with the new value, once per activation.
4. Focus stays on the button after activation.
5. A disabled toggle ignores clicks and keys.

**How I'll prove it**

After you approve the list, I'll write the component and the tests, then call the server runner with the complete files:

```json
{
  "tool": "run_tests",
  "input": {
    "files": [
      { "path": "ToggleButton.tsx", "content": "<full component>" },
      { "path": "ToggleButton.test.tsx", "content": "<full tests>" }
    ]
  }
}
```

I'll also send the same files through `a11y_check`. I won't say the tests pass until `run_tests` has actually returned a passing result in this session. If a test fails, I'll fix the component, not weaken the test. I'll report the real counts, for example "5 of 5 passing".

**What this can't prove**

The runner uses jsdom, and `a11y_check` is a static scan. Neither can verify the visible focus ring, color contrast in the browser, or real screen reader speech. I'll list those as "not verified here" and suggest an axe-core run plus a keyboard pass in your project.

**Defaults if you skip the questions:** React 19, TypeScript, Vitest + Testing Library, uncontrolled, neutral plain CSS. I'll state them as assumptions.
