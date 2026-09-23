# Project chats implementation

Shared AI conversations for Studio, amendment text and City Design, available in the editor and `/messages`. Reuse `/api/ai/chat` and Zero; no additional HTTP endpoints.

## Implementation checklist

- [x] Strict tool/action contracts and deterministic domain reducers
- [x] Atomic change sets and conflict-checked inverse operations
- [x] Additive database schema, live project access and content revisions
- [x] Zero tables, queries and authorized UI commands
- [x] Server context snapshots, domain adapters and tool registry
- [x] Durable runs, idempotent tool receipts, cancellation and resume
- [x] Shared editor/chat UI and personal-chat handoff
- [x] Shared Aria & Kai header, message list, streaming states and full composer
- [x] Personal skills/tools, project tool group, uploads and explicit attachment sharing
- [x] Studio briefing, amendment text and City Design integration
- [x] Targeted unit, component, database and integration verification

## Decisions

- Project membership controls shared chat access; public amendment visibility alone does not grant chat access.
- One active run per conversation; use the initiating user's model credentials.
- Each write tool applies 1–50 actions atomically against a server context snapshot.
- Studio stays on Yjs; text and City Design use existing domain mutation/governance services.
- City Design is amendment-scoped. Branches govern permissions and proposals, not separate scenes.
- Existing personal histories remain private during handoff.
- Direct content edits have persisted, conditional undo; governance results cannot be undone by bypassing their rules.
- No deployment or remote database migration is implied by implementation.

## Conversation and UI model

`conversation.type = project_ai` has exactly one `studio_project_id` or `amendment_id`. An amendment's text and City Design use the same conversation scope. Multiple conversations per project are supported. The same `ProjectConversation` component is rendered in the editor dock and `/messages`; messages are not copied between the two views.

The editor chat is exposed as a minimized dock tab instead of a side panel, so it never reduces the width of amendment text, City Design or Studio. On desktop the chat window grows upward from the lower-right content edge; on mobile it opens as a bottom sheet above the persistent navigation bar. Inside that shell it reuses `ConversationHeader`, `MessageList` and `AssistantMessageInput` from the personal Aria & Kai chat. The compact variant keeps every control available through the settings drawer. Project links preserve the conversation. From `/messages`, amendment chats can switch between text and City Design, with the last surface stored per user and conversation. The Studio AI briefing creates a project and starts its first conversation using the briefing as the initial instruction.

The shared composer includes the model catalog, reasoning, `#` tools, `/` skills, `@` resources, uploads, AI settings, structured cards, streaming, retry, resume and cancellation. Scope-dependent project tools are always enabled in a locked Project group. Personal skills and personal tools belong to the initiating user; their definitions and credentials are never replicated to other members.

Personal chats expose two entry tools. Handoff copies the actual current instruction and authorized source attachments, never the preceding personal conversation or client-supplied source text. The returned link opens the shared chat; the next instruction there starts project tool execution.

## Tool contracts

The executable schemas live in `src/features/project-chat/logic/contracts.ts`; the model-facing registry lives in `src/server/project-chat/tools.ts` and `starter-tools.ts`.

| Tool                        | Input                                                                                                           | Result / behavior                                                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `open_project_chat`         | `scope: {kind: studio, projectId}` or `{kind: amendment, amendmentId}`, `title`                                 | Creates a shared conversation after membership checks; returns conversation ID, scope, continuation URL and omitted-attachment count.    |
| `create_studio_project`     | `title`, `groupId` (nullable), `kind`, `template`, optional `themeId`, campaign settings and source `{type,id}` | Creates the Studio document, collaboration state and briefing conversation together. Published themes must belong to the selected group. |
| `studio_sources`            | `type: event / amendment / statement`, optional `id`                                                            | Server-loaded sources visible to the actor and shareable with the project audience.                                                      |
| `studio_read`               | `offset` (default 0), `limit` (default 20, maximum 50)                                                          | Committed pages/elements, brand, posts, source, stable IDs and a server snapshot.                                                        |
| `amendment_read`            | `offset`, `limit`                                                                                               | Metadata, semantic text blocks, snapshot-local block/anchor references, selection anchors, branch and editing mode.                      |
| `city_design_read`          | `offset`, `limit`                                                                                               | Saved scene, complete object geometry, IDs, revision and snapshot.                                                                       |
| `city_design_read_features` | `offset`, `limit`                                                                                               | Complete features from the saved OSM snapshot; does not fetch a new map.                                                                 |
| `city_design_catalog`       | `{}`                                                                                                            | Object types, supported properties, geometry types and cost rules.                                                                       |
| `studio_apply_actions`      | `snapshotId`, `summary`, `actions`                                                                              | Atomic Studio changes with change-set receipt.                                                                                           |
| `amendment_apply_actions`   | `snapshotId`, `summary`, `actions`                                                                              | Atomic direct changes or native change requests, according to the current process phase.                                                 |
| `city_design_apply_actions` | `snapshotId`, `summary`, `actions`                                                                              | Atomic object changes with recalculated costs, or native per-object proposals.                                                           |

All write tools require a prior read, accept 1–50 validated actions, and reject unknown properties. Existing entities use `{id}`; entities created earlier in the same batch can use `{localRef}`. A failed action rolls back the whole batch. Tools return structured errors with recovery guidance for stale snapshots, unavailable resources, invalid actions and permission failures.

### Studio actions

