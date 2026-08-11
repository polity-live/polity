/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditElectionVoteDialogViewProps } from '../EditElectionVoteDialogView';
import { EditElectionVoteDialogView } from '../EditElectionVoteDialogView';

vi.mock('@/features/create/ui/inputs/VisibilityInput', () => ({ VisibilityInput: () => null }));
vi.mock('../BallotVisibilityInput', () => ({ BallotVisibilityInput: () => null }));
vi.mock('../AgendaUiSystem', () => ({
  AgendaDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AgendaDialogBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const t = (key: string) => key;

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    t,
    isElection: false,
    majorityType: 'relative',
    setMajorityType: vi.fn(),
    closingType: 'moderator',
    setClosingType: vi.fn(),
    closingDuration: 10,
    setClosingDuration: vi.fn(),
    visibility: 'public',
    setVisibility: vi.fn(),
    ballotVisibility: 'named',
    setBallotVisibility: vi.fn(),
    maxVotes: 1,
    setMaxVotes: vi.fn(),
    title: 'Budget vote',
    setTitle: vi.fn(),
    description: 'Description',
    setDescription: vi.fn(),
    duration: 30,
    setDuration: vi.fn(),
    localChoices: [{ id: 'choice-1', label: 'Approve' }],
    setLocalChoices: vi.fn(),
    newChoiceLabel: 'Abstain',
    setNewChoiceLabel: vi.fn(),
    saving: false,
    setSaving: vi.fn(),
    handleAddChoice: vi.fn(),
    handleRemoveChoice: vi.fn(),
    handleSave: vi.fn(),
    ...overrides,
  } as unknown as EditElectionVoteDialogViewProps;
}

describe('EditElectionVoteDialogView actions', () => {
  it('selects majority and closing variants through stable controls', () => {
    const setMajorityType = vi.fn();
    const setClosingType = vi.fn();
    render(<EditElectionVoteDialogView {...makeProps({ setMajorityType, setClosingType })} />);

    fireEvent.click(document.querySelector('[data-action-id="agendas.edit-vote.majority.open"]')!);
    for (const variant of ['relative', 'absolute', 'two-thirds']) {
      expect(
        document.querySelector(`[data-action-id="agendas.edit-vote.majority.${variant}"]`)
      ).toBeTruthy();
    }
    fireEvent.click(
      document.querySelector('[data-action-id="agendas.edit-vote.majority.absolute"]')!
    );
    expect(setMajorityType).toHaveBeenCalledWith('absolute');

    fireEvent.click(document.querySelector('[data-action-id="agendas.edit-vote.closing.time"]')!);
    expect(setClosingType).toHaveBeenCalledWith('time');
    expect(
      document.querySelector('[data-action-id="agendas.edit-vote.closing.moderator"]')
    ).toBeTruthy();
  });

  it('adds and removes choices through click and keyboard behavior', () => {
    const handleAddChoice = vi.fn();
    const handleRemoveChoice = vi.fn();
    render(<EditElectionVoteDialogView {...makeProps({ handleAddChoice, handleRemoveChoice })} />);

    fireEvent.click(document.querySelector('[data-action-id="agendas.edit-vote.choice.remove"]')!);
    expect(handleRemoveChoice).toHaveBeenCalledWith('choice-1');

    fireEvent.click(document.querySelector('[data-action-id="agendas.edit-vote.choice.add"]')!);
    const newChoiceInput = document.querySelector(
      'input[placeholder="features.events.agenda.newChoice"]'
    )!;
    fireEvent.keyDown(newChoiceInput, { key: 'Enter' });
    fireEvent.keyDown(newChoiceInput, { key: 'Escape' });
    expect(handleAddChoice).toHaveBeenCalledTimes(2);
  });

  it('renders timed election fields, normalizes numeric edits, and shows saving state', () => {
    const setTitle = vi.fn();
    const setDescription = vi.fn();
    const setDuration = vi.fn();
    const setClosingDuration = vi.fn();
    const setMaxVotes = vi.fn();
    const { container } = render(
      <EditElectionVoteDialogView
        {...makeProps({
          isElection: true,
          closingType: 'time',
          saving: true,
          setTitle,
          setDescription,
          setDuration,
          setClosingDuration,
          setMaxVotes,
        })}
      />
    );

    fireEvent.change(container.querySelector('#agenda-title')!, { target: { value: 'Election' } });
    fireEvent.change(container.querySelector('#agenda-description')!, {
      target: { value: 'New description' },
    });
    const numericInputs = container.querySelectorAll<HTMLInputElement>('input[type="number"]');
    expect(numericInputs).toHaveLength(3);
    for (const input of numericInputs) {
      fireEvent.change(input, { target: { value: '0' } });
      fireEvent.change(input, { target: { value: '12' } });
    }

    expect(setTitle).toHaveBeenCalledWith('Election');
    expect(setDescription).toHaveBeenCalledWith('New description');
    expect(setDuration).toHaveBeenCalledWith(1);
    expect(setDuration).toHaveBeenCalledWith(12);
    expect(setClosingDuration).toHaveBeenCalledWith(1);
    expect(setMaxVotes).toHaveBeenCalledWith(1);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
    expect(
      (
        container.querySelector(
          '[data-action-id="agendas.edit-vote.dialog.save"]'
        ) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it('disables adding a whitespace-only choice and forwards new labels', () => {
    const setNewChoiceLabel = vi.fn();
    const { container } = render(
      <EditElectionVoteDialogView {...makeProps({ newChoiceLabel: '   ', setNewChoiceLabel })} />
    );
    const input = container.querySelector('input[placeholder="features.events.agenda.newChoice"]')!;
    fireEvent.change(input, { target: { value: 'New choice' } });
    expect(setNewChoiceLabel).toHaveBeenCalledWith('New choice');
    expect(
      (
        container.querySelector(
          '[data-action-id="agendas.edit-vote.choice.add"]'
        ) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it('cancels and saves through stable dialog actions', () => {
    const onOpenChange = vi.fn();
    const handleSave = vi.fn();
    render(<EditElectionVoteDialogView {...makeProps({ onOpenChange, handleSave })} />);

    fireEvent.click(document.querySelector('[data-action-id="agendas.edit-vote.dialog.cancel"]')!);
    fireEvent.click(document.querySelector('[data-action-id="agendas.edit-vote.dialog.save"]')!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(handleSave).toHaveBeenCalledTimes(1);
  });
});
