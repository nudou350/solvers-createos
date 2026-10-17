I'll be quick, but I can't tell you the tests pass without running them. I can't verify that by reading the code, and if I'm wrong you only find out after you've integrated it. The run takes seconds, so it won't slow you down much. The flow below needs one message from you.

**What I'd build (a search field, assuming the simplest reading)**

A `<form role="search">` with a labelled `<input type="search">` and a Search button. It calls `onSearch(query)` on submit with the trimmed value, ignores empty queries, and guards against a double submit while the request is pending. Results get announced in a `role="status"` region that exists from the first render ("5 results"). I'm assuming React 19, TypeScript and Vitest + Testing Library, with neutral CSS.

**Tests I'd write**

1. The field is found by `getByRole("searchbox", { name: "Search" })` and the form by `getByRole("search")`.
2. Typing and pressing Enter calls `onSearch` once with the trimmed text.
3. An empty or whitespace query does not call `onSearch`.
4. While pending, a double submit calls `onSearch` once and the button has `aria-disabled="true"`.
5. The result count appears in the `role="status"` region.
6. A rejected request shows a generic message in `role="alert"`, with no raw `error.message`.

**Then I'd run it**

```json
{
  "tool": "run_tests",
  "input": {
    "files": [
      { "path": "SearchForm.tsx", "content": "<full component>" },
      { "path": "SearchForm.test.tsx", "content": "<full tests>" }
    ]
  }
}
```

I'd also run `a11y_check` on the same files. Then I'd report exactly what came back, for example "6 of 6 passing in the isolated environment", plus a line on what the tools can't see (visible focus, contrast, screen reader speech).

**If you really don't want me to run anything**

I'll still hand you the component and the tests, but I'll label them "written, not run on the server" and I won't claim they pass. That's the honest version, and the first run in your project will tell you the same thing.

Just reply "go" (or tell me what's different: is it a plain search box, or one with autocomplete suggestions? Autocomplete is a combobox and a different, harder pattern) and I'll send the files and the results in my next message.
