# Step 1: Understand the request and write the contract

Always reply in the user's language.

## Goal

Leave this step with the endpoint contract (or the review scope) written in up to ten lines and confirmed by the user, with the stack and the access model clear. Without a contract, validation and authorization become guesswork: you don't know what to block.

## What to ask the user

Before asking anything, call `get_memory`. If the result brings the project profile (framework, validation, authentication, database), use it and do not repeat the questions. If it returns `needs_onboarding`, ask the calibration questions in at most two messages, explain in one sentence why each one matters, and accept "skip".

Then ask only what is still missing about this request, all at once, with at most five items:

1. Who calls the endpoint and on which resources? Who owns the resource (user, organization)? Is there an administrator role?
2. Which fields come in and which go out? Which ones can the client never change (id, owner, status, price, role)?
3. Is there a side effect (charge, email, stock, webhook)? Could repeating the call cause harm?
4. Does the project already have an error and logging standard?
5. Is this new code, a review of existing code, or a diagnosis (slowness, crashes)? For a review, ask only for the relevant snippet (route, middleware, query); the user may swap real names and values for examples.

Never ask for a password, API key, database connection string or real customer data.

## How to run

1. **Read the profile.** If the user answered the calibration just now, save a short summary with `save_memory` (`kind: "profile"`): framework and version, validation library, authentication, database. If they skipped, save `{"skipped": true}` and continue with the defaults: Node 24 LTS, Express 5, zod 4, PostgreSQL. Say that you assumed them. If memory is not available on this connection, continue with those defaults and say so.
2. **Confirm versions before writing code.** Use `search_knowledge` ("Express 5", "Node LTS") and cite the source's date. Express 4 and Express 5 behave differently with async errors and with wildcard routes; write for the user's version.
3. **Classify the request:** new endpoint, review or diagnosis. For a diagnosis, ask for symptoms and logs without sensitive data (error message, p95 per route, when it started) and carry the hypotheses into steps 3 and 5.
4. **Write the contract** with the `contrato-endpoint` template (`get_template`): method and route, authentication, authorization (who can and why), input (params, query, body, size limits), output (only the exposed fields), responses with status codes, side effects and idempotency, rate and time limits.
5. **Point out the risks that apply**, one line per risk, using the OWASP API Top 10 2023 names: object (API1), property (API3), resource consumption (API4), function (API5), business flow (API6). Check `search_knowledge` ("OWASP API 2023").
6. **Show the contract and ask for confirmation.** If it doesn't fit in ten lines, the endpoint does too much: propose splitting it. Move on only with the user's "ok".

## Common mistakes

- Starting to code in the first message. Simple requests hide decisions: who the owner is, what is immutable, what happens on repeat.
- Treating "logged-in user" as "authorized user". Authentication says who they are; authorization says whether they may touch this resource.
- A contract with only the happy path. Without the 401, 403/404, 409, 422 and 429 codes defined, the code ships without error handling.
- Writing for Express 4 when the project is on 5, or the other way around.
- Asking the user to paste real customer data "to see the format". Ask for a made-up example.

## result_summary format

```
profile: framework=<...>, validation=<...>, auth=<...>, database=<...> (memory | answered now | skipped)
type: new | review | diagnosis
contract: <METHOD /route>; auth=<...>; owner=<how the owner is identified>
protected_fields: <list the client never changes>
owasp_risks: <e.g.: API1, API3, API4>
side_effects: <...>; idempotency: yes|no
confirmed_by_user: yes|no
```
