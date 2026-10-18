# Group email invitations

Group email invitations are available without a feature flag. They use existing Supabase authentication and Resend transactional email; recipients are never subscribed to newsletters. Sending requires the database migration and valid mail configuration.

## Setup

1. Apply the current migration baseline (`20261014064625_initial.sql` and `20261014064626_initial_manual.sql`) when setting up a new database. It replaces the former separate invitation/name migrations. The four invitation tables live in the private `group_invitations` schema, outside Zero's automatic public-schema publication and PostgREST exposure. They have RLS enabled and no anonymous/authenticated grants. Existing invitations remain valid with null recipient names. On 2026-10-18 the production tables and recipient name columns were confirmed present; the production configuration repair requires no migration or seed.
2. Set `RESEND_API_KEY` to a server-only key with access to sending and usage, and `GROUP_EMAIL_INVITATIONS_FROM` to a verified sender. Configure Supabase custom SMTP separately for account confirmation emails.
3. Production: set `GROUP_EMAIL_INVITATIONS_ENVIRONMENT=production` and `GROUP_EMAIL_INVITATIONS_BASE_URL=https://www.polity.live`. Development: use localhost and explicit comma-separated `GROUP_EMAIL_INVITATIONS_ALLOWED_RECIPIENTS`. Preview origins are rejected by the configuration checks.
4. Enable Resend events `email.sent`, `email.delivered`, `email.bounced`, `email.complained`, `email.failed` on the existing `/api/resend/webhook` endpoint and retain its signing secret and newsletter configuration. The same endpoint verifies signatures and deduplicates events before dispatching them.
5. Run database and browser acceptance using the injected mail provider and check production configuration before deployment. The browser test requires matching local Zero client/server versions and the same allowed query/mutation origin as the application build.

For the local development stack, keep the working `RESEND_API_KEY` and add these values to `.env.development.local`:

```dotenv
GROUP_EMAIL_INVITATIONS_ENVIRONMENT=development
GROUP_EMAIL_INVITATIONS_BASE_URL=http://localhost:3000
GROUP_EMAIL_INVITATIONS_FROM=Polity <team@polity.live>
GROUP_EMAIL_INVITATIONS_DAILY_LIMIT=50
GROUP_EMAIL_INVITATIONS_ALLOWED_RECIPIENTS=delivered@resend.dev
```

Vite watches this file and restarts the application server when it changes. No database or Zero reset is needed. The domain `polity.live` must remain verified in Resend. `delivered@resend.dev` simulates email delivery, without a real inbox; use the injected test mail sink for link acceptance tests. Other addresses remain blocked unless explicitly added to the local allowlist.

### Vercel Production

Set all of the following in the linked Vercel project `polity`, targeting **Production only**:

```dotenv
GROUP_EMAIL_INVITATIONS_ENVIRONMENT=production
GROUP_EMAIL_INVITATIONS_BASE_URL=https://www.polity.live
GROUP_EMAIL_INVITATIONS_FROM=Polity <team@polity.live>
GROUP_EMAIL_INVITATIONS_DAILY_LIMIT=50
```

Keep `RESEND_API_KEY` server-only and configured as a Vercel Secret. It must support both sending and `GET /usage`; a sending-only key cannot perform the budget check. The production mode does not apply the development recipient allowlist. Verify `polity.live` in the Resend account used for production. SMTP configuration and keys for other applications do not change as part of this repair.

Saving variables does not update an existing deployment. Redeploy the currently live revision on Vercel and verify that `https://www.polity.live` serves the new deployment. A local `.env.production.local` file does not configure the live Vercel runtime. Check the actual runtime rather than using local values as fallbacks: Vercel Secrets cannot be read back through the API, and `vercel env run` can load local dotenv defaults when a cloud value is unavailable. Use the authenticated live invitation preview to verify the deployed key's budget access without sending mail.

For a configuration-only repair, do not run the full deployment script: it also applies Supabase migrations/seeds and deploys Fly.io. Redeploy only the existing Vercel production deployment. Validate preview/budget availability and compare invitation, batch and delivery counts before and after; no real invitation is needed for this check.

Missing sender/API configuration returns `configuration`; provider HTTP 401/403 returns `provider_access_denied`; network failures, timeouts and invalid quota data return `quota_unavailable`. Configuration and access errors ask users to contact the platform administrator, while temporary failures suggest trying again. The usage request needs only the API key; preview/create/resend validate sending configuration before reservation. Listing, revocation and acceptance do not require a working email provider.

## Limits and recovery

The composer immediately shows valid recipients as the same person cards used for registered users. Each card optionally accepts first and last names (100 characters per field). Names survive budget checks and case/whitespace changes to an address. Separate read-only cards show previously open invitations; these remain managed in the membership administration. The dialog stays open after sending, locks the submitted list, and keeps its green, red or yellow result during background refreshes. Counts distinguish provider acceptance, failure, unknown outcomes and skipped recipients. Provider acceptance is not delivery confirmation. “Invite more people” explicitly clears the draft and names and creates a fresh idempotency key; a technical retry of the same submission retains its key.

Preview/create accept exactly one of `emails` (legacy string/list) or `recipients: [{ email, firstName?, lastName? }]`. Names are trimmed and blank values become absent. Complementary duplicate names merge; conflicting values for the same normalized email return `invalid_names`. Names participate in the request fingerprint, are stored only as invitation data, appear in authorized management responses, and are reused for resending and personalized German/English greetings. Public token previews expose only the masked address. Acceptance never overwrites profile names.

