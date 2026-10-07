import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_STUDIO_THEME } from '@/features/communication-studio/logic/theme';
import { studioDocumentV5Schema } from '@/features/communication-studio/logic/document-v3';
import { studioCreateSchema } from '@/features/project-chat/logic/contracts';
const io = vi.hoisted(() => ({
  shared: vi.fn(),
  query: vi.fn(),
  createChat: vi.fn(),
  insert: vi.fn(),
  run: vi.fn(),
  enabled: vi.fn(),
  theme: vi.fn(),
  generate: vi.fn(),
}));
vi.mock('../attachments', () => ({ sharedAttachments: io.shared }));
vi.mock('@/server/zero-mutate', () => ({
  createZeroContext: (actor: string) => ({ userID: actor, email: '' }),
  executeZeroTransaction: async (
    ctx: unknown,
    body: (tx: unknown, ctx: unknown) => Promise<unknown>
  ) =>
    body(
      {
        location: 'server',
        dbTransaction: { query: io.query },
        run: io.run,
        mutate: { message: { insert: io.insert } },
      },
      ctx
    ),
}));
vi.mock('@/zero/project-chat/shared-mutators', () => ({
  projectChatSharedMutators: { create: { fn: io.createChat } },
}));
vi.mock('@/server/studio/db', () => ({ studioEnabled: io.enabled }));
vi.mock('@/server/studio/service', () => ({ resolveStudioTheme: io.theme }));
vi.mock('@/server/studio/ai-suggestions', async original => ({
  ...(await original<typeof import('@/server/studio/ai-suggestions')>()),
  generateStudioSuggestion: io.generate,
}));
import { buildProjectStarterTools } from '../starter-tools';
import { studioGenerateSuggestionToolSchema } from '@/server/studio/ai-suggestions';

const actor = crypto.randomUUID(),
  projectId = crypto.randomUUID();
const attachment = {
  entityType: 'event' as const,
  entityId: crypto.randomUUID(),
  title: 'Canonical event',
};
const toolOptions = { toolCallId: 'trusted-tool-call', messages: [], context: {} };
beforeEach(() => {
  vi.resetAllMocks();
  io.shared.mockResolvedValue({ attachments: [attachment], omittedCount: 2 });
  io.query.mockImplementation(async (sql: string) =>
    sql.includes('studio_group_access') ? [{ allowed: true }] : []
  );
  io.run.mockResolvedValue({ id: projectId });
  io.createChat.mockResolvedValue(undefined);
  io.insert.mockResolvedValue(undefined);
  io.enabled.mockReturnValue(true);
  io.theme.mockResolvedValue(DEFAULT_STUDIO_THEME);
  io.generate.mockResolvedValue({ proposalId: 'proposal' });
});
const projectArgs = (extra = {}) =>
  studioCreateSchema.parse({ title: 'Starter project', kind: 'single', groupId: null, ...extra });
function completed<T>(value: T | AsyncIterable<T>): T {
  if (Symbol.asyncIterator in Object(value)) throw new Error('Expected a completed starter result');
  return value as T;
}
const create = async (
  instruction = 'Actual user instruction',
  extra = {},
  attachments = [attachment]
) =>
  completed(
    await buildProjectStarterTools(actor, instruction, attachments).create_studio_project.execute!(
      projectArgs(extra),
      toolOptions
    )
  );
