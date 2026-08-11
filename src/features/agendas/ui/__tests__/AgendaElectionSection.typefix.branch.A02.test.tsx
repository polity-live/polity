/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CandidatesByElectionRow } from '@/zero/elections/queries';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

import { AgendaElectionSection } from '../AgendaElectionSection';

afterEach(cleanup);

describe('agenda election post-typefix consistency guards', () => {
  it('omits a candidate whose mutable external identity no longer matches its stats row', () => {
    let idRead = 0;
    const candidate = {
      get id() {
        idRead += 1;
        return `candidate-${idRead}`;
      },
      name: 'Mutable candidate',
      status: 'accepted',
      order_index: 0,
      user: null,
    } as unknown as CandidatesByElectionRow;

    const { container } = render(
      <AgendaElectionSection
        roleName="Board"
        candidates={[candidate]}
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

    expect(container.textContent).not.toContain('Mutable candidate');
  });
});
