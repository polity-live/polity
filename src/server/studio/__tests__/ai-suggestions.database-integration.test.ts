import { encodeAppError } from '@/features/shared/errors/app-error';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import postgres from 'postgres';
import { createStudioDocumentV5 } from '@/features/communication-studio/logic/document-v3';
import { diffStudio } from '@/features/communication-studio/logic/operations';
import { startAiTrace, withAiTrace } from '@/server/ai-trace';

const model = vi.hoisted(() => ({ targetId: '', calls: 0, invalid: false }));
const personal = vi.hoisted(() => ({ resolve: vi.fn() }));
vi.mock('@/server/ai-models', () => ({
  resolveStudioGenerationModelForUser: async (
    actor: string,
    descriptor?: unknown,
    effort = 'medium'
  ) =>
    descriptor
      ? { ...(await personal.resolve(actor, descriptor, effort)), supportsStructuredOutput: true }
      : { model: 'verified-free-model', supportsStructuredOutput: true },
}));
vi.mock('@/server/ai-db', () => ({
  enrichAiAttachmentsForPrompt: async (attachments: unknown[]) => attachments,
}));
vi.mock('ai', async original => ({
  ...(await original<typeof import('ai')>()),
  generateText: async ({
    system,
    prompt,
    output,
    maxRetries,
  }: {
    system: string;
    prompt: string;
    output?: { name: string };
    maxRetries?: number;
  }) => {
    expect(output?.name).toBe('json');
    expect(maxRetries).toBe(0);
    model.calls++;
    if (model.invalid) return { text: '{invalid json' };
    return {
      text: JSON.stringify(
        system.includes('Do not return frames')
          ? {
              title: 'Treffen',
              frames: [],
              edits: [{ nodeId: model.targetId, text: 'Neuer Titel' }],
            }
          : prompt.includes('"mode":"free"')
            ? {
                title: 'Treffen',
                frames: [
                  {
                    elements: [
                      {
                        kind: 'text',
                        text: 'Alter Titel',
                        box: { x: 0.1, y: 0.1, width: 0.8, height: 0.3 },
                        size: 64,
                      },
                    ],
                  },
                ],
              }
            : {
                title: 'Treffen',
                frames: [
                  {
                    eyebrow: 'Einladung',
                    headline: 'Alter Titel',
                    body: 'Gemeinsam gestalten',
                    cta: 'Mitmachen',
                    variant: 'invitation',
                  },
                ],
                edits: [],
              }
      ),
    };
  },
}));

import { executeProjectTool } from '@/server/project-chat/tools';
import { executeStudioChatSuggestion } from '@/server/project-chat/studio-suggestions';
import { resolveStudioSource } from '../source';
import { projectChatSharedMutators } from '@/zero/project-chat/shared-mutators';
import { createZeroContext, executeZeroTransaction } from '@/server/zero-mutate';
import {
  compileStudioAiPlan,
  studioAiPlanSchema,
} from '@/features/communication-studio/logic/ai-design';
import { generateStudioSuggestion } from '../ai-suggestions';
import { studioCanvasCommand as canvasCommand } from '@/test/studio-zero-database.fixture';
import { studioSql } from '../db';
import { inviteStudioCollaborators } from '../collaborators';

const database =
  process.env.STUDIO_TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
if (
  !['localhost', '127.0.0.1'].includes(new URL(database).hostname) ||
  new URL(database).port !== '54322'
)
  throw new Error('Studio AI tests require the explicit local development database');
process.env.STUDIO_DATABASE_URL = database;
process.env.STUDIO_AI_ENABLED = 'true';
const sql = postgres(database, { max: 4 });
const actor = crypto.randomUUID();
const viewer = crypto.randomUUID();
const group = crypto.randomUUID();
const projectIds: string[] = [];
const eventIds: string[] = [];

