That symptom is a classic race condition: you navigate from page A to page B, but the response for A arrives after the one for B (or after B starts loading), and it overwrites the state. The effect has no cleanup, so nothing cancels the old request.

## Fix: cancel the old request in the effect cleanup

```tsx
type Status = "loading" | "error" | "success";

function Profile({ userId }: { userId: string }) {
  const [data, setData] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setData(null); // never show the previous page's data under the new id

    fetch(`/api/users/${userId}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<User>;
      })
      .then((user) => {
        setData(user);
        setStatus("success");
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return; // expected
        setStatus("error");
      });

    return () => controller.abort(); // runs when userId changes or on unmount
  }, [userId]);

  if (status === "loading") return <p role="status">Loading…</p>;
  if (status === "error") return <p role="alert">Could not load this profile.</p>;
  return <h1>{data?.name}</h1>;
}
```

Why it works: when `userId` changes, React runs the cleanup of the previous effect first, which aborts request A, so its `then` never writes into state. If you cannot use `AbortController` (an SDK that does not accept a signal), use a flag instead: `let ignore = false;` ... `if (!ignore) setData(...)` ... `return () => { ignore = true; }`.

## Two things that remove the bug at its root

- **Reset by identity with `key`.** `<Profile key={userId} userId={userId} />` throws away the old state when the id changes, so stale data cannot survive. No effect needed for the reset.
- **Do not hand-roll fetching in an effect if you can avoid it.** React Query / TanStack Query, SWR, your router's loaders or (in Next.js) Server Components handle cancellation, caching and races for you.

Also check that the effect has cleanup for anything else it starts (timers, listeners): in development, Strict Mode mounts, unmounts and mounts again precisely to expose a missing cleanup.

## Accessibility note

The loading and error messages above are announced because they are status/alert content; do not move focus on load (focus only moves on a user action). On a route change, move focus to the new page's `<h1>` instead.

## A test that would have caught this

```tsx
it("does not show data from the previous id", async () => {
  const a = deferred<User>(); const b = deferred<User>();
  vi.spyOn(globalThis, "fetch")
    .mockReturnValueOnce(a.promise.then(json))
    .mockReturnValueOnce(b.promise.then(json));
  const { rerender } = render(<Profile userId="a" />);
  rerender(<Profile userId="b" />);
  b.resolve({ name: "Bea" });
  a.resolve({ name: "Ana" }); // arrives late
  expect(await screen.findByRole("heading", { name: "Bea" })).toBeInTheDocument();
  expect(screen.queryByText("Ana")).not.toBeInTheDocument();
});
```

To tailor this to your code, tell me: React 18 or 19, which framework (Next.js, Vite, React Router), whether you already use a data library, and paste your component. When I deliver the final version, I will run its tests on the server and report the exact result.
