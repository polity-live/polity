# Polity test strategy

Every user action belongs on the lowest test level that can reproduce a failure reliably. The nine critical business processes also have a complete browser journey in the PR suite. The executable mapping lives in `tools/testing/action-catalog.json` and is checked by `npm run test:action-catalog`.

## Test levels

| Level                 | Use for                                                                                  | Command                                                      |
| --------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Unit                  | Deterministic business rules without UI, database or network                             | `npm run test:unit`                                          |
| Component integration | Forms, dialogs, buttons, hooks, routing and loading/error states with stateful fake I/O  | `npm run test:component`                                     |
| Service integration   | Several controllers or adapters working together; files end in `.integration.test.ts(x)` | `npm run test:integration`                                   |
| Database integration  | Schema, RLS, triggers, transactions and concurrency against a reset local Supabase       | `npm run test:db:coverage` and `npm run test:db:concurrency` |
| E2E                   | Critical browser-App-Zero-database boundaries, realtime and multi-user behavior          | `npm run test:e2e:pr`                                        |

Integration tests intentionally use Vitest and Arrange-Act-Assert like unit tests. The classification is determined by the real components involved, not by syntax.

`processEngine.initialize.test.ts` is an explicitly classified stateful service-integration suite and therefore excluded from the unit project. New service integration files use the `.integration.test.ts(x)` suffix.

## Browser suites

- `@pr` is the deterministic Chromium desktop merge gate.
- `@mobile` is the small Chromium mobile merge gate.
- `@nightly` marks variants and cross-browser golden journeys.
- `@performance` is measured separately from functional correctness.
- `npm run test:e2e:stress` repeats the PR gate 20 times without retries.

The scheduled `Nightly Tests` workflow runs the extended variants, browser golden journeys, isolated performance measurements and the complete PR browser gate 20 times. The manually dispatched `E2E Cold-stack Acceptance` workflow recreates the stack for up to 30 consecutive PR-suite runs and stores each run's artifacts separately.

Playwright runs one worker per stack with `fullyParallel: false` and no retries. CI creates three isolated desktop stacks through GitHub shards plus one isolated mobile stack. Each stack gets a fresh unseeded database, production-built app, separate run IDs/auth state/artifacts and an independent Zero replica. Preconditions are inserted by fixture builders; only the action under test is performed in the browser. Test fixtures clean their exact test namespace and teardown removes only the exact run namespace—never a global `E2E-%` pattern.

Local terminal, headed and UI runs all call the same stack preparation and production-build commands. Existing servers are reused only with `E2E_REUSE_SERVER=1`, `E2E_REUSE_COMMIT=<git sha>` and `E2E_REUSE_SCHEMA_HASH=<migration hash>`; the verifier rejects commit, schema, local origin or Zero readiness mismatches.

`build:e2e` is a Vite production-mode build configured with local test endpoints; it never uses the Vite development server. After a successful build it records the app, Supabase and Zero origins together with the commit and migration-schema hash in `.output`. `start:e2e` refuses a missing or mismatching provenance, so a normal production build pointing at a remote Supabase project cannot accidentally be used by local acceptance tests. `test:all` aggregates the stack-independent PR checks without rerunning Unit/Component suites outside the instrumented coverage pass. Database, E2E, mutation, visual and resilience suites remain explicit because they own isolated stacks or long-running environments.

The E2E build, runtime and Playwright config load `.env.development.local` and then `.env.test.local` when present. Explicit process variables always win over values from those files. CI can therefore inject its isolated stack endpoints, while local terminal, headed and Playwright UI runs still share the same defaults. Wrapper and build-provenance contracts are covered in `tools/e2e/__tests__`.

Functional E2Es must wait for semantic UI state, the global `app-hydration` marker, the authenticated `app-readiness` marker, Zero connection state, `/keepalive`, or server confirmation. Fixed sleeps, `networkidle`, broad cleanup and shared mutable users are rejected by the catalog check.

The repository still contains pre-existing Prettier debt. CI therefore runs `npm run format:check:changed`: every file introduced or changed by a pull request must be formatted immediately, while unrelated legacy files are not rewritten as part of a test change.

Runtime dependency advisories use a package-level ratchet. `npm run test:security` rejects every new vulnerable production dependency, every severity increase and every critical finding. Resolved or severity-reduced baseline findings remain green and shrink the reported debt.

## Regression rule

Add a test at the lowest stable level that reproduces each bug. Add a browser regression only when the defect crossed a critical system boundary. External AI, payment, map and currency services are stubbed at their network boundary; local email flows use Inbucket.
