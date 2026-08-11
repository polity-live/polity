/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createVersion: vi.fn(),
  createChangeRequest: vi.fn(),
  createDocumentChangeRequest: vi.fn(),
  deleteChangeRequest: vi.fn(),
  finalizeVote: vi.fn(),
  updateChangeRequest: vi.fn(),
  voteOnChangeRequest: vi.fn(),
  versions: [] as { version_number?: number | null }[],
  language: 'en',
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  reportTutorial: vi.fn(),
  waitReject: false,
  serverReject: false,
  random: 0,
}));

vi.mock('@/zero/documents/useDocumentActions', () => ({
  useDocumentActions: () => ({ createVersion: mocks.createVersion }),
}));
vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({
    createChangeRequest: mocks.createChangeRequest,
    createDocumentChangeRequest: mocks.createDocumentChangeRequest,
    deleteChangeRequest: mocks.deleteChangeRequest,
    finalizeInternalChangeRequestVote: mocks.finalizeVote,
    updateChangeRequest: mocks.updateChangeRequest,
    voteOnChangeRequest: mocks.voteOnChangeRequest,
  }),
}));
vi.mock('@/zero/documents/useDocumentState', () => ({
  useDocumentState: () => ({ versions: mocks.versions }),
}));
vi.mock('@/features/shared/global-state/language.store', () => ({
  useLanguageStore: { getState: () => ({ language: mocks.language }) },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, values?: { crId?: string; timestamp?: string }) =>
    `${key}:${values?.crId ?? values?.timestamp ?? ''}`,
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));
vi.mock('@/features/change-requests/utils/suggestion-extraction', () => ({
  createChangeRequestDiffSnapshot: (id: string) => ({
    change_type: `type-${id}`,
    original_text: 'old',
    new_text: 'new',
    original_properties: { old: true },
    new_properties: { next: true },
    changed_character_count: 3,
  }),
}));
vi.mock('@/features/app-tutorial/events', () => ({
  reportAppTutorialAction: mocks.reportTutorial,
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  serverConfirmed: async (value: unknown) => {
    if (mocks.serverReject) throw new Error('server rejected');
    return value;
  },
  waitForClientApply: async (value: unknown) => {
    if (mocks.waitReject) throw new Error('client rejected');
    return value;
  },
  trackServerFinalization: (_value: unknown, options: { onSuccess: () => void }) =>
    options.onSuccess(),
}));