it('uses the requesting actor and selected personal key for native Studio suggestions without a free fallback', async () => {
  const descriptor = { provider: 'openai' as const, id: 'personal-model', source: 'byok' as const };
  personal.resolve.mockResolvedValue({
    model: 'personal-model',
    providerOptions: { openai: { reasoningEffort: 'low' } },
  });
  const suggestion = await generateStudioSuggestion(
    actor,
    { instruction: 'Erstelle einen persönlichen Post', mode: 'template', kind: 'single' },
    { model: descriptor, reasoningEffort: 'low' }
  );
  projectIds.push(suggestion.projectId);
  expect(personal.resolve).toHaveBeenLastCalledWith(actor, descriptor, 'low');
  const [draft] =
    await sql`select owner_id,ai_status from canvas_proposal where id=${suggestion.proposalId}`;
  expect(draft).toMatchObject({ owner_id: actor, ai_status: 'ready' });
  personal.resolve.mockRejectedValueOnce(
    Object.assign(new Error('usage limit'), { statusCode: 429 })
  );
  const beforeCalls = model.calls;
  await expect(
    generateStudioSuggestion(
      actor,
      { instruction: 'Erstelle einen weiteren Post', mode: 'template', kind: 'single' },
      { model: descriptor }
    )
  ).rejects.toThrow('usage limit');
  expect(model.calls).toBe(beforeCalls);
});

beforeAll(async () => {
  await sql`insert into "user"(id) values(${actor}),(${viewer})`;
  await sql`insert into "group"(id,name,owner_id) values(${group},'AI fixture',${actor})`;
});

afterAll(async () => {
  for (const projectId of projectIds) {
    await sql`delete from canvas_receipt where project_id=${projectId}`;
    await sql`delete from canvas_proposal where project_id=${projectId}`;
    await sql`delete from studio_project where id=${projectId}`;
  }
  for (const eventId of eventIds) await sql`delete from event where id=${eventId}`;
  await sql`delete from "group" where id=${group}`;
  await sql`delete from "user" where id=${actor}`;
  await sql`delete from "user" where id=${viewer}`;
  await sql.end();
  await studioSql().end();
});

it('creates a private native V5 proposal, edits its heading and applies it only on acceptance', async () => {
  const eventId = crypto.randomUUID();
  eventIds.push(eventId);
  await sql`insert into event(id,title,visibility,creator_id) values(${eventId},'Treffen','public',${actor})`;
  const first = await generateStudioSuggestion(
    actor,
    {
      instruction: 'Erstelle einen Post zu unserem Treffen',
      mode: 'template',
      kind: 'single',
      sourceRefs: [{ type: 'event', id: eventId }],
    },
    { requestKey: crypto.randomUUID() }
  );
  projectIds.push(first.projectId);
  const [before] =
    await sql`select document,content_revision from studio_state where project_id=${first.projectId}`;
  expect(before.document.nodes).toHaveLength(0);
  expect(before.content_revision).toBe(0);
  const [draft] =
    await sql`select document,revision,origin,ai_status from canvas_proposal where id=${first.proposalId}`;
  expect(draft).toMatchObject({ revision: 1, origin: 'ai', ai_status: 'ready' });
  model.targetId = draft.document.nodes.find(
    (node: { name: string }) => node.name === 'Headline'
  ).id;
  const followupKey = crypto.randomUUID();
  const followup = {
    instruction: 'Ändere nur die Überschrift',
    projectId: first.projectId,
    proposalId: first.proposalId,
    nodeIds: [model.targetId],
    sourceRefs: [],
  };
  const second = await generateStudioSuggestion(actor, followup, { requestKey: followupKey });
  const retried = await generateStudioSuggestion(actor, followup, { requestKey: followupKey });
  expect(retried.proposalId).toBe(second.proposalId);
  expect(second.proposalId).toBe(first.proposalId);
  const [edited] =
    await sql`select document,revision,ai_sources from canvas_proposal where id=${first.proposalId}`;
  expect(edited.revision).toBe(2);
  expect(edited.ai_sources).toMatchObject([{ type: 'event', id: eventId }]);
  expect(
    edited.document.nodes.find((node: { id: string }) => node.id === model.targetId).content[0]
      .children[0].text
  ).toBe('Neuer Titel');
  expect(
    (await sql`select content_revision from studio_state where project_id=${first.projectId}`)[0]
      .content_revision
  ).toBe(0);
  const session = await canvasCommand(actor, { action: 'session', projectId: first.projectId });
  await canvasCommand(actor, {
    action: 'acceptPrivate',
    projectId: first.projectId,
    workspaceId: first.proposalId,
    generation: session.generation,
    revision: 2,
    operationId: crypto.randomUUID(),
  });
  const [accepted] =
    await sql`select document,content_revision from studio_state where project_id=${first.projectId}`;
  expect(accepted.content_revision).toBe(1);
  const [project] =
    await sql`select source_references from studio_project where id=${first.projectId}`;
  expect(project.source_references).toMatchObject([{ type: 'event', id: eventId }]);
  expect(
    accepted.document.nodes.find((node: { id: string }) => node.id === model.targetId).content[0]
      .children[0].text
  ).toBe('Neuer Titel');
});

