/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useEditorOperations } from '../useEditorOperations';

const mocks = vi.hoisted(() => ({
  createDocumentChangeRequest: vi.fn(),
  createVersion: vi.fn(),
  finalizeInternalChangeRequestVote: vi.fn(),
  reportAppTutorialAction: vi.fn(),
  voteOnChangeRequest: vi.fn(),
}));

vi.mock('@/features/app-tutorial/events', () => ({
  reportAppTutorialAction: mocks.reportAppTutorialAction,
}));

vi.mock('@/zero/documents/useDocumentActions', () => ({
  useDocumentActions: () => ({
    createVersion: mocks.createVersion,
  }),
}));

vi.mock('@/zero/documents/useDocumentState', () => ({
  useDocumentState: () => ({
    versions: [],
  }),
}));

vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({
    createChangeRequest: vi.fn(),
    createDocumentChangeRequest: mocks.createDocumentChangeRequest,
    deleteChangeRequest: vi.fn(),
    finalizeInternalChangeRequestVote: mocks.finalizeInternalChangeRequestVote,
    updateChangeRequest: vi.fn(),
    voteOnChangeRequest: mocks.voteOnChangeRequest,
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('useEditorOperations', () => {
  it.each([
    ['accepted', 'handleSuggestionAccepted'],
    ['declined', 'handleSuggestionDeclined'],
  ] as const)('creates a default-titled version when a suggestion is %s', async (_, handler) => {
    const { result } = renderHook(() => useEditorOperations('amendment', 'document-1'));

    await act(async () => {
      await result.current[handler]('user-1', [] as any, [], {});
    });

    expect(mocks.createVersion).toHaveBeenCalledWith({
      id: expect.any(String),
      content: [],
      version_number: 1,
      change_summary: expect.any(String),
      document_id: 'document-1',
      amendment_id: null,
      blog_id: null,
    });
  });

  it.each([
    ['accepted', 'handleSuggestionAccepted', 'CR-7'],
    ['declined', 'handleSuggestionDeclined', 'CR-8'],
  ] as const)('creates a CR-titled version when a suggestion is %s', async (_, handler, crId) => {
    const { result } = renderHook(() => useEditorOperations('amendment', 'document-1'));

    await act(async () => {
      await result.current[handler]('user-1', [] as any, [], { crId });
    });

    expect(mocks.createVersion).toHaveBeenLastCalledWith(
      expect.objectContaining({ change_summary: expect.stringContaining(crId) })
    );
  });

  it('reports a normally created text suggestion to the tutorial', async () => {
    mocks.createDocumentChangeRequest.mockReturnValue({
      client: Promise.resolve(),
      server: Promise.resolve({ type: 'success' }),
    });
    const { result } = renderHook(() => useEditorOperations('amendment', 'document-1'));

    await act(async () => {
      await result.current.handleSuggestionCreated({
        id: 'change-request-1',
        crId: 'CR-3',
        discussionId: 'discussion-1',
        amendmentId: 'amendment-1',
        new_text: 'Am Knotenpunkt wird eine barrierefreie, schattige Querung ergänzt.',
        documentContent: [
          {
            type: 'p',
            children: [
              {
                text: 'Ergänzung',
                suggestion: true,
                suggestion_discussion: { id: 'discussion-1', type: 'insert' },
              },
            ],
          },
        ] as any,
        discussions: [
          {
            id: 'discussion-1',
            comments: [],
            createdAt: new Date(),
            isResolved: false,
            userId: 'author-1',
          },
        ],
      });
    });

    expect(mocks.createDocumentChangeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'change-request-1',
        title: 'CR-3',
        discussion_id: 'discussion-1',
        amendment_id: 'amendment-1',
      })
    );
    expect(mocks.reportAppTutorialAction).toHaveBeenCalledWith({
      type: 'action',
      event: 'change-request.created',
      value: 'Am Knotenpunkt wird eine barrierefreie, schattige Querung ergänzt.',
    });
  });

  it('removes persisted block markers from tutorial evidence', async () => {
    mocks.createDocumentChangeRequest.mockReturnValue({
      client: Promise.resolve(),
      server: Promise.resolve({ type: 'success' }),
    });
    const { result } = renderHook(() => useEditorOperations('amendment', 'document-1'));

    await act(async () => {
      await result.current.handleSuggestionCreated({
        id: 'change-request-1',
        crId: 'CR-3',
        amendmentId: 'amendment-1',
        new_text: '__block__An accessible, shaded crossing is added at the intersection.',
        documentContent: [] as any,
        discussions: [],
      });
    });

    expect(mocks.reportAppTutorialAction).toHaveBeenCalledWith({
      type: 'action',
      event: 'change-request.created',
      value: 'An accessible, shaded crossing is added at the intersection.',
    });
  });

  it('reports empty tutorial evidence when a non-text suggestion is created', async () => {
    mocks.createDocumentChangeRequest.mockReturnValue({
      client: Promise.resolve(),
      server: Promise.resolve({ type: 'success' }),
    });
    const { result } = renderHook(() => useEditorOperations('amendment', 'document-1'));

    await act(async () => {
      await result.current.handleSuggestionCreated({
        id: 'change-request-1',
        crId: 'CR-4',
        amendmentId: 'amendment-1',
        documentContent: [] as any,
        discussions: [],
      });
    });

    expect(mocks.reportAppTutorialAction).toHaveBeenCalledWith({
      type: 'action',
      event: 'change-request.created',
      value: '',
    });
  });

  it('does not report success when atomic suggestion persistence is rejected', async () => {
    mocks.createDocumentChangeRequest.mockReturnValue({
      client: Promise.resolve(),
      server: Promise.resolve({
        type: 'error',
        error: { type: 'app', message: 'linked suggestion is not present' },
      }),
    });
    const { result } = renderHook(() => useEditorOperations('amendment', 'document-1'));

    let created = true;
    await act(async () => {
      created = await result.current.handleSuggestionCreated({
        id: 'change-request-1',
        crId: 'CR-1',
        discussionId: 'suggestion-1',
        amendmentId: 'amendment-1',
        documentContent: [{ type: 'p', children: [{ text: 'Entwurf' }] }] as any,
        discussions: [
          {
            id: 'suggestion-1',
            comments: [],
            createdAt: new Date(),
            isResolved: false,
            userId: 'author-1',
          },
        ],
      });
    });

    expect(created).toBe(false);
    expect(mocks.reportAppTutorialAction).not.toHaveBeenCalled();
  });

  it('reports an accepted change request vote from the text editor', async () => {
    mocks.voteOnChangeRequest.mockReturnValue({
      client: Promise.resolve(),
      server: Promise.resolve({ type: 'success' }),
    });
    const { result } = renderHook(() => useEditorOperations('amendment', 'document-1'));

    await act(async () => {
      await result.current.handleVoteOnSuggestion(
        'amendment-1',
        'user-1',
        [
          {
            id: 'suggestion-1',
            comments: [],
            createdAt: new Date(),
            isResolved: false,
            userId: 'author-1',
            changeRequestEntityId: 'change-request-1',
          },
        ],
        { suggestionId: 'suggestion-1' },
        'accept'
      );
      await Promise.resolve();
    });

    expect(mocks.voteOnChangeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        change_request_id: 'change-request-1',
        vote: 'accept',
      })
    );
    expect(mocks.reportAppTutorialAction).toHaveBeenCalledWith({
      type: 'mutation',
      event: 'change-request.voted',
    });
  });

  it('finalizes an internal vote for the persisted change request', async () => {
    const { result } = renderHook(() => useEditorOperations('amendment', 'document-1'));

    await act(async () => {
      await result.current.handleFinalizeInternalVoteOnSuggestion(
        [{ id: 'suggestion-1', changeRequestEntityId: 'change-request-1' }] as any,
        { suggestionId: 'suggestion-1' }
      );
    });

    expect(mocks.finalizeInternalChangeRequestVote).toHaveBeenCalledWith({
      change_request_id: 'change-request-1',
    });
  });
});