import { useEditorOperations } from '../useEditorOperations';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.versions = [];
  mocks.language = 'en';
  mocks.waitReject = false;
  mocks.serverReject = false;
  mocks.random = 0;
  vi.stubGlobal('crypto', {
    randomUUID: () => `uuid-${++mocks.random}`,
  });
  for (const fn of [
    mocks.createVersion,
    mocks.createChangeRequest,
    mocks.createDocumentChangeRequest,
    mocks.deleteChangeRequest,
    mocks.finalizeVote,
    mocks.updateChangeRequest,
  ]) {
    fn.mockResolvedValue(undefined);
  }
  mocks.voteOnChangeRequest.mockReturnValue({
    client: Promise.resolve(),
    server: Promise.resolve(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const discussion = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'suggestion-1',
    crId: 'CR-1',
    comments: [],
    createdAt: new Date(0),
    isResolved: false,
    userId: 'author',
    ...overrides,
  }) as never;

describe('useEditorOperations branch campaign A03', () => {
  it('uses German default titles, latest version fallbacks, and blog routing', async () => {
    mocks.language = 'de';
    mocks.versions = [{ version_number: null }, { version_number: 3 }];
    const { result } = renderHook(() => useEditorOperations('blog', 'blog-1'));
    await act(async () => {
      await result.current.handleSuggestionAccepted('user', [] as never, [], {});
      await result.current.handleSuggestionDeclined('user', [] as never, [], {});
    });
    expect(mocks.createVersion).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        version_number: 4,
        document_id: '',
        blog_id: 'blog-1',
        change_summary: expect.stringContaining('suggestionAccepted'),
      })
    );
    expect(mocks.createVersion).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ change_summary: expect.stringContaining('suggestionDeclined') })
    );
  });

  it('creates suggestions with explicit/default fields and reports persistence failure', async () => {
    const { result } = renderHook(() => useEditorOperations('amendment', 'document-1'));
    let created = false;
    await act(async () => {
      created = await result.current.handleSuggestionCreated({
        id: 'cr-1',
        crId: 'CR-1',
        discussionId: 'discussion-1',
        amendmentId: 'amendment-1',
        processBranchId: 'branch-1',
        changedCharacterCount: 7,
        change_type: 'replace',
        original_text: 'old',
        new_text: '__block__ new',
        original_properties: { level: 1 },
        new_properties: { level: 2 },
        status: 'pending',
        votingStatus: 'scheduled',
        documentContent: [] as never,
        discussions: [],
      });
    });
    expect(created).toBe(true);
    expect(mocks.createDocumentChangeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        process_branch_id: 'branch-1',
        discussion_id: 'discussion-1',
        change_type: 'replace',
        changed_character_count: 7,
        voting_status: 'scheduled',
      })
    );

    mocks.serverReject = true;
    await act(async () => {
      created = await result.current.handleSuggestionCreated({
        id: 'cr-2',
        crId: 'CR-2',
        amendmentId: 'amendment-1',
        documentContent: [] as never,
        discussions: [],
      });
    });
    expect(created).toBe(false);
    expect(mocks.createDocumentChangeRequest).toHaveBeenLastCalledWith(
      expect.objectContaining({
        process_branch_id: null,
        discussion_id: null,
        change_type: null,
        original_text: null,
        new_text: null,
        original_properties: null,
        new_properties: null,
        changed_character_count: 0,
        voting_status: 'open',
      })
    );
  });

  it('submits and discards pending suggestions with success, defaults, and failures', async () => {
    const { result } = renderHook(() => useEditorOperations('amendment', 'document-1'));
    await act(async () => {
      await expect(
        result.current.handlePendingSuggestionSubmitted({
          id: 'cr-1',
          changedCharacterCount: 4,
          change_type: 'replace',
          original_text: 'old',
          new_text: 'new',
          original_properties: { a: 1 },
          new_properties: { a: 2 },
        })
      ).resolves.toBe(true);
      await expect(result.current.handlePendingSuggestionSubmitted({ id: 'cr-2' })).resolves.toBe(
        true
      );
      await expect(result.current.handlePendingSuggestionDiscarded('cr-2')).resolves.toBe(true);
    });
    expect(mocks.updateChangeRequest).toHaveBeenLastCalledWith(
      expect.objectContaining({
        change_type: null,
        original_text: null,
        new_text: null,
        original_properties: null,
        new_properties: null,
        changed_character_count: 0,
      })
    );

    mocks.updateChangeRequest.mockRejectedValueOnce(new Error('update failed'));
    mocks.deleteChangeRequest.mockRejectedValueOnce(new Error('delete failed'));
    await act(async () => {
      await expect(result.current.handlePendingSuggestionSubmitted({ id: 'cr-3' })).resolves.toBe(
        false
      );
      await expect(result.current.handlePendingSuggestionDiscarded('cr-3')).resolves.toBe(false);
    });
  });

  it.each(['vote_internal', 'event_final_closing_vote'] as const)(
    'blocks acceptance and decline in %s',
    async editingMode => {
      const { result } = renderHook(() => useEditorOperations('amendment', 'document-1'));
      const discussions = [discussion()];
      await act(async () => {
        expect(
          await result.current.handleSuggestionAccepted(
            'user',
            [] as never,
            discussions,
            {},
            editingMode
          )
        ).toEqual({ updatedDiscussions: discussions });
        expect(
          await result.current.handleSuggestionDeclined(
            'user',
            [] as never,
            discussions,
            {},
            editingMode
          )
        ).toEqual({ updatedDiscussions: discussions });
      });
      expect(mocks.toastError).toHaveBeenCalledTimes(2);
      expect(mocks.createVersion).not.toHaveBeenCalled();
    }
  );

  it('accepts existing and new amendment change requests through both suggestion ids', async () => {
    const { result } = renderHook(() => useEditorOperations('amendment', 'document-1'));
    const existing = discussion({ changeRequestEntityId: 'persisted' });
    const other = discussion({ id: 'other', crId: '' });
    await act(async () => {
      const accepted = await result.current.handleSuggestionAccepted(
        'user',
        [] as never,
        [existing, other],
        { suggestionId: 'suggestion-1', crId: 'CR-1' },
        'edit',
        'amendment-1',
        'branch-1'
      );
      expect(accepted.updatedDiscussions[0].status).toBe('accepted');
      expect(accepted.updatedDiscussions[1].status).not.toBe('accepted');
    });
    expect(mocks.updateChangeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'persisted', status: 'accepted' })
    );

    const withoutEntity = discussion({ id: 'by-id', crId: '' });
    await act(async () => {
      const accepted = await result.current.handleSuggestionAccepted(
        'user',
        [] as never,
        [withoutEntity, other],
        { id: 'by-id' },
        'edit',
        'amendment-1',
        null
      );
      expect(accepted.updatedDiscussions[0].changeRequestEntityId).toBe('uuid-3');
    });
    expect(mocks.createDocumentChangeRequest).toHaveBeenLastCalledWith(
      expect.objectContaining({
        process_branch_id: null,
        title: expect.stringContaining('changeRequest'),
        status: 'accepted',
      })
    );
  });

  it('accepts without amendment persistence and returns original discussions on failure', async () => {
    const discussions = [discussion()];
    const { result } = renderHook(() => useEditorOperations('document', 'document-1'));
    await act(async () => {
      const accepted = await result.current.handleSuggestionAccepted(
        'user',
        [] as never,
        discussions,
        { suggestionId: 'missing' },
        'edit'
      );
      expect(accepted.updatedDiscussions).toEqual(discussions);
    });
    mocks.createVersion.mockRejectedValueOnce(new Error('version failed'));
    await act(async () => {
      expect(
        await result.current.handleSuggestionAccepted('user', [] as never, discussions, {}, 'edit')
      ).toEqual({ updatedDiscussions: discussions });
    });
    expect(mocks.toastError).toHaveBeenCalled();
  });

  it('declines existing, new, missing, and failing amendment suggestions', async () => {
    const { result } = renderHook(() => useEditorOperations('amendment', 'document-1'));
    const existing = discussion({ changeRequestEntityId: 'persisted' });
    await act(async () => {
      const declined = await result.current.handleSuggestionDeclined(
        'user',
        [] as never,
        [existing, discussion({ id: 'other' })],
        { suggestionId: 'suggestion-1', crId: 'CR-1' },
        'edit',
        'amendment-1',
        'branch-1'
      );
      expect(declined.updatedDiscussions[0].status).toBe('rejected');
    });
    expect(mocks.updateChangeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'persisted', status: 'rejected' })
    );

    await act(async () => {
      const declined = await result.current.handleSuggestionDeclined(
        'user',
        [] as never,
        [discussion({ id: 'by-id', crId: '' }), discussion({ id: 'other' })],
        { id: 'by-id' },
        'edit',
        'amendment-1',
        null
      );
      expect(declined.updatedDiscussions[0].changeRequestStatus).toBe('rejected');
      await result.current.handleSuggestionDeclined(
        'user',
        [] as never,
        [],
        { id: 'missing' },
        'edit',
        'amendment-1'
      );
    });

    mocks.createVersion.mockRejectedValueOnce(new Error('version failed'));
    await act(async () => {
      const failed = await result.current.handleSuggestionDeclined(
        'user',
        [] as never,
        [existing],
        {},
        'edit'
      );
      expect(failed.updatedDiscussions).toEqual([existing]);
    });
  });

  it('votes with existing and fallback change requests and reports errors', async () => {
    const { result } = renderHook(() => useEditorOperations('amendment', 'document-1'));
    await act(async () => {
      await result.current.handleVoteOnSuggestion(
        'amendment-1',
        'user',
        [],
        { id: 'missing' },
        'accept'
      );
    });
    expect(mocks.toastError).toHaveBeenCalled();

    await act(async () => {
      await result.current.handleVoteOnSuggestion(
        'amendment-1',
        'user',
        [discussion({ id: 'by-id', crId: '' })],
        { id: 'by-id' },
        'reject',
        null
      );
    });
    expect(mocks.createChangeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        process_branch_id: null,
        title: expect.stringContaining('changeRequest'),
      })
    );
    expect(mocks.voteOnChangeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ change_request_id: 'uuid-1', vote: 'reject' })
    );
    expect(mocks.reportTutorial).toHaveBeenCalled();

    mocks.waitReject = true;
    await act(async () => {
      await result.current.handleVoteOnSuggestion(
        'amendment-1',
        'user',
        [discussion({ changeRequestEntityId: 'persisted' })],
        { suggestionId: 'suggestion-1' },
        'abstain',
        'branch-1'
      );
    });
    expect(mocks.toastError).toHaveBeenCalled();
  });

  it('guards and finalizes internal votes', async () => {
    const { result } = renderHook(() => useEditorOperations('amendment', 'document-1'));
    await act(async () => {
      await result.current.handleFinalizeInternalVoteOnSuggestion([], { id: 'missing' });
      await result.current.handleFinalizeInternalVoteOnSuggestion(
        [discussion({ id: 'by-id', changeRequestEntityId: 'persisted' })],
        { id: 'by-id' }
      );
    });
    expect(mocks.toastError).toHaveBeenCalled();
    expect(mocks.finalizeVote).toHaveBeenCalledWith({ change_request_id: 'persisted' });
  });
});
