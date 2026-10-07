import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStudioTemplateDocumentV5 } from '@/features/communication-studio/logic/templates-v5';
import { defaultBrand } from '@/features/communication-studio/logic/document';
const io = vi.hoisted(() => ({ source: vi.fn(), sql: vi.fn(), generate: vi.fn(), trace: vi.fn() }));
vi.mock('@/server/studio/source', () => ({ resolveStudioSource: io.source }));
vi.mock('@/server/studio/db', () => ({ studioSql: () => io.sql }));
vi.mock('@/server/studio/ai-suggestions', async original => ({
  ...(await original<typeof import('@/server/studio/ai-suggestions')>()),
  generateStudioSuggestion: io.generate,
}));
vi.mock('@/server/ai-trace', () => ({ traceAiOperation: io.trace }));
import { executeStudioChatSuggestion } from '../studio-suggestions';

const actor = crypto.randomUUID(),
  projectId = crypto.randomUUID(),
  runId = crypto.randomUUID(),
  snapshotId = crypto.randomUUID();
let source: {
  projectId: string;
  groupId: string | null;
  workspaceId: string | null;
  revision: string;
  document: ReturnType<typeof createStudioTemplateDocumentV5>;
  proposal: { origin: string; owner_id: string; state: string; ai_status: string } | null;
};
let snapshot: { resource_id: string; references_json: unknown } | null;
let receipts: unknown[];
beforeEach(() => {
  vi.resetAllMocks();
  source = {
    projectId,
    groupId: null,
    workspaceId: null,
    revision: 'current-source',
    document: createStudioTemplateDocumentV5('single', 'Headline', defaultBrand),
    proposal: null,
  };
  snapshot = {
    resource_id: projectId,
    references_json: { _studioSource: { workspaceId: null, revision: source.revision } },
  };
  receipts = [];
  io.source.mockImplementation(async () => source);
  io.sql.mockImplementation(async (parts: TemplateStringsArray) =>
    parts.join('').includes('canvas_proposal') ? receipts : snapshot ? [snapshot] : []
  );
  io.generate.mockResolvedValue({ projectId, proposalId: crypto.randomUUID(), warnings: [] });
  io.trace.mockImplementation(
    async (_feature: unknown, _name: unknown, _data: unknown, body: () => Promise<unknown>) =>
      body()
  );
});
const call = (
  name: string,
  input: unknown,
  instruction = 'Create content',
  hints?: Parameters<typeof executeStudioChatSuggestion>[6],
  options?: Parameters<typeof executeStudioChatSuggestion>[7]
) => executeStudioChatSuggestion(actor, projectId, runId, name, input, instruction, hints, options);
const textNode = () =>
  source.document.nodes.find(node => node.type === 'richText' && node.textRole === 'title')!;
