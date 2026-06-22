import { describe, expect, it } from 'vitest';
import { normalizeDecisionVotingPhase } from '../decision-phase';

describe('normalizeDecisionVotingPhase', () => {
  it('normalizes indicative and indication statuses', () => {
    expect(normalizeDecisionVotingPhase('indicative')).toBe('indication');
    expect(normalizeDecisionVotingPhase('indication')).toBe('indication');
    expect(normalizeDecisionVotingPhase(null)).toBe('indication');
  });

  it('normalizes final and closed statuses', () => {
    expect(normalizeDecisionVotingPhase('final')).toBe('final');
    expect(normalizeDecisionVotingPhase('final')).toBe('final');
    expect(normalizeDecisionVotingPhase('closed')).toBe('closed');
    expect(normalizeDecisionVotingPhase('completed')).toBe('closed');
  });
});