- `project.patch`: title and start date.
- `brand.patch`: supported palette/font fields; does not impersonate a theme revision.
- `source.set`: attach an authorized source by type and ID.
- `page.add`, `page.patch`, `page.resize`, `page.reorder`, `page.remove`: template creation, page settings, format and ordering. At least one page must remain.
- `element.add`, `element.patch`, `element.remove`, `element.reorder`: typed element properties and complete ordering. Locked elements are protected.
- `elements.group`, `elements.ungroup`: group membership within a page.
- `post.add`, `post.patch`, `post.set_pages`, `post.remove`: campaign post content and page associations.

Studio writes patch the existing Yjs document and use collaboration authorization/asset validation. These tools do not export or publish content.

### Amendment actions

- `metadata.patch`: title, code, reason, preamble and hashtags.
- `text.replace`: replace the exact snapshot anchor, including a valid partial selection.
- `text.format`: apply supported text marks to an anchor.
- `blocks.insert`, `blocks.append`, `blocks.replace`, `blocks.remove`: semantic paragraphs, headings, quotes, lists and tables. Multi-block references must be contiguous.

Text references are resolved against the snapshot rather than shifted array positions during a batch. Existing comments and suggestions are protected. In suggestion phases, changes become native suggestions/change requests; voting and read-only phases cannot be bypassed.

### City Design actions

- `object.add`, `object.patch`, `object.remove`: registered object types and supported properties.
- `object.set_geometry`: validated point, polygon, corridor or path-corridor geometry.
- `object.translate`: movement in local map meters.
- `object.rotate`: rotation in degrees.
- `object.set_width`: supported corridor widths.
- `object.set_unit_cost`: unit cost; totals are recomputed using existing domain logic.
- `osm.import_feature`: convert an existing saved OSM feature by ID.

The scene belongs to the amendment. The active branch selects governance permissions and proposal routing, not a separate map. A map area must already have been selected and saved.

## Context, access and execution

The server derives the scope and audience from the conversation. Client editor context supplies only hints: surface, branch/document/scene IDs, selected page/elements/objects/features, text selection and content revision. The editor flushes pending changes before submitting. Hints are checked against the canonical resource; stale selections are reported rather than applied at new offsets.

Read results contain `snapshotId`, `resourceId`, `branchId`, `revision`, `mode`, paging metadata and resource data. Full snapshots remain server-side. Model context uses the catalog's context budget, paged reads and bounded history while retaining tool-call/result pairs. Oversized current data is rejected with instructions to read a smaller page, not truncated into writable geometry or text.

Project access is checked in both Zero queries and server transactions. Conversation participation alone never grants access after project membership is revoked. Selecting a personal resource or upload in the composer is an explicit share with the project. The server first verifies the sender's own access, then reloads the title, preview, prompt content, link and card data from canonical rows. Uploads are resolved from `storage.objects`, must be owned by the sender, and receive a server-derived URL, MIME type, size and preview card; bounded text uploads are reloaded into prompt context. Supplied titles, URLs, prompt context and card payloads are discarded. The sanitized attachment is stored with the message and is then visible to project members.

The existing `/api/ai/chat` handles project runs. The existing catalog supplies the initiating user's available models and credentials. `requestId` and a request hash identify retries; only one run may be active per conversation. A server-only `ai_run.configuration` stores resolved skill definitions, selected personal tools, timezone, sanitized attachments, project tool names and the editor surface. It is deliberately absent from Zero. Resume sends only `conversationId`, `requestId` and `resume: true`.

Provider messages and pending calls are persisted before execution. Project mutations commit their domain write, change set and tool result in one transaction. Personal tools reuse the Project runner's ambient Zero transaction, so their data mutations, tool receipt and result also commit or roll back together; Resume executes only calls that are still pending. Leases fence interrupted workers. Cancellation and resume are available to the initiating user. Personal tool attachment and presentation results use the same message context cards as the personal chat.

Zero commands are `projectChat.create`, `join`, `setSurface`, `cancel` and `undo`. They are authorized application commands, not additional HTTP endpoints. Manual text/scene saves carry content revisions to detect conflicting updates.

## Undo and operational limits

Direct changes retain their before/after state. Undo requires the current resource to still match the recorded result and the actor to retain editing rights. This is intentionally conservative: an intervening edit causes a conflict instead of overwriting it. Proposed changes must be reviewed or withdrawn through the existing governance workflow.

The schema migrations are `20260920120000_project_chats.sql`, `20260921120000_project_chat_full_assistant.sql` and `20260921121000_project_chat_participant_surface.sql`; all were applied only to the local Supabase instance. Deployments need these migrations before the updated application. Runs use the existing request process, not a new background worker; interrupted work resumes on user action. External model-provider behavior was exercised with a mocked provider and real local database, not a paid live generation.

## Verification

- TypeScript typecheck, lint and production build passed.
- Project-chat regression suite: **9 files, 28 tests passed**, including the shared composer, editor flush, attachment authorization, durable resume and database-backed tool execution. The complete repository suite passed with **2,033 files and 12,950 tests**. After the final shared-transaction refinement, the affected server suite was rerun with **5 files and 72 passing tests**.
- Database tests cover membership boundaries, revisions, stale snapshots, native proposals, voting restrictions, Studio Yjs writes/undo and resumption after a committed write.
- Unit/component tests cover domain actions, editor/message integration, streaming controls, context budgets, timeline-ordered change sets and sanitized handoff sources/uploads.
- Authenticated Playwright acceptance passed for `/messages` desktop/mobile, the Studio panel, amendment text and City Design. It also verified the complete composer and the locked scope-specific Project tool groups. Live paid-provider generation was not invoked.
