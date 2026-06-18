/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VoteCastDialog } from '../VoteCastDialog';

async function enterPin(pin = '1234') {
  await waitFor(() => expect(document.querySelectorAll('input')).toHaveLength(4));
  const inputs = Array.from(document.querySelectorAll('input'));

  pin.split('').forEach((digit, index) => {
    fireEvent.change(inputs[index], { target: { value: digit } });
  });
}

function clickConfirmButton() {
  const confirmButton =
    screen.queryByRole('button', { name: /confirm/i }) ??
    screen.getAllByRole('button')[screen.getAllByRole('button').length - 2];
  fireEvent.click(confirmButton);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('VoteCastDialog', () => {
  it('renders the list election choice dialog fullscreen with spaced vote counts', () => {
    render(
      <VoteCastDialog
        open
        onOpenChange={vi.fn()}
        phase="indication"
        title="Delegiertenwahl"
        candidates={[
          { id: 'alice', name: 'Alice' },
          { id: 'bob', name: 'Bob' },
          { id: 'carla', name: 'Carla' },
        ]}
        maxVotes={3}
        electionMode="list"
        seatCount={3}
        onCastElectionVote={vi.fn()}
      />
    );

    expect(screen.getByText('0 von 3 Stimmen vergeben')).toBeTruthy();
    expect(screen.getByText('3 Stimmen offen')).toBeTruthy();

    const dialogContent = document.querySelector('[data-slot="dialog-content"]');
    if (!dialogContent) {
      throw new Error('Expected fullscreen choice dialog content to be rendered');
    }
    const dialogContentClasses = Array.from(dialogContent.classList);
    expect(dialogContentClasses).toContain('h-dvh');
    expect(dialogContentClasses).toContain('w-screen');
    expect(dialogContentClasses).toContain('max-h-none');
    expect(dialogContentClasses).toContain('max-w-none');
    expect(dialogContentClasses).toContain('rounded-none');
    expect(dialogContentClasses).toContain('sm:max-w-none');
    expect(dialogContentClasses).not.toContain('max-h-[80vh]');
    expect(dialogContentClasses).not.toContain('sm:max-w-lg');

    const centeredShell = document.querySelector('[data-slot="vote-cast-centered-shell"]');
    if (!centeredShell) {
      throw new Error('Expected centered vote cast shell to be rendered');
    }
    const shellClasses = Array.from(centeredShell.classList);
    expect(shellClasses).toContain('min-h-dvh');
    expect(shellClasses).toContain('justify-center');
    expect(shellClasses).toContain('max-w-5xl');
  });

  it('shows the fullscreen submission overlay after password submit and auto-closes on success', async () => {
    const onOpenChange = vi.fn();
    const onPasswordSubmit = vi.fn().mockResolvedValue(undefined);
    const onCastVote = vi.fn(async (_choiceId, context) => {
      context?.reportProgress('cast', 'active');
      context?.reportProgress('cast', 'complete');
      context?.reportProgress('sync', 'active');
      context?.reportProgress('sync', 'complete');
    });

    render(
      <VoteCastDialog
        open
        onOpenChange={onOpenChange}
        phase="indication"
        title="Budget vote"
        choices={[
          { id: 'support', label: 'Support' },
          { id: 'oppose', label: 'Oppose' },
        ]}
        requirePassword
        onPasswordSubmit={onPasswordSubmit}
        onCastVote={onCastVote}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /support/i }));
    expect(screen.getAllByText('Support')).toHaveLength(2);

    clickConfirmButton();
    const centeredShell = document.querySelector('[data-slot="vote-cast-centered-shell"]');
    if (!centeredShell) {
      throw new Error('Expected centered vote cast shell during PIN step');
    }
    expect(Array.from(centeredShell.classList)).toContain('justify-center');

    await enterPin();

    expect(await screen.findByText('POLITY zählt.')).toBeTruthy();
    const dialogContent = document.querySelector('[data-slot="dialog-content"]');
    if (!dialogContent) {
      throw new Error('Expected dialog content to be rendered during submission');
    }
    const dialogContentClasses = Array.from(dialogContent.classList);
    expect(dialogContentClasses).toContain('h-dvh');
    expect(dialogContentClasses).toContain('w-screen');
    expect(dialogContentClasses).toContain('max-h-none');
    expect(dialogContentClasses).toContain('max-w-none');
    expect(dialogContentClasses).toContain('sm:max-w-none');
    expect(dialogContentClasses).not.toContain('max-h-[80vh]');
    expect(dialogContentClasses).not.toContain('sm:max-w-lg');
    expect(document.querySelector('[data-slot="vote-submission-overlay"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /support/i })).toBeNull();
    expect(screen.getByText('Stimmrecht prüfen')).toBeTruthy();
    expect(screen.getByText('Stimme versiegeln')).toBeTruthy();
    expect(screen.getByText('Ergebnis synchronisieren')).toBeTruthy();

    await waitFor(() => expect(onPasswordSubmit).toHaveBeenCalledWith('1234'));
    await waitFor(() =>
      expect(onCastVote).toHaveBeenCalledWith(
        'support',
        expect.objectContaining({ reportProgress: expect.any(Function) })
      )
    );

    expect(await screen.findByText('Stimme abgegeben')).toBeTruthy();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false), { timeout: 1500 });
  });

  it('returns to PIN entry without casting when password verification fails', async () => {
    const onOpenChange = vi.fn();
    const onPasswordSubmit = vi.fn().mockRejectedValueOnce(new Error('PIN falsch'));
    const onCastVote = vi.fn().mockResolvedValue(undefined);

    render(
      <VoteCastDialog
        open
        onOpenChange={onOpenChange}
        phase="final_vote"
        title="Final vote"
        choices={[{ id: 'support', label: 'Support' }]}
        requirePassword
        onPasswordSubmit={onPasswordSubmit}
        onCastVote={onCastVote}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /support/i }));
    clickConfirmButton();
    await enterPin();

    expect(await screen.findByText('PIN nicht bestätigt')).toBeTruthy();
    expect(screen.getByText(/Voting-PIN erneut ein/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /pin erneut eingeben/i }));

    await waitFor(() => expect(document.querySelectorAll('input')).toHaveLength(4));
    expect(onPasswordSubmit).toHaveBeenCalledTimes(1);
    expect(onCastVote).not.toHaveBeenCalled();
  });

  it('explains duplicate submissions without exposing the raw constraint as the main error', async () => {
    const onPasswordSubmit = vi.fn().mockResolvedValue(undefined);
    const onCastVote = vi
      .fn()
      .mockRejectedValue(
        new Error(
          'duplicate key value violates unique constraint "indicative_voter_participation_vote_id_voter_id_key"'
        )
      );

    render(
      <VoteCastDialog
        open
        onOpenChange={vi.fn()}
        phase="indication"
        title="Amendment: A36"
        choices={[{ id: 'reject', label: 'reject' }]}
        requirePassword
        onPasswordSubmit={onPasswordSubmit}
        onCastVote={onCastVote}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /reject/i }));
    clickConfirmButton();
    await enterPin();

    expect(await screen.findByText('Stimme bereits vorhanden')).toBeTruthy();
    expect(screen.getByText(/Polity zählt keine doppelte Abgabe/i)).toBeTruthy();
    expect(screen.queryByText(/duplicate key value/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /erneut versuchen/i })).toBeNull();
    expect(screen.getByRole('button', { name: /zurück zur abstimmung/i })).toBeTruthy();
  });

  it('smoothly switches election choices while keeping a single selected candidate', () => {
    render(
      <VoteCastDialog
        open
        onOpenChange={vi.fn()}
        phase="indication"
        title="Elect moderator"
        candidates={[
          { id: 'alice', name: 'Alice' },
          { id: 'bob', name: 'Bob' },
        ]}
        maxVotes={1}
        requirePassword
        onPasswordSubmit={vi.fn()}
        onCastElectionVote={vi.fn()}
      />
    );

    const alice = screen.getByRole('button', { name: /alice/i });
    const bob = screen.getByRole('button', { name: /bob/i });

    fireEvent.click(alice);
    expect(alice.getAttribute('aria-pressed')).toBe('true');
    expect(bob.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(bob);
    expect(alice.getAttribute('aria-pressed')).toBe('false');
    expect(bob.getAttribute('aria-pressed')).toBe('true');
  });
});
