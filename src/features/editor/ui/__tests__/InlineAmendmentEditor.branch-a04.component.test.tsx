/* @vitest-environment jsdom */

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  editor: {} as Record<string, any>,
  ops: {
    handleSuggestionAccepted: vi.fn(),
    handleSuggestionDeclined: vi.fn(),
    handleSuggestionCreated: vi.fn(),
    handlePendingSuggestionSubmitted: vi.fn(),
    handlePendingSuggestionDiscarded: vi.fn(),
  },
  suggestionAssignment: vi.fn(),
  viewProps: undefined as Record<string, any> | undefined,
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  snapshotFromDocument: vi.fn(() => ({
    changed_character_count: 4,
    change_type: 'replace',
    original_text: 'old',
    new_text: 'new',
    original_properties: { old: true },
    new_properties: { next: true },
  })),
  snapshotFromContent: vi.fn(() => ({
    change_type: 'insert',
    original_text: '',
    new_text: 'new',
    original_properties: {},
    new_properties: {},
  })),
  countChanged: vi.fn(() => 3),
}));

vi.mock('../../hooks/useEditor', () => ({ useEditor: () => mocks.editor }));
vi.mock('../../hooks/useEditorOperations', () => ({ useEditorOperations: () => mocks.ops }));
vi.mock('../../hooks/useEditorUsers', () => ({ useEditorUsers: () => ({ users: true }) }));
vi.mock('@/features/documents/hooks/use-suggestion-id-assignment', () => ({
  useSuggestionIdAssignment: (options: unknown) => mocks.suggestionAssignment(options),
}));
vi.mock('@/features/change-requests/utils/suggestion-extraction', () => ({
  countChangedCharacters: (content: unknown) =>
    (mocks.countChanged as (value: unknown) => number)(content),
  createChangeRequestDiffSnapshot: (...args: unknown[]) =>
    (mocks.snapshotFromDocument as (...values: unknown[]) => unknown)(...args),
  createChangeRequestDiffSnapshotFromContent: (content: unknown) =>
    (mocks.snapshotFromContent as (value: unknown) => unknown)(content),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, fallback: string) => fallback,
}));
vi.mock('../InlineAmendmentEditorView', () => ({
  InlineAmendmentEditorView: (props: Record<string, unknown>) => {
    mocks.viewProps = props;
    return <div data-testid="inline-editor-view" />;
  },
}));

import { InlineAmendmentEditor } from '../InlineAmendmentEditor';

function baseEntity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'document-1',
    owner: { id: 'owner', name: 'Owner', email: 'owner@example.test', avatarUrl: 'owner.png' },
    collaborators: [],
    extraUsers: [],
    metadata: { amendmentId: 'amendment-entity', processBranchId: 'branch-entity' },
    ...overrides,
  };
}

function resetEditor(overrides: Record<string, unknown> = {}) {
  mocks.editor = {
    entity: baseEntity(),
    isLoading: false,
    content: [{ type: 'p', children: [{ text: 'content' }] }],
    discussions: [],
    mode: 'suggest_event',
    selectedCrIds: null,
    setContent: vi.fn(),
    setDiscussions: vi.fn(async () => undefined),
    setSelectedCrIds: vi.fn(),
    getLatestContent: vi.fn(() => [{ type: 'p', children: [{ text: 'latest' }] }]),
    ...overrides,
  };
}

function renderEditor(props: Record<string, unknown> = {}) {
  return render(
    <InlineAmendmentEditor
      amendmentId="amendment-route"
      userId="user-1"
      processBranchId="branch-prop"
      {...props}
    />
  );
}

