# Studio collaboration and legacy editors

The broad editor migration was reverted on 18 September 2026.

- Amendments, blogs, personal/group documents and Streetdesign use their previous editors, Zero content mutations, presence, change-request and voting workflows.
- Only Communication Studio uses Yjs/Hocuspocus on port 1236. Its authorization, durable revisions, drafts/recovery, media and exports remain enabled.
- `/api/collaboration` rejects non-Studio document references and retired amendment commands. The database additionally prevents active non-Studio rooms.
- Migration `20260918120000_studio_only_collaboration.sql` removes the legacy-editor write fences, restores canonical discussions and retires non-Studio rooms. Existing content projections stay authoritative. Historical migration records remain private archives, not active editor state.
- Archived branch/proposal drafts are not merged into legacy main content. Existing decisions and legacy change-request records are preserved.
- The global collaboration phase now controls Studio only. `phase=active` does not mean that the other editors use Yjs.

## Local operation

`pnpm dev:stack` starts Supabase, Vite (3000), Zero (4848), Studio collaboration (1236) and the export worker. Normal startup does not reset data.

`pnpm dev:stack:status` reports readiness. `pnpm dev:stack:stop` stops the stack. `pnpm dev:stack:reset` explicitly rebuilds the local database and demo records; its seed activates Studio only. Demo credentials are in the ignored `output/local-stack/demo.json`.

The previous all-editor migration/acceptance commands and fingerprinted reports are historical and are not release authorization for this configuration. Production has not been changed.

Rollback verification artifacts are in the ignored `output/editor-rollback/` directory. It also holds the pre-rollback source copies and local database backup.

## Rollback verification

The targeted editor/Studio suites passed 1,715 tests. Local seed and migration-command checks passed 17 tests; Studio storage passed six PostgreSQL integration tests and the SQL suites passed 38 assertions. The static repository checks and 46 contract tests passed, along with type checking, lint and the production build.

Browser checks confirmed legacy amendment/blog text writes and Streetdesign object saves against their entity tables. Studio saved a new confirmed revision and produced a downloadable PPTX. Readiness reports one active Studio document, no active legacy-editor rooms, no pending deliveries and no integrity errors.
