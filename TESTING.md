# Polity test strategy

Every user action belongs on the lowest test level that can reproduce a failure reliably. The executable mapping for the nine critical business processes lives in `tools/testing/action-catalog.json` and is checked by `npm run test:action-catalog`. The separate flow campaign and its ten canonical cross-boundary acceptance journeys live in `tools/testing/flow-test-campaign.json` and are checked by `npm run test:flow-campaign`.

The campaign audit currently locks 86 component-flow, 13 service-integration, 9 database-integration, 20 PR E2E and 10 nightly E2E cases: 138 promoted cases in total. It separately asserts that exactly ten E2E journeys carry the `@acceptance` contract.

## Test levels

| Level                 | Use for                                                                               | Required suffix                    | Primary command                     |
| --------------------- | ------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------- |
| Unit                  | Deterministic business rules without UI, database or network                          | `*.unit.test.ts`                   | `npm run test:unit`                 |
| Component integration | Components, hooks, forms and UI states with stateful fake I/O                         | `*.component.test.tsx`             | `npm run test:component`            |
| Component flow        | Several components, hooks and providers exercised as one user flow                    | `*.component-flow.test.tsx`        | `npm run test:component-flow`       |
| Browser component     | Browser-only component behavior requiring a real Chromium DOM                         | `*.browser-component.test.tsx`     | `npm run test:browser-component`    |
| Service integration   | Route/handler, schema and service working together through real in-process boundaries | `*.service-integration.test.ts(x)` | `npm run test:service-integration`  |
| Database integration  | Schema, RLS, triggers, transactions and concurrency against a reset local Supabase    | `*.database-integration.test.ts`   | `npm run test:database-integration` |
| Static contract       | Repository, workflow, source-shape and generated-artifact invariants                  | `*.static-contract.test.ts`        | `npm run test:static`               |
| E2E                   | Critical browser-App-Zero-database boundaries, realtime and multi-user behavior       | `*.e2e.spec.ts`                    | `npm run test:e2e:pr`               |

Integration tests intentionally use Vitest and Arrange-Act-Assert like unit tests. Classification is determined by the real components involved, not by syntax. For example, `processEngine.initialize.unit.test.ts` mocks its collaborators and is therefore a unit test.

Optional campaign or branch qualifiers come before the style suffix, for example `useAgenda.branch-a04.unit.test.ts`. `npm run test:naming` rejects legacy suffixes and obsolete dotted campaign qualifiers.

## Runners and environments

- Vitest uses Node by default for pure unit, service-integration and static-contract tests.
- DOM-based component and component-flow tests opt into jsdom with `@vitest-environment jsdom` and normally use Testing Library. jsdom simulates web APIs; it does not validate a real browser's layout, rendering engine or cross-browser behavior.
- `*.browser-component.test.tsx` runs through Vitest Browser and its Playwright provider in real Chromium. Use this level when the real browser boundary matters but a full application stack does not.
- Playwright E2E runs the production-mode application against isolated local Supabase and Zero services. Use E2E only when the failure requires those cross-process boundaries.
- Stryker uses the Vitest runner for focused mutation testing of critical amendment, event, voting and authorization logic. `npm run test:mutation` uses per-test coverage and incremental results, writes its reports under `reports/`, and fails when the mutation score falls below 80%. `npm run test:mutation:contract` validates the Stryker sandbox and test selection with a dry run.

## Local commands and quality gates

| Goal                                       | Command                                |
| ------------------------------------------ | -------------------------------------- |
| Run stack-independent Vitest projects      | `npm test`                             |
| Run naming, catalogs and static contracts  | `npm run test:static`                  |
| Run instrumented coverage and ratchets     | `npm run test:coverage:ratchet`        |
| Check coverage of changed source           | `npm run test:coverage:changed`        |
| Check the complete branch inventory        | `npm run test:coverage:branches:check` |
| Check changed source/action accountability | `npm run test:accountability:changed`  |
| Run real-browser component tests           | `npm run test:browser-component`       |
| Run the complete local database gate       | `npm run test:db`                      |
| Run focused mutation testing               | `npm run test:mutation`                |
| Run the stack-independent PR aggregate     | `npm run test:all`                     |

