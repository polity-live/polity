import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NoObjectGeneratedError } from 'ai';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { element } from '@/features/communication-studio/logic/document';
import { legacyDocumentToV3 } from '@/features/communication-studio/logic/v3-adapter';
import { createThemeSnapshot } from '@/features/communication-studio/logic/theme';
import { POLITY_THEME, BUILTIN_THEMES } from '@/features/shared/appearance-theme';
import { createElementSetSnapshot } from '@/features/communication-studio/logic/element-library';

const io = vi.hoisted(() => ({
  sql: vi.fn(),
  transaction: vi.fn(),
  source: vi.fn(),
  sources: vi.fn(),
  theme: vi.fn(),
  model: vi.fn(),
  generate: vi.fn(),
  stage: vi.fn(),
  audience: vi.fn(),
  remove: vi.fn(),
  copy: vi.fn(),
  event: vi.fn(),
  link: vi.fn(),
  start: vi.fn(),
  context: null as any,
  studio: true,
  canvas: true,
}));
vi.mock('../db', async original => ({
  ...(await original<typeof import('../db')>()),
  studioSql: () => io.sql,
  studioTransaction: io.transaction,
  studioEnabled: () => io.studio,
  canvasEnabled: () => io.canvas,
}));
vi.mock('../source', () => ({ resolveStudioSource: io.source }));
vi.mock('../ai-sources', () => ({
  resolveProjectSources: io.sources,
  assertStudioProposalSourceAudience: io.audience,
}));
vi.mock('../service', () => ({ resolveStudioTheme: io.theme }));
vi.mock('../elements', () => ({ stageElementSetForAiProposal: io.stage }));
vi.mock('@/server/ai-models', () => ({ resolveStudioGenerationModelForUser: io.model }));
vi.mock('@/server/ai-generation', () => ({ generateText: io.generate }));
vi.mock('@/server/ai-trace-store', () => ({ linkAiStudioProject: io.link }));
vi.mock('@/server/ai-trace', () => ({
  currentAiTrace: () => io.context,
  startAiTrace: io.start,
  withAiTrace: async (context: unknown, body: () => unknown) => {
    const old = io.context;
    io.context = context;
    try {
      return await body();
    } finally {
      io.context = old;
    }
  },
  traceAiOperation: async (_kind: unknown, _name: unknown, _input: unknown, body: () => unknown) =>
    body(),
  persistAiDiagnostic: async (body: () => unknown) => body(),
  logAiEvent: io.event,
  normalizeAiError: (error: unknown) => ({ message: String(error) }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ storage: { from: () => ({ copy: io.copy, remove: io.remove }) } }),
}));
import {
  applyStudioTextEdits,
  cleanupStudioProposalAssets,
  generateStudioSuggestion,
  loadSnapshot,
  studioGenerateSuggestionSchema,
} from '../ai-suggestions';

const actor = crypto.randomUUID();
const projectId = crypto.randomUUID();
const proposalId = crypto.randomUUID();
const groupId = crypto.randomUUID();
const generation = crypto.randomUUID();
let source: any,
  current: any,
  saved: any,
  previous: any,
  latest: any,
  media: any[],
  sets: any[],
  eventRows: any[],
  workspaceAssets: any[],
  cleanupRows: any[],
  group: any,
  matches: any[],
  usage: any,
  prune: any;
const text = (parts: TemplateStringsArray) => parts.join('?').replace(/\s+/g, ' ').trim();
const calls = (prefix: string) =>
  io.sql.mock.calls.filter(
    ([parts]) =>
      Array.isArray(parts) &&
      'raw' in parts &&
      text(parts as unknown as TemplateStringsArray).startsWith(prefix)
  );