it('prepares a group AI draft in edit phase but waits for the suggestion phase to submit', async () => {
  const projectId = crypto.randomUUID();
  projectIds.push(projectId);
  const document = createStudioDocumentV5('Group draft', 'single');
  await sql`insert into studio_project(id,owner_id,group_id,title,kind,document_schema_version,created_at,updated_at)
    values(${projectId},${actor},${group},${document.title},'single',5,0,0)`;
  await sql`insert into studio_state(project_id,document,updated_at)
    values(${projectId},${sql.json(JSON.parse(JSON.stringify(document)))},0)`;
  const suggestion = await generateStudioSuggestion(actor, {
    instruction: 'Erstelle einen Gruppenpost',
    projectId,
    mode: 'template',
    kind: 'single',
    sourceRefs: [],
  });
  const session = await canvasCommand(actor, { action: 'session', projectId });
  expect(session.phase).toBe('edit');
  expect(
    session.proposals.some((proposal: { id: string }) => proposal.id === suggestion.proposalId)
  ).toBe(true);
  await expect(
    canvasCommand(actor, {
      action: 'submit',
      projectId,
      workspaceId: suggestion.proposalId,
      revision: 1,
      generation: session.generation,
      operationId: crypto.randomUUID(),
    })
  ).rejects.toThrow(encodeAppError('permission_denied'));
  await canvasCommand(actor, {
    action: 'phase',
    projectId,
    phase: 'suggest_internal',
    revision: 0,
    generation: session.generation,
    operationId: crypto.randomUUID(),
  });
  await canvasCommand(actor, {
    action: 'submit',
    projectId,
    workspaceId: suggestion.proposalId,
    revision: 1,
    generation: session.generation,
    operationId: crypto.randomUUID(),
  });
  const [proposal] = await sql`select state from canvas_proposal where id=${suggestion.proposalId}`;
  expect(proposal.state).toBe('submitted');
  expect(model.calls).toBeGreaterThanOrEqual(2);
});

it('leaves no project or proposal when the free model returns invalid data twice', async () => {
  const [before] =
    await sql`select count(*)::int as projects from studio_project where owner_id=${actor}`;
  model.invalid = true;
  try {
    await expect(
      generateStudioSuggestion(actor, {
        instruction: 'Erstelle einen Post zu unserem Treffen',
        mode: 'template',
        kind: 'single',
        sourceRefs: [],
      })
    ).rejects.toThrow('invalid design plan');
  } finally {
    model.invalid = false;
  }
  const [after] =
    await sql`select count(*)::int as projects from studio_project where owner_id=${actor}`;
  expect(after.projects).toBe(before.projects);
});

it('rejects a private AI suggestion without changing the canonical document', async () => {
  const suggestion = await generateStudioSuggestion(actor, {
    instruction: 'Erstelle einen Post',
    mode: 'template',
    kind: 'single',
    sourceRefs: [],
  });
  projectIds.push(suggestion.projectId);
  const session = await canvasCommand(actor, {
    action: 'session',
    projectId: suggestion.projectId,
  });
  await canvasCommand(actor, {
    action: 'rejectPrivate',
    projectId: suggestion.projectId,
    workspaceId: suggestion.proposalId,
    revision: 1,
    generation: session.generation,
    operationId: crypto.randomUUID(),
  });
  const [proposal] =
    await sql`select state,decision from canvas_proposal where id=${suggestion.proposalId}`;
  expect(proposal).toMatchObject({ state: 'closed', decision: 'rejected' });
  const [canonical] =
    await sql`select document,content_revision from studio_state where project_id=${suggestion.projectId}`;
  expect(canonical.content_revision).toBe(0);
  expect(canonical.document.nodes).toHaveLength(0);
});