`test:all` combines changed-file formatting, linting, type checking, static contracts and catalogs, coverage ratchets, browser-component tests, security contracts and the production build. Database, E2E, mutation, visual, accessibility and resilience suites remain explicit because they require isolated stacks, browsers or long-running environments. Stryker is a nightly quality gate, not part of `test:all` or the normal PR gate.

## Coverage contract

`npm run test:coverage` uses V8 to instrument the source assigned to the unit, component, component-flow and service-integration projects. Coverage is necessary but not sufficient: a test must assert the observable result, not merely execute a line.

- The repository ratchet checks lines, statements, functions and branches. Its current baseline contains no uncovered debt, so every instrumented metric must remain at 100%. `npm run test:coverage:ratchet` fails if any change introduces an uncovered item.
- Changed-code coverage is stricter about the pull-request diff. `npm run test:coverage:changed` requires every changed executable line, statement and function to run and every changed branch alternative to be covered. New untracked source is included in this check.
- Branch accountability fingerprints every branch alternative. `npm run test:coverage:branches:check` rejects new uncovered branches, stale debt and stale exceptions. Any non-critical exception must name an owner, evidence, an issue, test references and an expiry of no more than 30 days; critical domains cannot use exceptions. The current inventories contain no branch debt and no exceptions.
- The coverage manifest defines which source is instrumented and how excluded artifacts are verified. Do not exclude source merely to satisfy the percentage.

CI creates coverage in four shards, merges the results and then enforces the repository ratchet, the complete branch inventory, changed-code coverage and exact test-reference evidence.

The repository still contains pre-existing Prettier debt. CI therefore runs `npm run format:check:changed`: every file introduced or changed by a pull request must be formatted immediately, while unrelated legacy files are not rewritten as part of a test change.

Runtime dependency advisories use a package-level ratchet. `npm run test:security` rejects every new vulnerable production dependency, every severity increase and every critical finding. Resolved or severity-reduced baseline findings remain green and shrink the reported debt.

## Browser suites

- `@pr` is the deterministic Chromium desktop merge gate.
- `@mobile` marks the small Chromium mobile merge gate.
- `@nightly` marks extended variants and cross-browser golden journeys.
- `@acceptance` marks the ten canonical cross-boundary journeys.
- `@performance`, `@visual`, `@a11y` and `@resilience` select their dedicated non-functional suites.

| Goal                              | Command                       |
| --------------------------------- | ----------------------------- |
| Run the desktop PR gate           | `npm run test:e2e:pr`         |
| Run the mobile PR gate            | `npm run test:e2e:pr:mobile`  |
| Run the canonical acceptance set  | `npm run test:e2e:acceptance` |
| Run the extended nightly projects | `npm run test:e2e:nightly`    |
| Repeat the PR gate 20 times       | `npm run test:e2e:stress`     |
| Open Playwright UI mode           | `npm run test:e2e:ui`         |
| Run a visible browser             | `npm run test:e2e:headed`     |
| Start the Playwright debugger     | `npm run test:e2e:debug`      |

Playwright runs one worker per stack with `fullyParallel: false` and no retries. PR CI creates seven isolated Chromium desktop stacks and two isolated Chromium mobile stacks. The scheduled `Nightly Tests` workflow adds three desktop and two mobile Chromium shards plus Firefox and WebKit golden journeys, isolated performance measurements, critical-domain Stryker mutation testing and 20 repetitions of the desktop PR suite.

The weekly and manually dispatchable `E2E Stability Acceptance` workflow runs the ten `@acceptance` journeys 20 times without retries across reused isolated stacks. It also runs them against 30 independently recreated cold stacks and stores validated evidence for both campaigns.

## E2E stack contract

Each CI stack gets a fresh database, a production-built app, separate run IDs, auth state and artifacts, and an independent Zero replica. PR and acceptance stacks are reset without seed data; nightly golden journeys use the repository seed. Preconditions are inserted by fixture builders so that only the action under test is performed in the browser. Fixtures clean their exact test namespace, and teardown removes only the exact run namespace—never a global `E2E-%` pattern.

