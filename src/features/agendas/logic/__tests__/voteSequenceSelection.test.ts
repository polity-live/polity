import { describe, expect, it } from 'vitest';

import {
  resolveCurrentVoteSequenceItem,
  resolveNextStartableVoteSequenceItem,
  resolvePreferredReorderedVoteSequenceItem,
  resolveVoteSequenceSelectionUpdate,
} from '../voteSequenceSelection';

describe('resolveCurrentVoteSequenceItem', () => {
  it('prioritizes the final-open vote step over the timeline current item', () => {
    const result = resolveCurrentVoteSequenceItem({
      currentItemId: 'cr-current',
      sequenceItems: [
        { id: 'cr-current', status: 'voting', vote: { id: 'vote-current', status: 'closed' } },
        { id: 'final-open', status: 'pending', vote: { id: 'vote-final', status: 'final' } },
      ],
    });

    expect(result?.id).toBe('final-open');
  });

  it('falls back to the current item and then the first unfinished item', () => {
    expect(
      resolveCurrentVoteSequenceItem({
        currentItemId: 'cr-current',
        sequenceItems: [
          {
            id: 'cr-current',
            status: 'voting',
            vote: { id: 'vote-current', status: 'indicative' },
          },
          { id: 'next', status: 'pending', vote: { id: 'vote-next', status: null } },
        ],
      })?.id
    ).toBe('cr-current');

    expect(
      resolveCurrentVoteSequenceItem({
        currentItemId: null,
        sequenceItems: [
          {
            id: 'completed',
            status: 'completed',
            vote: { id: 'vote-completed', status: 'closed' },
          },
          { id: 'next', status: 'pending', vote: { id: 'vote-next', status: null } },
        ],
      })?.id
    ).toBe('next');
  });
});

describe('resolveVoteSequenceSelectionUpdate', () => {
  const sequenceItems = [
    { id: 'cr-3', status: 'voting' },
    { id: 'final-amendment', status: 'voting' },
  ];

  it('initializes to the fallback item when nothing is selected', () => {
    expect(
      resolveVoteSequenceSelectionUpdate({
        selectedItemId: null,
        sequenceItems,
        fallbackItemId: 'cr-3',
        currentItemId: 'cr-3',
      })
    ).toBe('cr-3');
  });

  it('keeps an explicit non-current selection while the row still exists', () => {
    expect(
      resolveVoteSequenceSelectionUpdate({
        selectedItemId: 'final-amendment',
        sequenceItems,
        fallbackItemId: 'cr-3',
        currentItemId: 'cr-3',
      })
    ).toBeUndefined();
  });

  it('realigns to the current item when the sequence was reordered under the active selection', () => {
    expect(
      resolveVoteSequenceSelectionUpdate({
        selectedItemId: 'cr-15',
        sequenceItems: [
          { id: 'cr-17', status: 'pending' },
          { id: 'cr-15', status: 'pending' },
        ],
        fallbackItemId: 'cr-17',
        currentItemId: 'cr-17',
        preferSequenceItem: true,
      })
    ).toBe('cr-17');
  });

  it('realigns to the preferred reordered item even when another item is currently indicative', () => {
    expect(
      resolveVoteSequenceSelectionUpdate({
        selectedItemId: 'cr-15',
        sequenceItems: [
          { id: 'cr-17', status: 'pending' },
          { id: 'cr-15', status: 'voting' },
        ],
        fallbackItemId: 'cr-15',
        currentItemId: 'cr-15',
        preferredItemId: 'cr-17',
        preferSequenceItem: true,
      })
    ).toBe('cr-17');
  });

  it('advances from a completed selected item to the current item', () => {
    expect(
      resolveVoteSequenceSelectionUpdate({
        selectedItemId: 'cr-3',
        sequenceItems: [
          { id: 'cr-3', status: 'completed' },
          { id: 'final-amendment', status: 'voting' },
        ],
        fallbackItemId: 'final-amendment',
        currentItemId: 'final-amendment',
      })
    ).toBe('final-amendment');
  });

  it('falls back when the selected item is no longer in the sequence', () => {
    expect(
      resolveVoteSequenceSelectionUpdate({
        selectedItemId: 'removed-item',
        sequenceItems,
        fallbackItemId: 'cr-3',
        currentItemId: 'cr-3',
      })
    ).toBe('cr-3');
  });
});