it('blocks sharing and acceptance when a private source is not readable by the project audience', async () => {
  const eventId = crypto.randomUUID();
  eventIds.push(eventId);
  await sql`insert into event(id,title,visibility,creator_id) values(${eventId},'Privates Treffen','private',${actor})`;
  const suggestion = await generateStudioSuggestion(actor, {
    instruction: 'Erstelle einen Post zu diesem Treffen',
    sourceRefs: [{ type: 'event', id: eventId }],
  });
  projectIds.push(suggestion.projectId);
  await expect(inviteStudioCollaborators(actor, suggestion.projectId, [viewer])).rejects.toThrow(
    'project audience'
  );
  await sql`insert into studio_project_collaborator(id,project_id,user_id,invited_by_id,status,created_at,updated_at)
    values(${crypto.randomUUID()},${suggestion.projectId},${viewer},${actor},'active',0,0)`;
  const session = await canvasCommand(actor, {
    action: 'session',
    projectId: suggestion.projectId,
  });
  await expect(
    canvasCommand(actor, {
      action: 'acceptPrivate',
      projectId: suggestion.projectId,
      workspaceId: suggestion.proposalId,
      revision: 1,
      generation: session.generation,
      operationId: crypto.randomUUID(),
    })
  ).rejects.toThrow(encodeAppError('permission_denied'));
  const [canonical] =
    await sql`select content_revision from studio_state where project_id=${suggestion.projectId}`;
  expect(canonical.content_revision).toBe(0);
});

it('creates a free native composition and preserves its mode on a targeted followup', async () => {
  const suggestion = await generateStudioSuggestion(actor, {
    instruction: 'Gestalte einen freien Post',
    mode: 'free',
    sourceRefs: [],
  });
  projectIds.push(suggestion.projectId);
  const [draft] =
    await sql`select document,ai_mode from canvas_proposal where id=${suggestion.proposalId}`;
  expect(draft.ai_mode).toBe('free');
  model.targetId = draft.document.nodes.find(
    (node: { type: string }) => node.type === 'richText'
  ).id;
  await generateStudioSuggestion(actor, {
    instruction: 'Ändere die Überschrift',
    projectId: suggestion.projectId,
    proposalId: suggestion.proposalId,
    nodeIds: [model.targetId],
    sourceRefs: [],
  });
  const [edited] =
    await sql`select document,ai_mode from canvas_proposal where id=${suggestion.proposalId}`;
  expect(edited.ai_mode).toBe('free');
  expect(
    edited.document.nodes.find((node: { id: string }) => node.id === model.targetId).content[0]
      .children[0].text
  ).toBe('Neuer Titel');
});

it('proposes an explicit theme-only change without a model call or direct canvas write', async () => {
  const projectId = projectIds[0];
  const calls = model.calls;
  const suggestion = await generateStudioSuggestion(actor, {
    instruction: 'Ändere nur das Theme auf Dunkel',
    projectId,
    themeMode: 'dark',
    themeOnly: true,
  });
  expect(model.calls).toBe(calls);
  const [draft] =
    await sql`select document,revision from canvas_proposal where id=${suggestion.proposalId}`;
  expect(draft.document.theme.mode).toBe('dark');
  const [original] = await sql`select document from studio_state where project_id=${projectId}`;
  expect(original.document.theme.mode).toBe('light');
  const session = await canvasCommand(actor, { action: 'session', projectId });
  await canvasCommand(actor, {
    action: 'acceptPrivate',
    projectId,
    workspaceId: suggestion.proposalId,
    revision: draft.revision,
    generation: session.generation,
    operationId: crypto.randomUUID(),
  });
  const [accepted] = await sql`select document from studio_state where project_id=${projectId}`;
  expect(accepted.document.theme.mode).toBe('dark');
});

