/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  t: vi.fn((key: string) => `t:${key}`),
  translate: vi.fn((key: string) => `translated:${key}`),
  useEditor: vi.fn(),
  useSuggestionIdAssignment: vi.fn(),
  createChangeRequestDiffSnapshot: vi.fn(),
  useEditorPresence: vi.fn(),
  useEditorUsers: vi.fn(),
  operations: {
    handleSuggestionCreated: vi.fn(),
    handleSuggestionAccepted: vi.fn(),
    handleSuggestionDeclined: vi.fn(),
    handleVoteOnSuggestion: vi.fn(),
    handleFinalizeInternalVoteOnSuggestion: vi.fn(),
  },
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: mocks.t }),
  translate: mocks.translate,
}));
vi.mock('@/features/documents/hooks/use-suggestion-id-assignment.ts', () => ({
  useSuggestionIdAssignment: mocks.useSuggestionIdAssignment,
}));
vi.mock('@/features/change-requests/utils/suggestion-extraction', () => ({
  createChangeRequestDiffSnapshot: mocks.createChangeRequestDiffSnapshot,
}));
vi.mock('../../logic/editor-helpers', () => ({
  generateDistinctUserColorMap: (ids: Iterable<string>) =>
    new Map([...ids].map(id => [id, `color:${id}`])),
}));
vi.mock('../useEditor', () => ({ useEditor: mocks.useEditor }));
vi.mock('../useEditorOperations', () => ({
  useEditorOperations: () => mocks.operations,
}));
vi.mock('../useEditorPresence', () => ({
  useEditorPresence: mocks.useEditorPresence,
}));
vi.mock('../useEditorUsers', () => ({ useEditorUsers: mocks.useEditorUsers }));

import { useEditorViewModel } from '../useEditorViewModel';

const capabilities = {
  versioning: true,
  presence: true,
  voting: true,
  modeSelection: true,
  sharing: true,
  invites: true,
  publicAccess: false,
};

const suggestion = { id: 'suggestion-1' } as never;
const discussions = [{ id: 'discussion-1' }] as never[];
const content = [{ type: 'p', children: [{ text: 'Content' }] }] as never[];

function editorState(overrides: Record<string, unknown> = {}) {
  return {
    entity: null,
    isLoading: false,
    title: 'Title',
    content,
    discussions,
    mode: 'edit',
    modeDisabledReasons: {},
    saveStatus: 'saved',
    hasUnsavedChanges: false,
    isSavingTitle: false,
    hasAccess: true,
    isOwnerOrCollaborator: true,
    canVoteOnChangeRequests: true,
    canManageChangeRequestVotes: true,
    capabilities,
    setTitle: vi.fn(),
    setContent: vi.fn(),
    setDiscussions: vi.fn(),
    setMode: vi.fn(),
    setSelectedCrIds: vi.fn(),
    selectedCrIds: null,
    restoreVersion: vi.fn(),
    getLatestContent: vi.fn(() => content),
    ...overrides,
  };
}

function props(overrides: Record<string, unknown> = {}) {
  return {
    entityType: 'amendment',
    entityId: 'entity-1',
    ...overrides,
  } as never;
}

function renderModel(
  stateOverrides: Record<string, unknown> = {},
  propOverrides: Record<string, unknown> = {}
) {
  const state = editorState(stateOverrides);
  mocks.useEditor.mockReturnValue(state);
  const rendered = renderHook(() => useEditorViewModel(props(propOverrides)));
  return { ...rendered, state };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useEditorPresence.mockReturnValue({
    onlinePeers: [],
    userColor: '#current',
  });
  mocks.useEditorUsers.mockReturnValue({});
  mocks.createChangeRequestDiffSnapshot.mockReturnValue({
    changed_character_count: 7,
    change_type: 'insert',
    original_text: 'old',
    new_text: 'new',
    original_properties: null,
    new_properties: null,
  });
  mocks.operations.handleSuggestionCreated.mockResolvedValue(true);
  mocks.operations.handleSuggestionAccepted.mockResolvedValue({
    updatedDiscussions: [{ id: 'accepted' }],
  });
  mocks.operations.handleSuggestionDeclined.mockResolvedValue({
    updatedDiscussions: [{ id: 'declined' }],
  });
});

afterEach(cleanup);