describe('resolvePreferredReorderedVoteSequenceItem', () => {
  it('prefers the first startable item in the reordered sequence before an indicative current item', () => {
    expect(
      resolvePreferredReorderedVoteSequenceItem({
        sequenceItems: [
          { id: 'cr-17', status: 'pending', vote: { id: 'vote-17', status: 'indicative' } },
          { id: 'cr-15', status: 'voting', vote: { id: 'vote-15', status: 'indicative' } },
        ],
      })?.id
    ).toBe('cr-17');
  });

  it('keeps an already final vote ahead of reordered pending items', () => {
    expect(
      resolvePreferredReorderedVoteSequenceItem({
        sequenceItems: [
          { id: 'cr-17', status: 'pending', vote: { id: 'vote-17', status: 'indicative' } },
          { id: 'cr-15', status: 'voting', vote: { id: 'vote-15', status: 'final' } },
        ],
      })?.id
    ).toBe('cr-15');
  });
});

describe('resolveNextStartableVoteSequenceItem', () => {
  it('skips pending-submission rows', () => {
    const result = resolveNextStartableVoteSequenceItem({
      selectedItemId: 'selected',
      sequenceItems: [
        { id: 'selected', status: 'completed', vote: { id: 'vote-selected', status: 'closed' } },
        {
          id: 'pending-submission',
          status: 'pending',
          vote: { id: 'vote-pending-submission', status: 'indicative' },
          change_request: { status: 'pending_submission' },
        },
        { id: 'next', status: 'pending', vote: { id: 'vote-next', status: 'indicative' } },
      ],
    });

    expect(result?.id).toBe('next');
  });

  it('skips completed and closed rows', () => {
    const result = resolveNextStartableVoteSequenceItem({
      selectedItemId: 'selected',
      sequenceItems: [
        { id: 'selected', status: 'completed', vote: { id: 'vote-selected', status: 'closed' } },
        { id: 'completed', status: 'completed', vote: { id: 'vote-completed', status: 'closed' } },
        { id: 'closed', status: 'pending', vote: { id: 'vote-closed', status: 'closed' } },
        { id: 'next', status: 'pending', vote: { id: 'vote-next', status: 'indicative' } },
      ],
    });

    expect(result?.id).toBe('next');
  });

  it('finds the next indication row after a locked selected row', () => {
    const result = resolveNextStartableVoteSequenceItem({
      selectedItemId: 'locked',
      sequenceItems: [
        { id: 'locked', status: 'pending', _votePlaceholder: true },
        { id: 'next', status: 'voting', vote: { id: 'vote-next', status: 'indicative' } },
      ],
    });

    expect(result?.id).toBe('next');
  });

  it('returns null when no startable step exists', () => {
    expect(
      resolveNextStartableVoteSequenceItem({
        selectedItemId: 'selected',
        sequenceItems: [
          { id: 'selected', status: 'completed', vote: { id: 'vote-selected', status: 'closed' } },
          { id: 'final-open', status: 'pending', vote: { id: 'vote-final', status: 'final' } },
        ],
      })
    ).toBeNull();
  });

  it('does not suggest a jump when the selected row is already startable', () => {
    expect(
      resolveNextStartableVoteSequenceItem({
        selectedItemId: 'selected',
        sequenceItems: [
          {
            id: 'selected',
            status: 'pending',
            vote: { id: 'vote-selected', status: 'indicative' },
          },
          { id: 'next', status: 'pending', vote: { id: 'vote-next', status: 'indicative' } },
        ],
      })
    ).toBeNull();
  });
});