`GROUP_EMAIL_INVITATIONS_DAILY_LIMIT` defaults to 50 attempts per rolling 24 hours. Budget also respects half the remaining Resend daily and monthly quota. Concurrent batches reserve budget under the same database authority lock. Failed attempts are conservatively counted; unknown/in-flight attempts additionally reserve provider quota. Supabase SMTP sends share the provider quota and can race the usage check; provider rejection is shown as a failure, never hidden by an automatic next-day queue.

Deleting a group or inviter removes personal invitation data but preserves delivery IDs, provider status and attempt timestamps in the budget ledger. Deletion cannot reset the platform sending limit.

The API accepts at most 100 distinct addresses, further limited by budget. Over-budget lists produce no invitation rows and no emails. Duplicate addresses, active members and open invitations are skipped. Resend idempotency is scoped to a batch, and the database request key prevents re-execution even after the provider's 24-hour idempotency window expires.

Invitation links last 30 days. Retries initiated by a manager after ten minutes rotate the token and invalidate the old link. Revoking a link does not recall an email already handed to Resend. A provider timeout or interrupted request becomes `unknown`; inspect the status before manually resending. No token or rendered message is persisted by Polity. A crash after reservation cannot be replayed automatically because the token is intentionally held only in memory. Managers can resend manually after the cooldown.

Logs contain only error codes, batch/invitation IDs, counts and provider HTTP status/operation. Ensure hosting/proxy access logs redact `/invite/*` and `/api/invitations/*` paths. Application code never logs these URLs. The invite page sends no-referrer/noindex metadata and endpoints disable caching.

Monitor `group_invitation.delivery`, `group_invitation.error` and Resend delivery events. Mail configuration and provider errors are reported explicitly; the interface does not hide invitations when loading fails. No production migration or real email is required for the automated test suite.

## Verification (2026-10-11)

The targeted suite passed 72 unit/component tests, 16 PostgreSQL integration tests, 8 pgTAP assertions and 15 route/mutation contract tests. A separate service integration test verifies an actual Resend HMAC signature, tampering rejection and duplicate dispatch suppression. Feature files pass lint and production builds succeed.

Browser acceptance now passes on the running local stack: two external accounts receive distinct sink emails, sign in, explicitly accept, become active members and return to their group. Post-acceptance navigation uses the router's replacement navigation so the consumed invitation URL is replaced consistently. Do not reset a shared development database to run this test.

The migration has been applied to local PostgreSQL only. No production configuration or production migration was performed. The feature flag has been removed; group managers see the email mode immediately, while permission, budget and test-recipient checks still apply.

After the local configuration fix, 20 targeted unit/component/webhook tests, 19 database integration tests and the browser acceptance test passed. A live smoke check used the running localhost API, genuine local Supabase authentication and the real Resend provider: preview succeeded and one email to `delivered@resend.dev` was accepted, with its provider ID persisted. Its temporary user/group were removed while the real attempt remains counted in the anonymous budget ledger. Production build and lint for changed files passed. Global typecheck still reports the Stripe API-version mismatch; global lint reports unrelated Studio test errors. No new migration or production change is needed for this fix.

For persistent feedback and optional recipient names, the additive migration was applied locally without resetting PostgreSQL or Zero. The final feature regression suite passed 45 unit/component/webhook tests, 21 database integration tests and 10 pgTAP assertions. Browser acceptance checks named cards, personalized sink emails, visible provider-accepted feedback, a fresh list, persisted names after reopening, and explicit acceptance by both accounts. All deliveries for this acceptance use an injected mail sink; no real mail or production migration was performed.

The complete browser flow passed twice during implementation. Later verification still passed sending, feedback and reopening, but group navigation was blocked by an unrelated Studio runtime error (`Cannot access 'presentationMusic' before initialization`); the general route runtime contract encounters the same error. Production build, feature lint/formatting, route catalog and action catalog checks passed. Global typecheck reports unrelated Stripe and Studio type errors; global lint, source/UI accountability and database coverage also report unrelated Studio/chart inventory gaps. These checks do not report an invitation feature gap.

## Production configuration repair (2026-10-18)

The four invitation configuration variables were missing from Vercel Production, including the required sender. They were added for Production only, and the previously live revision was redeployed as `dpl_CMg4qkB6WYkZ2oecGPP8ohbZzQxW`. Its build completed successfully and `https://www.polity.live` was confirmed to point to it. No application/API/schema changes, Supabase/Fly deployments, migrations or seeds were performed. The existing production Resend Secret was retained: the authenticated live preview successfully checked its real sending budget. A separate read-only Resend account check confirmed that `polity.live` is verified. All 19 existing invitation configuration/provider unit tests passed, including missing sender/key and HTTP 401/403 cases.

The production browser preview displayed one eligible recipient, 50 invitations available and an enabled send button without the configuration error. The acceptance workflow did not invoke create, resend or acceptance. Initial invitation/batch/delivery counts were all zero. After the preview screenshot was captured at 11:51:10 UTC, concurrent live activity created one invitation and one delivery attempt at 11:51:16 UTC, recorded as `sent` with a Resend message ID. Consequently the final counters were one each; an unchanged-counter assertion cannot be claimed for this shared production session. Provider acceptance does not establish delivery to the recipient's inbox. The live invitation was left unchanged.
