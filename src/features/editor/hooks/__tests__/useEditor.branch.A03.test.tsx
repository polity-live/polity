// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  amendmentRows: null as any,
  amendmentLoading: false,
  blogRows: null as any,
  blogLoading: false,
  documentRows: null as any,
  documentLoading: false,
  amendmentEntity: null as any,
  blogEntity: null as any,
  documentEntity: null as any,
  groupDocumentEntity: null as any,
  adaptAmendment: vi.fn(),
  adaptBlog: vi.fn(),
  adaptDocument: vi.fn(),
  adaptGroupDocument: vi.fn(),
  mutate: vi.fn(),
  mutationFns: {} as Record<string, ReturnType<typeof vi.fn>>,
  waitForClientApply: vi.fn(),
  trackServerFinalization: vi.fn(),
  finalizations: [] as any[],
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  broadcastContent: vi.fn(),
  realtimeOptions: null as any,
  debug: vi.fn(),
  containsTutorialInput: vi.fn(),
  tutorialVariants: ['tutorial variant'] as string[],
  reportTutorial: vi.fn(),
  resolveBranchId: vi.fn(),
  disabledReasons: vi.fn(),
  now: 10_000,
}));

function tagged(name: string) {
  const fn = vi.fn((args: unknown) => ({ type: name, args }));
  mocks.mutationFns[name] = fn;
  return fn;
}

vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: (...args: any[]) => mocks.mutate(...args) }),
}));

vi.mock('@/zero/shared/helpers', () => ({
  toMutableJSONValue: (value: unknown) => value,
}));

vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => ({
    amendmentDocsCollabs: mocks.amendmentRows,
    isLoading: mocks.amendmentLoading,
  }),
}));

vi.mock('@/zero/blogs/useBlogState', () => ({
  useBlogState: () => ({ blogForEditor: mocks.blogRows, isLoading: mocks.blogLoading }),
}));

vi.mock('@/zero/documents/useDocumentState', () => ({
  useDocumentState: () => ({ document: mocks.documentRows, isLoading: mocks.documentLoading }),
}));

vi.mock('@/zero/mutators', () => ({
  mutators: {
    amendments: {
      update: tagged('amendments.update'),
      updateProcessBranch: tagged('amendments.updateProcessBranch'),
    },
    blogs: { update: tagged('blogs.update') },
    documents: {
      updateContent: tagged('documents.updateContent'),
      updateGroupDocumentTitle: tagged('documents.updateGroupDocumentTitle'),
    },
  },
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (...args: any[]) => mocks.waitForClientApply(...args),
  trackServerFinalization: (result: unknown, callbacks: any) => {
    mocks.finalizations.push({ result, callbacks });
    return mocks.trackServerFinalization(result, callbacks);
  },
}));

vi.mock('../useRealtimeSync', () => ({
  useRealtimeSync: (options: any) => {
    mocks.realtimeOptions = options;
    return { broadcastContent: mocks.broadcastContent };
  },
}));

vi.mock('../../logic/entity-adapter', () => ({
  adaptAmendmentToEntity: (...args: any[]) => {
    mocks.adaptAmendment(...args);
    return mocks.amendmentEntity;
  },
  adaptBlogToEntity: (...args: any[]) => {
    mocks.adaptBlog(...args);
    return mocks.blogEntity;
  },
  adaptDocumentToEntity: (...args: any[]) => {
    mocks.adaptDocument(...args);
    return mocks.documentEntity;
  },
  adaptGroupDocumentToEntity: (...args: any[]) => {
    mocks.adaptGroupDocument(...args);
    return mocks.groupDocumentEntity;
  },
}));

vi.mock('@/features/shared/logic/editorContentSync', () => ({
  getEditorContentSignature: (value: unknown) => JSON.stringify(value),
}));

vi.mock('@/features/shared/logic/editorSelectionDebug', () => ({
  editorSelectionDebugLog: (...args: any[]) => mocks.debug(...args),
  summarizeDiscussions: (value: unknown) => value,
  summarizeRichTextValue: (value: unknown) => value,
}));

vi.mock('@/features/app-tutorial/catalog', () => ({
  APP_TUTORIAL_EXPECTED_INPUTS: { amendmentAddition: 'catalog fallback' },
  containsAppTutorialExpectedInput: (...args: any[]) => mocks.containsTutorialInput(...args),
  getAppTutorialExpectedInputVariants: () => mocks.tutorialVariants,
}));

vi.mock('@/features/app-tutorial/events', () => ({
  reportAppTutorialAction: (...args: any[]) => mocks.reportTutorial(...args),
}));

