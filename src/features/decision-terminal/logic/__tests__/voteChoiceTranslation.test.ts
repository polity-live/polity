import { beforeEach, describe, expect, it, vi } from 'vitest';

import { translateVoteChoiceLabel } from '../voteChoiceTranslation';

const mocks = vi.hoisted(() => ({
  translate: vi.fn((key: string, values?: object) =>
    values ? `${key}:${JSON.stringify(values)}` : key
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, values?: object) => mocks.translate(key, values),
}));

describe('translateVoteChoiceLabel', () => {
  beforeEach(() => {
    mocks.translate.mockClear();
  });

  it.each(['support', 'accept', 'SUPPORT'])('translates semantic support key %s', semanticKey => {
    expect(
      translateVoteChoiceLabel({ id: 'choice', semantic_key: semanticKey, label: 'ignored' }, 0)
    ).toBe('features.timeline.terminal.support');
  });

  it.each(['oppose', 'reject', 'REJECT'])('translates semantic opposition key %s', semanticKey => {
    expect(translateVoteChoiceLabel({ id: 'choice', semantic_key: semanticKey }, 0)).toBe(
      'features.timeline.terminal.oppose'
    );
  });

  it('translates a semantic abstention', () => {
    expect(translateVoteChoiceLabel({ id: 'choice', semantic_key: 'ABSTAIN' }, 0)).toBe(
      'features.timeline.terminal.abstain'
    );
  });

  it.each(['support', 'accept', 'in favor'])('translates support label %s', label => {
    expect(translateVoteChoiceLabel({ id: 'choice', semantic_key: 'custom', label }, 0)).toBe(
      'features.timeline.terminal.support'
    );
  });

  it.each(['oppose', 'reject', 'against'])('translates opposition label %s', label => {
    expect(translateVoteChoiceLabel({ id: 'choice', label }, 0)).toBe(
      'features.timeline.terminal.oppose'
    );
  });

  it.each(['abstain', 'abstention'])('translates abstention label %s', label => {
    expect(translateVoteChoiceLabel({ id: 'choice', label }, 0)).toBe(
      'features.timeline.terminal.abstain'
    );
  });

  it('keeps a custom label unchanged', () => {
    expect(translateVoteChoiceLabel({ id: 'choice', label: 'Custom Choice' }, 0)).toBe(
      'Custom Choice'
    );
    expect(mocks.translate).not.toHaveBeenCalled();
  });

  it('uses the one-based choice position as the final fallback', () => {
    expect(translateVoteChoiceLabel({ id: 'choice' }, 2)).toBe(
      'features.timeline.terminal.choiceFallback:{"number":3}'
    );
    expect(mocks.translate).toHaveBeenCalledWith('features.timeline.terminal.choiceFallback', {
      number: 3,
    });
  });
});