const editInput = (edits = [{ nodeIds: [textNode().id], frameIds: [], text: 'Updated' }]) => ({
  snapshotId,
  summary: 'Precise change',
  edits,
});
describe('Reviewable Studio project chat suggestions', () => {
  it.each([null, 'group-id'])(
    'replays a completed request in the correct project scope %s without invoking generation',
    async groupId => {
      source.groupId = groupId;
      const proposalId = crypto.randomUUID();
      receipts = [{ id: proposalId, ai_warnings: ['warning'] }];
      expect(
        await call('studio_generate_suggestion', {}, 'Create', undefined, { requestKey: 'request' })
      ).toEqual({
        projectId,
        proposalId,
        status: 'proposed',
        warnings: ['warning'],
        url: `${groupId ? `/group/${groupId}` : ''}/studio/${projectId}?proposalId=${proposalId}`,
      });
      expect(io.generate).not.toHaveBeenCalled();
      expect(io.sql.mock.calls[0].slice(1)).toEqual([projectId, actor, 'request']);
    }
  );
  it('uses empty warnings on legacy receipts and resolves the explicitly selected workspace before replay', async () => {
    const proposalId = crypto.randomUUID();
    receipts = [{ id: proposalId, ai_warnings: null }];
    const hints = { surface: 'studio' as const, proposalId };
    expect(
      (await call('studio_generate_suggestion', {}, 'Create', hints, { requestKey: 'request' }))
        .warnings
    ).toEqual([]);
    expect(io.source).toHaveBeenCalledWith(actor, projectId, proposalId);
  });
  it('generates from authoritative main content and retains trusted model options', async () => {
    const model = { provider: 'openai', id: 'personal-model', source: 'byok' } as const;
    const result = await call(
      'studio_generate_suggestion',
      { instruction: 'Injected', projectId: 'other' },
      'User instruction',
      undefined,
      { model, requestKey: 'fresh' }
    );
    expect(result).toMatchObject({ projectId, status: 'proposed' });
    expect(io.generate).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        projectId,
        instruction: 'User instruction',
        nodeIds: [],
        frameIds: [],
        proposalId: undefined,
        sourceWorkspaceId: undefined,
      }),
      {
        model,
        requestKey: 'fresh',
        strictSource: true,
        expectedRevision: source.revision,
      }
    );
  });
  it.each([
    { origin: 'manual', owner_id: actor, state: 'draft', ai_status: 'ready' },
    { origin: 'ai', owner_id: 'other', state: 'draft', ai_status: 'ready' },
    { origin: 'ai', owner_id: actor, state: 'accepted', ai_status: 'ready' },
    { origin: 'ai', owner_id: actor, state: 'draft', ai_status: 'pending' },
  ])('forks a selected workspace rather than editing an ineligible AI draft %j', async proposal => {
    source.proposal = proposal;
    source.workspaceId = crypto.randomUUID();
    await call('studio_generate_suggestion', {});
    expect(io.generate).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ sourceWorkspaceId: source.workspaceId, proposalId: undefined }),
      expect.anything()
    );
  });
  it('updates only the actor-owned ready AI draft while preserving its workspace identity', async () => {
    source.proposal = { origin: 'ai', owner_id: actor, state: 'draft', ai_status: 'ready' };
    source.workspaceId = crypto.randomUUID();
    await call('studio_generate_suggestion', {});
    expect(io.generate).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ sourceWorkspaceId: undefined, proposalId: source.workspaceId }),
      expect.anything()
    );
    source.workspaceId = null;
    await call('studio_generate_suggestion', {});
    expect(io.generate).toHaveBeenLastCalledWith(
      actor,
      expect.objectContaining({ sourceWorkspaceId: undefined, proposalId: undefined }),
      expect.anything()
    );
  });
  it('resolves explicit and instruction-based generation edit targets while theme-only edits require no text selection', async () => {
    const node = textNode();
    await call(
      'studio_generate_suggestion',
      { action: 'edit', nodeIds: [node.id] },
      'Update selected copy'
    );
    expect(io.generate.mock.lastCall![1].nodeIds).toEqual([node.id]);
    await call('studio_generate_suggestion', { action: 'edit' }, 'Change title to "Updated"');
    expect(io.generate.mock.lastCall![1].nodeIds).toEqual([node.id]);
    await call(
      'studio_generate_suggestion',
      { action: 'edit', themeOnly: true, themeMode: 'dark' },
      'Change theme'
    );
    expect(io.generate.mock.lastCall![1]).toMatchObject({
      nodeIds: [],
      frameIds: [],
      themeOnly: true,
    });
  });
  it.each(['missing', 'empty', 'wrong-project', 'wrong-workspace', 'stale'] as const)(
    'rejects %s snapshot provenance before making a precise text edit',
    async state => {
      if (state === 'missing') snapshot = null;
      if (state === 'empty') snapshot!.references_json = null;
      if (state === 'wrong-project') snapshot!.resource_id = crypto.randomUUID();
      if (state === 'wrong-workspace')
        snapshot!.references_json = {
          _studioSource: { workspaceId: crypto.randomUUID(), revision: source.revision },
        };
      if (state === 'stale')
        snapshot!.references_json = { _studioSource: { workspaceId: null, revision: 'old' } };
      await expect(call('studio_edit_suggestion', editInput())).rejects.toMatchObject({
        code: state === 'stale' ? 'context_stale' : 'invalid_target',
        recovery: 'read_again',
      });
      expect(io.generate).not.toHaveBeenCalled();
    }
  );
  it('resolves all precise edits against the real document and records their authoritative revision', async () => {
    const node = textNode();
    expect(await call('studio_edit_suggestion', editInput(), 'Update selected copy')).toMatchObject(
      { status: 'proposed' }
    );
    expect(io.generate).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        action: 'edit',
        nodeIds: [node.id],
        instruction: 'Update selected copy',
      }),
      {
        strictSource: true,
        expectedRevision: source.revision,
        textEdits: [{ nodeId: node.id, text: 'Updated' }],
      }
    );
    expect(io.trace).toHaveBeenCalledWith(
      'studio',
      'resolve_targets',
      { workspaceId: null, revision: source.revision },
      expect.any(Function)
    );
  });
  it('gives the instruction role precedence over model names and preserves literal replacement text', async () => {
    const node = textNode();
    const edits = [
      { nodeIds: [], frameIds: [], name: 'wrong', role: 'body', text: '<script>literal</script>' },
    ];
    await call(
      'studio_edit_suggestion',
      { snapshotId, summary: 'Title', edits },
      'Change the title'
    );
    expect(io.generate.mock.lastCall![2].textEdits).toEqual([
      { nodeId: node.id, text: '<script>literal</script>' },
    ]);
  });
});