it('uses a normal workspace as a source, preserves it, and honors explicit new-frame creation', async () => {
  const initial = await generateStudioSuggestion(actor, { instruction: 'Erstelle einen Post' });
  projectIds.push(initial.projectId);
  const session = await canvasCommand(actor, { action: 'session', projectId: initial.projectId });
  const source = await canvasCommand(actor, {
    action: 'createDraft',
    projectId: initial.projectId,
    title: 'Manual draft',
    revision: 0,
    generation: session.generation,
    operationId: crypto.randomUUID(),
  });
  const [ai] = await sql`select document from canvas_proposal where id=${initial.proposalId}`;
  const [manual] = await sql`select document from canvas_proposal where id=${source.workspaceId}`;
  await canvasCommand(actor, {
    action: 'saveDraft',
    projectId: initial.projectId,
    workspaceId: source.workspaceId,
    revision: 0,
    generation: session.generation,
    operationId: crypto.randomUUID(),
    changes: diffStudio(manual.document, ai.document),
  });
  const [before] =
    await sql`select document,revision from canvas_proposal where id=${source.workspaceId}`;
  const result = await generateStudioSuggestion(actor, {
    instruction: 'Füge ein weiteres Frame hinzu',
    projectId: initial.projectId,
    sourceWorkspaceId: source.workspaceId,
    action: 'create',
  });
  expect(result.proposalId).not.toBe(source.workspaceId);
  const [draft] =
    await sql`select origin,document from canvas_proposal where id=${result.proposalId}`;
  expect(draft.origin).toBe('ai');
  expect(
    draft.document.nodes.filter((node: { type: string }) => node.type === 'frame')
  ).toHaveLength(2);
  expect(
    (await sql`select document,revision from canvas_proposal where id=${source.workspaceId}`)[0]
  ).toEqual(before);
  await generateStudioSuggestion(actor, {
    instruction: 'Erstelle noch ein neues Frame',
    projectId: initial.projectId,
    proposalId: result.proposalId,
    action: 'create',
  });
  const [extended] = await sql`select document from canvas_proposal where id=${result.proposalId}`;
  expect(
    extended.document.nodes.filter((node: { type: string }) => node.type === 'frame')
  ).toHaveLength(3);
  await expect(
    generateStudioSuggestion(actor, {
      instruction: 'Ändere diesen Entwurf',
      projectId: initial.projectId,
      proposalId: source.workspaceId,
      action: 'edit',
    })
  ).rejects.toMatchObject({ code: 'ai_workspace_invalid' });
  await expect(
    generateStudioSuggestion(actor, {
      instruction: 'Ändere diesen Entwurf',
      projectId: initial.projectId,
      sourceWorkspaceId: crypto.randomUUID(),
    })
  ).rejects.toMatchObject({ code: 'ai_workspace_unavailable' });
});

it('logs direct Studio input once and preserves a parent chat prompt for nested Studio generation', async () => {
  vi.stubEnv('AI_LOG_PROMPTS', 'true');
  const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  try {
    const initial = await generateStudioSuggestion(actor, {
      instruction: 'Original direct Studio input',
    });
    projectIds.push(initial.projectId);
    const parent = await startAiTrace(
      {
        traceId: crypto.randomUUID(),
        actorId: actor,
        studioProjectId: initial.projectId,
        surface: 'studio',
        invocation: 'project_chat',
      },
      { content: 'Original chat message' },
      'Original chat message'
    );
    await withAiTrace(parent, () =>
      generateStudioSuggestion(actor, {
        projectId: initial.projectId,
        instruction: 'Derived Studio tool instruction',
      })
    );
    const records = info.mock.calls.map(([value]) => JSON.parse(String(value)));
    expect(records.filter(record => record.event === 'ai.trace.started')).toEqual([
      expect.objectContaining({
        surface: 'studio',
        invocation: 'studio_generation',
        originalMessageText: 'Original direct Studio input',
      }),
      expect.objectContaining({
        traceId: parent.traceId,
        surface: 'studio',
        invocation: 'project_chat',
        originalMessageText: 'Original chat message',
      }),
    ]);
    expect(records.filter(record => record.originalMessageText !== undefined)).toHaveLength(2);
    expect(JSON.stringify(records)).not.toContain('Derived Studio tool instruction');
  } finally {
    info.mockRestore();
    vi.unstubAllEnvs();
  }
});