beforeEach(() => {
  resetEditor();
  Object.values(mocks.ops).forEach(mock => mock.mockReset());
  mocks.ops.handleSuggestionAccepted.mockResolvedValue({ updatedDiscussions: ['accepted'] });
  mocks.ops.handleSuggestionDeclined.mockResolvedValue({ updatedDiscussions: ['declined'] });
  mocks.ops.handleSuggestionCreated.mockResolvedValue(true);
  mocks.ops.handlePendingSuggestionSubmitted.mockResolvedValue(true);
  mocks.ops.handlePendingSuggestionDiscarded.mockResolvedValue(true);
  mocks.viewProps = undefined;
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('InlineAmendmentEditor branch contract', () => {
  it('resolves owner identity, entity metadata, and event-final assignment mode', () => {
    mocks.editor.entity = baseEntity({
      owner: {
        id: 'user-1',
        name: 'Owner Name',
        email: 'owner@example.test',
        avatarUrl: 'owner.png',
      },
    });
    renderEditor({ editingMode: 'event_final_closing_vote' });

    expect(mocks.viewProps).toMatchObject({
      resolvedMode: 'event_final_closing_vote',
      contentEntityId: 'document-1',
      amendmentIdFromEntity: 'amendment-entity',
      currentUser: {
        id: 'user-1',
        name: 'Owner Name',
        email: 'owner@example.test',
        avatarUrl: 'owner.png',
      },
    });
    expect(mocks.suggestionAssignment).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, confirmationMode: 'none' })
    );
  });

  it('falls through collaborator, extra-user, record, and anonymous identity fields', () => {
    mocks.editor.entity = baseEntity({
      owner: { id: 'other' },
      collaborators: [{ user: { id: 'user-1', name: 'Collaborator', email: 'collab@test' } }],
      extraUsers: [{ id: 'extra', name: 'Extra', email: 'extra@test', avatarUrl: 'extra.png' }],
    });
    const view = renderEditor({
      userRecord: { id: 'user-1', name: 'Record', email: null, avatar: 'record.png' },
    });
    expect(mocks.viewProps?.currentUser).toMatchObject({ name: 'Record', email: 'collab@test' });

    mocks.editor.entity = baseEntity({
      owner: { id: 'other' },
      collaborators: [{ user: { id: 'other' } }, { user: null }],
      extraUsers: [{ id: 'user-1', name: '', email: 'extra@test', avatarUrl: 'extra.png' }],
      metadata: {},
    });
    view.rerender(<InlineAmendmentEditor amendmentId="amendment-route" userId="user-1" />);
    expect(mocks.viewProps?.currentUser).toMatchObject({
      name: 'extra@test',
      avatarUrl: 'extra.png',
    });

    mocks.editor.entity = baseEntity({ owner: { id: 'other' }, collaborators: [], extraUsers: [] });
    view.rerender(
      <InlineAmendmentEditor
        amendmentId="amendment-route"
        userId="user-1"
        userRecord={{ id: 'user-1', email: 'record@test' }}
      />
    );
    expect(mocks.viewProps?.currentUser?.name).toBe('record@test');

    view.rerender(<InlineAmendmentEditor amendmentId="amendment-route" userId="user-1" />);
    expect(mocks.viewProps?.currentUser?.name).toBe('Anonymous');
  });

  it('handles missing user and missing entity identity independently', () => {
    const view = renderEditor({ userId: undefined });
    expect(mocks.viewProps?.currentUser).toBeUndefined();

    mocks.editor.entity = null;
    view.rerender(<InlineAmendmentEditor amendmentId="amendment-route" userId="user-1" />);
    expect(mocks.viewProps).toMatchObject({
      contentEntityId: '',
      amendmentIdFromEntity: undefined,
      currentUser: { id: 'user-1', name: 'Anonymous' },
    });
  });

  it('creates a change request snapshot only when entity metadata identifies the amendment', () => {
    renderEditor();
    const callback = mocks.suggestionAssignment.mock.calls.at(-1)?.[0].onChangeRequestCreate;
    expect(
      callback({
        crId: 'CR-1',
        discussionId: 'discussion-1',
        changeRequestEntityId: 'change-1',
        discussions: ['next'],
      })
    ).toBeInstanceOf(Promise);
    expect(mocks.ops.handleSuggestionCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'change-1',
        crId: 'CR-1',
        amendmentId: 'amendment-entity',
        processBranchId: 'branch-entity',
        documentContent: expect.any(Array),
      })
    );

    mocks.editor.entity = baseEntity({ metadata: {} });
    renderEditor();
    const missingCallback = mocks.suggestionAssignment.mock.calls.at(-1)?.[0].onChangeRequestCreate;
    expect(
      missingCallback({
        crId: 'CR-2',
        discussionId: 'discussion-2',
        changeRequestEntityId: 'change-2',
        discussions: [],
      })
    ).toBeUndefined();
  });

  it('accepts and declines suggestions and covers every missing prerequisite', async () => {
    const view = renderEditor();
    await act(async () => mocks.viewProps?.onSuggestionAccepted({ suggestionId: 'one' }));
    await act(async () => mocks.viewProps?.onSuggestionDeclined({ suggestionId: 'two' }));
    expect(mocks.editor.setDiscussions).toHaveBeenNthCalledWith(1, ['accepted']);
    expect(mocks.editor.setDiscussions).toHaveBeenNthCalledWith(2, ['declined']);

    resetEditor({ entity: null });
    view.rerender(<InlineAmendmentEditor amendmentId="amendment-route" userId="user-1" />);
    await act(async () => mocks.viewProps?.onSuggestionAccepted({ suggestionId: 'guard-id' }));
    await act(async () => mocks.viewProps?.onSuggestionDeclined({ suggestionId: 'guard-id' }));

    resetEditor({ content: null });
    view.rerender(<InlineAmendmentEditor amendmentId="amendment-route" userId="user-1" />);
    await act(async () => mocks.viewProps?.onSuggestionAccepted({ suggestionId: 'guard-content' }));
    await act(async () => mocks.viewProps?.onSuggestionDeclined({ suggestionId: 'guard-content' }));

    resetEditor();
    view.rerender(<InlineAmendmentEditor amendmentId="amendment-route" />);
    await act(async () => mocks.viewProps?.onSuggestionAccepted({ suggestionId: 'guard-user' }));
    await act(async () => mocks.viewProps?.onSuggestionDeclined({ suggestionId: 'guard-user' }));
  });

  it('validates event suggestion discussion and CR identity fallbacks', async () => {
    resetEditor({ discussions: [] });
    const view = renderEditor();
    await act(async () =>
      mocks.viewProps?.onEventSuggestionConfirm({ keyId: 'suggestion_missing' })
    );
    expect(mocks.toastError).toHaveBeenCalledWith('Suggestion not found.');

    resetEditor({ discussions: [{ id: 'by-suggestion' }] });
    view.rerender(<InlineAmendmentEditor amendmentId="amendment-route" userId="user-1" />);
    await act(async () =>
      mocks.viewProps?.onEventSuggestionConfirm({ suggestionId: 'by-suggestion' })
    );
    expect(mocks.toastError).toHaveBeenCalledWith('Suggestion is still being prepared.');

    resetEditor({ discussions: [{ id: 'by-id' }] });
    view.rerender(<InlineAmendmentEditor amendmentId="amendment-route" userId="user-1" />);
    await act(async () =>
      mocks.viewProps?.onEventSuggestionConfirm({ id: 'by-id', crId: 'CR-fallback' })
    );
    expect(mocks.ops.handleSuggestionCreated).toHaveBeenCalledWith(
      expect.objectContaining({ crId: 'CR-fallback', discussionId: 'by-id' })
    );
  });

  it('submits existing and new suggestions, including failure and success updates', async () => {
    const discussions = [
      {
        id: 'existing',
        crId: 'CR-existing',
        changeRequestEntityId: 'change-existing',
      },
      { id: 'other', crId: 'CR-other' },
    ];
    resetEditor({ discussions });
    const view = renderEditor();
    await act(async () =>
      mocks.viewProps?.onEventSuggestionConfirm({
        keyId: 'suggestion_existing',
        type: undefined,
        text: undefined,
        newText: undefined,
        properties: undefined,
        newProperties: undefined,
      })
    );
    expect(mocks.ops.handlePendingSuggestionSubmitted).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'change-existing' })
    );
    expect(mocks.editor.setDiscussions).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'existing', confirmationStatus: 'confirmed' }),
      discussions[1],
    ]);
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Change request submitted.');

    mocks.ops.handleSuggestionCreated.mockResolvedValueOnce(false);
    resetEditor({ discussions: [{ id: 'new', crId: 'CR-new', changeRequestEntityId: null }] });
    view.rerender(<InlineAmendmentEditor amendmentId="amendment-route" userId="user-1" />);
    await act(async () => mocks.viewProps?.onEventSuggestionConfirm({ suggestionId: 'new' }));
    expect(mocks.toastError).toHaveBeenCalledWith('Failed to submit change request.');

    mocks.ops.handlePendingSuggestionSubmitted.mockResolvedValueOnce(false);
    resetEditor({
      discussions: [{ id: 'failed-existing', crId: 'CR', changeRequestEntityId: 'change' }],
    });
    view.rerender(<InlineAmendmentEditor amendmentId="amendment-route" userId="user-1" />);
    await act(async () =>
      mocks.viewProps?.onEventSuggestionConfirm({ suggestionId: 'failed-existing' })
    );
    expect(mocks.toastError).toHaveBeenLastCalledWith('Failed to submit change request.');
  });

  it('guards confirmation mode and missing amendment metadata', async () => {
    const view = renderEditor({ editingMode: 'event_final_closing_vote' });
    await act(async () => mocks.viewProps?.onEventSuggestionConfirm({ suggestionId: 'x' }));
    expect(mocks.ops.handleSuggestionCreated).not.toHaveBeenCalled();

    mocks.editor.entity = baseEntity({ metadata: {} });
    view.rerender(<InlineAmendmentEditor amendmentId="amendment-route" userId="user-1" />);
    await act(async () => mocks.viewProps?.onEventSuggestionConfirm({ suggestionId: 'x' }));
    expect(mocks.ops.handleSuggestionCreated).not.toHaveBeenCalled();
  });

  it('cancels unconfirmed suggestions and rejects confirmed or undeletable ones', async () => {
    const view = renderEditor({ editingMode: 'event_final_closing_vote' });
    await act(async () => mocks.viewProps?.onEventSuggestionCancel({ suggestionId: 'x' }));

    resetEditor({ discussions: [{ id: 'confirmed', confirmationStatus: 'confirmed' }] });
    view.rerender(<InlineAmendmentEditor amendmentId="amendment-route" userId="user-1" />);
    await expect(
      act(async () => mocks.viewProps?.onEventSuggestionCancel({ suggestionId: 'confirmed' }))
    ).rejects.toThrow('Submitted change requests cannot be withdrawn.');

    mocks.ops.handlePendingSuggestionDiscarded.mockResolvedValueOnce(false);
    resetEditor({ discussions: [{ id: 'pending', changeRequestEntityId: 'change-pending' }] });
    view.rerender(<InlineAmendmentEditor amendmentId="amendment-route" userId="user-1" />);
    await expect(
      act(async () => mocks.viewProps?.onEventSuggestionCancel({ suggestionId: 'pending' }))
    ).rejects.toThrow('Failed to discard pending change request.');

    resetEditor({
      discussions: [{ id: 'discard', changeRequestEntityId: 'change-discard' }, { id: 'keep' }],
    });
    view.rerender(<InlineAmendmentEditor amendmentId="amendment-route" userId="user-1" />);
    await act(async () =>
      mocks.viewProps?.onEventSuggestionCancel({ keyId: 'suggestion_discard' })
    );
    expect(mocks.editor.setDiscussions).toHaveBeenCalledWith([{ id: 'keep' }]);
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Suggestion discarded.');

    resetEditor({ discussions: [{ id: 'keep' }] });
    view.rerender(<InlineAmendmentEditor amendmentId="amendment-route" userId="user-1" />);
    await act(async () => mocks.viewProps?.onEventSuggestionCancel({ id: 'missing' }));
    expect(mocks.editor.setDiscussions).toHaveBeenCalledWith([{ id: 'keep' }]);
  });
});
