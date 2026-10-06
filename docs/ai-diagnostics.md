# AI diagnostics

AI requests share one persisted trace across assistant chat, Studio project chat, amendment text, City Design, editor commands and inline copilot. A trace retains the original prompt, originating message and resource. Each model step, provider attempt, tool call, nested generation and result has an operation ID and parent operation ID. Retries and project-chat resumes keep the original trace. Successful outputs are stored too, so an unsatisfactory result can be inspected alongside the exact model input and tool results.

Expand **AI history / AI-Verlauf** beside a chat message, active request or document editor to inspect the prompt and operation tree. Details load only when expanded; refresh updates a running trace. The original-message link returns to the user prompt. Older messages without diagnostics display an empty state. Model input includes the selected skills, compressed conversation, tool catalogue and provider request; output includes generated text and tool results. Invalid tool parameters are recorded even when execution is rejected by the SDK.

## Server logs

Development logs are complete JSON objects indented with two spaces. Production logs are one-line JSON. Correlation fields include `traceId`, `originMessageId`, `conversationId`, `runId`, `operationId`, `surface`, `invocation`, model/provider/source, tool call ID and attempt. Errors include stable application codes, HTTP status, SQLSTATE, upstream provider, rate-limit source and recovery guidance when available.

Locally, `ai.trace.started` includes `originalMessageText` once per incoming request. Chat, Studio project chat, City Design and amendment chats use the original user message; direct Studio generation uses the instruction, editor commands use the last user message and copilot uses its input prompt. System prompts, conversation history and tool payloads are not added to console output. Nested generations and provider retries do not repeat the original text. An explicit project-chat resume emits a new start event with the same trace ID and original message.

| Setting          | Values           | Development default | Production default |
| ---------------- | ---------------- | ------------------- | ------------------ |
| `AI_LOG_FORMAT`  | `pretty`, `json` | `pretty`            | `json`             |
| `AI_LOG_PROMPTS` | `true`, `false`  | `true`              | `false`            |

Unset or invalid values use the environment default. The settings are independent: compact JSON can include the original text, and pretty JSON can omit it. To explicitly enable the local presentation, set:

```dotenv
AI_LOG_FORMAT=pretty
AI_LOG_PROMPTS=true
```

Example start event (IDs abbreviated for readability):

```json
{
  "time": "2026-10-06T09:33:23.514Z",
  "level": "info",
  "event": "ai.trace.started",
  "traceId": "a2a43ebc…",
  "originMessageId": "a2a43ebc…",
  "surface": "studio",
  "invocation": "project_chat",
  "originalMessageText": "Erstelle einen Instagram-Post zum Fußballspiel."
}
```

Each event is emitted as a single console call, even when its JSON spans multiple lines. Existing credential redaction is applied before formatting. Persisted diagnostic payloads are unchanged; these settings affect console output only and require no database migration.

`AI_LOG_LEVEL=debug` additionally retains sanitized stack frames in error diagnostics. Prompts, inputs and outputs remain in protected database records at normal verbosity. Provider credentials, tokens, cookies and request headers are removed from persisted payloads and console records.

The reported OpenRouter/Novita HTTP 429 identifies an upstream shared-pool rate limit. Chat and Studio generation retry a rejected request at most twice with the same model and credential, using backoff and `Retry-After` within 30 seconds. Accepted streams and executed tools are never replayed by this retry policy. Editor commands and copilot retain their existing SDK retry/cooldown behavior. PostgreSQL `22P02` maps to an invalid-identifier error; database diagnostics show the statement and parameter positions/types, including empty values, so the failing input can be located without dumping parameter contents to console.

Studio editor context is a source workspace. Accessible manual workspaces can be forked into separate AI proposals, including their referenced media. Only an explicit AI proposal is treated as the target. Explicit `action: create` adds frames; legacy direct proposal followups without an action retain edit behavior. Source and canonical documents remain governed by the existing acceptance workflow.

## Storage and access

Apply `supabase/migrations/20261006010000_ai_traces.sql` before deploying the server changes. It creates the private `ai_diagnostics` schema, outside Zero's automatically published `public` schema and outside the Supabase client API. `ai_trace` and `ai_trace_operation` have RLS and no anonymous/authenticated table privileges.

`GET /api/ai/traces` accepts exactly one UUID selector: `traceId`, `messageId` or `documentId`. It authenticates the session, restricts records to the actor who requested the generation and rechecks current conversation/resource access under the shared authority lock. Responses are not cached. Shared-chat participants can inspect their own calls; another participant's personal model context and tool results remain private.

Deleting a user, conversation, origin message, project, amendment or document cascades diagnostic removal. Soft-deleting an origin or response message also purges its trace. A storage failure emits `ai.diagnostics.failed` without turning an already committed tool operation into a failure; an absent migration is therefore visible in server logs, while the AI operation can still complete.

## Validation

Focused tests cover concurrent prompt isolation, nested SDK generations, rejected tool input, accepted-stream failures, 429 retry/cancellation, protected reads after access revocation, actor isolation, reload, deletion cleanup, exclusion from Zero publication, lazy UI inspection, unstable replicated arrays and Studio workspace fork/new-frame behavior. Database tests require the local development database at port 54322 and use fixture IDs; no real provider calls or production writes are needed.

## Project context and precise Studio edits

Project chat shows the active project, workspace/branch and editor selection as context chips before sending. Selection chips can be excluded for the next request. Studio `@frame@` and `@element@` references come from the current workspace; pinned references survive editor selection changes. Project/workspace chips identify the fixed chat scope and cannot be removed. General tools are opt-in through `#` in project chats.

The displayed references are frozen before editor save, resolved against authorized server documents, and saved with the original message and trace. Historical selections are never reused as a live editor selection. Read tools, media tools and suggestion generation share the same source resolver; an absent workspace means canonical content, never the latest AI draft or a model-supplied workspace ID.

`studio_resolve_target` identifies named text roles and returns a snapshot. `studio_edit_suggestion` applies exact text replacements to that snapshot through the existing AI proposal workflow, preserving typography, element names and unrelated content. A named subtitle takes precedence over a selected title; ambiguous roles require clarification. Generated design requests continue to use `studio_generate_suggestion`. Both tools return `status: proposed`; message status comes from tool receipts rather than the assistant's prose. Identical failed inputs are not replayed, and at most one corrected retry is accepted per tool/run.

New template and AI text nodes retain optional `textRole` metadata across editor saves and renaming. Explicit roles take precedence over legacy name matching. Older documents remain compatible; named elements and known template placeholders can still be resolved, while ambiguous matches require clarification.

Source metadata uses existing run, message and snapshot JSON fields; this extension requires no database migration. Console prompt visibility and redaction settings remain unchanged.
