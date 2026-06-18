/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OfflineElectionTallyDialog } from '../OfflineElectionTallyDialog';
import { OfflineTallyDialog } from '../OfflineTallyDialog';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => {
    if (fallback) return fallback;
    if (key.includes('cancel')) return 'Cancel';
    if (key.includes('total_offline_selections')) return 'Total offline selections: ';
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
  it('renders the enter tally form in a fullscreen centered shell', () => {
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
        maxTotalVotes={5}
        isSubmitting={false}
        onSubmit={vi.fn()}
      />
    );

    expectFullscreenCenteredTallyDialog('offline-tally-centered-card');
    expect(screen.getByText('Final offline tally')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Support').value).toBe('2');
    expect(screen.getByLabelText<HTMLInputElement>('Oppose').value).toBe('0');
    expect(screen.getByText('Enter voting PIN')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
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
        isSubmitting={false}
        onSubmit={vi.fn()}
      />
    );

    expectFullscreenCenteredTallyDialog('offline-election-tally-centered-card');
    expect(screen.getByLabelText<HTMLInputElement>('Alice').value).toBe('1');
    expect(screen.getByLabelText<HTMLInputElement>('Bob').value).toBe('0');
  });
});
