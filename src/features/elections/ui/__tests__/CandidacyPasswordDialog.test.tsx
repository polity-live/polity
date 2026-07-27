/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CandidacyPasswordDialog } from '../CandidacyPasswordDialog';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'features.events.candidacy.becomeTitle': 'Confirm candidacy',
        'features.events.candidacy.becomeDescription':
          'Enter your voting PIN to become a candidate for this election.',
        'features.events.candidacy.withdrawTitle': 'Withdraw candidacy',
        'features.events.candidacy.withdrawDescription':
          'Enter your voting PIN to withdraw your candidacy from this election.',
        'features.events.candidacy.loadingDescription':
          'Polity is confirming your PIN and updating the election.',
        'features.events.candidacy.role': 'Role',
        'features.events.candidacy.currentCandidates': 'Current candidates',
        'features.events.candidacy.votingMethod': 'Voting method',
        'features.events.candidacy.verifyingPin': 'Verifying PIN...',
        'features.events.candidacy.loadingStepsLabel': 'Candidacy confirmation progress',
        'features.events.candidacy.stepVerifyPin': 'Verify PIN',
        'features.events.candidacy.stepSubmitCandidacy': 'Submit candidacy',
        'features.events.candidacy.stepWithdrawCandidacy': 'Withdraw candidacy',
        'features.events.candidacy.stepSyncElection': 'Sync election',
        'features.events.candidacy.cancel': 'Cancel',
        'features.events.voting.enterPin': 'Enter your 4-digit voting PIN',
        'common.votingPassword.openSettingsToContinue':
          'Set a voting PIN in password settings to continue.',
      })[key] ?? key,
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CandidacyPasswordDialog', () => {
  it('renders become-candidacy confirmation details', () => {
    render(
      <CandidacyPasswordDialog
        open
        mode="become"
        electionTitle="Board election"
        electionDescription="Choose the next board."
        roleTitle="Chair"
        candidatesCount={2}
        majorityType="simple"
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(document.querySelector('.h-dvh')).not.toBeNull();
    expect(document.querySelector('.w-screen')).not.toBeNull();
    expect(screen.getByText('Confirm candidacy')).toBeTruthy();
    expect(screen.getByText('Board election')).toBeTruthy();
    expect(screen.getByText('Chair')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('simple')).toBeTruthy();
  });

  it('submits the entered voting PIN after four digits', async () => {
    const onSubmit = vi.fn();

    render(
      <CandidacyPasswordDialog
        open
        mode="become"
        electionTitle="Board election"
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const inputs = Array.from(document.querySelectorAll('input'));
    expect(inputs).toHaveLength(4);

    '1234'.split('').forEach((digit, index) => {
      fireEvent.change(inputs[index], { target: { value: digit } });
    });

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('1234'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('renders withdraw-candidacy copy and password errors', () => {
    render(
      <CandidacyPasswordDialog
        open
        mode="withdraw"
        electionTitle="Board election"
        error="Invalid voting password."
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('Withdraw candidacy')).toBeTruthy();
    expect(
      screen.getByText('Enter your voting PIN to withdraw your candidacy from this election.')
    ).toBeTruthy();
    expect(screen.getByText('Invalid voting password.')).toBeTruthy();
  });

  it('links missing voting PIN errors to password settings', () => {
    render(
      <CandidacyPasswordDialog
        open
        mode="become"
        electionTitle="Board election"
        error="No voting password set. Please set your voting PIN first."
        noVotingPasswordSettingsHref="/user/user-1/settings?tab=passwords"
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText(/No voting password set/)).toBeTruthy();
    const link = screen.getByRole('link', {
      name: 'Set a voting PIN in password settings to continue.',
    });
    expect(link.getAttribute('href')).toBe('/user/user-1/settings?tab=passwords');
  });

  it('shows three animated loading steps after confirmation starts', () => {
    render(
      <CandidacyPasswordDialog
        open
        mode="become"
        electionTitle="Board election"
        isSubmitting
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(
      screen.getByText('Polity is confirming your PIN and updating the election.')
    ).toBeTruthy();
    expect(screen.getByText('Verify PIN')).toBeTruthy();
    expect(screen.getByText('Submit candidacy')).toBeTruthy();
    expect(screen.getByText('Sync election')).toBeTruthy();
    expect(
      document.querySelectorAll('[data-slot="candidacy-submission-steps"] .animate-pulse')
    ).toHaveLength(3);
    expect(document.querySelectorAll('input')).toHaveLength(0);
  });
});
