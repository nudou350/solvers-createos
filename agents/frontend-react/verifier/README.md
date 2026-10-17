# Test verifier: React Front-end Solver

The minimal environment the server uses to check whether a Solver delivery passes the tests. It is the `docker:solvers-react-test` runner declared in `manifest.json` (the `run_tests` tool).

## How it works

1. The AI calls `run_tool` with `run_tests` with the delivery files: `.tsx`/`.ts` components and `*.test.tsx`/`*.test.ts` tests.
2. The server writes the files to a temporary folder, which becomes `verifier/src/` inside the container (mounted at `/work/src`, read-only).
3. The server runs `npx vitest run --reporter=json` in `/work`.
4. **Exit code 0 = passed.** Any other code (failing test, compile error, no tests found, timeout) = not passed.
5. The detailed report is at `/work/report/vitest.json` (useful fields: `success`, `numPassedTests`, `numFailedTests`, `testResults[].assertionResults[].failureMessages`). The server returns a summary of the failures so the AI can fix them.

## Rules for the delivery

- Only files in `src/` are included. Relative imports between them work (`./LoginForm`).
- Available dependencies: `react`, `react-dom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom` and `vitest`. Any other package fails on import, because the container runs **without a network**.
- Tests must follow the `src/**/*.test.{ts,tsx}` pattern.
- The jest-dom matchers (`toBeInTheDocument`, `toHaveAccessibleDescription`, etc.) and the `cleanup` between tests already come from `setup.ts`.
- There is no type checking at run time (Vitest only transpiles). Type errors do not fail the run, but syntax errors do.

## Image

```bash
docker build -t solvers-react-test agents/frontend-react/verifier
```

The `Dockerfile` starts from `node:22-alpine`, installs the dependencies from `package.json` in `/work` and leaves `WORKDIR /work`. The dependencies live in the image, so running does not need a network.

## Running on the server

```bash
docker run --rm \
  --network none --cpus 1 --memory 768m --pids-limit 256 \
  --cap-drop ALL --security-opt no-new-privileges --user node \
  --read-only --tmpfs /tmp:rw,size=64m --tmpfs /work/node_modules/.vite-temp:rw,size=16m \
  --env HOME=/tmp --ulimit fsize=8000000:8000000 \
  -v /tmp/delivery-123:/work/src:ro \
  -v /tmp/report-123:/work/report \
  solvers-react-test \
  npx --no-install vitest run --reporter=json --outputFile.json=/work/report/vitest.json
```

The server applies a 60 s timeout and kills the container if it is exceeded (this counts as not passed). It only passes with exit code 0 **and** a valid report in which every file of the agreed acceptance suite ran and passed. What comes back from `/work/report` is treated as untrusted (no symlinks, FIFOs or large files) and the server kills the container if the folder goes over 8 MB.

## Running locally without Docker

```bash
cd agents/frontend-react/verifier
npm install
mkdir -p src && cp example/* src/
npx vitest run --reporter=json; echo "exit=$?"
```

The `src/` folder is disposable and is not part of the package.

## Example

`example/LoginForm.tsx` and `example/LoginForm.test.tsx` are the demo delivery: an accessible login form (labels, errors tied by `aria-describedby`, focus on the first invalid field, a generic error announced in `role="alert"`, double-submit protection and a show-password button with `aria-pressed`). The 15 tests pass.
