I checked for a saved project profile first (`get_memory`). Nothing is stored yet, so a few questions before I write anything.

## What I understood

A **tabs** component following the WAI-ARIA tabs pattern. One check first: tabs mean alternating panels **in the same page**. If each tab should go to a different URL, it isn't tabs. It is navigation with links and `aria-current="page"`, and I'd build that instead.

The pattern needs:
- `role="tablist"` with an accessible name (`aria-label`).
- `role="tab"` children with `aria-selected` and `aria-controls`.
- `role="tabpanel"` with `aria-labelledby`, and `tabIndex={0}` when the panel has no focusable content at its start.
- **Roving tabindex:** only the active tab has `tabIndex={0}` and the rest have `-1`. Left/Right arrows move between tabs and wrap around, and Home/End jump to the first/last. Tab then moves from the active tab into the panel.

The classic mistake is giving every tab `tabIndex={0}` with no arrow keys. That contradicts the `tab` role, because screen readers announce arrow-key instructions that do not work.

## Questions

1. **Stack:** React 19 or 18? TypeScript or JavaScript? Next.js, Vite or Remix?
2. **Library:** do you already use Radix Tabs, React Aria, Headless UI or MUI? If so I build on it, since tabs are well solved there.
3. **Activation:** *automatic* (the panel changes as soon as the tab gets focus, the default when panels load fast) or *manual* (Enter/Space activates, better when a panel is expensive to load)?
4. **Control:** uncontrolled with an optional `defaultValue`, or controlled (`value` / `onValueChange`)? Should the active tab be synced with the URL hash?
5. **Content:** fixed tabs or dynamic ones? Any disabled tab? Horizontal only, or vertical too (Up/Down instead of Left/Right)?
6. **Styling and ready-when:** your styling approach, plus anything else that has to work for you to call it done.

## Draft API

```ts
type Tab = { id: string; label: string; panel: ReactNode; disabled?: boolean };
type TabsProps = {
  tabs: Tab[];
  label: string;                  // accessible name of the tablist
  defaultValue?: string;
  activation?: "automatic" | "manual";
};
```

IDs for tabs and panels are built from `useId()`. Keyboard handling runs in the `onKeyDown` handler, and the focus move calls `.focus()` on the target tab ref there.

## Draft test list

1. The tablist, tabs and tabpanel are found by role and name. Only one tab has `aria-selected="true"` and its panel is visible.
2. Only the selected tab is in the Tab order: `user.tab()` lands on it, and the next Tab lands in the panel.
3. ArrowRight and ArrowLeft move focus and wrap at the ends.
4. Home and End go to the first and last tab.
5. Automatic mode: arrows also change the panel. Manual mode: only Enter/Space does.
6. Clicking a tab selects it.
7. `aria-controls` / `aria-labelledby` point at IDs that exist.
8. Disabled tabs are skipped by the arrows.

## How I'll verify

I'll run `run_tests` and `a11y_check` on the complete files and report the real results. Visible focus, contrast and the screen reader announcements need a keyboard pass and axe-core in a browser, and I'll list them as not verified here.

Answer what you can. With "do it your way" I'll assume React 19 + TypeScript + Vitest + Testing Library, neutral CSS, uncontrolled and automatic activation, and I'll state that I assumed it.
