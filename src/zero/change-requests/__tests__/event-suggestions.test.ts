import { describe, expect, it, vi } from 'vitest';
import type { Value } from 'platejs';

import {
  discardPendingEventSuggestions,
  discardPendingEventSuggestionsFromState,
  isPendingUnconfirmedEventSuggestion,
} from '../event-suggestions';

function textContent(content: Value | null) {
  return JSON.stringify(content);
}

describe('discardPendingEventSuggestionsFromState', () => {
  it('removes pending event insertions and their discussion entries', () => {
    const content = [
      {
        type: 'p',
        children: [
          {
            text: 'Noch nicht eingereicht',
            suggestion: true,
            suggestion_insert: { id: 'discussion-pending', type: 'insert' },
          },
        ],
      },
    ] as Value;

    const result = discardPendingEventSuggestionsFromState({
      content,
      discussions: [
        {
          id: 'discussion-pending',
          confirmationStatus: 'pending',
        },
      ],
    });

    expect(result.removedCount).toBe(1);
    expect(result.discussions).toHaveLength(0);
    expect(textContent(result.content)).not.toContain('Noch nicht eingereicht');
  });

  it('rejects pending removals by keeping the original text without the suggestion mark', () => {
    const content = [
      {
        type: 'p',
        children: [
          {
            text: 'Soll bleiben',
            suggestion: true,
            suggestion_remove: { id: 'discussion-pending', type: 'remove' },
          },
        ],
      },
    ] as Value;

    const result = discardPendingEventSuggestionsFromState({
      content,
      discussions: [
        {
          id: 'discussion-pending',
          confirmationStatus: 'pending',
        },
      ],
    });

    expect(result.removedCount).toBe(1);
    expect(textContent(result.content)).toContain('Soll bleiben');
    expect(textContent(result.content)).not.toContain('suggestion_remove');
  });

  it('keeps confirmed and persisted change requests', () => {
    const content = [
      {
        type: 'p',
        children: [
          {
            text: 'Eingereicht',
            suggestion: true,
            suggestion_insert: { id: 'discussion-confirmed', type: 'insert' },
          },
        ],
      },
    ] as Value;

    const result = discardPendingEventSuggestionsFromState({
      content,
      discussions: [
        {
          id: 'discussion-confirmed',
          changeRequestEntityId: 'cr-row-1',
          confirmationStatus: 'confirmed',
        },
      ],
    });

    expect(result.changed).toBe(false);
    expect(result.removedCount).toBe(0);
    expect(result.discussions).toHaveLength(1);
    expect(textContent(result.content)).toContain('Eingereicht');
  });

  it('classifies only pending confirmations and preserves null content', () => {
    expect(isPendingUnconfirmedEventSuggestion({ id: 'pending', confirmationStatus: 'pending' })).toBe(
      true
    );
    expect(isPendingUnconfirmedEventSuggestion({ id: 'confirmed', confirmationStatus: 'confirmed' })).toBe(
      false
    );
    expect(
      discardPendingEventSuggestionsFromState({
        content: undefined,
        discussions: [{ id: 'pending', confirmationStatus: 'pending', changeRequestEntityId: null }],
      })
    ).toMatchObject({ changed: true, removedCount: 1, content: null, discussions: [] });
  });

  function txWithRuns(...values: unknown[]) {
    const run = vi.fn();
    for (const value of values) run.mockResolvedValueOnce(value);
    return {
      run,
      mutate: {
        change_request: { delete: vi.fn() },
        document_version: { insert: vi.fn() },
        document: { update: vi.fn() },
        amendment_process_branch: { update: vi.fn() },
        amendment: { update: vi.fn() },
      },
    };
  }

  it('does nothing without an amendment, a stored amendment, or discussions', async () => {
    await expect(
      discardPendingEventSuggestions({
        tx: txWithRuns() as never,
        ctx: { userID: 'user' },
        amendmentId: null,
      })
    ).resolves.toEqual({ removedCount: 0 });
    await expect(
      discardPendingEventSuggestions({
        tx: txWithRuns(null) as never,
        ctx: { userID: 'user' },
        amendmentId: 'missing',
      })
    ).resolves.toEqual({ removedCount: 0 });
    await expect(
      discardPendingEventSuggestions({
        tx: txWithRuns({ id: 'amendment', discussions: null }) as never,
        ctx: { userID: 'user' },
        amendmentId: 'amendment',
      })
    ).resolves.toEqual({ removedCount: 0 });
  });

  it('does nothing when stored discussions have no pending suggestions', async () => {
    const tx = txWithRuns({
      id: 'amendment',
      document_id: null,
      discussions: [{ id: 'confirmed', confirmationStatus: 'confirmed' }],
    });
    await expect(
      discardPendingEventSuggestions({
        tx: tx as never,
        ctx: { userID: 'user' },
        amendmentId: 'amendment',
      })
    ).resolves.toEqual({ removedCount: 0 });
    expect(tx.mutate.amendment.update).not.toHaveBeenCalled();
  });

  it('deletes pending change requests and updates amendment discussions without a document', async () => {
    const tx = txWithRuns({
      id: 'amendment',
      document_id: null,
      discussions: [
        {
          id: 'pending',
          confirmationStatus: 'pending',
          changeRequestEntityId: 'change-request',
        },
      ],
    });
    await expect(
      discardPendingEventSuggestions({
        tx: tx as never,
        ctx: { userID: 'user' },
        amendmentId: 'amendment',
        now: 123,
      })
    ).resolves.toEqual({ removedCount: 1 });
    expect(tx.mutate.change_request.delete).toHaveBeenCalledWith({ id: 'change-request' });
    expect(tx.mutate.amendment.update).toHaveBeenCalledWith({
      id: 'amendment',
      discussions: [],
      updated_at: 123,
    });
  });

  it('versions and updates a branch document with default and existing version numbers', async () => {
    const pendingContent = [
      {
        type: 'p',
        children: [
          {
            text: 'Pending',
            suggestion: true,
            suggestion_insert: { id: 'pending', type: 'insert' },
          },
        ],
      },
    ] as Value;

    for (const latestVersion of [null, { version_number: 4 }]) {
      const tx = txWithRuns(
        { id: 'amendment', document_id: 'amendment-document', discussions: [] },
        {
          id: 'branch',
          document_id: 'branch-document',
          discussions: [{ id: 'pending', confirmationStatus: 'pending' }],
        },
        { id: 'branch-document', content: pendingContent },
        latestVersion
      );
      await expect(
        discardPendingEventSuggestions({
          tx: tx as never,
          ctx: { userID: 'user' },
          amendmentId: 'amendment',
          processBranchId: 'branch',
          now: 456,
        })
      ).resolves.toEqual({ removedCount: 1 });
      expect(tx.mutate.document_version.insert).toHaveBeenCalledWith(
        expect.objectContaining({ version_number: latestVersion ? 5 : 1, created_at: 456 })
      );
      expect(tx.mutate.document.update).toHaveBeenCalled();
      expect(tx.mutate.amendment_process_branch.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'branch', discussions: [] })
      );
      expect(tx.mutate.amendment.update).not.toHaveBeenCalled();
    }
  });
});
