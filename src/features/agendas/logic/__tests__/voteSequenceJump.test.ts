import { describe, expect, it } from 'vitest';

import { resolveClosingJumpTarget } from '../voteSequenceJump';

describe('resolveClosingJumpTarget', () => {
  it('selects an existing final vote item without initialization', () => {
    const result = resolveClosingJumpTarget({
      item: {
        id: 'placeholder-crs',
        _votePlaceholder: true,
        _voteStepKind: 'change_request_votes_placeholder',
      },
      nonFinalItemCount: 0,
      sequenceItems: [
        {
          id: 'placeholder-crs',
          _votePlaceholder: true,
          _voteStepKind: 'change_request_votes_placeholder',
        },
        {
          id: 'final-vote-item',
          is_closing_vote: true,
          vote: { id: 'vote-final' },
          _voteStepKind: 'closing',
        },
      ],
    });

    expect(result).toEqual({
      isClosingJump: true,
      shouldInitialize: false,
      targetItemId: 'final-vote-item',
    });
  });

  it('initializes the sequence and selects the final placeholder when no final vote exists', () => {
    const result = resolveClosingJumpTarget({
      item: {
        id: 'placeholder-crs',
        _votePlaceholder: true,
        _voteStepKind: 'change_request_votes_placeholder',
      },
      nonFinalItemCount: 0,
      sequenceItems: [
        {
          id: 'placeholder-crs',
          _votePlaceholder: true,
          _voteStepKind: 'change_request_votes_placeholder',
        },
        {
          id: 'placeholder-final',
          _votePlaceholder: true,
          _voteStepKind: 'closing_placeholder',
        },
      ],
    });

    expect(result).toEqual({
      isClosingJump: true,
      shouldInitialize: true,
      targetItemId: 'placeholder-final',
    });
  });

  it('does not treat the placeholder as a closing jump while CR steps exist', () => {
    const result = resolveClosingJumpTarget({
      item: {
        id: 'placeholder-crs',
        _votePlaceholder: true,
        _voteStepKind: 'change_request_votes_placeholder',
      },
      nonFinalItemCount: 1,
      sequenceItems: [],
    });

    expect(result).toEqual({
      isClosingJump: false,
      shouldInitialize: false,
      targetItemId: null,
    });
  });
});
