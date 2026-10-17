---
title: React 19.x: versions, new features that affect components and current tooling
source: react.dev (versions and release posts for 19.2, 19.3 and React Compiler 1.0) and the npm registry
source_url: https://react.dev/versions
source_date: 2026-10-02
valid_until: 2027-01-31
trial: true
tags: [react-19, versions, compiler, useeffectevent, view-transition]
---

## Timeline (checked on 2026-10-02)

According to react.dev/versions: 19.0 on 2024-12-05, 19.1 on 2025-03-28, 19.2 on 2025-10-01 and 19.3 on 2026-09-09 (the latest at the time of this check). The `react` package on the npm registry is also at 19.3.0. React Compiler reached version 1.0 in October 2025. Before stating a version to the user, check the date of this source and warn the user if it has expired.

Rule for the answer: write for the version the user's profile reports. With no information, assume React 19 and TypeScript, say that you assumed it, and avoid APIs that only exist in newer versions without warning.

## What arrived in 19.2

`<Activity>` controls parts of the interface in two modes: `visible` and `hidden` (hides the children, unmounts the effects and defers updates), useful for keeping the state of a hidden tab. `useEffectEvent` separates "event" logic from effect logic: it lets you read the latest props and state inside an effect without re-running the effect. Rules for the hook: only call it from inside effects, do not pass it to other components and do not include it in the dependency list. The `eslint-plugin-react-hooks` v6 package uses flat config by default. The `useId` prefix changed to `_r_`.

```tsx
const onTick = useEffectEvent(() => setCount(count + step));
useEffect(() => {
  const id = setInterval(() => onTick(), 1000);
  return () => clearInterval(id);
}, []); // step does not restart the interval
```

## What arrived in 19.3

`<ViewTransition>` is stable: it animates enter, exit, move and resize using the browser's View Transitions API, and only animates updates marked as a transition (`startTransition`, `<Suspense>`, `useDeferredValue`). Fragment with `ref` (`FragmentInstance`) offers `focus()`, `focusLast()`, `blur()`, observers and measurement for a group of sibling elements without an extra container: useful for focus management in groups. Forms now reset after Server Actions by firing `onReset`, and the `submit` event includes the `submitter`. There is support for Trusted Types in React DOM.

For animation, remember to respect `prefers-reduced-motion` in view transitions too.

## React Compiler 1.0

It is a build tool that memoizes components and hooks automatically. It works with React 17 or newer (on 19 with no extra configuration; on 17 and 18 it requires `react-compiler-runtime` and a minimum target). In new code, leave memoization to the compiler and use `useMemo` and `useCallback` only when you need explicit control; in existing code, keep the manual memoization unless you have tested removing it. The compiler's lint rules ship in `eslint-plugin-react-hooks` and do not require the compiler to be installed.

## Testing and build tools (npm, 2026-10-02)

`vitest` 5.0.3 (Node `^22.12.0 || ^24.0.0 || >=26.0.0`), `@testing-library/react` 16.3.3, `@testing-library/user-event` 14.6.7, `typescript` 7.0.2, `next` 16.3.8 (Node 20.9 or later). This specialist's verifier runs Vitest with jsdom, with no network: only the dependencies installed there are available (react, react-dom and the testing libraries).
