---
title: CreateOS Sandbox networking: egress allowlist, ingress and preview URLs
source: CreateOS Sandbox docs (REST API Egress, Limits, How-to Expose a service)
source_url: https://createos.sh/docs/Sandbox/REST-API/Egress
source_date: 2026-10-17
valid_until: 2027-01-15
tags: [createos, sandbox, egress, ingress, preview, network, allowlist]
---

## Egress (outbound)

- Sandboxes are **open by default**. A non-empty rule list means **deny by default**: only listed destinations pass, everything else is dropped in-kernel on the host.
- Rule formats: `host` (`pypi.org`), `host:port` (`registry.npmjs.org:443`), wildcard `*.host` (`*.pythonhosted.org`), `ip`, `ip:port`, `cidr`, `cidr:port`, and `*`.
- Rules change live with `PUT /v1/sandboxes/{id}/egress` (SDK `setEgress`), no restart. `[]`, `null` or `["*"]` mean allow all.
- The docs table says a bare `host` allows HTTP and HTTPS on ports 80 and 443; the prose says rules cover any port. Write `host:443` explicitly to avoid the ambiguity.

### The Solvers session allowlist

Solvers creates every session sandbox with:

```
registry.npmjs.org:443, pypi.org:443, *.pythonhosted.org:443, github.com:443, *.githubusercontent.com:443
```

Consequences you must plan for:

- `npm install`, `pip install` and `git clone` from GitHub work. `yarn` via its own registry, `apt-get`, Docker Hub pulls and `curl` to other sites fail with a connection error or timeout. That is the allowlist, not a bug in the code: do not retry in a loop.
- **`api.stripe.com` is not reachable.** Never call the Stripe API from tests in the sandbox. Test the webhook with locally signed payloads (`stripe.webhooks.generateTestHeaderString`) and inject a fake for `checkout.sessions.create`. Creating a real Checkout Session happens after deploy, on CreateOS, with the user's test key.
- No user secret goes into the sandbox: no real `sk_test_` key, no `whsec_` secret, no database URL. Use placeholders in tests.
- If a dependency's install script downloads a binary from another host (Playwright browsers, Prisma engines, Puppeteer Chrome), it fails. Choose dependencies without download steps or tell the user it will work after deploy.

How to recognize an egress block in `stderr`: `ETIMEDOUT`, `ECONNREFUSED`, `ENOTFOUND`, `getaddrinfo`, `Could not resolve host`, `fetch failed` for a host that is not in the list above.

## Ingress (inbound) and preview URLs

- Inbound is closed unless `ingress_enabled: true`. When enabled, the control plane provisions a public hostname for the sandbox, and any TCP server bound to **`0.0.0.0`** on any port becomes reachable at a stable URL derived from that hostname. A server bound to `127.0.0.1` or `localhost` is **not** reachable from outside.
- SDK: `setIngress(true)`, `waitForPortReady(port)`, `previewUrl(port)` (https by default).
- In Solvers: `sandbox_preview { session_id, port }` does all three and returns the URL. Call it only after the server answers `curl -fsS localhost:<port>/health` inside the sandbox.
- A preview URL is for demonstration: it stops answering when the sandbox pauses (after 5 idle minutes) or is destroyed. A permanent URL comes from a CreateOS deploy.
- Anyone with the preview URL can reach the app: do not put real data or real keys behind it.
