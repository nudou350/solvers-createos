# Endpoint contract: <METHOD /route>

Fill it in within ten useful lines. If it doesn't fit, the endpoint does too much: split it.

- **Purpose:** <one sentence: what the endpoint does and for whom>
- **Authentication:** <session | JWT | API key | public>
- **Authorization:** <who can: resource owner | role X | any logged-in user> / **Owner identified by:** <field and where it comes from>
- **Input:**
  - params: <name: type and limit>
  - query: <name: type, default, maximum>
  - body (strict, an extra field is an error): <field: type, minimum and maximum>
- **Fields the client never changes:** <id, owner, role, status, price...>
- **Output (only these fields):** <field: type>
- **Responses:**

| Code | When |
|---|---|
| 200 / 201 / 204 | <success> |
| 401 | no credential, or an invalid or expired credential |
| 403 or 404 | another owner's resource (pick one rule and keep it) |
| 409 | <state conflict, uniqueness, reused idempotency key> |
| 422 | invalid body, params or query |
| 429 | rate limit reached (with Retry-After) |
| 5xx | unexpected or external service failure (generic message) |

- **States and allowed transitions:** <state -> state>
- **Side effects:** <charge, email, stock, webhook> / **Idempotency:** <Idempotency-Key | natural key | not applicable>
- **Limits:** rate <n per minute per user>; body <kb>; maximum time <ms>; external calls with timeout <ms>
- **OWASP API 2023 risks that apply:** <API1 object | API3 property | API4 consumption | API5 function | API6 business flow>
- **Sensitive data:** <what never goes to logs or responses>
