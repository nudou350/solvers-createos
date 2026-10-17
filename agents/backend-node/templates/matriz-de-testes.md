# Test matrix: <METHOD /route>

One row per contract requirement. Each security test must fail if the rule is removed: fill in the last column.

| # | Requirement | Test data | Expected result | Change that would make the test fail |
|---|---|---|---|---|
| 1 | Happy path | exact contract body, user A is the owner | 200 with only the contract's fields | mapper returning the whole object |
| 2 | No credential | no headers | 401 problem+json | route outside the authentication middleware |
| 3 | Expired or invalid credential | expired token | 401 | verification that doesn't check expiry |
| 4 | Different owner | user B on user A's resource | 404 (or 403, per the contract) and nothing changes in the database | removing the owner from the query filter |
| 5 | Invalid body | wrong type, string above the limit | 422 with a list of fields, without echoing the value | schema without limits |
| 6 | Unknown field | body with `extra: 1` | 422 | schema that ignores extra fields |
| 7 | Mass assignment | body with `role` or `ownerId` | 422 or value unchanged in the database | passing the body straight to the ORM |
| 8 | Invalid state | resource in a state that doesn't accept the action | 409 | transition without checking the state |
| 9 | Repeat | same `Idempotency-Key` twice | same response, a single effect | key not stored or without uniqueness |
| 10 | Rate limit | n+1 calls in the window | 429 with Retry-After | limiter missing, or in memory with several instances |
| 11 | External failure | external service slow or down | expected response (502 or 504), with no internal detail | call without a timeout |
| 12 | List | limit above the maximum | limit capped or 422 | limit not enforced on the server |

Environment notes: <test database, how tokens are generated, what is replaced at the edge>