it('edits the real subtitle through a source-bound snapshot, preserves styling, replays safely and accepts the proposal', async () => {
  const projectId = crypto.randomUUID(),
    conversationId = crypto.randomUUID(),
    runId = crypto.randomUUID();
  projectIds.push(projectId);
  const document = compileStudioAiPlan({
    document: createStudioDocumentV5('t2', 'single'),
    plan: studioAiPlanSchema.parse({
      title: 't2',
      frames: [{ headline: 't2', body: 'Euren Inhalt hier ergänzen.' }],
    }),
    mode: 'template',
    format: 'portrait',
    kind: 'single',
    allowedNodeIds: new Set(),
    assetIds: new Set(),
  });
  const title = document.nodes.find(node => node.name === 'Headline')!;
  const subtitle = document.nodes.find(node => node.name === 'Body')!;
  subtitle.name = 'Subtitel';
  title.name = 'Titel';
  const frame = document.nodes.find(node => node.type === 'frame')!;
  await sql`insert into studio_project(id,owner_id,title,kind,visibility,document_schema_version,created_at,updated_at) values(${projectId},${actor},'t2','single','private',5,0,0)`;
  await sql`insert into studio_state(project_id,document,updated_at) values(${projectId},${sql.json(JSON.parse(JSON.stringify(document)))},0)`;
  const ctx = createZeroContext(actor);
  await executeZeroTransaction(ctx, async tx => {
    await projectChatSharedMutators.create.fn({
      tx,
      ctx,
      args: { id: conversationId, scope: { kind: 'studio', projectId }, name: 'Subtitle' },
    });
  });
  try {
    await sql`insert into ai_run(id,conversation_id,actor_id,request_id,status,model,request_hash,lease_token,lease_expires_at,created_at,updated_at)
      values(${runId},${conversationId},${actor},${crypto.randomUUID()},'running','{}','test',${crypto.randomUUID()},${Date.now() + 120000},0,0)`;
    const hints = { surface: 'studio' as const, pageId: frame.id, elementIds: [title.id] };
    const read = (await executeZeroTransaction(ctx, tx =>
      executeProjectTool(
        tx,
        actor,
        runId,
        conversationId,
        crypto.randomUUID(),
        'studio_read',
        {},
        hints
      )
    )) as { snapshotId: string; data: { nodes: { id: string; text?: string }[] } };
    expect(read.data.nodes.find(node => node.id === subtitle.id)?.text).toBe(
      'Euren Inhalt hier ergänzen.'
    );
    const snapshotId = read.snapshotId;
    const requestKey = `${runId}:subtitle`;
    const call = {
      snapshotId,
      summary: 'Change subtitle',
      sourceWorkspaceId: '00000000-0000-0000-0000-000000000000',
      edits: [{ role: 'subtitle', text: 'test' }],
    };
    const beforeCalls = model.calls;
    const result = await executeStudioChatSuggestion(
      actor,
      projectId,
      runId,
      'studio_edit_suggestion',
      call,
      'Ändere den subtitle des frames in "test"',
      hints,
      { requestKey }
    );
    expect(model.calls).toBe(beforeCalls);
    expect(result.status).toBe('proposed');
    const [draft] =
      await sql`select document,revision from canvas_proposal where id=${result.proposalId}`;
    const next = draft.document.nodes.find((node: { id: string }) => node.id === subtitle.id);
    expect(next.content[0].children[0].text).toBe('test');
    expect({ ...next, content: subtitle.type === 'richText' ? subtitle.content : null }).toEqual(
      subtitle
    );
    expect(draft.document.nodes.filter((node: { id: string }) => node.id !== subtitle.id)).toEqual(
      document.nodes.filter(node => node.id !== subtitle.id)
    );
    const proposalSource = await resolveStudioSource(actor, projectId, result.proposalId);
    expect(proposalSource.document.nodes.find(node => node.id === subtitle.id)).toEqual(next);
    const proposalRead = (await executeZeroTransaction(ctx, tx =>
      executeProjectTool(
        tx,
        actor,
        runId,
        conversationId,
        crypto.randomUUID(),
        'studio_read',
        {},
        { ...hints, proposalId: result.proposalId }
      )
    )) as { data: { nodes: { id: string; text?: string }[] } };
    expect(proposalRead.data.nodes.find(node => node.id === subtitle.id)?.text).toBe('test');
    const replay = await executeStudioChatSuggestion(
      actor,
      projectId,
      runId,
      'studio_edit_suggestion',
      call,
      'Ändere den subtitle des frames in "test"',
      hints,
      { requestKey }
    );
    expect(replay.proposalId).toBe(result.proposalId);
    expect(
      (await sql`select revision from canvas_proposal where id=${result.proposalId}`)[0].revision
    ).toBe(draft.revision);
    await expect(
      executeStudioChatSuggestion(
        actor,
        projectId,
        runId,
        'studio_edit_suggestion',
        { ...call, snapshotId: crypto.randomUUID() },
        'Change subtitle',
        hints,
        { requestKey: crypto.randomUUID() }
      )
    ).rejects.toThrow('Read the current');
    const session = await canvasCommand(actor, { action: 'session', projectId });
    await canvasCommand(actor, {
      action: 'acceptPrivate',
      projectId,
      workspaceId: result.proposalId,
      generation: session.generation,
      revision: draft.revision,
      operationId: crypto.randomUUID(),
    });
    expect(
      (
        await sql`select document from studio_state where project_id=${projectId}`
      )[0].document.nodes.find((node: { id: string }) => node.id === subtitle.id).content[0]
        .children[0].text
    ).toBe('test');
  } finally {
    await sql`delete from conversation where id=${conversationId}`;
  }
});
