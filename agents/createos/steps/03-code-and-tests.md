# Step 3: Code and tests

## Goal

Implement every `must_have` behavior from the spec with a test that proves it, and get the whole suite green **in the sandbox**. You fix failures from the real error output, not from guesses, and you use a checkpoint so a bad fix never leaves the project worse than before.

## What to ask the user

Nothing by default. Ask only if a test reveals an ambiguity in the spec (for example "what happens when the waitlist is full?"); propose an answer and continue unless the user objects.

## How to run

1. **One test per behavior.** For each line in `must_have`, write a test that goes through HTTP (start the app on port 0 and use `fetch`, as in the template's `test/helpers.js`): status code, body, and resulting state. Add the error cases that matter (422 for invalid input, 404 for unknown id, 409 for a repeated action).
2. **Write code and tests together, then run.** One `sandbox_run` with the changed `files` and `bash -lc "cd /workspace/app && npm test 2>&1 | tail -n 80"`. Running everything at once saves runs.
3. **The fix loop** (write -> run -> read the error -> fix):
   - Read `stdout` and `stderr` for the first failing test: the assertion, expected vs actual, and the file and line in the stack.
   - Explain the cause in one sentence before changing anything. If you cannot, run a narrower command (`node --test test/<file>.test.js`, or a `node -e` probe) instead of changing code blindly.
   - **Before a risky fix** (touching more than one file, changing a shared helper, upgrading a dependency) call `sandbox_checkpoint` and keep the id it returns.
   - Apply the fix and re-run the same command. Compare: fewer failures means keep going. **If the fix made it worse** (more failures, or a new crash), call `sandbox_restore` with the checkpoint id, say so, and try a different cause.
   - Stop after 3 failed attempts on the same error: show the user the error, what you tried, and what you need from them.
4. **Never weaken a test to make it pass** (deleting the assertion, loosening the status, skipping the test). If the test was wrong, say why and fix the test explicitly.
5. **Show proof.** Quote the summary lines (`# tests N`, `# pass N`, `# fail 0`) and `exec_ms`. When you call `next_step`, the server runs `npm test` in `/workspace/app` and only advances if it exits 0; if it fails there, read its output and go back to the loop.

## Common mistakes

- Saying "the tests pass" without a `sandbox_run` that shows `# fail 0`.
- Tests that call the handler directly and miss the JSON parser, the 404 and the error middleware.
- Tests that depend on each other's data or on order; create the data each test needs.
- Calling an external API in a test (blocked by egress, and flaky anyway): inject a fake.
- Changing three things at once after a failure, so you cannot tell which one worked.
- Forgetting to restore after a fix that broke more tests.
- Leaving a server listening at the end of a test (the run hangs until timeout): close it in `after()`.

## result_summary format

```
behaviors: <must_have -> test name>, ...
tests: <n> total, <n> pass, 0 fail (npm test, <exec_ms> ms)
fix_loop: <n> iterations; checkpoints: <n>; restores: <n> (<why>)
files_changed: <paths>
open_questions: <none | list>
```