Local terminal, headed and UI runs all call the same stack preparation and production-build commands. Existing servers are reused only with `E2E_REUSE_SERVER=1`, `E2E_REUSE_COMMIT=<git sha>` and `E2E_REUSE_SCHEMA_HASH=<migration hash>`; the verifier rejects commit, schema, local-origin or Zero-readiness mismatches.

`build:e2e` is a Vite production-mode build configured with local test endpoints; it never uses the Vite development server. After a successful build it records the app, Supabase and Zero origins together with the commit and migration-schema hash in `.output`. `start:e2e` refuses missing or mismatching provenance, so a normal production build pointing at a remote Supabase project cannot accidentally be used by local acceptance tests.

The E2E build, runtime and Playwright configuration load `.env.development.local` and then `.env.test.local` when present. Explicit process variables always win. CI can therefore inject isolated stack endpoints, while local terminal, headed and Playwright UI runs share the same defaults. Wrapper and build-provenance contracts are covered in `tools/e2e/__tests__`.

Functional E2Es must wait for semantic UI state, the global `app-hydration` marker, the authenticated `app-readiness` marker, Zero connection state, `/keepalive` or server confirmation. Fixed sleeps, `networkidle`, broad cleanup and shared mutable users are rejected by the catalog check.

## Pull-request test requirements

Test count is behavior-based, not a fixed quota. One parameterized test may cover equivalent inputs, but every distinct observable behavior, meaningful branch and failure mode introduced by a pull request needs explicit evidence. Always start at the lowest stable level and add a higher-level test only for a boundary that the lower level cannot reproduce.

### New code and features

- Add at least one focused automated test for every new behavior or user action. Cover each distinct success path and every meaningful validation, permission, empty, loading, error, concurrency or realtime branch introduced by the change.
- Prefer unit tests for pure rules, component tests for isolated UI behavior, component-flow tests for multi-component interactions, service/database tests for their real boundaries, and browser-component tests for browser APIs. Add E2E only for a critical browser-App-Zero-database journey.
- Update the applicable coverage, route, UI-action, critical-process or flow-campaign catalog when the new source or action enters that contract. Critical processes require their complete `@critical @pr` browser journey; ordinary UI actions do not automatically require E2E.
- Reuse tables or parameterized cases when setup and expectations are identical. Do not combine unrelated branches into one test merely to reduce the case count.

### Refactored code

- When observable behavior is unchanged, zero new test cases is acceptable only if existing assertions characterize the affected contract and cover every changed executable item and branch. Passing coverage through incidental execution is not sufficient.
- Before changing insufficiently protected code, add characterization cases for each behavior and edge case the refactor must preserve. Keep those assertions stable while changing the implementation.
- Treat every new behavior, branch, error mode or boundary introduced during the refactor as new code and test it under the rules above. Do not rewrite tests to mirror private implementation details or weaken assertions to make the refactor pass.
- Move or rename tests only when ownership or the public boundary moves. The refactor must not reduce repository coverage, branch accountability or catalog evidence.

### Bugs and bug fixes

- Add at least one regression case for each distinct defect or root cause. The case must reproduce the observable failure on the pre-fix code and pass after the fix; demonstrate this by running it against the failing implementation or by otherwise proving that its assertion targets the reported symptom.
- Put the regression at the lowest stable level that can reproduce the failure. Add a second boundary-level regression only when the bug depended on a real database, browser, network, realtime, multi-user or full-stack interaction.
- Cover materially different affected roles, states or failure modes separately. Use a parameterized case when they share the same root cause and expected contract.
- Keep the regression permanently. Do not replace it with a broad snapshot or a coverage-only assertion, and do not add a browser regression for a defect that a deterministic lower-level test fully reproduces.

For all three change types, run the focused suite while developing, then `npm run test:all`, `npm run test:accountability:changed` and `npm run test:coverage:branches:check`. Also run `npm run test:db` or the relevant E2E suite whenever the change touches those boundaries. External AI, payment, map and currency services are stubbed at their network boundary; local email flows use Inbucket.
