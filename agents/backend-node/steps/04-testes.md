# Step 4: Tests that prove security

## Goal

Deliver API tests that exercise the contract through the HTTP edge and that would break if a security rule were removed. A test that only covers the happy path does not protect against regressions in authorization or validation.

## What to ask the user

Ask only what prevents you from writing the test:

- Which runner does the project use (Vitest, Jest, `node:test`)? With no preference, use the one in the profile; if there is none, use native `node:test` or Vitest.
- How does the test get users and data? Is there a test database, an in-memory database, or is data access injectable?
- Is there a way to generate a test token or session without going through the real authentication provider?

## How to run

1. **Build the test matrix** with the `matriz-de-testes` template (`get_template`): each row is a contract requirement and the expected code. Show the matrix to the user before writing the code.
2. **Minimum coverage per endpoint**, in this order:
   - Happy path with the exact body from the contract and the output with only the exposed fields.
   - 401 with no credential and with an invalid or expired credential.
   - **Different owner:** user B tries to read and change user A's resource and gets 404 (or 403, per the contract). This test is mandatory.
   - 422 for an invalid body, unknown field, wrong type, string above the limit.
   - Mass assignment attempt: send `role` or `ownerId` in the body and prove the value does not change.
   - 409 for an invalid state transition and for a repeat without `Idempotency-Key`, when applicable.
   - 429 after the rate limit, with `Retry-After`.
   - External service failure (timeout) returning the expected error and leaking no detail.
3. **Test through the HTTP edge.** Start the app on an ephemeral port (`app.listen(0)`) and use native `fetch`, or use `supertest`. Do not call the handler directly: you would stop testing the parser, the middlewares and the error handler.
4. **Assertions that matter:** status code, `content-type` `application/problem+json` on errors, absence of internal fields in the output, and, in the database, the state after the operation (not only the response).
5. **Prove the test catches the mistake.** For the different-owner test and the mass-assignment test, describe in one line which code change would make it fail (for example, removing `ownerId` from the filter).
6. **Deliver the complete files** with the path at the top and state the command to run them. If you did not run the tests, say you did not: you have no way to run them from here. Never write "the tests pass" unless the user has confirmed the run.

## Common mistakes

- Mocking the authorization module in the security test: the test passes even with the rule broken.
- An owner test that uses the same user on both sides.
- Asserting only `status === 200` without looking at the body or the database state.
- Data shared between tests without cleanup, making execution order matter.
- Testing the handler in isolation and leaving the error middleware uncovered.
- Sleeping with `setTimeout` to wait for an async effect; await the promise or use a fake clock.

## result_summary format

```
runner: <vitest|jest|node:test>; strategy: <fetch on ephemeral port|supertest>
tests: <n> (happy <n>, 401 <n>, different owner <n>, 422 <n>, mass assignment <n>, 409 <n>, 429 <n>, external failure <n>)
regression_each_test_catches: <test -> change that would make it fail>
test_data: <how it is created and cleaned up>
run_by_user: yes|no|pending
files: <paths>
```
