/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgendaElectionSection } from '../AgendaElectionSection';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => {
      if (_key === 'features.events.agenda.becomeCandidate') {
        return 'Become Candidate';
      }

      return fallback ?? _key;
    },
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AgendaElectionSection', () => {
  it('renders the Become Candidate button as blocked with help when passive voting rights are missing', () => {
    render(
      <AgendaElectionSection
        roleName="Board"
        candidates={[]}
        indicativeSelections={[]}
        finalSelections={[]}
        userHasVoted={false}
        userSelectedCandidateIds={[]}
        electionStatus="indicative"
        canVote={false}
        canBeCandidate={false}
        isUserCandidate={false}
        onBecomeCandidate={() => undefined}
      />
    );

    const candidateButton = screen.getByRole('button', { name: /Become Candidate/ });

    expect(candidateButton.getAttribute('aria-disabled')).toBe('true');
    expect(candidateButton.getAttribute('title')).toBe(
      'Passive Voting Rights are required to become a candidate in this event.'
    );
    expect(candidateButton.className).toContain('text-muted-foreground');
  });
});
