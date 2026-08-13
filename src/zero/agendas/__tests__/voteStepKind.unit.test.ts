import { describe, expect, it } from 'vitest';
import { isClosingVoteTimelineItem } from '../vote-step-kind';

describe('isClosingVoteTimelineItem', () => {
  it('recognizes each canonical closing marker and rejects other or missing items', () => {
    expect(isClosingVoteTimelineItem({ is_closing_vote: true })).toBe(true);
    expect(isClosingVoteTimelineItem({ is_closing_vote: false, step_kind: 'closing' })).toBe(true);
    expect(
      isClosingVoteTimelineItem({
        is_closing_vote: false,
        step_kind: 'change_request',
        _voteStepKind: 'closing',
      })
    ).toBe(true);
    expect(isClosingVoteTimelineItem({ step_kind: 'change_request' })).toBe(false);
    expect(isClosingVoteTimelineItem(null)).toBe(false);
  });
});