describe('Project starter handoffs and native Studio creation', () => {
  it('copies only the current instruction and server-filtered attachments into an existing project chat', async () => {
    const instruction = 'User instruction '.repeat(2000);
    const tools = buildProjectStarterTools(actor, instruction, [attachment]);
    const scope = { kind: 'studio', projectId } as const;
    const result = completed(
      await tools.open_project_chat.execute!({ scope, title: 'Briefing' }, toolOptions)
    );
    expect(result).toMatchObject({ scope, omittedAttachments: 2 });
    expect(result.url).toBe(`/messages?conversationId=${result.conversationId}`);
    expect(io.shared).toHaveBeenCalledWith(actor, scope, [attachment]);
    expect(io.createChat).toHaveBeenCalledWith(
      expect.objectContaining({
        ctx: { userID: actor, email: '' },
        args: { id: result.conversationId, scope, name: 'Briefing' },
      })
    );
    expect(io.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: result.conversationId,
        sender_id: actor,
        content: instruction.slice(0, 20_000),
        is_read: false,
      })
    );
    expect(JSON.parse(io.insert.mock.lastCall![0].context_json)).toEqual({
      version: 1,
      attachments: [attachment],
      project: { handoff: true },
    });
  });
  it('opens a briefing without inventing a message when the current instruction is blank', async () => {
    const tools = buildProjectStarterTools(actor);
    await tools.open_project_chat.execute!(
      { scope: { kind: 'studio', projectId }, title: 'Empty briefing' },
      toolOptions
    );
    expect(io.insert).not.toHaveBeenCalled();
    expect(io.shared).toHaveBeenCalledWith(actor, { kind: 'studio', projectId }, []);
  });
  it.each([null, 'group-id'])(
    'creates native project state and a shared briefing for scope %s',
    async groupId => {
      const validGroup = groupId ? crypto.randomUUID() : null;
      const result = await create('Trusted briefing', { groupId: validGroup });
      expect(result.url).toBe(
        `${validGroup ? `/group/${validGroup}` : ''}/studio/${result.projectId}?conversationId=${result.conversationId}`
      );
      expect(io.shared).toHaveBeenCalledWith(actor, null, validGroup ? [] : [attachment]);
      expect(io.query).toHaveBeenCalledWith('select pg_advisory_xact_lock($1)', [1886351981]);
      const projectCall = io.query.mock.calls.find(([sql]) =>
        sql.startsWith('insert into studio_project')
      )!;
      expect(projectCall[1].slice(0, 5)).toEqual([
        result.projectId,
        actor,
        validGroup,
        'Starter project',
        'single',
      ]);
      const persisted = io.query.mock.calls.find(([sql]) =>
        sql.startsWith('insert into studio_state')
      )![1][1];
      expect(studioDocumentV5Schema.safeParse(persisted).success).toBe(true);
      expect(persisted.schemaVersion).toBe(5);
      expect(persisted.deliverables).toHaveLength(1);
      expect(io.createChat).toHaveBeenCalledWith(
        expect.objectContaining({
          args: {
            id: result.conversationId,
            scope: { kind: 'studio', projectId: result.projectId },
            name: 'Starter project',
          },
        })
      );
      expect(JSON.parse(io.insert.mock.lastCall![0].context_json)).toEqual({
        version: 1,
        attachments: [attachment],
        project: { handoff: true, editorContext: { surface: 'studio' } },
      });
      expect(io.generate).not.toHaveBeenCalled();
    }
  );
  it('creates customized and default campaign schedules from validated native templates', async () => {
    await create('   ', {
      kind: 'campaign',
      campaign: { weeks: 2, corePostsPerWeek: 2, storiesPerWeek: 1 },
    });
    let persisted = io.query.mock.calls.find(([sql]) =>
      sql.startsWith('insert into studio_state')
    )![1][1];
    expect(persisted.deliverables).toHaveLength(6);
    expect(io.insert).not.toHaveBeenCalled();
    io.query.mockClear();
    await create('', { kind: 'campaign' });
    persisted = io.query.mock.calls.find(([sql]) =>
      sql.startsWith('insert into studio_state')
    )![1][1];
    expect(persisted.deliverables).toHaveLength(20);
  });
  it('truncates new-project handoff messages at the durable message limit', async () => {
    const instruction = 'X'.repeat(20_001);
    await create(instruction);
    expect(io.insert.mock.lastCall![0].content).toBe('X'.repeat(20_000));
  });
  it('requires Studio enablement, group write rights and a visible newly inserted project before creating its chat', async () => {
    io.enabled.mockReturnValueOnce(false);
    await expect(create()).rejects.toMatchObject({ code: 'studio_unavailable' });
    expect(io.theme).not.toHaveBeenCalled();
    for (const rights of [[], [{ allowed: false }]]) {
      io.query.mockImplementation(async (sql: string) =>
        sql.includes('studio_group_access') ? rights : []
      );
      await expect(create('Brief', { groupId: crypto.randomUUID() })).rejects.toMatchObject({
        code: 'permission_denied',
      });
    }
    io.query.mockResolvedValue([]);
    io.run.mockResolvedValueOnce(undefined);
    await expect(create()).rejects.toMatchObject({ code: 'resource_not_ready' });
    expect(io.createChat).not.toHaveBeenCalled();
    expect(io.insert).not.toHaveBeenCalled();
  });
  it('propagates chat mutation failures without inserting a handoff message', async () => {
    io.createChat.mockRejectedValueOnce(new Error('chat write failed'));
    await expect(create()).rejects.toThrow('chat write failed');
    expect(io.insert).not.toHaveBeenCalled();
  });
  it('passes the trusted model, current instruction and canonical attachment references to suggestion generation', async () => {
    const model = { provider: 'openai', id: 'personal-model', source: 'byok' } as const;
    const uploads = {
      entityType: 'document' as const,
      entityId: 'editor-uploads/local.png',
      title: 'Upload',
    };
    const tools = buildProjectStarterTools(actor, 'User instruction', [attachment, uploads], {
      model,
      reasoningEffort: 'low',
    });
    await tools.studio_generate_suggestion.execute!(
      studioGenerateSuggestionToolSchema.parse({ instruction: 'Model instruction' }),
      toolOptions
    );
    expect(io.generate).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ instruction: 'User instruction' }),
      {
        requestKey: 'trusted-tool-call',
        model,
        reasoningEffort: 'low',
        attachmentRefs: [{ type: 'event', id: attachment.entityId }],
      }
    );
  });
  it('uses the model tool instruction only when there is no current user instruction', async () => {
    const tools = buildProjectStarterTools(actor, '  ');
    await tools.studio_generate_suggestion.execute!(
      studioGenerateSuggestionToolSchema.parse({ instruction: 'Fallback' }),
      toolOptions
    );
    expect(io.generate.mock.lastCall![1].instruction).toBe('Fallback');
    await tools.studio_generate_suggestion.execute!(
      studioGenerateSuggestionToolSchema.parse({}),
      toolOptions
    );
    expect(io.generate.mock.lastCall![1].instruction).toBe('');
  });
});
