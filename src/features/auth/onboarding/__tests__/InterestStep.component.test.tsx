/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const editorSuggestions = vi.hoisted(() => vi.fn());

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === 'onboarding.interestStep.suggestions'
        ? 'climate,mobility,housing,education,democracy,health,digital,participation,budget,neighborhood'
        : key,
  }),
}));

vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagEditor: ({ suggestions }: { suggestions: string[] }) => {
    editorSuggestions(suggestions);
    return <div data-testid="hashtag-editor-suggestions">{suggestions.join(',')}</div>;
  },
}));

import { InterestStep } from '../InterestStep';

afterEach(() => {
  cleanup();
  editorSuggestions.mockClear();
});

function renderInterestStep(suggestions: string[]) {
  return render(
    <InterestStep
      selectedInterestTags={[]}
      suggestions={suggestions}
      onSelectedInterestTagsChange={() => undefined}
      onToggleInterestTag={() => undefined}
      onClearInterestTags={() => undefined}
      onNext={() => undefined}
      onBack={() => undefined}
    />
  );
}

describe('InterestStep', () => {
  it('uses database tags first and passes the completed list to the editor', () => {
    const view = renderInterestStep(['local-topic', 'Climate']);

    const expected = [
      'local-topic',
      'Climate',
      'mobility',
      'housing',
      'education',
      'democracy',
      'health',
      'digital',
      'participation',
      'budget',
    ];

    expect(view.getByRole('button', { name: '#local-topic' })).toBeTruthy();
    expect(view.getByTestId('hashtag-editor-suggestions').textContent).toBe(expected.join(','));
    expect(editorSuggestions).toHaveBeenLastCalledWith(expected);
  });

  it('does not append hardcoded fallback tags when ten database tags exist', () => {
    const databaseTags = Array.from({ length: 10 }, (_, index) => `database-${index}`);

    const view = renderInterestStep(databaseTags);

    expect(view.queryByRole('button', { name: '#climate' })).toBeNull();
    expect(view.getByTestId('hashtag-editor-suggestions').textContent).toBe(databaseTags.join(','));
  });
});