vi.mock('@/features/amendments/logic/amendmentBranchDisplay', () => ({
  getBranchEditingModeDisabledReasons: (...args: any[]) => mocks.disabledReasons(...args),
  resolveSelectedBranchId: (...args: any[]) => mocks.resolveBranchId(...args),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

import { useEditor } from '../useEditor';

const content = (text: string) => [{ type: 'p', children: [{ text }] }] as any;

function editorEntity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entity-1',
    title: 'Entity title',
    content: content('initial'),
    discussions: [],
    editingMode: 'edit',
    updatedAt: 100,
    visibility: 'private',
    owner: { id: 'owner' },
    collaborators: [],
    metadata: {},
    canChangeMode: false,
    canVoteOnChangeRequests: false,
    canManageChangeRequestVotes: false,
    ...overrides,
  } as any;
}

function amendmentRows(overrides: Record<string, unknown> = {}) {
  return {
    id: 'amendment-1',
    document: { id: 'document-1', content: content('initial') },
    current_process_run: null,
    ...overrides,
  } as any;
}

function renderEditor(options: Record<string, unknown> = {}) {
  const initial = {
    entityType: 'amendment',
    entityId: 'amendment-1',
    userId: 'user-1',
    ...options,
  } as any;
  return renderHook(props => useEditor(props), { initialProps: initial });
}

describe('useEditor complete branch contract', () => {
  beforeEach(() => {
    mocks.amendmentRows = amendmentRows();
    mocks.amendmentLoading = false;
    mocks.blogRows = { id: 'blog-1' };
    mocks.blogLoading = false;
    mocks.documentRows = { id: 'document-1', amendment_id: 'parent-amendment' };
    mocks.documentLoading = false;
    mocks.amendmentEntity = editorEntity();
    mocks.blogEntity = editorEntity({ id: 'blog-1' });
    mocks.documentEntity = editorEntity({ id: 'document-1' });
    mocks.groupDocumentEntity = editorEntity({ id: 'group-document-1' });
    mocks.mutate.mockReset().mockImplementation(value => value);
    for (const fn of Object.values(mocks.mutationFns)) fn.mockClear();
    mocks.waitForClientApply.mockReset().mockResolvedValue(undefined);
    mocks.trackServerFinalization.mockReset();
    mocks.finalizations = [];
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
    mocks.broadcastContent.mockReset();
    mocks.realtimeOptions = null;
    mocks.debug.mockReset();
    mocks.containsTutorialInput.mockReset().mockReturnValue(false);
    mocks.tutorialVariants = ['tutorial variant'];
    mocks.reportTutorial.mockReset();
    mocks.resolveBranchId.mockReset().mockReturnValue(null);
    mocks.disabledReasons.mockReset().mockReturnValue({ reason: true });
    mocks.now = 10_000;
    vi.spyOn(Date, 'now').mockImplementation(() => mocks.now);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('derives every entity type, loading operand, capability override, and null entity', () => {
    mocks.amendmentLoading = true;
    const amendment = renderEditor({ capabilities: { voting: true } });
    expect(amendment.result.current.isLoading).toBe(true);
    expect(amendment.result.current.capabilities.voting).toBe(true);
    amendment.unmount();

    mocks.amendmentLoading = false;
    mocks.amendmentRows = amendmentRows({ document: null });
    const hydrating = renderEditor();
    expect(hydrating.result.current.isLoading).toBe(true);
    expect(hydrating.result.current.entity).toBeNull();
    hydrating.unmount();

    mocks.blogLoading = true;
    const blog = renderEditor({ entityType: 'blog', entityId: 'blog-1' });
    expect(blog.result.current.isLoading).toBe(true);
    expect(blog.result.current.entity?.id).toBe('blog-1');
    blog.unmount();

    mocks.blogRows = null;
    const missingBlog = renderEditor({ entityType: 'blog', entityId: 'blog-1' });
    expect(missingBlog.result.current.entity).toBeNull();
    missingBlog.unmount();
    mocks.blogRows = { id: 'blog-1' };

    mocks.documentLoading = true;
    const document = renderEditor({ entityType: 'document', entityId: 'document-1' });
    expect(document.result.current.isLoading).toBe(true);
    expect(document.result.current.entity?.id).toBe('document-1');
    document.unmount();

    mocks.documentRows = null;
    const missingDocument = renderEditor({ entityType: 'document', entityId: 'document-1' });
    expect(missingDocument.result.current.entity).toBeNull();
    missingDocument.unmount();

    const missingGroupDocument = renderEditor({
      entityType: 'groupDocument',
      entityId: 'document-1',
    });
    expect(missingGroupDocument.result.current.entity).toBeNull();
    missingGroupDocument.unmount();
    mocks.documentRows = { id: 'document-1', amendment_id: 'parent-amendment' };

    const group = renderEditor({
      entityType: 'groupDocument',
      entityId: 'document-1',
      groupId: '',
    });
    expect(group.result.current.isLoading).toBe(true);
    expect(mocks.adaptGroupDocument).toHaveBeenCalledWith(mocks.documentRows, '', undefined);
    group.unmount();

    mocks.documentLoading = false;
    renderEditor({
      entityType: 'groupDocument',
      entityId: 'document-1',
      groupId: 'group-1',
    }).unmount();
    expect(mocks.adaptGroupDocument).toHaveBeenLastCalledWith(
      mocks.documentRows,
      'group-1',
      undefined
    );

    const invalid = renderEditor({ entityType: 'invalid' });
    expect(invalid.result.current.entity).toBeNull();
  });

  it('selects requested, agenda, resolved, active, and empty amendment branches', () => {
    const requested = { id: 'requested', document: { id: 'doc-requested' }, step_runs: [] };
    const agenda = {
      id: 'agenda',
      document: { id: 'doc-agenda' },
      step_runs: [{ agenda_item_id: 'agenda-item' }],
    };
    const noSteps = { id: 'no-steps', document: null, step_runs: undefined };
    const active = { id: 'active', document: { id: 'doc-active' } };
    mocks.amendmentRows = amendmentRows({
      current_process_run: {
        branches: [requested, noSteps, agenda],
        active_branch_id: 'agenda',
        active_branch: active,
      },
    });
    mocks.amendmentEntity = editorEntity({ metadata: { processBranchId: 'requested' } });
    const direct = renderEditor({ processBranchId: 'requested' });
    expect(mocks.adaptAmendment.mock.calls.at(-1)?.[3]).toEqual(
      expect.objectContaining({ processBranch: requested })
    );
    direct.unmount();

    mocks.resolveBranchId.mockReturnValue('agenda');
    const byAgenda = renderEditor({ processBranchId: 'missing', agendaItemId: 'agenda-item' });
    expect(mocks.adaptAmendment.mock.calls.at(-1)?.[3]).toEqual(
      expect.objectContaining({ processBranch: agenda })
    );
    byAgenda.unmount();

    mocks.resolveBranchId.mockReturnValue('not-found');
    const activeFallback = renderEditor();
    expect(mocks.adaptAmendment.mock.calls.at(-1)?.[3]).toEqual(
      expect.objectContaining({ processBranch: active })
    );
    activeFallback.unmount();

    mocks.amendmentRows = amendmentRows({
      current_process_run: { branches: undefined, active_branch: null, active_branch_id: null },
    });
    mocks.amendmentEntity = editorEntity({ metadata: {} });
    const empty = renderEditor();
    expect(mocks.adaptAmendment.mock.calls.at(-1)?.[3]).toEqual(
      expect.objectContaining({ processBranch: null, processBranches: [] })
    );
    empty.unmount();

    mocks.amendmentRows = amendmentRows({ document: null, current_process_run: null });
    const noDocument = renderEditor();
    expect(noDocument.result.current.entity).toBeNull();
  });

  it('handles realtime callbacks before init, semantic noops, remote changes, and enabled operands', async () => {
    mocks.amendmentRows = null;
    mocks.amendmentEntity = null;
    const rendered = renderEditor();
    act(() => mocks.realtimeOptions.onRemoteContent(content('ignored')));
    expect(rendered.result.current.content).not.toEqual(content('ignored'));

    mocks.amendmentRows = amendmentRows();
    mocks.amendmentEntity = editorEntity();
    rendered.rerender({ entityType: 'amendment', entityId: 'amendment-1', userId: 'user-1' });
    await waitFor(() => expect(rendered.result.current.entity).toBeTruthy());
    act(() => mocks.realtimeOptions.onRemoteContent(content('initial')));
    expect(mocks.debug).toHaveBeenCalledWith(
      'content-source:realtime-broadcast:semantic-noop',
      expect.any(Object)
    );
    act(() => mocks.realtimeOptions.onRemoteContent(content('remote broadcast')));
    expect(rendered.result.current.content).toEqual(content('remote broadcast'));
    expect(mocks.realtimeOptions.enabled).toBe(true);
    rendered.unmount();

    const noUser = renderEditor({ userId: undefined });
    expect(mocks.realtimeOptions.enabled).toBe(false);
    noUser.unmount();
    const readOnly = renderEditor({ readOnly: true });
    expect(mocks.realtimeOptions.enabled).toBe(false);
    readOnly.unmount();
  });

  it('initializes fallback entity fields and reinitializes only for a new context key', async () => {
    mocks.amendmentEntity = editorEntity({
      id: 'first',
      title: '',
      content: [],
      discussions: null,
      editingMode: null,
      updatedAt: 0,
    });
    const rendered = renderEditor();
    await waitFor(() => expect(rendered.result.current.entity?.id).toBe('first'));
    expect(rendered.result.current.title).toBe('');
    expect(rendered.result.current.mode).toBe('edit');
    expect(rendered.result.current.discussions).toEqual([]);

    act(() => rendered.result.current.setSelectedCrIds(new Set(['cr'])));
    rendered.rerender({ entityType: 'amendment', entityId: 'amendment-1', userId: 'user-1' });
    expect(rendered.result.current.selectedCrIds).toEqual(new Set(['cr']));

    mocks.amendmentEntity = editorEntity({
      id: 'second',
      title: 'Second',
      metadata: { processBranchId: 'branch-2' },
    });
    mocks.amendmentRows = { ...mocks.amendmentRows };
    rendered.rerender({ entityType: 'amendment', entityId: 'amendment-1', userId: 'user-1' });
    await waitFor(() => expect(rendered.result.current.title).toBe('Second'));
    expect(rendered.result.current.selectedCrIds).toBeNull();
  });

  it('syncs persisted discussion fields, new discussions, unchanged data, and stale snapshots', async () => {
    const local = { id: 'one', content: 'local', status: 'open', votesFor: 1 } as any;
    mocks.amendmentEntity = editorEntity({ discussions: [local] });
    const rendered = renderEditor();
    await waitFor(() => expect(rendered.result.current.discussions).toEqual([local]));
    await act(async () =>
      rendered.result.current.setDiscussions([local, { id: 'local-only' } as any])
    );

    mocks.amendmentEntity = editorEntity({
      discussions: [
        { id: 'one', content: 'remote body', status: 'closed', votesFor: 2 },
        { id: 'remote-new', status: 'open' },
      ],
    });
    mocks.amendmentRows = { ...mocks.amendmentRows };
    rendered.rerender({ entityType: 'amendment', entityId: 'amendment-1', userId: 'user-1' });
    await waitFor(() => expect(rendered.result.current.discussions).toHaveLength(3));
    expect(rendered.result.current.discussions[0]).toEqual(
      expect.objectContaining({ content: 'local', status: 'closed', votesFor: 2 })
    );

    mocks.now += 6_000;
    const staleRemote = [{ id: 'stale', status: 'remote' }] as any;
    mocks.amendmentEntity = editorEntity({ discussions: staleRemote });
    mocks.amendmentRows = { ...mocks.amendmentRows };
    rendered.rerender({ entityType: 'amendment', entityId: 'amendment-1', userId: 'user-1' });
    await waitFor(() => expect(rendered.result.current.discussions).toEqual(staleRemote));
  });

  it('covers read-only, missing-context, tutorial, leading, trailing, and failed content saves', async () => {
    const readOnly = renderEditor({ readOnly: true });
    act(() => readOnly.result.current.setContent(content('readonly')));
    expect(mocks.broadcastContent).not.toHaveBeenCalled();
    readOnly.unmount();

    const noUser = renderEditor({ userId: undefined });
    act(() => noUser.result.current.setContent(content('missing user')));
    expect(console.warn).toHaveBeenCalled();
    noUser.unmount();

    mocks.containsTutorialInput.mockReturnValue(true);
    mocks.tutorialVariants = ['matched text'];
    const amendment = renderEditor();
    await act(async () => amendment.result.current.setContent(content('matched text')));
    expect(mocks.reportTutorial).toHaveBeenCalledWith({ type: 'input', value: 'matched text' });
    expect(mocks.mutationFns['documents.updateContent']).toHaveBeenCalledWith(
      expect.objectContaining({ reconcile_orphaned_change_requests: true })
    );
    expect(mocks.broadcastContent).toHaveBeenCalled();

    mocks.tutorialVariants = ['not present'];
    mocks.now += 10;
    vi.useFakeTimers();
    act(() => amendment.result.current.setContent(content('fallback tutorial')));
    act(() => amendment.result.current.setContent(content('replace pending timeout')));
    expect(mocks.reportTutorial).toHaveBeenCalledWith({
      type: 'input',
      value: 'catalog fallback',
    });
    await act(async () => vi.advanceTimersByTime(1_000));
    amendment.unmount();

    vi.useRealTimers();
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('save failed'));
    mocks.now += 2_000;
    const failed = renderEditor({ entityType: 'document', entityId: 'document-1' });
    await act(async () => failed.result.current.setContent(content('failure')));
    await waitFor(() => expect(failed.result.current.saveStatus).toBe('error'));
    const finalization = mocks.finalizations.at(-1);
    act(() => finalization.callbacks.onError(new Error('server failed')));
    expect(failed.result.current.saveStatus).toBe('error');
  });

  it('persists blog content and suppresses amendment reconciliation outside edit mode', async () => {
    const blog = renderEditor({ entityType: 'blog', entityId: 'blog-1' });
    await act(async () => blog.result.current.setContent(content('blog content')));
    expect(mocks.mutationFns['blogs.update']).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'blog-1', content: content('blog content') })
    );
    blog.unmount();

    mocks.amendmentEntity = editorEntity({ editingMode: 'suggest_internal' });
    mocks.now += 2_000;
    const amendment = renderEditor();
    await waitFor(() => expect(amendment.result.current.mode).toBe('suggest_internal'));
    await act(async () => amendment.result.current.setContent(content('suggestion')));
    expect(mocks.mutationFns['documents.updateContent']).toHaveBeenLastCalledWith({
      id: 'document-1',
      content: content('suggestion'),
    });
  });

  it('skips recent and stale noncanonical remote content after local editing settles', async () => {
    vi.useFakeTimers();
    mocks.amendmentEntity = editorEntity({ editingMode: 'suggest_internal', updatedAt: 100 });
    const rendered = renderEditor();
    act(() => rendered.result.current.setContent(content('local pending')));

    mocks.amendmentEntity = editorEntity({
      editingMode: 'suggest_internal',
      content: content('first remote'),
      updatedAt: 200,
    });
    mocks.amendmentRows = { ...mocks.amendmentRows };
    rendered.rerender({ entityType: 'amendment', entityId: 'amendment-1', userId: 'user-1' });
    await act(async () => vi.advanceTimersByTime(2_000));

    mocks.amendmentEntity = editorEntity({
      editingMode: 'suggest_internal',
      content: content('recent remote'),
      updatedAt: 300,
    });
    mocks.amendmentRows = { ...mocks.amendmentRows };
    rendered.rerender({ entityType: 'amendment', entityId: 'amendment-1', userId: 'user-1' });
    expect(rendered.result.current.content).not.toEqual(content('recent remote'));

    mocks.now += 3_000;
    mocks.amendmentEntity = editorEntity({
      editingMode: 'suggest_internal',
      content: content('stale remote'),
      updatedAt: 50,
    });
    mocks.amendmentRows = { ...mocks.amendmentRows };
    rendered.rerender({ entityType: 'amendment', entityId: 'amendment-1', userId: 'user-1' });
    expect(rendered.result.current.content).not.toEqual(content('stale remote'));
  });

  it('rejects an older noncanonical remote version without any local edit', async () => {
    mocks.amendmentEntity = editorEntity({
      editingMode: 'suggest_internal',
      content: content('current remote'),
      updatedAt: 100,
    });
    const rendered = renderEditor();
    await waitFor(() => expect(rendered.result.current.content).toEqual(content('current remote')));

    mocks.amendmentEntity = editorEntity({
      editingMode: 'suggest_internal',
      content: content('older remote'),
      updatedAt: 50,
    });
    mocks.amendmentRows = { ...mocks.amendmentRows };
    rendered.rerender({ entityType: 'amendment', entityId: 'amendment-1', userId: 'user-1' });
    expect(rendered.result.current.content).toEqual(content('current remote'));
  });

  it('debounces titles across entity types, no-user, readonly, missing parent, and failures', async () => {
    vi.useFakeTimers();
    const amendment = renderEditor();
    act(() => amendment.result.current.setTitle('First'));
    act(() => amendment.result.current.setTitle('Second'));
    await act(async () => vi.advanceTimersByTime(500));
    expect(mocks.mutationFns['amendments.update']).toHaveBeenCalledWith({
      id: 'amendment-1',
      title: 'Second',
    });
    mocks.finalizations.at(-1).callbacks.onError(new Error('title server'));
    expect(mocks.toastError).toHaveBeenCalled();
    amendment.unmount();

    for (const [entityType, expectedMutation] of [
      ['blog', 'blogs.update'],
      ['document', 'amendments.update'],
      ['groupDocument', 'documents.updateGroupDocumentTitle'],
    ] as const) {
      const rendered = renderEditor({ entityType, entityId: 'document-1' });
      act(() => rendered.result.current.setTitle(`${entityType} title`));
      await act(async () => vi.advanceTimersByTime(500));
      expect(mocks.mutationFns[expectedMutation]).toHaveBeenCalled();
      rendered.unmount();
    }

    const noUser = renderEditor({ userId: undefined });
    act(() => noUser.result.current.setTitle('No user'));
    await act(async () => vi.advanceTimersByTime(500));
    expect(noUser.result.current.isSavingTitle).toBe(false);
    noUser.unmount();

    const readonly = renderEditor({ readOnly: true });
    act(() => readonly.result.current.setTitle('Ignored'));
    expect(readonly.result.current.title).not.toBe('Ignored');
    readonly.unmount();

    mocks.documentRows = { id: 'document-1', amendment_id: null };
    const missingParent = renderEditor({ entityType: 'document', entityId: 'document-1' });
    act(() => missingParent.result.current.setTitle('Fails'));
    await act(async () => vi.advanceTimersByTime(500));
    expect(mocks.toastError).toHaveBeenCalled();
    missingParent.unmount();

    const unsupported = renderEditor({ entityType: 'unsupported', entityId: 'unsupported-1' });
    act(() => unsupported.result.current.setTitle('No storage target'));
    await act(async () => vi.advanceTimersByTime(500));
    expect(unsupported.result.current.title).toBe('No storage target');
    unsupported.unmount();
  });

  it('persists discussion variants and handles readonly, same, missing context, server, and thrown errors', async () => {
    const readonly = renderEditor({ readOnly: true });
    await act(async () => readonly.result.current.setDiscussions([{ id: 'ignored' } as any]));
    expect(readonly.result.current.discussions).toEqual([]);
    readonly.unmount();

    const same = renderEditor();
    await act(async () => same.result.current.setDiscussions([]));
    expect(mocks.mutate).not.toHaveBeenCalled();
    same.unmount();

    const noUser = renderEditor({ userId: undefined });
    await act(async () => noUser.result.current.setDiscussions([{ id: 'local' } as any]));
    expect(noUser.result.current.discussions).toHaveLength(1);
    noUser.unmount();

    const blog = renderEditor({ entityType: 'blog', entityId: 'blog-1' });
    await act(async () => blog.result.current.setDiscussions([{ id: 'blog-discussion' } as any]));
    expect(mocks.mutationFns['blogs.update']).toHaveBeenCalled();
    mocks.finalizations.at(-1).callbacks.onError(new Error('discussion server'));
    blog.unmount();

    mocks.amendmentEntity = editorEntity({ metadata: { processBranchId: 'branch-1' } });
    const branch = renderEditor();
    await act(async () =>
      branch.result.current.setDiscussions([{ id: 'branch-discussion' } as any])
    );
    expect(mocks.mutationFns['amendments.updateProcessBranch']).toHaveBeenCalled();
    branch.unmount();

    mocks.amendmentEntity = editorEntity({ metadata: {} });
    const main = renderEditor();
    await act(async () => main.result.current.setDiscussions([{ id: 'main-discussion' } as any]));
    expect(mocks.mutationFns['amendments.update']).toHaveBeenCalled();
    main.unmount();

    const document = renderEditor({ entityType: 'document', entityId: 'document-1' });
    await act(async () =>
      document.result.current.setDiscussions([{ id: 'document-discussion' } as any])
    );
    document.unmount();

    mocks.waitForClientApply.mockRejectedValueOnce('plain rejection');
    const failed = renderEditor({ entityType: 'blog', entityId: 'blog-1' });
    await act(async () => failed.result.current.setDiscussions([{ id: 'failed' } as any]));
    expect(console.error).toHaveBeenCalled();
    failed.unmount();

    mocks.waitForClientApply.mockRejectedValueOnce(new Error('error rejection'));
    const failedError = renderEditor({ entityType: 'blog', entityId: 'blog-1' });
    await act(async () =>
      failedError.result.current.setDiscussions([{ id: 'failed-error' } as any])
    );
    expect(console.error).toHaveBeenCalled();
  });

  it('changes modes for every storage target, tutorial event, server callback, and catch rollback', async () => {
    const readOnly = renderEditor({ readOnly: true });
    await act(async () => readOnly.result.current.setMode('suggest_internal'));
    expect(mocks.mutate).not.toHaveBeenCalled();
    readOnly.unmount();

    mocks.amendmentRows = amendmentRows({
      current_process_run: {
        branches: [{ id: 'branch-1', document: { id: 'branch-document' } }],
        active_branch_id: 'branch-1',
      },
    });
    mocks.resolveBranchId.mockReturnValue('branch-1');
    mocks.amendmentEntity = editorEntity({ metadata: { processBranchId: 'branch-1' } });
    const branch = renderEditor();
    await act(async () => branch.result.current.setMode('suggest_internal'));
    expect(mocks.mutationFns['amendments.updateProcessBranch']).toHaveBeenCalled();
    act(() => mocks.finalizations.at(-1).callbacks.onSuccess());
    expect(mocks.reportTutorial).toHaveBeenCalledWith({
      type: 'mutation',
      event: 'amendment.mode.suggest_internal',
    });

    await act(async () => branch.result.current.setMode('vote_internal'));
    act(() => mocks.finalizations.at(-1).callbacks.onSuccess());
    expect(mocks.reportTutorial).toHaveBeenCalledWith({
      type: 'mutation',
      event: 'amendment.mode.vote_internal',
    });
    branch.unmount();

    const blog = renderEditor({ entityType: 'blog', entityId: 'blog-1' });
    await act(async () => blog.result.current.setMode('edit'));
    expect(mocks.mutationFns['blogs.update']).toHaveBeenCalled();
    blog.unmount();

    const document = renderEditor({ entityType: 'document', entityId: 'document-1' });
    await act(async () => document.result.current.setMode('edit'));
    expect(mocks.mutationFns['documents.updateContent']).toHaveBeenCalled();
    document.unmount();

    mocks.amendmentEntity = editorEntity({ editingMode: null });
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('mode failed'));
    const failed = renderEditor();
    await expect(
      act(async () => {
        await failed.result.current.setMode('suggest_internal');
      })
    ).rejects.toThrow('mode failed');
    expect(failed.result.current.mode).toBe('edit');
  });

  it('reconciles pending remote modes and ignores stale finalization callbacks after context changes', async () => {
    mocks.amendmentEntity = editorEntity({ editingMode: 'edit', metadata: {} });
    const rendered = renderEditor();
    await act(async () => rendered.result.current.setMode('suggest_internal'));
    const oldFinalization = mocks.finalizations.at(-1);

    mocks.amendmentEntity = editorEntity({ editingMode: 'vote_internal', metadata: {} });
    mocks.amendmentRows = { ...mocks.amendmentRows };
    rendered.rerender({ entityType: 'amendment', entityId: 'amendment-1', userId: 'user-1' });
    expect(rendered.result.current.mode).toBe('suggest_internal');

    mocks.amendmentEntity = editorEntity({ editingMode: 'suggest_internal', metadata: {} });
    mocks.amendmentRows = { ...mocks.amendmentRows };
    rendered.rerender({ entityType: 'amendment', entityId: 'amendment-1', userId: 'user-1' });
    expect(rendered.result.current.mode).toBe('suggest_internal');

    mocks.amendmentEntity = editorEntity({ editingMode: 'edit', metadata: {} });
    mocks.amendmentRows = { ...mocks.amendmentRows };
    rendered.rerender({ entityType: 'amendment', entityId: 'amendment-1', userId: 'user-1' });
    expect(rendered.result.current.mode).toBe('edit');

    mocks.amendmentEntity = editorEntity({
      id: 'new-context',
      editingMode: null,
      metadata: { processBranchId: 'new-branch' },
    });
    mocks.amendmentRows = { ...mocks.amendmentRows };
    rendered.rerender({ entityType: 'amendment', entityId: 'amendment-1', userId: 'user-1' });
    act(() => oldFinalization.callbacks.onSuccess());
    act(() => oldFinalization.callbacks.onError(new Error('stale server error')));
    expect(rendered.result.current.mode).toBe('edit');

    rendered.unmount();
    mocks.amendmentRows = amendmentRows({ document: null });
    mocks.amendmentEntity = null;
    mocks.mutate.mockClear();
    const noContent = renderEditor();
    await act(async () => noContent.result.current.setMode('suggest_internal'));
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it('restores versions for blog and documents and covers guards plus server/client failures', async () => {
    const readonly = renderEditor({ readOnly: true });
    await act(async () => readonly.result.current.restoreVersion(content('ignored')));
    expect(mocks.mutate).not.toHaveBeenCalled();
    readonly.unmount();

    const noUser = renderEditor({ userId: undefined });
    await act(async () => noUser.result.current.restoreVersion(content('ignored')));
    expect(mocks.mutate).not.toHaveBeenCalled();
    noUser.unmount();

    const blog = renderEditor({ entityType: 'blog', entityId: 'blog-1' });
    await act(async () => blog.result.current.restoreVersion(content('blog restored')));
    expect(mocks.mutationFns['blogs.update']).toHaveBeenCalled();
    act(() => mocks.finalizations.at(-1).callbacks.onError(new Error('restore server')));
    expect(mocks.toastError).toHaveBeenCalled();
    blog.unmount();

    mocks.waitForClientApply.mockRejectedValueOnce(new Error('restore failed'));
    const document = renderEditor({ entityType: 'document', entityId: 'document-1' });
    await act(async () => document.result.current.restoreVersion(content('document restored')));
    expect(mocks.toastError).toHaveBeenCalled();
  });

  it('evaluates every access and collaborator rule plus non-amendment vote capabilities', () => {
    const cases: {
      entityType?: string;
      userId?: string;
      value: any;
      access: boolean;
      owner: boolean;
    }[] = [
      { value: null, access: false, owner: false },
      { entityType: 'groupDocument', value: editorEntity(), access: true, owner: false },
      { value: editorEntity({ visibility: 'public' }), access: true, owner: false },
      {
        value: editorEntity({ visibility: 'authenticated' }),
        access: true,
        owner: false,
      },
      {
        userId: undefined,
        value: editorEntity({ visibility: 'authenticated' }),
        access: false,
        owner: false,
      },
      {
        value: editorEntity({ owner: { id: 'user-1' } }),
        access: true,
        owner: true,
      },
      {
        value: editorEntity({
          collaborators: [{ user: { id: 'user-1' }, status: 'owner', canEdit: false }],
        }),
        access: true,
        owner: true,
      },
      {
        value: editorEntity({
          collaborators: [{ user: { id: 'user-1' }, status: 'admin', canEdit: false }],
        }),
        access: true,
        owner: true,
      },
      {
        value: editorEntity({
          collaborators: [{ user: { id: 'user-1' }, status: 'member', canEdit: true }],
        }),
        access: true,
        owner: true,
      },
      {
        value: editorEntity({
          collaborators: [{ user: { id: 'other' }, status: 'member', canEdit: false }],
        }),
        access: false,
        owner: false,
      },
    ];

    for (const testCase of cases) {
      mocks.amendmentEntity = testCase.value;
      mocks.groupDocumentEntity = testCase.value;
      const rendered = renderEditor({
        entityType: testCase.entityType ?? 'amendment',
        userId: 'userId' in testCase ? testCase.userId : 'user-1',
      });
      expect(rendered.result.current.hasAccess).toBe(testCase.access);
      if ((testCase.entityType ?? 'amendment') !== 'amendment') {
        expect(rendered.result.current.isOwnerOrCollaborator).toBe(testCase.owner);
      }
      rendered.unmount();
    }

    mocks.blogEntity = editorEntity({
      owner: null,
      collaborators: [{ user: { id: 'other' }, status: 'member', canEdit: false }],
    });
    const blog = renderEditor({
      entityType: 'blog',
      entityId: 'blog-1',
      capabilities: { voting: true },
    });
    expect(blog.result.current.canVoteOnChangeRequests).toBe(true);
    expect(blog.result.current.canManageChangeRequestVotes).toBe(false);
    blog.unmount();

    for (const collaborator of [
      { user: { id: 'user-1' }, status: 'owner', canEdit: false },
      { user: { id: 'user-1' }, status: 'admin', canEdit: false },
      { user: { id: 'user-1' }, status: 'member', canEdit: true },
      { user: { id: 'user-1' }, status: 'member', canEdit: false },
      { user: { id: 'other' }, status: 'owner', canEdit: true },
    ]) {
      mocks.blogEntity = editorEntity({ owner: null, collaborators: [collaborator] });
      mocks.blogRows = { ...mocks.blogRows };
      const collaboratorEditor = renderEditor({ entityType: 'blog', entityId: 'blog-1' });
      expect(collaboratorEditor.result.current.isOwnerOrCollaborator).toBe(
        collaborator.user.id === 'user-1' &&
          (collaborator.status === 'owner' ||
            collaborator.status === 'admin' ||
            collaborator.canEdit)
      );
      collaboratorEditor.unmount();
    }

    mocks.blogEntity = editorEntity({ owner: { id: 'user-1' }, collaborators: [] });
    mocks.blogRows = { ...mocks.blogRows };
    const owner = renderEditor({ entityType: 'blog', entityId: 'blog-1' });
    expect(owner.result.current.isOwnerOrCollaborator).toBe(true);
  });
});
