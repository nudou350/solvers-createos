A list of 5,000 items is slow for one of three reasons, and virtualizing is not always the first fix. Measure first, then pick.

## 1. Find the cause (React DevTools Profiler, 5 minutes)

Record one interaction (typing in a filter, toggling an item) and look at what re-rendered:

- **Every item re-renders when only one changed.** Fix: put the row in its own component wrapped in `memo`, and pass stable props. If you are on React 19 with the React Compiler 1.0, it memoizes for you; just enable it and re-measure.
- **State lives too high.** Typing in a search box that sits in the same component as the list re-renders 5,000 rows per keystroke. Move the input state down, or use `useDeferredValue` for the filter.
- **Unstable `key`.** Use the item's id, never the array index in a list that filters, reorders or removes items (state and focus end up on the wrong row).

```tsx
const Row = memo(function Row({ item, onRemove }: { item: Item; onRemove: (id: string) => void }) {
  return (
    <li>
      <span>{item.name}</span>
      <button type="button" onClick={() => onRemove(item.id)}>Remove {item.name}</button>
    </li>
  );
});

// in the parent: key={item.id}, and onRemove wrapped in useCallback
```

## 2. If the DOM itself is too big: virtualize

With thousands of nodes, render only the visible rows with a mature library (TanStack Virtual or react-window). Do not hand-roll it.

Virtualizing has an accessibility and product cost, so plan for it:

- **Ctrl+F stops finding off-screen items** (they are not in the DOM). Offer your own search or filter.
- **Screen readers lose the item count.** Add `aria-setsize={items.length}` and `aria-posinset={index + 1}` on each rendered row.
- Keyboard focus on a row that scrolls out of view must not be lost: keep the focused row mounted or restore focus after scrolling.

## 3. The alternative that keeps native behavior

For a few hundred simple rows per view, pagination or "Load more" is often better than virtualization: native semantics, working Ctrl+F per page, nothing exotic. With "Load more", move focus to the first new item so keyboard and screen reader users land where the new content starts.

## What I need from you to give you the right fix

1. React version (18 or 19) and whether the React Compiler is on?
2. Are the rows all the same height, and are they interactive (buttons, checkboxes, inline editing)?
3. Do users need to search the whole list (Ctrl+F) or can they filter?
4. Is there a component library in the project (for example a table or list from MUI or Radix) that already offers virtualization?
5. Can you paste the list component and one row component? Then I can point at the exact line that re-renders.

Once you answer, I will write up the plan (props, states and the tests we will write, for example "removing a row moves focus to the next row") for your approval, and then deliver the code with tests. Delivered tests would be run on the server with `run_tests` before I tell you they pass; and I will say clearly that scroll performance itself needs to be measured in your browser, since jsdom cannot measure it.
