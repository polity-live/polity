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

  it('returns early when disabled, missing a document, or given no discussions', async () => {
    const onDiscussionsUpdate = vi.fn();
    const onChangeRequestCreate = vi.fn();
    const { result, rerender } = renderHook(
      (props: { enabled: boolean; documentId: string; discussions: TDiscussion[] }) =>
        useSuggestionIdAssignment({
          ...props,
          onDiscussionsUpdate,
          onChangeRequestCreate,
        }),
      {
        initialProps: {
          enabled: false,
          documentId: 'document-1',
          discussions: [baseDiscussion],
        },
      }
    );

    await act(async () => result.current.assignMissingIds());
    rerender({ enabled: true, documentId: '', discussions: [baseDiscussion] });
    await act(async () => result.current.assignMissingIds());
    rerender({ enabled: true, documentId: 'document-1', discussions: [] });
    await act(async () => result.current.assignMissingIds());

    expect(onDiscussionsUpdate).not.toHaveBeenCalled();
    expect(onChangeRequestCreate).not.toHaveBeenCalled();
  });

  it('assigns missing internal IDs chronologically without an entity callback', async () => {
    const onDiscussionsUpdate = vi.fn();
    const later = { ...baseDiscussion, id: 'later', createdAt: new Date(2) };
    const earlier = { ...baseDiscussion, id: 'earlier', createdAt: new Date(1) };
    const { result } = renderHook(() =>
      useSuggestionIdAssignment({
        documentId: 'document-1',
        discussions: [later, earlier],
        onDiscussionsUpdate,
      })
    );

    await waitFor(() => expect(onDiscussionsUpdate).toHaveBeenCalledOnce());
    expect(onDiscussionsUpdate).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'later', crId: 'CR-2' }),
      expect.objectContaining({ id: 'earlier', crId: 'CR-1' }),
    ]);

    await act(async () => result.current.assignMissingIds());
    expect(onDiscussionsUpdate).toHaveBeenCalledOnce();
  });

  it('normalizes event confirmation state and preserves already normalized discussions', async () => {
    const onDiscussionsUpdate = vi.fn();
    const onChangeRequestCreate = vi.fn();
    const { rerender } = renderHook(
      ({ discussion }: { discussion: TDiscussion }) =>
        useSuggestionIdAssignment({
          confirmationMode: 'event_suggestion',
          documentId: 'document-1',
          discussions: [discussion],
          onDiscussionsUpdate,
          onChangeRequestCreate,
        }),
      {
        initialProps: {
          discussion: {
            ...baseDiscussion,
            crId: 'CR-1',
            changeRequestEntityId: 'entity-1',
          },
        },
      }
    );

    await waitFor(() => expect(onDiscussionsUpdate).toHaveBeenCalledOnce());
    expect(onDiscussionsUpdate).toHaveBeenCalledWith([
      expect.objectContaining({
        confirmationStatus: 'pending',
        changeRequestStatus: 'pending_submission',
      }),
    ]);

    onDiscussionsUpdate.mockClear();
    rerender({
      discussion: {
        ...baseDiscussion,
        crId: 'CR-1',
        changeRequestEntityId: 'entity-1',
        confirmationStatus: 'pending',
        changeRequestStatus: 'pending_submission',
      },
    });
    await act(async () => Promise.resolve());
    expect(onDiscussionsUpdate).not.toHaveBeenCalled();
    expect(onChangeRequestCreate).not.toHaveBeenCalled();
  });
});
