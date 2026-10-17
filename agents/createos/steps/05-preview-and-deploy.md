# Step 5: Preview and deploy

## Goal

Run the app in the sandbox, prove `/health` answers, give the user a live preview URL they can open now, and hand over everything needed to deploy it permanently on CreateOS: the code, the build and run settings, the port, the environment variables and the Stripe webhook setup.

## What to ask the user

- Do they already have a GitHub repository and a CreateOS account? (If not, the checklist includes creating them.)
- Do they want the deploy through the dashboard (default) or the `createos` CLI?

## How to run

1. **Start the server in the background**, bound to `0.0.0.0:3000`: `sandbox_run` with `background: true`,
   `command: "bash"` and `args: ["-lc", "cd /workspace/app && npm start"]`. It returns at once with a process id and a
   log path. Never start a server with `&` in a normal `sandbox_run`: the call would wait for it and time out.
   Then check it: `sandbox_run` with `bash` and `["-lc", "sleep 2 && curl -fsS localhost:3000/health"]`.
   - `exit_code` 0 and `{"ok":true}`: running.
   - Otherwise read the log at the path the background call returned (`bash -lc "tail -n 50 <log path>"`). `EADDRINUSE` means a previous server is still up (`pkill -f "node src/server.js"`, then start again). A crash on boot goes back to the step 3 fix loop.
2. **Open the preview.** Call `sandbox_preview` with `port: 3000` and give the user the URL, with two or three things to try (`/health`, the main endpoint). Say plainly that the preview is temporary (it stops when the sandbox pauses after 5 idle minutes) and that the purchase route answers 503 there because the sandbox holds no Stripe key and cannot reach Stripe.
3. **Gate.** When you call `next_step`, the server runs `curl -fsS localhost:3000/health` in the sandbox and advances only if it exits 0. If the sandbox paused in between, start the server again first.
4. **Deliver the code.** Print every project file with its path (read them back from the sandbox with `cat` if you are not sure they match what ran), plus a `.gitignore` (`node_modules`, `.env`, `.env.*`). If the trial ended before this step, say so and do not pretend.
5. **Fill the `createos-deploy-checklist` template** (`get_template`) with real values: the proof table (node version, install, tests, webhook tests, health, preview URL), the GitHub steps, the CreateOS fields (Framework Node.js, Server port 3000, Build commands `npm ci` or `npm install`, Run commands `npm start`), the environment variables (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_URL`, any from `stripe projects env`), the deploy and log commands, and the Stripe webhook endpoint on the live URL with its four events. Use `search_knowledge` ("createos deploy", "createos env") for current commands.
6. **Close honestly.** End with what was proven (each check with its exit code) and what was not (real Checkout redirect, real webhook delivery, the deploy itself, load). Offer the next improvement (database via `stripe projects add`, auth) without starting it.

## Common mistakes

- Starting the server in the foreground: the run hangs until timeout and the gate fails.
- Binding to `localhost`: health passes inside the sandbox but the preview URL shows nothing.
- Presenting the preview URL as the production URL.
- Inventing the CreateOS URL format; tell the user to read it from `createos status` or the dashboard.
- Putting real keys in the code, in `.env` committed to git, or in the chat.
- A checklist with placeholders left in it: every value must come from what ran.
- Telling the user to run the app locally to test it: it already ran in the sandbox.

## result_summary format

```
server: 0.0.0.0:3000, health exit <code> -> <body>
preview_url: <url> (temporary)
delivered_files: <n> (<paths>)
deploy: dashboard|cli; framework=Node.js; port=3000; build=<cmd>; run=<cmd>
env: <names only>
stripe_webhook: <live URL>/webhook, events=<list>
proven: <check -> exit code>, ...
not_verified: <list>
```
