/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { requestAppTutorialTargetRecovery } from '@/features/app-tutorial/events';
import { useLanguageStore } from '@/features/shared/global-state/language.store';
import { encodeAppError } from '@/features/shared/errors';
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
    screen.queryByRole('button', { name: /confirm|bestätigen/i }) ??
    screen.getAllByRole('button')[screen.getAllByRole('button').length - 2];
  fireEvent.click(confirmButton);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('VoteCastDialog', () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: 'de' });
  });

  it('shows document preview content before selection and keeps it during PIN entry', () => {
    render(
      <VoteCastDialog
        open
        onOpenChange={vi.fn()}
        phase="indication"
        title="CR vote"
        choices={[
          { id: 'yes', label: 'Yes' },
          { id: 'no', label: 'No' },
        ]}
        requirePassword
        documentPreviewContent={
          <section data-testid="vote-dialog-document-preview">
            <button type="button">Document Preview</button>
          </section>
        }
        onPasswordSubmit={vi.fn()}
        onCastVote={vi.fn()}
      />
    );

    expect(screen.getByTestId('vote-dialog-document-preview')).toBeTruthy();
    expect(screen.getByRole('button', { name: /document preview/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /yes/i }));
    clickConfirmButton();

    expect(screen.getByTestId('vote-dialog-document-preview')).toBeTruthy();
    expect(document.querySelectorAll('input')).toHaveLength(4);
  });

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

  it('spotlights all tutorial election candidates as one selectable target', () => {
    render(
      <VoteCastDialog
        open
        onOpenChange={vi.fn()}
        phase="final"
        title="Wahl zum Kreisvorsitzenden"
        candidates={[
          { id: 'amira', name: 'Amira Scholz' },
          { id: 'murat', name: 'Murat Demir' },
        ]}
        maxVotes={1}
        tutorialAnchor="agenda-election-vote"
        requirePassword
        onCastElectionVote={vi.fn()}
      />
    );

    const target = document.querySelector('[data-tutorial-anchor="agenda-election-option"]');
    expect(target).not.toBeNull();
    expect(
      document.querySelectorAll('[data-tutorial-anchor="agenda-election-option"]')
    ).toHaveLength(1);
    const amira = screen.getByRole('button', { name: /amira scholz/i });
    expect(target?.contains(amira)).toBe(true);
    expect(target?.contains(screen.getByRole('button', { name: /murat demir/i }))).toBe(true);

    fireEvent.click(amira);
    expect(document.querySelector('[data-tutorial-anchor="agenda-election-submit"]')).toBe(
      screen.getByRole('button', { name: /confirm|bestätigen/i })
    );

    fireEvent.click(
      document.querySelector('[data-tutorial-anchor="agenda-election-submit"]') as HTMLElement
    );
    expect(document.querySelector('[data-tutorial-anchor="agenda-election-password"]')).not.toBe(
      null
    );
  });

  it('provides separate tutorial targets for Yes and final amendment confirmation', () => {
    render(
      <VoteCastDialog
        open
        onOpenChange={vi.fn()}
        phase="final"
        title="Amendment vote"
        choices={[
          { id: 'yes', label: 'Ja', semanticKey: 'accept' },
          { id: 'no', label: 'Nein', semanticKey: 'reject' },
        ]}
        tutorialAnchor="agenda-amendment-vote"
        requirePassword
        onCastVote={vi.fn()}
      />
    );

    const yes = document.querySelector('[data-tutorial-anchor="agenda-amendment-yes"]');
    expect(yes).toBe(screen.getByRole('button', { name: 'Ja' }));

    fireEvent.click(screen.getByRole('button', { name: 'Ja' }));
    expect(document.querySelector('[data-tutorial-anchor="agenda-amendment-submit"]')).toBe(
      screen.getByRole('button', { name: /confirm|bestätigen/i })
    );

    fireEvent.click(
      document.querySelector('[data-tutorial-anchor="agenda-amendment-submit"]') as HTMLElement
    );
    expect(document.querySelector('[data-tutorial-anchor="agenda-amendment-password"]')).not.toBe(
      null
    );
  });

  it('keeps controls outside the tutorial voting dialog clickable and focusable', async () => {
    const copyPassword = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <>
        <VoteCastDialog
          open
          onOpenChange={onOpenChange}
          phase="final"
          title="Amendment vote"
          choices={[{ id: 'yes', label: 'Yes', semanticKey: 'accept' }]}
          tutorialAnchor="agenda-amendment-vote"
          requirePassword
          onPasswordSubmit={vi.fn()}
          onCastVote={vi.fn()}
        />
        <section>
          <p>Copy 1234 and paste the password.</p>
          <button type="button" onClick={copyPassword}>
            Copy tutorial password
          </button>
        </section>
      </>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    fireEvent.click(
      document.querySelector('[data-tutorial-anchor="agenda-amendment-submit"]') as HTMLElement
    );
    await waitFor(() =>
      expect(
        document.querySelector('[data-tutorial-anchor="agenda-amendment-password"]')
      ).not.toBeNull()
    );

    const copyButton = screen.getByRole('button', { name: 'Copy tutorial password' });
    fireEvent.pointerDown(copyButton);
    copyButton.focus();
    expect(document.activeElement).toBe(copyButton);
    expect(document.body.style.pointerEvents).not.toBe('none');

    fireEvent.click(copyButton);
    expect(copyPassword).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(
      document.querySelector('[data-tutorial-anchor="agenda-amendment-password"]')
    ).not.toBeNull();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(
      document.querySelector('[data-tutorial-anchor="agenda-amendment-password"]')
    ).not.toBeNull();
  });

  it('keeps the normal app dialog dismissible with Escape', () => {
    const onOpenChange = vi.fn();

    render(
      <VoteCastDialog
        open
        onOpenChange={onOpenChange}
        phase="final"
        choices={[{ id: 'yes', label: 'Yes' }]}
        onCastVote={vi.fn()}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('recovers the amendment PIN step and preserves an existing choice', async () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <VoteCastDialog
          open={open}
          onOpenChange={setOpen}
          phase="final"
          choices={[
            { id: 'yes', label: 'Ja', semanticKey: 'accept' },
            { id: 'no', label: 'Nein', semanticKey: 'reject' },
          ]}
          tutorialAnchor="agenda-amendment-vote"
          requirePassword
          onCastVote={vi.fn()}
        />
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Nein' }));
    fireEvent.click(
      document.querySelector('[data-tutorial-anchor="agenda-amendment-submit"]') as HTMLElement
    );
    await waitFor(() => expect(document.querySelectorAll('input')).toHaveLength(4));

    fireEvent.click(screen.getByRole('button', { name: /cancel|abbrechen/i }));
    expect(document.querySelectorAll('input')).toHaveLength(0);

    requestAppTutorialTargetRecovery('agenda-amendment-password');
    await waitFor(() => expect(document.querySelectorAll('input')).toHaveLength(4));

    requestAppTutorialTargetRecovery('agenda-amendment-submit');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Nein' }).getAttribute('aria-pressed')).toBe('true')
    );
  });

  it.each([
    {
      tutorialAnchor: 'agenda-amendment-vote',
      recoveryAnchor: 'agenda-amendment-password',
      candidates: undefined,
      choices: [
        { id: 'no', label: 'Nein', semanticKey: 'reject' },
        { id: 'yes', label: 'Ja', semanticKey: 'accept' },
      ],
      selectedLabel: 'Ja',
    },
    {
      tutorialAnchor: 'agenda-election-vote',
      recoveryAnchor: 'agenda-election-password',
      candidates: [
        { id: 'alice', name: 'Alice' },
        { id: 'bob', name: 'Bob' },
      ],
      choices: undefined,
      selectedLabel: 'Alice',
    },
  ])(
    'uses the deterministic $tutorialAnchor fallback when recovering without a selection',
    async ({ tutorialAnchor, recoveryAnchor, candidates, choices, selectedLabel }) => {
      function Harness() {
        const [open, setOpen] = useState(false);
        return (
          <VoteCastDialog
            open={open}
            onOpenChange={setOpen}
            phase="final"
            candidates={candidates}
            choices={choices}
            tutorialAnchor={tutorialAnchor}
            requirePassword
            onCastVote={vi.fn()}
            onCastElectionVote={vi.fn()}
          />
        );
      }

      render(<Harness />);
      requestAppTutorialTargetRecovery(recoveryAnchor);
      await waitFor(() => expect(document.querySelectorAll('input')).toHaveLength(4));

      requestAppTutorialTargetRecovery(
        tutorialAnchor === 'agenda-election-vote'
          ? 'agenda-election-submit'
          : 'agenda-amendment-submit'
      );
      await waitFor(() =>
        expect(
          screen
            .getByRole('button', { name: new RegExp(selectedLabel, 'i') })
            .getAttribute('aria-pressed')
        ).toBe('true')
      );
    }
  );

  it('shows the fullscreen submission overlay after password submit and auto-closes on success', async () => {
    const onOpenChange = vi.fn();
    const onPasswordSubmit = vi.fn().mockResolvedValue(undefined);
    let confirmServer: () => void = () => undefined;
    const server = new Promise<{ type: 'success' }>(resolve => {
      confirmServer = () => resolve({ type: 'success' });
    });
    const onCastVote = vi.fn(async (_choiceId, context) => {
      context?.reportProgress('cast', 'active');
      context?.reportProgress('cast', 'complete');
      context?.reportProgress('sync', 'active');
      await context?.trackServerResult?.({ client: Promise.resolve(), server });
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
    expect(screen.getByRole('progressbar', { name: 'Fortschritt der Stimmabgabe' })).toBeTruthy();
    expect(document.querySelector('[data-slot="loading-progress-bar"]')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /support/i })).toBeNull();
    expect(screen.getByText('Stimmrecht wird geprüft')).toBeTruthy();
    expect(screen.getByText('Stimme wird versiegelt')).toBeTruthy();
    expect(screen.getByText('Ergebnis wird synchronisiert')).toBeTruthy();

    await waitFor(() => expect(onPasswordSubmit).toHaveBeenCalledWith('1234'));
    await waitFor(() =>
      expect(onCastVote).toHaveBeenCalledWith(
        'support',
        expect.objectContaining({ reportProgress: expect.any(Function) })
      )
    );

    expect(screen.queryByText('Stimme abgegeben')).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    confirmServer();
    expect(await screen.findByText('Stimme abgegeben')).toBeTruthy();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false), { timeout: 1500 });
  });

  it('returns to PIN entry without casting when password verification fails', async () => {
    const onOpenChange = vi.fn();
    const onPasswordSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error(encodeAppError('voting_password_invalid')));
    const onCastVote = vi.fn().mockResolvedValue(undefined);

    render(
      <VoteCastDialog
        open
        onOpenChange={onOpenChange}
        phase="final"
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
    expect(screen.getByText(/Abstimmungs-PIN erneut ein/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /pin erneut eingeben/i }));

    await waitFor(() => expect(document.querySelectorAll('input')).toHaveLength(4));
    expect(onPasswordSubmit).toHaveBeenCalledTimes(1);
    expect(onCastVote).not.toHaveBeenCalled();
  });

  it('does not reuse the previous PIN when background server finalization rejects', async () => {
    const onPasswordSubmit = vi.fn().mockResolvedValue(undefined);
    let rejectServer: (result: {
      type: 'error';
      error: { type: 'server'; message: string };
    }) => void = () => undefined;
    const server = new Promise<{
      type: 'error';
      error: { type: 'server'; message: string };
    }>(resolve => {
      rejectServer = resolve;
    });
    const onCastVote = vi.fn(async (_choiceId, context) => {
      await context?.trackServerResult?.({
        client: Promise.resolve(),
        server,
      });
    });

    render(
      <VoteCastDialog
        open
        onOpenChange={vi.fn()}
        phase="final"
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

    expect(screen.queryByText('Stimme abgegeben')).toBeNull();
    rejectServer({
      type: 'error',
      error: { type: 'server', message: encodeAppError('mutation_server_failed') },
    });

    expect(await screen.findByText('Prüfung unterbrochen')).toBeTruthy();
    expect(
      screen.getByText('Die Änderung konnte auf dem Server nicht gespeichert werden.')
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /erneut versuchen/i }));

    await waitFor(() => expect(document.querySelectorAll('input')).toHaveLength(4));
    expect(onPasswordSubmit).toHaveBeenCalledTimes(1);
    expect(onCastVote).toHaveBeenCalledTimes(1);
  });

  it('submits a completed PIN only once while the first submission is still running', async () => {
    let finishPasswordVerification: () => void = () => undefined;
    const passwordVerification = new Promise<void>(resolve => {
      finishPasswordVerification = resolve;
    });
    const onPasswordSubmit = vi.fn(() => passwordVerification);
    const onCastVote = vi.fn().mockResolvedValue(undefined);

    render(
      <VoteCastDialog
        open
        onOpenChange={vi.fn()}
        phase="final"
        title="Final vote"
        choices={[{ id: 'support', label: 'Support' }]}
        requirePassword
        onPasswordSubmit={onPasswordSubmit}
        onCastVote={onCastVote}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /support/i }));
    clickConfirmButton();
    await waitFor(() => expect(document.querySelectorAll('input')).toHaveLength(4));
    const inputs = Array.from(document.querySelectorAll('input'));
    inputs.forEach((input, index) => {
      fireEvent.change(input, { target: { value: String(index + 1) } });
    });
    fireEvent.change(inputs[3], { target: { value: '4' } });

    await waitFor(() => expect(onPasswordSubmit).toHaveBeenCalledTimes(1));
    expect(onCastVote).not.toHaveBeenCalled();

    finishPasswordVerification();
    await waitFor(() => expect(onCastVote).toHaveBeenCalledTimes(1));
  });

  it('submits a pasted four-digit PIN only once', async () => {
    const onPasswordSubmit = vi.fn().mockResolvedValue(undefined);
    const onCastVote = vi.fn().mockResolvedValue(undefined);

    render(
      <VoteCastDialog
        open
        onOpenChange={vi.fn()}
        phase="final"
        title="Final vote"
        choices={[{ id: 'support', label: 'Support' }]}
        requirePassword
        onPasswordSubmit={onPasswordSubmit}
        onCastVote={onCastVote}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /support/i }));
    clickConfirmButton();
    await waitFor(() => expect(document.querySelectorAll('input')).toHaveLength(4));
    const firstInput = document.querySelector('input');
    if (!firstInput) throw new Error('Expected PIN input');
    const clipboardData = { getData: () => '1234' };

    fireEvent.paste(firstInput, { clipboardData });
    fireEvent.paste(firstInput, { clipboardData });

    await waitFor(() => expect(onPasswordSubmit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onCastVote).toHaveBeenCalledTimes(1));
  });

  it('explains duplicate submissions without exposing the raw constraint as the main error', async () => {
    const onPasswordSubmit = vi.fn().mockResolvedValue(undefined);
    const onCastVote = vi
      .fn()
      .mockRejectedValue(new Error(encodeAppError('vote_already_submitted')));

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
