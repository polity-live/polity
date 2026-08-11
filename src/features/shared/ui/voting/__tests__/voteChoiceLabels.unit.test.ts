import { describe, expect, it, vi } from 'vitest';

import { getCanonicalVoteChoice, getLocalizedVoteChoiceLabel } from '../voteChoiceLabels';

describe('voteChoiceLabels', () => {
  it('canonicalizes known labels and rejects empty or unknown labels', () => {
    expect(getCanonicalVoteChoice(' YES ')).toBe('yes');
    expect(getCanonicalVoteChoice('Nein')).toBe('no');
    expect(getCanonicalVoteChoice('Enthaltung')).toBe('abstain');
    expect(getCanonicalVoteChoice('maybe')).toBeUndefined();
    expect(getCanonicalVoteChoice(null)).toBeUndefined();
  });

  it('localizes known labels and preserves custom labels', () => {
    const translate = vi.fn((key: string, fallback?: string) => `${key}:${fallback}`);
    expect(getLocalizedVoteChoiceLabel(' approve ', translate)).toContain(':Yes');
    expect(getLocalizedVoteChoiceLabel('Custom', translate)).toBe('Custom');
  });

  it('uses explicit and translated fallbacks for empty labels', () => {
    const translate = vi.fn((_key: string, fallback?: string) => fallback ?? 'translated');
    expect(getLocalizedVoteChoiceLabel(' ', translate, 'Missing')).toBe('Missing');
    expect(getLocalizedVoteChoiceLabel(undefined, translate)).toBe('Choice');
  });
});
