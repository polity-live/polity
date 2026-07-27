/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TDiscussion } from '@/features/shared/ui/kit-platejs/discussion-kit';
import { useSuggestionIdAssignment } from '../use-suggestion-id-assignment';

const baseDiscussion: TDiscussion = {
  id: 'suggestion-1',
  comments: [],
  createdAt: new Date(1),
  isResolved: false,
  userId: 'user-1',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useSuggestionIdAssignment', () => {
  it('creates pending change requests for event suggestions', async () => {
    const onDiscussionsUpdate = vi.fn();
    const onChangeRequestCreate = vi.fn();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('22222222-2222-4222-8222-222222222222');

    renderHook(() =>
      useSuggestionIdAssignment({
        confirmationMode: 'event_suggestion',
        documentId: 'document-1',
        discussions: [baseDiscussion],
        onDiscussionsUpdate,
        onChangeRequestCreate,
      })
    );

    await waitFor(() => expect(onDiscussionsUpdate).toHaveBeenCalledTimes(1));
    expect(onDiscussionsUpdate).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'suggestion-1',
        crId: 'CR-1',
        confirmationStatus: 'pending',
        changeRequestEntityId: '22222222-2222-4222-8222-222222222222',
        changeRequestStatus: 'pending_submission',
      }),
    ]);
    expect(onChangeRequestCreate).toHaveBeenCalledWith({
      crId: 'CR-1',
      discussionId: 'suggestion-1',
      changeRequestEntityId: '22222222-2222-4222-8222-222222222222',
      status: 'pending_submission',
      votingStatus: 'pending_submission',
      discussions: [
        expect.objectContaining({
          id: 'suggestion-1',
          changeRequestEntityId: '22222222-2222-4222-8222-222222222222',
        }),
      ],
    });
    expect(onDiscussionsUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      onChangeRequestCreate.mock.invocationCallOrder[0]
    );
  });

  it('keeps internal suggestions auto-created as before', async () => {
    const onDiscussionsUpdate = vi.fn();
    const onChangeRequestCreate = vi.fn();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');

    renderHook(() =>
      useSuggestionIdAssignment({
        documentId: 'document-1',
        discussions: [{ ...baseDiscussion, crId: 'CR-1' }],
        onDiscussionsUpdate,
        onChangeRequestCreate,
      })
    );

    await waitFor(() => expect(onChangeRequestCreate).toHaveBeenCalledTimes(1));
    expect(onChangeRequestCreate).toHaveBeenCalledWith({
      crId: 'CR-1',
      discussionId: 'suggestion-1',
      changeRequestEntityId: '11111111-1111-4111-8111-111111111111',
      status: 'open',
      votingStatus: 'open',
      discussions: [
        expect.objectContaining({
          id: 'suggestion-1',
          changeRequestEntityId: '11111111-1111-4111-8111-111111111111',
        }),
      ],
    });
    expect(onDiscussionsUpdate).not.toHaveBeenCalled();
  });

  it('keeps a rejected change request creation retryable', async () => {
    const onDiscussionsUpdate = vi.fn();
    const onChangeRequestCreate = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('33333333-3333-4333-8333-333333333333');

    const { result } = renderHook(() =>
      useSuggestionIdAssignment({
        documentId: 'document-1',
        discussions: [{ ...baseDiscussion, crId: 'CR-1' }],
        onDiscussionsUpdate,
        onChangeRequestCreate,
      })
    );

    await waitFor(() => expect(onChangeRequestCreate).toHaveBeenCalledTimes(1));
    await act(async () => {
      await result.current.assignMissingIds();
    });
    expect(onChangeRequestCreate).toHaveBeenCalledTimes(2);
    expect(onDiscussionsUpdate).not.toHaveBeenCalled();
  });
});
