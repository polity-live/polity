/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, params?: string | Record<string, unknown>) =>
    typeof params === 'string' ? params : params ? `${key}:${JSON.stringify(params)}` : key,
}));
vi.mock('@/features/vote-cast/ui/VotePasswordInput', () => ({
  VotePasswordInput: () => <div>password input</div>,
}));

import { OfflineElectionTallyDialogView } from '../OfflineElectionTallyDialogView';
import { OfflineTallyDialogView } from '../OfflineTallyDialogView';

afterEach(cleanup);

const callbacks = () => ({
  onOpenChange: vi.fn(),
  onDraftValueChange: vi.fn(),
  onConfirmCounts: vi.fn(),
  onBackToCounts: vi.fn(),
  onPasswordSubmit: vi.fn(async () => undefined),
});

describe('offline tally dialog views', () => {
  it('renders tally limits, invalid entries, errors, and draft edits', () => {
    const actions = callbacks();
    render(
      <OfflineTallyDialogView
        open
        title="Tally"
        description="Description"
        phase="indicative"
        choices={[{ id: 'yes', label: 'Yes' }]}
        maxTotalVotes={null}
        maxPerEntryVotes={2}
        maxPerEntryLimitLabel="choice"
        participantCount={null}
        votesPerParticipant={null}
        isSubmitting
        submitError="submit failed"
        step="counts"
        draft={{ yes: '3' }}
        totalVotes={3}
        isOverTotalLimit
        isOverEntryLimit
        isOverLimit
        overLimitEntryIds={['yes']}
        {...actions}
      />
    );
    const input = screen.getByLabelText('Yes');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(input, { target: { value: '4' } });
    expect(actions.onDraftValueChange).toHaveBeenCalledWith('yes', '4');
    expect(screen.getByText('submit failed')).toBeTruthy();
    fireEvent.click(document.querySelector('[data-action-id="agendas.offline-tally.cancel"]')!);
    expect(actions.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders password-step tally defaults without limit messages', () => {
    const actions = callbacks();
    render(
      <OfflineTallyDialogView
        open
        title="Tally"
        description="Description"
        phase="final"
        choices={[]}
        participantCount={1}
        votesPerParticipant={null}
        maxTotalVotes={1}
        maxPerEntryVotes={null}
        isSubmitting={false}
        step="password"
        draft={{}}
        totalVotes={0}
        isOverTotalLimit={false}
        isOverEntryLimit={false}
        isOverLimit={false}
        overLimitEntryIds={[]}
        {...actions}
      />
    );
    expect(screen.getByText('password input')).toBeTruthy();
    fireEvent.click(
      document.querySelector('[data-action-id="agendas.offline-tally.counts.back"]')!
    );
    expect(actions.onBackToCounts).toHaveBeenCalled();
  });

  it('renders election limits and invalid candidate entries', () => {
    const actions = callbacks();
    render(
      <OfflineElectionTallyDialogView
        open
        title="Election tally"
        description="Description"
        phase="final"
        candidates={[
          { id: 'alice', label: 'Alice' },
          { id: 'bob', label: 'Bob' },
        ]}
        maxTotalVotes={null}
        maxPerEntryVotes={2}
        participantCount={null}
        votesPerParticipant={null}
        isSubmitting
        submitError="submit failed"
        step="counts"
        draft={{ alice: '3' }}
        totalVotes={3}
        isOverTotalLimit
        isOverEntryLimit
        isOverLimit
        overLimitEntryIds={['alice']}
        {...actions}
      />
    );
    const input = screen.getByLabelText('Alice');
    fireEvent.change(input, { target: { value: '4' } });
    expect(actions.onDraftValueChange).toHaveBeenCalledWith('alice', '4');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('submit failed')).toBeTruthy();
  });

  it('renders an indicative election password step without limit messages', () => {
    const actions = callbacks();
    render(
      <OfflineElectionTallyDialogView
        open
        title="Election tally"
        description="Description"
        phase="indicative"
        candidates={[]}
        maxTotalVotes={1}
        maxPerEntryVotes={null}
        participantCount={1}
        votesPerParticipant={null}
        isSubmitting={false}
        step="password"
        draft={{}}
        totalVotes={0}
        isOverTotalLimit={false}
        isOverEntryLimit={false}
        isOverLimit={false}
        overLimitEntryIds={[]}
        {...actions}
      />
    );
    expect(screen.getByText('password input')).toBeTruthy();
    fireEvent.click(
      document.querySelector('[data-action-id="agendas.offline-election-tally.counts.back"]')!
    );
    expect(actions.onBackToCounts).toHaveBeenCalled();
  });

  it('renders an unrestricted election entry and the calculated total limit', () => {
    const actions = callbacks();
    render(
      <OfflineElectionTallyDialogView
        open
        title="Election tally"
        description="Description"
        phase="indicative"
        candidates={[{ id: 'alice', label: 'Alice' }]}
        maxTotalVotes={6}
        maxPerEntryVotes={null}
        participantCount={3}
        votesPerParticipant={2}
        isSubmitting={false}
        step="counts"
        draft={{}}
        totalVotes={0}
        isOverTotalLimit={false}
        isOverEntryLimit={false}
        isOverLimit={false}
        overLimitEntryIds={[]}
        {...actions}
      />
    );

    expect(screen.getByLabelText('Alice').getAttribute('max')).toBeNull();
    expect(screen.getByLabelText('Alice').getAttribute('value')).toBe('0');
    expect(
      screen.getByText(
        'features.agendas.offlineTally.totalLimitFormula:{"participants":3,"votes":2,"total":6}'
      )
    ).toBeTruthy();
    fireEvent.click(
      document.querySelector('[data-action-id="agendas.offline-election-tally.counts.confirm"]')!
    );
    expect(actions.onConfirmCounts).toHaveBeenCalled();
    fireEvent.click(
      document.querySelector('[data-action-id="agendas.offline-election-tally.cancel"]')!
    );
    expect(actions.onOpenChange).toHaveBeenCalledWith(false);
  });
});
