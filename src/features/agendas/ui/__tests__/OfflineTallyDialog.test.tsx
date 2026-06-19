/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OfflineElectionTallyDialog } from '../OfflineElectionTallyDialog';
import { OfflineTallyDialog } from '../OfflineTallyDialog';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => {
    if (fallback) return fallback;
    if (key.includes('cancel')) return 'Cancel';
    if (key.includes('total_offline_selections')) return 'Total offline selections: ';
    if (key.includes('confirm')) return 'Confirm';
    if (key.includes('tally')) return ' tally';
    return key;
  },
  useTranslation: () => ({
    t: (key: string, fallback?: string) =>
      fallback ?? (key === 'features.events.voting.enterPin' ? 'Enter voting PIN' : key),
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function expectFullscreenCenteredTallyDialog(cardSlot: string) {
  const dialogContent = document.querySelector('[data-slot="dialog-content"]');
  if (!dialogContent) {
    throw new Error('Expected tally dialog content to be rendered');
  }

  const dialogClasses = Array.from(dialogContent.classList);
  expect(dialogClasses).toContain('h-dvh');
  expect(dialogClasses).toContain('w-screen');
  expect(dialogClasses).toContain('max-w-none');
  expect(dialogClasses).toContain('rounded-none');
  expect(dialogClasses).toContain('border-0');
  expect(dialogClasses).toContain('p-0');
  expect(dialogClasses).toContain('shadow-none');

  const centeredCard = document.querySelector(`[data-slot="${cardSlot}"]`);
  if (!centeredCard?.parentElement) {
    throw new Error('Expected centered tally card shell to be rendered');
  }

  const shellClasses = Array.from(centeredCard.parentElement.classList);
  expect(shellClasses).toContain('min-h-dvh');
  expect(shellClasses).toContain('items-center');
  expect(shellClasses).toContain('justify-center');
  expect(shellClasses).toContain('max-w-3xl');
}

describe('OfflineTallyDialog fullscreen layout', () => {
  it('renders the enter tally form in a fullscreen centered shell', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <OfflineTallyDialog
        open
        onOpenChange={vi.fn()}
        title="Final offline tally"
        description="Enter offline selections."
        phase="final"
        choices={[
          { id: 'support', label: 'Support' },
          { id: 'oppose', label: 'Oppose' },
        ]}
        tallies={[{ id: 'support', count: 2 }]}
        maxTotalVotes={8}
        participantCount={2}
        votesPerParticipant={4}
        isSubmitting={false}
        onSubmit={onSubmit}
      />
    );

    expectFullscreenCenteredTallyDialog('offline-tally-centered-card');
    expect(screen.getByText('Final offline tally')).toBeTruthy();
    expect(screen.getByText('final').className).toContain('animate-pulse');
    expect(screen.getByText('Total offline selections: 2')).toBeTruthy();
    expect(screen.getByText('2 Participants x 4 Stimmen = 8')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Support').value).toBe('2');
    expect(screen.getByLabelText<HTMLInputElement>('Oppose').value).toBe('0');
    expect(screen.queryByText('Enter voting PIN')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.getByText('Enter voting PIN')).toBeTruthy();
    expect(screen.queryByLabelText('Support')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText<HTMLInputElement>('Support').value).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    const inputs = Array.from(document.querySelectorAll('input'));
    '1234'.split('').forEach((digit, index) => {
      fireEvent.change(inputs[index], { target: { value: digit } });
    });
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        password: '1234',
        counts: { support: 2, oppose: 0 },
      })
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('shows a fullscreen animated submission overlay while saving a tally', () => {
    render(
      <OfflineTallyDialog
        open
        onOpenChange={vi.fn()}
        title="Final offline tally"
        description="Enter offline selections."
        phase="final"
        choices={[{ id: 'support', label: 'Support' }]}
        tallies={[{ id: 'support', count: 2 }]}
        maxTotalVotes={8}
        participantCount={2}
        votesPerParticipant={4}
        isSubmitting
        onSubmit={vi.fn()}
      />
    );

    expect(document.querySelector('[data-slot="action-submission-overlay"]')).toBeTruthy();
    expect(screen.getByText('POLITY zählt.')).toBeTruthy();
    expect(screen.getByText('PIN prüfen')).toBeTruthy();
    expect(screen.getByText('Tally speichern')).toBeTruthy();
    expect(screen.getByText('Ansicht synchronisieren')).toBeTruthy();
  });

  it('keeps election tallies aligned to the same centered fullscreen shell', () => {
    render(
      <OfflineElectionTallyDialog
        open
        onOpenChange={vi.fn()}
        title="Indicative offline tally"
        description="Enter candidate selections."
        phase="indicative"
        candidates={[
          { id: 'alice', label: 'Alice' },
          { id: 'bob', label: 'Bob' },
        ]}
        tallies={[{ candidate_id: 'alice', count: 1 }]}
        maxTotalVotes={3}
        maxPerEntryVotes={3}
        participantCount={3}
        votesPerParticipant={1}
        isSubmitting={false}
        onSubmit={vi.fn()}
      />
    );

    expectFullscreenCenteredTallyDialog('offline-election-tally-centered-card');
    expect(screen.getByText('3 Participants x 1 Stimmen = 3')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Alice').value).toBe('1');
    expect(screen.getByLabelText<HTMLInputElement>('Alice').max).toBe('3');
    expect(screen.getByLabelText<HTMLInputElement>('Bob').value).toBe('0');
  });

  it('disables confirmation while counts exceed the participant limit', () => {
    render(
      <OfflineTallyDialog
        open
        onOpenChange={vi.fn()}
        title="Final offline tally"
        description="Enter offline selections."
        phase="final"
        choices={[{ id: 'support', label: 'Support' }]}
        tallies={[{ id: 'support', count: 9 }]}
        maxTotalVotes={8}
        participantCount={2}
        votesPerParticipant={4}
        isSubmitting={false}
        onSubmit={vi.fn()}
      />
    );

    expect((screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(screen.queryByText('Enter voting PIN')).toBeNull();
  });

  it('blocks election confirmation when a candidate exceeds the participant count', () => {
    render(
      <OfflineElectionTallyDialog
        open
        onOpenChange={vi.fn()}
        title="Indicative offline tally"
        description="Enter candidate selections."
        phase="indicative"
        candidates={[
          { id: 'alice', label: 'Alice' },
          { id: 'bob', label: 'Bob' },
        ]}
        tallies={[{ candidate_id: 'alice', count: 4 }]}
        maxTotalVotes={12}
        maxPerEntryVotes={3}
        participantCount={3}
        votesPerParticipant={4}
        isSubmitting={false}
        onSubmit={vi.fn()}
      />
    );

    expect(
      screen.getByText('Each candidate can receive at most 3 offline selections.')
    ).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(screen.queryByText('Enter voting PIN')).toBeNull();
  });

  it('allows election confirmation when each candidate is at the participant cap and total is valid', () => {
    render(
      <OfflineElectionTallyDialog
        open
        onOpenChange={vi.fn()}
        title="Indicative offline tally"
        description="Enter candidate selections."
        phase="indicative"
        candidates={[
          { id: 'alice', label: 'Alice' },
          { id: 'bob', label: 'Bob' },
          { id: 'carol', label: 'Carol' },
          { id: 'dave', label: 'Dave' },
        ]}
        tallies={[
          { candidate_id: 'alice', count: 3 },
          { candidate_id: 'bob', count: 3 },
          { candidate_id: 'carol', count: 3 },
          { candidate_id: 'dave', count: 3 },
        ]}
        maxTotalVotes={12}
        maxPerEntryVotes={3}
        participantCount={3}
        votesPerParticipant={4}
        isSubmitting={false}
        onSubmit={vi.fn()}
      />
    );

    expect(
      screen.queryByText('Each candidate can receive at most 3 offline selections.')
    ).toBeNull();
    expect((screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement).disabled).toBe(
      false
    );
  });

  it('still blocks election confirmation when total selections exceed the total cap', () => {
    render(
      <OfflineElectionTallyDialog
        open
        onOpenChange={vi.fn()}
        title="Indicative offline tally"
        description="Enter candidate selections."
        phase="indicative"
        candidates={[
          { id: 'alice', label: 'Alice' },
          { id: 'bob', label: 'Bob' },
          { id: 'carol', label: 'Carol' },
          { id: 'dave', label: 'Dave' },
          { id: 'eve', label: 'Eve' },
        ]}
        tallies={[
          { candidate_id: 'alice', count: 3 },
          { candidate_id: 'bob', count: 3 },
          { candidate_id: 'carol', count: 3 },
          { candidate_id: 'dave', count: 3 },
          { candidate_id: 'eve', count: 1 },
        ]}
        maxTotalVotes={12}
        maxPerEntryVotes={3}
        participantCount={3}
        votesPerParticipant={4}
        isSubmitting={false}
        onSubmit={vi.fn()}
      />
    );

    expect(
      screen.queryByText('Each candidate can receive at most 3 offline selections.')
    ).toBeNull();
    expect((screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });
});
