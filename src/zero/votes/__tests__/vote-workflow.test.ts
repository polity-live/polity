import { describe, expect, it } from 'vitest';
import {
  VOTE_PHASE,
  VOTE_PURPOSE,
  isFinalVotePhase,
  isClosedVotePhase,
  isIndicativeVotePhase,
  isInternalVotePhase,
  normalizeVotePhase,
} from '../vote-workflow';

describe('vote workflow semantics', () => {
  it('treats internal as its own canonical vote phase', () => {
    expect(normalizeVotePhase('internal')).toBe(VOTE_PHASE.internal);
    expect(isInternalVotePhase('internal')).toBe(true);
    expect(isIndicativeVotePhase('internal')).toBe(false);
    expect(isFinalVotePhase('internal')).toBe(false);
  });

  it('keeps final change-request votes distinct from closing votes', () => {
    expect(VOTE_PURPOSE.changeRequest).toBe('change_request');
    expect(VOTE_PURPOSE.closing).toBe('closing');
    expect(VOTE_PURPOSE.mergeVariant).toBe('merge_variant');
    expect(isFinalVotePhase(VOTE_PHASE.final)).toBe(true);
    expect(normalizeVotePhase(VOTE_PHASE.closed)).toBe(VOTE_PHASE.closed);
    expect(isClosedVotePhase(VOTE_PHASE.closed)).toBe(true);
    expect(() => normalizeVotePhase('legacy')).toThrow('Unknown vote phase: legacy');
  });
});