const input = (values: Record<string, unknown> = {}) => ({
  instruction: 'Create a short political announcement',
  projectId,
  frameCount: 1,
  ...values,
});
function ownProposal(values: Record<string, unknown> = {}) {
  source.proposal = {
    ...structuredClone(saved),
    origin: 'ai',
    ai_status: 'ready',
    ai_mode: 'template',
    ai_sources: [],
    ...values,
  };
  source.document = source.proposal.document;
}
function libraryWithMedia() {
  const assetId = crypto.randomUUID();
  const mappedAsset = crypto.randomUUID();
  const setId = crypto.randomUUID();
  const legacy = createDocument('single', 'Library');
  legacy.pages[0].elements.push(element('image', { assetId }));
  const document = legacyDocumentToV3(legacy);
  const node = document.nodes.find(node => node.type === 'media')!;
  const snapshot = createElementSetSnapshot(
    document,
    [node.id],
    [{ id: assetId, name: 'Image', mime: 'image/png' }]
  );
  sets = [{ id: setId, name: 'Reusable image', snapshot }];
  io.stage.mockResolvedValue({
    revisionId: crypto.randomUUID(),
    snapshot,
    assetIds: { [assetId]: mappedAsset },
    assets: [
      {
        id: mappedAsset,
        source: 'library/image',
        path: 'copied/library/image',
        name: 'Image',
        mime: 'image/png',
        size: 16,
      },
    ],
  });
  return setId;
}
function planFromRequest(request: { prompt: string; system: string }) {
  const data = JSON.parse(request.prompt.split('\nYour previous JSON')[0]);
  if (request.system.includes('Do not return frames')) {
    const target = data.editableNodes.find((node: any) => node.type === 'richText');
    return {
      title: 'Generated',
      edits: target ? [{ nodeId: target.id, text: 'Changed heading' }] : [],
      frames: [],
    };
  }
  return {
    title: 'Generated',
    frames: Array.from({ length: data.frameCount }, () =>
      data.mode === 'free'
        ? {
            elements: [
              {
                kind: 'text',
                text: 'Generated heading',
                box: { x: 0.1, y: 0.1, width: 0.8, height: 0.3 },
              },
            ],
          }
        : { headline: 'Generated heading', body: 'A short announcement', cta: 'Join us' }
    ),
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('STUDIO_AI_ENABLED', 'true');
  io.studio = true;
  io.canvas = true;
  io.context = { traceId: 'existing-trace', invocation: 'project_chat' };
  const document = legacyDocumentToV3(createDocument('single', 'Canonical'));
  source = {
    canonical: structuredClone(document),
    document: structuredClone(document),
    proposal: undefined,
    canSuggest: true,
    groupId: null,
    contentRevision: 7,
    generation,
    revision: 'trusted-revision',
    audienceIsShared: false,
  };
  current = {
    document: source.canonical,
    content_revision: 7,
    generation,
    phase: 'edit',
    allowed: true,
  };
  saved = {
    id: proposalId,
    owner_id: actor,
    state: 'draft',
    revision: 3,
    base_revision: 7,
    base_document: source.canonical,
    document: source.document,
    origin: 'ai',
    decision: null,
    application: 'pending',
  };
  previous = null;
  latest = null;
  media = [];
  sets = [];
  eventRows = [];
  workspaceAssets = [];
  cleanupRows = [];
  group = null;
  matches = [];
  usage = { count: 0, bytes: 0 };
  prune = null;
  Object.assign(io.sql, {
    json: (value: unknown) => value,
    unsafe: vi
      .fn()
      .mockImplementation(async (query, args) =>
        query.startsWith('select id from studio_asset') ? args[1].map((id: string) => ({ id })) : []
      ),
  });
  io.sql.mockImplementation((parts: TemplateStringsArray | string[], ...values: unknown[]) => {
    if (!('raw' in parts)) return { values: parts };
    const query = text(parts);
    if (query.startsWith('select c.id,c.project_id')) return previous ? [previous] : [];
    if (query.startsWith('select id from canvas_proposal')) return latest ? [latest] : [];
    if (query.startsWith('select t.id from appearance_theme')) return matches;
    if (query.startsWith('select id,start_date')) return eventRows;
    if (query.startsWith('select id,name,mime_type,byte_size')) return workspaceAssets;
    if (query.startsWith('select id,name,mime_type')) return media;
    if (query.startsWith('select s.id,s.name')) return sets;
    if (
      query.startsWith('select s.content_revision') ||
      query.startsWith('select s.document,s.content_revision')
    )
      return current ? [current] : [];
    if (query.startsWith('select generation')) return [{ generation }];
    if (query.startsWith('select * from canvas_proposal')) return saved ? [saved] : [];
    if (query.startsWith('select origin,state')) return saved ? [saved] : [];
    if (query.startsWith('select document from canvas_proposal')) return prune ? [prune] : [];
    if (query.startsWith('select id from studio_asset')) return cleanupRows;
    if (query.startsWith('select id,storage_path')) return cleanupRows;
    if (query.startsWith('select group_id'))
      return group === undefined ? [] : [{ group_id: group }];
    if (query.startsWith('select count')) return [usage];
    if (query.startsWith('insert into studio_state')) {
      current.document = values[1];
      current.content_revision = 0;
      saved.base_document = values[1];
      saved.base_revision = 0;
    }
    return [];
  });
  io.transaction.mockImplementation(async body => body(io.sql));
  io.source.mockImplementation(async (_actor, _project, _workspace, transaction) => {
    if (transaction) await transaction.query('select source fixture', []);
    return structuredClone(source);
  });
  io.sources.mockResolvedValue([]);
  io.audience.mockResolvedValue(undefined);
  io.theme.mockResolvedValue(createThemeSnapshot(POLITY_THEME, 'dark'));
  io.model.mockResolvedValue({ model: 'fixture-model', supportsStructuredOutput: true });
  io.generate.mockImplementation(async request => ({
    text: JSON.stringify(planFromRequest(request)),
  }));
  io.remove.mockResolvedValue({ error: null });
  io.copy.mockResolvedValue({ error: null });
  io.start.mockResolvedValue({ traceId: 'new-trace', invocation: 'studio_generation' });
  io.link.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe('Studio AI plans, snapshots, persistence and cleanup', () => {
  it.each(['studio', 'canvas', 'ai-env'])('denies generation when %s is disabled', async flag => {
    if (flag === 'studio') io.studio = false;
    if (flag === 'canvas') io.canvas = false;
    if (flag === 'ai-env') vi.stubEnv('STUDIO_AI_ENABLED', 'false');
    await expect(generateStudioSuggestion(actor, input())).rejects.toMatchObject({ status: 404 });
    expect(io.generate).not.toHaveBeenCalled();
  });
  it('allows development defaults but requires explicit production enablement', async () => {
    vi.stubEnv('STUDIO_AI_ENABLED', undefined);
    vi.stubEnv('NODE_ENV', 'development');
    await generateStudioSuggestion(actor, input());
    vi.stubEnv('NODE_ENV', 'production');
    await expect(generateStudioSuggestion(actor, input())).rejects.toThrow(
      'Studio AI is unavailable'
    );
  });
  it.each(['personal', 'group'])(
    'replays completed %s requests without another model call',
    async kind => {
      previous = {
        id: proposalId,
        project_id: projectId,
        ai_status: 'ready',
        group_id: kind === 'group' ? groupId : null,
        ai_warnings: kind === 'group' ? ['Warning'] : null,
      };
      const result = await generateStudioSuggestion(actor, input(), { requestKey: 'request' });
      expect(result).toEqual({
        projectId,
        proposalId,
        url: `${kind === 'group' ? `/group/${groupId}` : ''}/studio/${projectId}?proposalId=${proposalId}`,
        warnings: previous.ai_warnings ?? [],
      });
      expect(io.generate).not.toHaveBeenCalled();
    }
  );
  it('rejects a duplicate request that is still generating', async () => {
    previous = { ai_status: 'generating' };
    await expect(
      generateStudioSuggestion(actor, input(), { requestKey: 'request' })
    ).rejects.toMatchObject({ status: 409 });
  });
  it('creates an empty snapshot for a new project and rejects editing without a project', async () => {
    const parsed = studioGenerateSuggestionSchema.parse({ instruction: 'Create a post' });
    expect(await loadSnapshot(actor, parsed)).toMatchObject({
      projectId: null,
      generation: null,
      contentRevision: 0,
      proposalId: null,
    });
    await expect(loadSnapshot(actor, { ...parsed, action: 'edit' })).rejects.toThrow(
      'Editing needs a Studio project'
    );
    await expect(loadSnapshot(actor, { ...parsed, proposalId })).rejects.toThrow(
      'Editing needs a Studio project'
    );
  });
  it.each(['manual', 'other-owner', 'submitted', 'generating', 'free', 'template'])(
    'loads a %s source workspace with the proper update authority',
    async kind => {
      ownProposal();
      if (kind === 'manual') source.proposal.origin = 'manual';
      if (kind === 'other-owner') source.proposal.owner_id = groupId;
      if (kind === 'submitted') source.proposal.state = 'submitted';
      if (kind === 'generating') source.proposal.ai_status = 'generating';
      if (kind === 'free') source.proposal.ai_mode = 'free';
      source.proposal.ai_sources = kind === 'template' ? null : [];
      const result = await loadSnapshot(
        actor,
        studioGenerateSuggestionSchema.parse(input({ sourceWorkspaceId: proposalId }))
      );
      expect(result.proposalRevision).toBe(['free', 'template'].includes(kind) ? 3 : null);
      expect(result.proposalMode).toBe(kind === 'free' ? 'free' : 'template');
      expect(result.sourceRefs).toEqual([]);
    }
  );
  it('rejects an unavailable phase, a manual explicit target and another owner’s explicit AI draft', async () => {
    source.canSuggest = false;
    await expect(
      loadSnapshot(actor, studioGenerateSuggestionSchema.parse(input()))
    ).rejects.toThrow('unavailable in this project phase');
    source.canSuggest = true;
    ownProposal({ origin: 'manual' });
    await expect(
      loadSnapshot(actor, studioGenerateSuggestionSchema.parse(input({ proposalId })))
    ).rejects.toMatchObject({ code: 'ai_workspace_invalid' });
    source.proposal.origin = 'ai';
    source.proposal.owner_id = groupId;
    await expect(
      loadSnapshot(actor, studioGenerateSuggestionSchema.parse(input({ proposalId })))
    ).rejects.toMatchObject({ status: 403 });
  });
  it.each([false, true])(
    'resolves the latest editable draft with strict source %s',
    async strict => {
      latest = { id: proposalId };
      await loadSnapshot(
        actor,
        studioGenerateSuggestionSchema.parse(input({ action: 'edit' })),
        strict
      );
      expect(io.source).toHaveBeenCalledWith(actor, projectId, strict ? null : proposalId);
      expect(calls('select id from canvas_proposal')).toHaveLength(strict ? 0 : 1);
    }
  );
  it('uses no latest draft when none exists or the user explicitly selected nodes or frames', async () => {
    await loadSnapshot(actor, studioGenerateSuggestionSchema.parse(input({ action: 'edit' })));
    expect(io.source).toHaveBeenLastCalledWith(actor, projectId, null);
    await loadSnapshot(
      actor,
      studioGenerateSuggestionSchema.parse(input({ action: 'edit', nodeIds: [groupId] }))
    );
    await loadSnapshot(
      actor,
      studioGenerateSuggestionSchema.parse(input({ action: 'edit', frameIds: [groupId] }))
    );
    expect(calls('select id from canvas_proposal')).toHaveLength(1);
  });
  it.each(['single', 'carousel', 'story', 'presentation'] as const)(
    'generates correctly formatted %s plans and stores a reviewable proposal',
    async kind => {
      const result = await generateStudioSuggestion(actor, input({ kind, frameCount: undefined }));
      expect(result.projectId).toBe(projectId);
      expect(calls('update canvas_proposal')).toHaveLength(1);
      expect(calls('update studio_state')).toHaveLength(0);
      const request = io.generate.mock.calls[0][0];
      expect(JSON.parse(request.prompt)).toMatchObject({
        kind,
        format: kind === 'story' ? 'story' : kind === 'presentation' ? 'widescreen' : 'portrait',
        frameCount: ['carousel', 'presentation'].includes(kind) ? 3 : 1,
      });
      expect(request.maxRetries).toBe(0);
      expect(request.output).toBeDefined();
    }
  );
  it.each(['story', 'presentation'])(
    'rejects an incompatible explicit %s format before model generation',
    async kind => {
      await expect(
        generateStudioSuggestion(actor, input({ kind, format: 'square' }))
      ).rejects.toThrow('require');
      expect(io.generate).not.toHaveBeenCalled();
    }
  );
  it('generates a new personal project atomically and links its diagnostic trace', async () => {
    io.context = null;
    const result = await generateStudioSuggestion(actor, input({ projectId: undefined }));
    expect(calls('insert into studio_project')).toHaveLength(1);
    expect(calls('insert into studio_state')).toHaveLength(1);
    expect(io.start).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: actor, invocation: 'studio_generation' }),
      expect.anything(),
      expect.any(String)
    );
    expect(io.link).toHaveBeenCalledWith('new-trace', result.projectId);
  });
  it('creates group proposal links and supports plain JSON providers with code-fenced responses', async () => {
    source.groupId = groupId;
    group = groupId;
    io.model.mockResolvedValue({ model: 'plain-model', supportsStructuredOutput: false });
    io.generate.mockImplementation(async request => ({
      text: `\`\`\`json\n${JSON.stringify(planFromRequest(request))}\n\`\`\``,
    }));
    expect((await generateStudioSuggestion(actor, input())).url).toContain(
      `/group/${groupId}/studio/`
    );
    expect(io.generate.mock.calls[0][0]).not.toHaveProperty('output');
  });
  it('propagates a provider authentication failure without selecting a fallback model', async () => {
    io.model.mockRejectedValueOnce(new Error('personal key revoked'));
    await expect(
      generateStudioSuggestion(actor, input(), {
        model: { id: 'personal', provider: 'openai', source: 'byok' },
        reasoningEffort: 'low',
      })
    ).rejects.toThrow('personal key revoked');
    expect(io.model).toHaveBeenCalledTimes(1);
    expect(io.model).toHaveBeenCalledWith(
      actor,
      { id: 'personal', provider: 'openai', source: 'byok' },
      'low'
    );
    expect(io.generate).not.toHaveBeenCalled();
  });
  it('retries malformed JSON once and rejects repeated invalid plans without creating records', async () => {
    io.generate.mockResolvedValueOnce({ text: '{invalid' });
    await generateStudioSuggestion(actor, input());
    expect(io.generate).toHaveBeenCalledTimes(2);
    expect(io.generate.mock.calls[1][0].prompt).toContain('previous JSON was invalid');
    io.generate.mockReset().mockResolvedValue({ text: '{invalid' });
    io.transaction.mockClear();
    await expect(generateStudioSuggestion(actor, input())).rejects.toMatchObject({ status: 502 });
    expect(io.generate).toHaveBeenCalledTimes(2);
    expect(io.transaction).not.toHaveBeenCalled();
  });
  it.each([
    'frame-count',
    'create-edits',
    'template-elements',
    'free-empty',
    'edit-frames',
    'edit-empty',
  ])('rejects a plan violating %s after one corrective retry', async kind => {
    const target = source.document.nodes.find((node: any) => node.type === 'richText').id;
    const plan: any = { title: 'Invalid', frames: [{ headline: 'Title' }] };
    const values: Record<string, unknown> = {};
    if (kind === 'frame-count') plan.frames = [];
    if (kind === 'create-edits') plan.edits = [{ nodeId: target, text: 'Change' }];
    if (kind === 'template-elements')
      plan.frames[0].elements = [
        { kind: 'shape', shape: 'rectangle', box: { x: 0, y: 0, width: 1, height: 1 } },
      ];
    if (kind === 'free-empty') values.mode = 'free';
    if (kind.startsWith('edit')) {
      values.action = 'edit';
      values.nodeIds = [target];
      if (kind === 'edit-empty') plan.frames = [];
    }
    io.generate.mockResolvedValue({ text: JSON.stringify(plan) });
    await expect(generateStudioSuggestion(actor, input(values))).rejects.toThrow(
      'invalid design plan'
    );
    expect(io.generate).toHaveBeenCalledTimes(2);
  });
  it('propagates ordinary generation failures without retrying', async () => {
    io.generate.mockRejectedValueOnce(new Error('provider down'));
    await expect(generateStudioSuggestion(actor, input())).rejects.toThrow('provider down');
    expect(io.generate).toHaveBeenCalledTimes(1);
  });
  it('retries structured-output validation errors once and rejects a second one', async () => {
    const invalid = new NoObjectGeneratedError({
      text: '{invalid',
      response: { id: 'fixture', modelId: 'fixture', timestamp: new Date() },
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        inputTokenDetails: { noCacheTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        outputTokenDetails: { textTokens: 0, reasoningTokens: 0 },
      },
      finishReason: 'error',
    });
    io.generate.mockRejectedValueOnce(invalid);
    await generateStudioSuggestion(actor, input());
    expect(io.generate.mock.calls[1][0].prompt).toContain('corrected JSON object');
    io.generate.mockReset().mockRejectedValue(invalid);
    await expect(generateStudioSuggestion(actor, input())).rejects.toThrow('invalid design plan');
    expect(io.generate).toHaveBeenCalledTimes(2);
  });
  it.each(['node', 'frame', 'no-selection'])(
    'rejects stale or missing edit selection %s',
    async kind => {
      const values =
        kind === 'node' ? { nodeIds: [groupId] } : kind === 'frame' ? { frameIds: [groupId] } : {};
      await expect(
        generateStudioSuggestion(actor, input({ action: 'edit', ...values }))
      ).rejects.toThrow();
      expect(io.generate).not.toHaveBeenCalled();
    }
  );
  it.each(['node', 'frame', 'legacy-proposal'])(
    'edits the actual selected %s without automatic canonical application',
    async kind => {
      const node = source.document.nodes.find((node: any) => node.type === 'richText');
      const frame = source.document.nodes.find((node: any) => node.type === 'frame');
      const values: Record<string, unknown> =
        kind === 'node'
          ? { action: 'edit', nodeIds: [node.id] }
          : kind === 'frame'
            ? { action: 'edit', frameIds: [frame.id] }
            : { proposalId };
      if (kind === 'legacy-proposal') ownProposal({ ai_mode: 'free' });
      await generateStudioSuggestion(actor, input(values));
      const data = JSON.parse(io.generate.mock.calls[0][0].prompt);
      expect(data.editableNodes.some((target: any) => target.id === node.id)).toBe(true);
      expect(data.editableFrames[0].id).toBe(frame.id);
      expect(data.mode).toBe(kind === 'legacy-proposal' ? 'free' : 'template');
      expect(calls('update studio_state')).toHaveLength(0);
    }
  );
  it('rechecks expected context both before and inside the locked transaction', async () => {
    await generateStudioSuggestion(actor, input(), { expectedRevision: 'trusted-revision' });
    expect(io.source).toHaveBeenCalledTimes(3);
    expect((io.sql as unknown as { unsafe: ReturnType<typeof vi.fn> }).unsafe).toHaveBeenCalledWith(
      'select source fixture',
      []
    );
    io.source.mockResolvedValueOnce(source).mockResolvedValueOnce({ ...source, revision: 'stale' });
    await expect(
      generateStudioSuggestion(actor, input(), { expectedRevision: 'trusted-revision' })
    ).rejects.toThrow('context changed');
  });
  it.each([
    'allowed',
    'missing-current',
    'phase',
    'missing-proposal',
    'owner',
    'state',
    'revision',
    'generation',
  ])('rejects a concurrent %s change before saving', async kind => {
    ownProposal();
    io.generate.mockImplementationOnce(async request => {
      const plan = planFromRequest(request);
      if (kind === 'allowed') current.allowed = false;
      if (kind === 'missing-current') current = null;
      if (kind === 'phase') current.phase = 'vote_internal';
      if (kind === 'missing-proposal') saved = null;
      if (kind === 'owner') saved.owner_id = groupId;
      if (kind === 'state') saved.state = 'submitted';
      if (kind === 'revision') saved.revision = 4;
      if (kind === 'generation') current.generation = groupId;
      return { text: JSON.stringify(plan) };
    });
    await expect(generateStudioSuggestion(actor, input({ proposalId }))).rejects.toThrow();
    expect(calls('update canvas_proposal')).toHaveLength(0);
  });
  it.each(['none', 'withdrawn', 'rejected', 'applied', 'manual', 'draft'])(
    'cleans proposal assets only for completed AI lifecycle %s',
    async state => {
      if (state === 'none') saved = null;
      if (state === 'withdrawn') saved.state = state;
      if (state === 'rejected') saved.decision = state;
      if (state === 'applied') saved.application = state;
      if (state === 'manual') saved.origin = state;
      cleanupRows = [{ id: groupId, storage_path: 'private/asset' }];
      await cleanupStudioProposalAssets(proposalId);
      expect(io.remove).toHaveBeenCalledTimes(
        ['withdrawn', 'rejected', 'applied'].includes(state) ? 1 : 0
      );
    }
  );
  it('treats empty cleanup as a no-op and retains rows if storage deletion fails', async () => {
    saved.state = 'withdrawn';
    await cleanupStudioProposalAssets(proposalId);
    expect(io.remove).not.toHaveBeenCalled();
    cleanupRows = [{ id: groupId, storage_path: 'private/asset' }];
    io.remove.mockResolvedValueOnce({ error: true });
    await expect(cleanupStudioProposalAssets(proposalId)).rejects.toMatchObject({ status: 502 });
    expect(calls('delete from studio_asset')).toHaveLength(0);
  });
  it.each(['id', 'name', 'slug', 'custom-name', 'mode'])(
    'applies an explicitly requested theme by %s without generating text for theme-only changes',
    async kind => {
      const builtin =
        BUILTIN_THEMES.find(theme => theme.slug !== theme.name.toLowerCase()) ?? POLITY_THEME;
      const values: Record<string, unknown> = { themeOnly: true };
      if (kind === 'id') values.themeId = builtin.id;
      if (kind === 'name') values.themeName = builtin.name;
      if (kind === 'slug') values.themeName = builtin.slug;
      if (kind === 'custom-name') {
        values.themeName = 'Custom';
        matches = [{ id: groupId }];
      }
      if (kind === 'mode') values.themeMode = 'dark';
      await generateStudioSuggestion(actor, input(values));
      expect(io.generate).not.toHaveBeenCalled();
      expect(calls('update canvas_proposal')).toHaveLength(1);
      if (kind !== 'mode')
        expect(io.theme).toHaveBeenCalledWith(
          actor,
          null,
          kind === 'custom-name' ? groupId : builtin.id,
          'light'
        );
      else expect(io.theme).not.toHaveBeenCalled();
    }
  );
  it.each([
    'no-project',
    'same-theme',
    'locked',
    'shared-personal',
    'missing-name',
    'ambiguous-name',
  ])('rejects a requested theme for %s', async kind => {
    const values: Record<string, unknown> = { themeOnly: true, themeId: groupId };
    if (kind === 'no-project') values.projectId = undefined;
    if (kind === 'same-theme') io.theme.mockResolvedValue(source.document.theme);
    if (kind === 'locked') source.document.nodes[0].locked = true;
    if (kind === 'shared-personal') {
      source.audienceIsShared = true;
      io.theme.mockResolvedValue({
        ...createThemeSnapshot(POLITY_THEME, 'dark'),
        scope: 'personal',
      });
    }
    if (kind.endsWith('name')) {
      values.themeId = undefined;
      values.themeName = 'Custom';
      matches = kind === 'ambiguous-name' ? [{ id: actor }, { id: groupId }] : [];
    }
    await expect(generateStudioSuggestion(actor, input(values))).rejects.toThrow();
    expect(io.generate).not.toHaveBeenCalled();
  });
  it('allows an unchanged theme for generation and honors an explicit dark theme mode', async () => {
    io.theme.mockResolvedValueOnce(source.document.theme);
    await generateStudioSuggestion(actor, input({ themeId: POLITY_THEME.id }));
    await generateStudioSuggestion(
      actor,
      input({ themeId: POLITY_THEME.id, themeMode: 'dark', themeOnly: true })
    );
    expect(io.theme).toHaveBeenLastCalledWith(actor, null, POLITY_THEME.id, 'dark');
  });
  it('deduplicates approved source references and rejects more than ten combined sources', async () => {
    const ref = { type: 'event' as const, id: groupId };
    ownProposal({ ai_sources: [ref] });
    await generateStudioSuggestion(
      actor,
      input({ proposalId, action: 'create', sourceRefs: [ref] }),
      { attachmentRefs: [ref] }
    );
    expect(io.sources).toHaveBeenCalledWith(actor, { kind: 'studio', projectId }, [ref]);
    source.proposal.ai_sources = Array.from({ length: 10 }, () => ({
      type: 'event',
      id: crypto.randomUUID(),
    }));
    await expect(
      generateStudioSuggestion(actor, input({ proposalId, sourceRefs: [ref] }))
    ).rejects.toThrow('Too many sources');
  });
  it('includes verified source context and missing event facts in the prompt and visible design placeholders', async () => {
    io.sources.mockResolvedValue([
      { entityType: 'event', entityId: groupId, title: 'Event', prompt_context: 'x'.repeat(9000) },
      { entityType: 'blog', entityId: actor, title: 'Article' },
    ]);
    eventRows = [
      { start_date: null, location_name: null, city: null },
      { start_date: '2026-10-07', location_name: 'Town hall', city: null },
      { start_date: '2026-10-07', location_name: null, city: 'Berlin' },
    ];
    const result = await generateStudioSuggestion(actor, input());
    expect(result.warnings).toEqual(['[Datum ergänzen]', '[Ort ergänzen]']);
    const prompt = JSON.parse(io.generate.mock.calls[0][0].prompt);
    expect(prompt.sources[0].context).toHaveLength(8000);
    expect(prompt.sources[1].context).toBe('');
    expect(prompt.missingFacts).toEqual(result.warnings);
  });
  it('excludes personal element sets from an audience-shared project', async () => {
    source.audienceIsShared = true;
    await generateStudioSuggestion(actor, input());
    expect(calls('select s.id,s.name')).toHaveLength(0);
  });
  it('uses explicit text edits as the candidate without invoking the model', async () => {
    const node = source.document.nodes.find((node: any) => node.type === 'richText');
    await generateStudioSuggestion(actor, input({ action: 'edit', nodeIds: [node.id] }), {
      textEdits: [{ nodeId: node.id, text: 'Precise edit' }],
    });
    expect(io.generate).not.toHaveBeenCalled();
    expect(
      calls('update canvas_proposal')[0][1].nodes.find((candidate: any) => candidate.id === node.id)
        .content[0].children[0].text
    ).toBe('Precise edit');
  });
  it('rejects unchanged candidate content without claiming a completed suggestion', async () => {
    const node = source.document.nodes.find((node: any) => node.type === 'richText');
    await expect(
      generateStudioSuggestion(actor, input({ action: 'edit', nodeIds: [node.id] }), {
        textEdits: [],
      })
    ).rejects.toThrow('contains no changes');
    expect(calls('update canvas_proposal')).toHaveLength(0);
  });
  it.each(['independent', 'conflicting'])(
    'rebases a proposal against a concurrent %s canonical change',
    async kind => {
      ownProposal();
      const node = source.document.nodes.find((node: any) => node.type === 'richText');
      current.document = structuredClone(source.canonical);
      current.content_revision = 8;
      if (kind === 'independent') current.document.title = 'Other editor title';
      else
        current.document.nodes.find(
          (candidate: any) => candidate.id === node.id
        ).content[0].children[0].text = 'Other text';
      const result = generateStudioSuggestion(actor, input({ proposalId }), {
        textEdits: [{ nodeId: node.id, text: 'AI text' }],
      });
      if (kind === 'conflicting') {
        await expect(result).rejects.toThrow('suggestion conflicts');
        expect(calls('update canvas_proposal')).toHaveLength(0);
      } else {
        await result;
        expect(calls('update canvas_proposal')[0][1].title).toBe('Other editor title');
        expect(calls('update canvas_proposal')[0][3]).toBe(8);
      }
    }
  );
  it('rejects an expected revision that changes inside the transaction after generation', async () => {
    let reads = 0;
    io.source.mockImplementation(async () => ({
      ...structuredClone(source),
      revision: ++reads === 3 ? 'later' : 'trusted-revision',
    }));
    await expect(
      generateStudioSuggestion(actor, input(), { expectedRevision: 'trusted-revision' })
    ).rejects.toThrow('context changed');
    expect(calls('update canvas_proposal')).toHaveLength(0);
  });
  it.each(['missing', 'denied', 'phase'])(
    'rechecks authority when inserting a new draft for %s',
    async kind => {
      io.generate.mockImplementationOnce(async request => {
        if (kind === 'missing') current = null;
        if (kind === 'denied') current.allowed = false;
        if (kind === 'phase') current.phase = 'vote_internal';
        return { text: JSON.stringify(planFromRequest(request)) };
      });
      await expect(generateStudioSuggestion(actor, input())).rejects.toThrow(
        'suggestions are unavailable'
      );
      expect(calls('insert into canvas_proposal')).toHaveLength(0);
    }
  );
  it.each(['empty-blocks', 'nested-link', 'missing-parent', 'parent-cycle'])(
    'replaces text safely with %s without looping or losing style',
    kind => {
      const node = source.document.nodes.find((candidate: any) => candidate.type === 'richText');
      if (kind === 'empty-blocks') node.content = [];
      if (kind === 'nested-link')
        node.content[0].children = [
          {
            id: crypto.randomUUID(),
            type: 'a',
            url: 'https://example.com',
            children: [{ id: crypto.randomUUID(), text: 'Link' }],
          },
        ];
      if (kind === 'missing-parent') node.parentFrameId = groupId;
      if (kind === 'parent-cycle')
        source.document.nodes.find((candidate: any) => candidate.type === 'frame').parentFrameId =
          node.parentFrameId;
      const replace = () =>
        applyStudioTextEdits(source.document, [{ nodeId: node.id, text: 'First\nSecond' }]);
      if (kind.includes('parent')) expect(replace).toThrow();
      else
        expect(
          (replace().nodes.find(candidate => candidate.id === node.id) as any).content[0]
            .children[0].text
        ).toBe('First');
    }
  );
  it('prunes unused staged files while preserving media and chart sources referenced by the proposal', async () => {
    const image = crypto.randomUUID();
    const chartFile = crypto.randomUUID();
    const unused = crypto.randomUUID();
    const legacy = createDocument('single', 'Media');
    legacy.pages[0].elements.push(
      element('image', { assetId: image }),
      element('chart'),
      element('chart')
    );
    const document = legacyDocumentToV3(legacy);
    document.nodes.find(node => node.type === 'chart')!.sourceAssetId = chartFile;
    prune = { document };
    cleanupRows = [
      { id: image, storage_path: 'image' },
      { id: chartFile, storage_path: 'chart' },
      { id: unused, storage_path: 'unused' },
    ];
    const original = io.sql.getMockImplementation()!;
    io.sql.mockImplementation((parts, ...values) =>
      Array.isArray(parts) &&
      'raw' in parts &&
      text(parts as unknown as TemplateStringsArray).startsWith('select id,storage_path')
        ? cleanupRows.filter(row => row.id === unused)
        : original(parts, ...values)
    );
    await generateStudioSuggestion(actor, input());
    expect(io.remove).toHaveBeenCalledWith(['unused']);
  });
  it('logs an asset-pruning failure after storing a successful proposal', async () => {
    prune = { document: source.document };
    cleanupRows = [{ id: groupId, storage_path: 'unused' }];
    io.remove.mockResolvedValueOnce({ error: true });
    await generateStudioSuggestion(actor, input());
    expect(io.event).toHaveBeenCalledWith(
      'ai.operation.failed',
      expect.objectContaining({ operation: 'Cannot prune unused AI media' })
    );
    expect(calls('update canvas_proposal')).toHaveLength(1);
  });
  it.each(['frame', 'addition'])(
    'stages a permitted reusable library element in a %s and checks media availability',
    async kind => {
      const setId = libraryWithMedia();
      const frame = source.document.nodes.find((node: any) => node.type === 'frame');
      const library = { kind: 'library', setId, box: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 } };
      const plan =
        kind === 'frame'
          ? { title: 'Library', frames: [{ elements: [library] }] }
          : {
              title: 'Library',
              additions: [
                { frameId: frame.id, element: library },
                {
                  frameId: frame.id,
                  element: {
                    kind: 'shape',
                    shape: 'rectangle',
                    box: { x: 0.5, y: 0.5, width: 0.2, height: 0.2 },
                  },
                },
              ],
            };
      io.generate.mockResolvedValue({ text: JSON.stringify(plan) });
      await generateStudioSuggestion(
        actor,
        input({
          mode: 'free',
          ...(kind === 'addition' ? { action: 'edit', frameIds: [frame.id] } : {}),
        })
      );
      expect(io.stage).toHaveBeenCalledWith(actor, expect.objectContaining({ projectId, setId }));
      expect(calls('insert into studio_asset')).toHaveLength(1);
      expect(calls('update canvas_proposal')[0][1].componentInstances).toHaveLength(1);
    }
  );
  it('rejects a model-selected library that is outside the permitted set list', async () => {
    io.generate.mockResolvedValue({
      text: JSON.stringify({
        title: 'Unavailable',
        frames: [
          {
            elements: [
              { kind: 'library', setId: groupId, box: { x: 0, y: 0, width: 0.5, height: 0.5 } },
            ],
          },
        ],
      }),
    });
    await expect(generateStudioSuggestion(actor, input({ mode: 'free' }))).rejects.toThrow(
      'unavailable library element'
    );
    expect(io.stage).not.toHaveBeenCalled();
  });
  it.each(['count', 'bytes', 'audience', 'cleanup-error', 'cleanup-rejection', 'cleanup-ok'])(
    'cleans staged library media after a failure in %s',
    async kind => {
      const setId = libraryWithMedia();
      io.generate.mockResolvedValue({
        text: JSON.stringify({
          title: 'Library',
          frames: [
            {
              elements: [{ kind: 'library', setId, box: { x: 0, y: 0, width: 0.5, height: 0.5 } }],
            },
          ],
        }),
      });
      if (kind === 'count') usage.count = 100;
      else if (kind === 'bytes') usage.bytes = 500 * 1024 * 1024;
      else io.audience.mockRejectedValueOnce(new Error('Audience access revoked'));
      if (kind === 'cleanup-error')
        io.remove.mockResolvedValueOnce({ error: new Error('storage refused') });
      if (kind === 'cleanup-rejection') io.remove.mockRejectedValueOnce(new Error('network down'));
      await expect(generateStudioSuggestion(actor, input({ mode: 'free' }))).rejects.toThrow(
        kind === 'count' || kind === 'bytes' ? 'Project media limit' : 'Audience access revoked'
      );
      expect(io.remove).toHaveBeenCalledWith(['copied/library/image']);
      expect(io.event).toHaveBeenCalledTimes(
        kind.startsWith('cleanup-') && kind !== 'cleanup-ok' ? 1 : 0
      );
    }
  );
  it.each(['frame', 'addition', 'copy-error'])(
    'forks source-workspace media into a new AI proposal for %s',
    async kind => {
      const copied = crypto.randomUUID();
      const canonicalAsset = crypto.randomUUID();
      const absentChart = crypto.randomUUID();
      const legacy = createDocument('single', 'Workspace');
      legacy.pages[0].elements.push(
        element('image', { assetId: copied }),
        element('image', { assetId: canonicalAsset }),
        element('chart'),
        element('chart'),
        element('chart')
      );
      const document = legacyDocumentToV3(legacy);
      const charts = document.nodes.filter(node => node.type === 'chart');
      charts[0].sourceAssetId = copied;
      charts[1].sourceAssetId = absentChart;
      source.document = document;
      ownProposal({ origin: 'manual', document });
      workspaceAssets = [
        {
          id: copied,
          name: 'Workspace image',
          mime_type: 'image/png',
          byte_size: '16',
          storage_path: 'private/workspace/image',
        },
        { id: crypto.randomUUID(), storage_path: 'unreferenced' },
      ];
      media = [
        { id: copied, name: 'Workspace image' },
        { id: canonicalAsset, name: 'Canonical image' },
      ];
      const frame = document.nodes.find(node => node.type === 'frame')!;
      const image = (assetId: string) => ({
        kind: 'media',
        assetId,
        box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
      });
      const plan =
        kind === 'addition'
          ? {
              title: 'Forked',
              additions: [
                { frameId: frame.id, element: image(copied) },
                { frameId: frame.id, element: image(canonicalAsset) },
                {
                  frameId: frame.id,
                  element: {
                    kind: 'text',
                    text: 'New',
                    box: { x: 0.4, y: 0.4, width: 0.4, height: 0.2 },
                  },
                },
              ],
            }
          : {
              title: 'Forked',
              frames: [
                {
                  elements: [
                    image(copied),
                    image(canonicalAsset),
                    { kind: 'text', text: 'New', box: { x: 0.4, y: 0.4, width: 0.4, height: 0.2 } },
                  ],
                },
              ],
            };
      io.generate.mockResolvedValue({ text: JSON.stringify(plan) });
      if (kind === 'copy-error') io.copy.mockResolvedValueOnce({ error: true });
      const result = generateStudioSuggestion(
        actor,
        input({
          sourceWorkspaceId: proposalId,
          mode: 'free',
          ...(kind === 'addition' ? { action: 'edit', frameIds: [frame.id] } : {}),
        })
      );
      if (kind === 'copy-error') {
        await expect(result).rejects.toThrow('Cannot copy source workspace media');
        expect(io.remove).not.toHaveBeenCalled();
      } else {
        await result;
        expect(io.copy).toHaveBeenCalledTimes(1);
        const stored = calls('update canvas_proposal')[0][1];
        const newAssetId = calls('insert into studio_asset')[0][1];
        expect(
          stored.nodes
            .filter((node: any) => node.type === 'media')
            .some((node: any) => node.assetId === newAssetId)
        ).toBe(true);
        expect(
          stored.nodes
            .filter((node: any) => node.type === 'media')
            .some((node: any) => node.assetId === copied)
        ).toBe(false);
        expect(newAssetId).not.toBe(copied);
        expect(
          stored.nodes
            .filter((node: any) => node.type === 'chart')
            .map((node: any) => node.sourceAssetId)
        ).toEqual(expect.arrayContaining([newAssetId, absentChart, null]));
      }
    }
  );
  it('does not adopt source group access for an unchanged theme-mode request', async () => {
    await generateStudioSuggestion(actor, input({ themeMode: 'light' }));
    expect(io.theme).not.toHaveBeenCalled();
  });
  it('describes text with nested inline elements without flattening nontext objects into fabricated content', async () => {
    const node = source.document.nodes.find((candidate: any) => candidate.type === 'richText');
    node.content[0].children.push({
      id: crypto.randomUUID(),
      type: 'a',
      url: 'https://example.com',
      children: [{ id: crypto.randomUUID(), text: 'Link' }],
    });
    await generateStudioSuggestion(actor, input({ action: 'edit', nodeIds: [node.id] }));
    expect(JSON.parse(io.generate.mock.calls[0][0].prompt).editableNodes[0].text).not.toContain(
      '[object Object]'
    );
  });
  it('treats missing storage rows as already cleaned and keeps the request receipt independent', async () => {
    saved.state = 'withdrawn';
    cleanupRows = [{ id: groupId }];
    const original = io.sql.getMockImplementation()!;
    io.sql.mockImplementation((parts, ...values) =>
      Array.isArray(parts) &&
      'raw' in parts &&
      text(parts as unknown as TemplateStringsArray).startsWith('select id,storage_path')
        ? []
        : original(parts, ...values)
    );
    await cleanupStudioProposalAssets(proposalId);
    expect(io.remove).not.toHaveBeenCalled();
  });
  it('continues a new request key while checking ready-state retries separately', async () => {
    await generateStudioSuggestion(actor, input(), { requestKey: 'new-request' });
    expect(calls('insert into canvas_proposal')[0]).toContain('new-request');
  });
  it('uses top-level frame targets when a theme-only follow-up has no selected nodes', async () => {
    ownProposal();
    await generateStudioSuggestion(
      actor,
      input({ proposalId, themeMode: 'dark', themeOnly: true })
    );
    expect(io.generate).not.toHaveBeenCalled();
  });
  it('preserves existing mode when no theme mode is given for a nonchanging mode request', async () => {
    await generateStudioSuggestion(actor, input({ themeMode: 'light' }));
    expect(calls('update canvas_proposal')).toHaveLength(1);
  });
  it('preserves first paragraph style and IDs during a multiline replacement', () => {
    const node = source.document.nodes.find((node: any) => node.type === 'richText');
    const before = structuredClone(source.document);
    const replaced = applyStudioTextEdits(source.document, [
      { nodeId: node.id, text: 'First\nSecond' },
    ]);
    const next = replaced.nodes.find((candidate: any) => candidate.id === node.id) as any;
    expect(next.content[0].id).toBe(node.content[0].id);
    expect(next.content[0].children[0].id).toBe(node.content[0].children[0].id);
    expect(next.content[1].id).not.toBe(node.content[0].id);
    expect(next.content.map((block: any) => block.children[0].text)).toEqual(['First', 'Second']);
    expect(source.document).toEqual(before);
  });
  it.each(['missing', 'shape', 'node-lock', 'frame-lock'])(
    'protects text replacement for %s',
    kind => {
      const node = source.document.nodes.find((node: any) => node.type === 'richText');
      const frame = source.document.nodes.find((node: any) => node.type === 'frame');
      if (kind === 'node-lock') node.locked = true;
      if (kind === 'frame-lock') frame.locked = true;
      const id = kind === 'missing' ? groupId : kind === 'shape' ? frame.id : node.id;
      expect(() =>
        applyStudioTextEdits(source.document, [{ nodeId: id, text: 'Replace' }])
      ).toThrow();
    }
  );
});
