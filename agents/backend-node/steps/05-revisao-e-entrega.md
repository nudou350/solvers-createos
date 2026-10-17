# Step 5: Review security and deliver

## Goal

Do the final review against the OWASP API Top 10 2023 checklist adapted to Node, fix what fails, and give the user an honest summary of what was verified, what was out of scope and what they need to confirm by running it. This is also the step for reviewing existing services.

## What to ask the user

- In production, does the API sit behind a proxy or load balancer (nginx, cloud)? How many hops? (This defines `trust proxy` and the rate limit.)
- Is the API called by a browser from another domain? Which origins? (This defines CORS.)
- If they asked for a review, ask only for the missing snippet; do not ask for secrets, `.env` files or real data.
- At the end: "Do you want me to save to your profile anything that applies to your next endpoints (for example, the error standard we adopted)?" Save only on a yes, as a note (`save_memory` with `kind: "note"`).

## How to run

1. **Walk the checklist** from the `checklist-revisao` template (`get_template`) item by item, over the code delivered in the earlier steps or the user's own. Mark each item as met, not applicable or failed, with the line or file.
2. **The ten OWASP API 2023 risks**, one question each, only where relevant: object (API1), authentication (API2), property (API3), resource consumption (API4), function (API5), business flow (API6), SSRF (API7), configuration (API8), inventory (API9), consumption of third-party APIs (API10). Use `search_knowledge` for each risk's text and cite the source.
3. **Secrets and configuration.** Environment variables validated at startup (the process does not start if one is missing), no secret in the repository or in logs, `.env` outside version control.
4. **Logs.** Structured logging with a request identifier; password, token, national ID number (such as Brazil's CPF), email and address masked (logger redaction); never log the whole login body.
5. **Headers and CORS.** `helmet`, `x-powered-by` turned off, CORS with an explicit list of origins (never `*` together with credentials), cookies with `httpOnly`, `secure` and `sameSite`.
6. **Dependencies.** Run `npm audit` and read the result with the user; confirm the Node version is still supported (check the knowledge base).
7. **Fix** what failed, showing only the changed snippet. What cannot be fixed becomes an open item with the risk described in one line.
8. **Deliver** a short final message: what was delivered, what was verified, what was left out, what the user needs to run or confirm, and next steps.

## Common mistakes

- Declaring the API "secure". Say what was reviewed and what was not; a review by reading does not replace a penetration test.
- Listing generic checklist findings without pointing to a file and line.
- Approving CORS with `origin: "*"` because "it's only development" and forgetting to change it.
- Forgetting old routes and exposed documentation (inventory, API9): `/docs`, `/debug`, old API versions.
- Saving a note to memory without the user asking.
- A summary that is too long: the user wants to know what changed and what to do now.

## result_summary format

```
checklist: <n met | n not applicable | n failed>
failures_fixed: <short list>
open_items_with_risk: <item: risk in one line>
owasp_api_2023: <risks reviewed and the result>
cors/proxy: <origins; trust proxy>
not_verified: <what depends on the user's environment>
user_confirmations: <what they should run or confirm>
note_saved_to_memory: yes|no
```
