/* @vitest-environment jsdom */

import { cleanup, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderComponentFlow } from '@/test/render-component-flow';
import { computeVoteResult } from '@/features/votes/logic/computeVoteResult';
import { ChangeRequestSummaryItem } from '@/features/change-requests/ui/ChangeRequestSummaryItem';
import { VersionComparisonView } from '@/features/amendments/ui/VersionComparisonView';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

interface ReviewRequest {
  id: string;
  title: string;
  description: string;
  original: string;
  proposed: string;
  status: 'open' | 'completed' | 'rejected';
}

const initialRequest: ReviewRequest = {
  id: 'cr-1',
  title: 'Protect the square',
  description: 'Adds a protection clause',
  original: 'The square may be developed.',
  proposed: 'The square must remain public.',
  status: 'open',
};

function ChangeRequestReviewFlow({ initial = [initialRequest] }: { initial?: ReviewRequest[] }) {
  const [requests, setRequests] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const selected = requests.find(request => request.id === selectedId) ?? null;

  const resolve = (accept: number, reject: number) => {
    if (!selected) return;
    const result = computeVoteResult(accept, reject, 2, 'simple');
    setRequests(current =>
      current.map(request =>
        request.id === selected.id
          ? { ...request, status: result === 'passed' ? 'completed' : 'rejected' }
          : request
      )
    );
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const created: ReviewRequest = {
            id: 'cr-2',
            title: 'Add affordable housing',
            description: 'Adds an affordability requirement',
            original: 'Housing is planned.',
            proposed: 'At least 40% affordable housing is required.',
            status: 'open',
          };
          setRequests(current => [...current, created]);
          setSelectedId(created.id);
        }}
      >
        Create change request
      </button>

      {requests.map(request => (
        <ChangeRequestSummaryItem
          key={request.id}
          identifier={request.id.toUpperCase()}
          title={request.title}
          description={request.description}
          status={request.status}
          changeType="replace"
          selected={selectedId === request.id}
          onClick={() => setSelectedId(request.id)}
        />
      ))}

      {selected ? (
        <section>
          <output data-testid="review-status">{selected.status}</output>
          <VersionComparisonView
            originalVersion={selected.original}
            currentVersion={selected.proposed}
            changeRequest={selected}
          />
          <button type="button" onClick={() => resolve(2, 0)}>
            Accept change
          </button>
          <button type="button" onClick={() => resolve(0, 2)}>
            Reject change
          </button>
        </section>
      ) : null}
    </div>
  );
}

afterEach(cleanup);

describe('change request review component flow', () => {
  it('creates a change request and selects it for review', () => {
    renderComponentFlow(<ChangeRequestReviewFlow initial={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create change request' }));

    expect(screen.getByRole('button', { name: /Add affordable housing/ })).toBeTruthy();
    expect(screen.getByTestId('review-status').textContent).toBe('open');
  });

  it('opens the selected change request and presents its document diff', () => {
    renderComponentFlow(<ChangeRequestReviewFlow />);

    fireEvent.click(screen.getByRole('button', { name: /Protect the square/ }));

    expect(screen.getAllByText('The square may be developed.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('The square must remain public.').length).toBeGreaterThan(0);
    expect(
      screen.getByText('features.amendments.supportConfirmation.comparison.hasChanges')
    ).toBeTruthy();
  });

  it('accepts or rejects a reviewed change and updates the visible resolution', () => {
    const { rerender } = renderComponentFlow(<ChangeRequestReviewFlow />);

    fireEvent.click(screen.getByRole('button', { name: 'Accept change' }));
    expect(screen.getByTestId('review-status').textContent).toBe('completed');

    rerender(<ChangeRequestReviewFlow key="rejected-flow" />);
    fireEvent.click(screen.getByRole('button', { name: 'Reject change' }));
    expect(screen.getByTestId('review-status').textContent).toBe('rejected');
  });
});