describe('useEditorViewModel branch contract', () => {
  it('covers omitted props, an absent entity, and callback short-circuits without an entity id', async () => {
    const { result } = renderModel();
    const assignment = mocks.useSuggestionIdAssignment.mock.calls.at(-1)?.[0];

    expect(result.current.currentUser).toBeUndefined();
    expect(result.current.contentEntityId).toBe('');
    expect(result.current.existingCollaboratorIds).toEqual([]);
    expect(result.current.statusBadgeLabel).toBeNull();
    expect(result.current.defaultBackUrl).toBe('/amendment/entity-1');
    expect(result.current.defaultBackLabel).toBe('t:features.editor.navigation.backToAmendment');
    expect(assignment.enabled).toBe(true);
    expect(assignment.onChangeRequestCreate({ discussions })).toBeUndefined();

    await act(async () => {
      await result.current.onSuggestionAccepted(suggestion);
      await result.current.onSuggestionDeclined(suggestion);
      await result.current.onVoteAccept(suggestion);
      await result.current.onVoteReject(suggestion);
      await result.current.onVoteAbstain(suggestion);
      await result.current.onFinalizeInternalVote(suggestion);
    });

    act(() => result.current.goBack());
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/amendment/entity-1' });
    expect(mocks.operations.handleSuggestionAccepted).not.toHaveBeenCalled();
  });

  it('builds a rich amendment model and delegates every successful editor operation', async () => {
    const entity = {
      id: 'document-1',
      visibility: 'private',
      owner: { id: 'owner-1' },
      collaborators: [{ user: { id: 'collaborator-1' } }, { user: { id: '' } }],
      extraUsers: [{ id: 'extra-1' }, { id: '' }],
      metadata: {
        amendmentId: 'amendment-1',
        amendmentCode: 'A-42',
        amendmentEditingMode: 'internal_editing',
        processBranchId: 'branch-from-entity',
      },
    };
    const state = editorState({ entity });
    mocks.useEditor.mockReturnValue(state);
    mocks.useEditorPresence.mockReturnValue({
      onlinePeers: [
        { peerId: 'peer-1', userId: 'collaborator-1' },
        { peerId: 'peer-2', userId: 'extra-1' },
      ],
      userColor: '#ada',
    });
    mocks.useEditorUsers.mockReturnValue({ Ada: { id: 'user-1' } });

    const { result } = renderHook(() =>
      useEditorViewModel(
        props({
          userId: 'user-1',
          userRecord: { name: 'Ada', email: 'ada@example.test', avatar: 'ada.png' },
          backUrl: '/custom-back',
          backLabel: 'Custom back',
          compactToolbarSpacing: true,
          showTopToolbar: false,
        })
      )
    );
    const assignment = mocks.useSuggestionIdAssignment.mock.calls.at(-1)?.[0];

    expect(result.current.currentUser).toEqual({
      id: 'user-1',
      name: 'Ada',
      email: 'ada@example.test',
      avatarUrl: 'ada.png',
    });
    expect(result.current.presenceColorByUserId).toEqual(
      new Map([
        ['user-1', 'color:user-1'],
        ['owner-1', 'color:owner-1'],
        ['collaborator-1', 'color:collaborator-1'],
        ['extra-1', 'color:extra-1'],
      ])
    );
    expect([...result.current.onlinePeerMap]).toHaveLength(2);
    expect(result.current.existingCollaboratorIds).toEqual(['collaborator-1', '', 'owner-1']);
    expect(result.current.amendmentTitle).toBe('A-42 - Title');
    expect(result.current.statusBadgeLabel).toBe('internal_editing');

    await act(async () => {
      await assignment.onChangeRequestCreate({
        crId: 'CR-1',
        discussionId: 'discussion-1',
        changeRequestEntityId: 'change-request-1',
        discussions,
      });
      await result.current.onSuggestionAccepted(suggestion);
      await result.current.onSuggestionDeclined(suggestion);
      await result.current.onVoteAccept(suggestion);
      await result.current.onVoteReject(suggestion);
      await result.current.onVoteAbstain(suggestion);
      await result.current.onFinalizeInternalVote(suggestion);
    });
    act(() => {
      result.current.setActiveCursorUserIds(new Set(['user-2']));
      result.current.goBack();
    });

    expect(mocks.operations.handleSuggestionCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        amendmentId: 'amendment-1',
        processBranchId: 'branch-from-entity',
        changedCharacterCount: 7,
        documentContent: content,
      })
    );
    expect(mocks.operations.handleSuggestionAccepted).toHaveBeenCalled();
    expect(mocks.operations.handleSuggestionDeclined).toHaveBeenCalled();
    expect(mocks.operations.handleVoteOnSuggestion.mock.calls.map(call => call[4])).toEqual([
      'accept',
      'reject',
      'abstain',
    ]);
    expect(mocks.operations.handleFinalizeInternalVoteOnSuggestion).toHaveBeenCalled();
    expect(state.setDiscussions).toHaveBeenCalledTimes(2);
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/custom-back' });
  });

  it('covers remaining user, content, amendment, and process-branch fallbacks', async () => {
    const emailUser = renderModel(
      {
        entity: {
          id: 'document-1',
          collaborators: [],
          metadata: { amendmentId: 'amendment-1' },
        },
      },
      {
        userId: 'user-email',
        userRecord: { name: '', email: 'fallback@example.test' },
        processBranchId: 'branch-from-props',
      }
    );
    expect(emailUser.result.current.currentUser?.name).toBe('fallback@example.test');

    await act(async () => {
      await emailUser.result.current.onSuggestionAccepted(suggestion);
      await emailUser.result.current.onSuggestionDeclined(suggestion);
      await emailUser.result.current.onVoteAccept(suggestion);
    });
    expect(mocks.operations.handleVoteOnSuggestion).toHaveBeenLastCalledWith(
      'amendment-1',
      'user-email',
      discussions,
      suggestion,
      'accept',
      'branch-from-props'
    );

    cleanup();
    const anonymous = renderModel(
      {
        entity: { id: 'document-2', collaborators: [], metadata: {} },
        content: null,
      },
      { userId: 'anonymous', userRecord: { name: '', email: '' } }
    );
    expect(anonymous.result.current.currentUser?.name).toBe('Anonymous');
    await act(async () => {
      await anonymous.result.current.onSuggestionAccepted(suggestion);
      await anonymous.result.current.onSuggestionDeclined(suggestion);
      await anonymous.result.current.onVoteAccept(suggestion);
      await anonymous.result.current.onVoteReject(suggestion);
      await anonymous.result.current.onVoteAbstain(suggestion);
      await anonymous.result.current.onFinalizeInternalVote(suggestion);
    });

    cleanup();
    const missingUser = renderModel(
      { entity: { id: 'document-3', collaborators: [], metadata: { amendmentId: 'a-3' } } },
      { userId: undefined }
    );
    await act(async () => {
      await missingUser.result.current.onSuggestionAccepted(suggestion);
      await missingUser.result.current.onSuggestionDeclined(suggestion);
      await missingUser.result.current.onVoteAccept(suggestion);
    });
  });

  it.each([
    ['public', 'translated:generated.inline.0063_public_dc5eb704'],
    ['authenticated', 'translated:generated.inline.0064_authenticated_c2be8376'],
    ['private', 'translated:generated.inline.0065_private_237dfa0a'],
  ])('labels %s blogs and chooses each blog back-route fallback', (visibility, label) => {
    const entity = {
      id: 'blog-1',
      visibility,
      collaborators: [],
      metadata: visibility === 'public' ? { groupId: 'group-1' } : {},
      owner: visibility === 'authenticated' ? { id: 'owner-1' } : undefined,
    };
    const { result } = renderModel({ entity }, { entityType: 'blog', entityId: 'blog-1' });

    expect(result.current.statusBadgeLabel).toBe(label);
    expect(result.current.defaultBackLabel).toBe('t:features.editor.navigation.backToBlog');
    expect(result.current.defaultBackUrl).toBe(
      visibility === 'public'
        ? '/group/group-1/blog/blog-1'
        : visibility === 'authenticated'
          ? '/user/owner-1/blog/blog-1'
          : '/blog/blog-1'
    );
  });

  it.each([
    ['document', undefined, '/editor'],
    ['groupDocument', 'group-1', '/group/group-1/editor'],
    ['groupDocument', undefined, '/'],
    ['unsupported', undefined, '/'],
  ])('covers %s navigation with group %s', (entityType, groupId, expectedUrl) => {
    const entity = { id: 'entity-1', collaborators: [], metadata: { groupId } };
    const { result } = renderModel({ entity }, { entityType });

    expect(result.current.defaultBackUrl).toBe(expectedUrl);
    expect(result.current.defaultBackLabel).toBe(
      entityType === 'unsupported'
        ? 't:common.back'
        : 't:features.editor.navigation.backToDocuments'
    );
    expect(result.current.contentEntityId).toBe('entity-1');
    expect(result.current.statusBadgeLabel).toBeNull();
  });

  it.each(['suggest_event', 'event_final_closing_vote'])(
    'disables automatic suggestion IDs in amendment mode %s',
    mode => {
      const entity = {
        id: 'document-1',
        collaborators: [],
        metadata: { amendmentId: 'amendment-1' },
      };
      const { result } = renderModel({ entity, mode });
      const assignment = mocks.useSuggestionIdAssignment.mock.calls.at(-1)?.[0];

      expect(assignment.enabled).toBe(false);
      expect(result.current.amendmentTitle).toBe('Title');
    }
  );
});
