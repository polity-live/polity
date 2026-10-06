# Studio AI Suggestions

## Activation

Apply `20260924010000_studio_ai_suggestions.sql` and
`20260924011000_studio_ai_private_access.sql` and
`20260927010000_studio_ai_source_provenance.sql` before enabling the feature.
The existing Studio, V5 and Canvas flags must also be enabled.

```text
STUDIO_AI_ENABLED=true
OPENROUTER_API_KEY=<application key>
```

`STUDIO_AI_MODEL_ID` optionally prefers a model from the verified free catalog.
Application-funded Studio generation accepts only models whose catalog prompt
and completion prices are both explicitly zero. New AI chat and project chat
requests pass their explicitly selected model and credential source to Studio;
personal API keys are supported and charged to the requesting user's provider
account. Legacy callers without a selection keep the verified-free behavior.
There are no automatic credential or paid fallbacks. See
[OpenAI and personal AI access](openai-ai-access.md) for source selection and the
separate, disabled ChatGPT login preparation.
The feature defaults to disabled in production and enabled in development.
Disable it with `STUDIO_AI_ENABLED=false`.

## Generation and review

Both chats use `studio_generate_suggestion`. The general chat can search for a
source and generate the suggestion in the same conversation. If no project is
provided, the server creates a private V5 project after successful compilation.
The returned URL opens its proposal review. Studio chat supplies its current
project and verified frame/node selection.

The model returns a bounded JSON plan. Template mode owns geometry in code;
free mode accepts relative boxes for text, shapes, existing media and approved
library elements. The compiler creates native V5 nodes and a diff. It checks
selection scope, locks, safe areas, text capacity and asset references. Missing
event dates and locations appear as visible placeholders. Tables, charts,
drawings, embeds and generated images are not created by this tool.

Project palettes, fonts and named text styles are used by default. Explicit
`themeId`, `themeName` or `themeMode` requests change them through the same
proposal path. `themeOnly=true` prepares only that change without a model call.
Theme changes that would modify locked elements are rejected.

Library media are copied into a proposal storage path before compilation.
Project, proposal and asset rows are committed together. Failed compilation or
commit removes prepared copies; rejected/withdrawn proposals remove their
workspace media. Accepted media move into the canonical workspace.

Sources are reloaded from canonical rows and checked against every current
project reader. Followups retain the earlier proposal's source references.
Sharing, invitations, visibility changes, group adoption and acceptance repeat
the source checks. Proposal metadata stores only type, ID and retrieval time.
Accepted source references remain on the project and follow project/template
copies, so later audience changes continue to check the original sources.

Private project owners explicitly accept or reject AI drafts. Active editors
can create them. Group AI drafts can be prepared during `edit`; submission and
voting continue to follow the existing phase rules. Submitted proposals are
immutable and further prompts create a new draft. Existing direct AI Studio
write tools, Undo/Redo and the legacy AI acceptance path cannot apply these
changes.

Presentation projects use ordered 16:9 V5 frames. The default presentation and
carousel contain three frames. PPTX export uses deliverable frame order and
preserves editable text and shapes. A flyer is a digital portrait frame.

## Verification

```powershell
pnpm run typecheck
pnpm exec vitest run --project unit --project component --maxWorkers 2 src/features/communication-studio src/server/studio src/server/project-chat tools/studio/__tests__/exports.unit.test.ts
pnpm exec vitest run --project database-integration --maxWorkers 1 src/server/studio/__tests__/ai-suggestions.database-integration.test.ts src/server/studio/__tests__/canvas-workflow.database-integration.test.ts src/server/project-chat/__tests__/project-chat.database-integration.test.ts
```

Generation tests mock the model and use the local database. They do not call a
paid provider or publish content. Production activation and a real free-model
smoke test are separate deployment steps.
