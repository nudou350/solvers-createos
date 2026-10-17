# Step 2: Validate input and authorize per resource

## Goal

Implement the layer that decides what comes in and who can touch what: strict schemas for params, query and body; a query that already filters by owner; output that exposes only the fields in the contract. This is where the failures that most often bring APIs down get closed: access to someone else's object (BOLA/IDOR), mass assignment and exposure of internal fields.

## What to ask the user

Usually nothing: the contract from step 1 answers it. Ask only if there is a real gap:

- Is there more than one kind of owner (user and organization)? Does the access rule change by role?
- Should a nonexistent resource and another owner's resource be indistinguishable (404 for both), or does the product need a 403?

## How to run

1. **Check the knowledge base.** Use `search_knowledge` with "BOLA", "mass assignment", "zod 4" when the case touches the topic, and cite the source.
2. **Separate input schemas** for `params`, `query` and `body`, using the user's profile (zod by default). Strict body (an unknown field is an error, not ignored), strings with `max`, arrays with `max`, numbers with bounds, enums for closed values. Query always arrives as a string: convert explicitly (`z.coerce` or equivalent) and cap `page` and `limit`.
3. **Validate before any side effect.** No query, write or external call before the schema approves. A validation failure answers 422 (or 400 for malformed JSON) with the list of invalid fields, without echoing sensitive data.
4. **Never pass `req.body` straight to the ORM.** Build the write object field by field from the validated result. Fields the contract marks as immutable (owner, role, status, price) do not enter the write schema.
5. **Authorize in the query.** The owner goes into the filter (`where: { id, ownerId }`), not into a check afterwards. A resource that does not belong to the user answers as nonexistent (404) when revealing its existence is a risk. For role-based actions, check the role on the server, never through a field sent by the client.
6. **Map the output.** One function returns only the contract's fields (no `passwordHash`, tokens, internal ids, audit fields). Do not serialize the whole ORM object.
7. **Show the complete code** for the schema, the authorized query and the mapper, in the profile's framework, with the file path at the top of each block. Use the `esqueleto-express` template (`get_template`) as a base when the framework is Express.

## Common mistakes

- Fetching by `id` and checking the owner afterwards, or not checking at all. This is the API1:2023 failure.
- A schema that silently strips extra fields. The client thinks it changed the field and nothing happens; prefer rejecting.
- Trusting `role` or `userId` coming from the body or from a header the client controls.
- Validating only the body and forgetting `params` and `query` (parameter injection, `limit=999999`).
- In Express 5, treating `req.body` as always present: with no parser or no body it is `undefined`. In Express 5, `req.query` is read-only: store the validated result in another variable.
- Answering 403 for another owner's resource and thereby confirming the id exists.

## result_summary format

```
input: params=<schema> query=<schema> body=<strict schema>
limits: <sizes, max page/limit>
authorization: <how the owner enters the query; roles checked where>
output: <mapper and exposed fields>
immutable_fields_blocked: <list>
files: <delivered paths>
open_items: <pending decisions>
```
