/* @vitest-environment jsdom */

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  controller: {
    draft: {} as Record<string, string>,
    totalVotes: 0,
    isOverTotalLimit: false,
    isOverEntryLimit: false,
    isOverLimit: false,
    overLimitEntryIds: [] as string[],
    onDraftValueChange: vi.fn(),
    onPasswordSubmit: vi.fn(),
  },
  controllerHook: vi.fn(),
  progressHook: vi.fn((_value: boolean) => []),
  tallyView: vi.fn((_props: unknown) => <div data-testid="tally-view" />),
  electionView: vi.fn((_props: unknown) => <div data-testid="election-view" />),
  overlay: vi.fn((_props: unknown) => <div data-testid="overlay" />),
}));

vi.mock('@/features/agendas/hooks/useOfflineTallyDialogController', () => ({
  useOfflineTallyDialogController: (args: any) => {
    mocks.controllerHook(args);
    for (const tally of args.tallies) {
      args.getTallyEntryId(tally);
      args.getTallyCount(tally);
    }
    return mocks.controller;
  },
}));
vi.mock('@/features/agendas/hooks/useOfflineTallySubmissionProgress', () => ({
  useOfflineTallySubmissionProgress: (value: boolean) => mocks.progressHook(value),
}));
vi.mock('@/features/agendas/ui/OfflineTallyDialogView', () => ({
  OfflineTallyDialogView: (props: unknown) => mocks.tallyView(props),
}));
vi.mock('@/features/agendas/ui/OfflineElectionTallyDialogView', () => ({
  OfflineElectionTallyDialogView: (props: unknown) => mocks.electionView(props),
}));
vi.mock('@/features/shared/ui/action-submission', () => ({
  ActionSubmissionOverlay: (props: unknown) => mocks.overlay(props),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, number>) =>
      params ? `${key}:${Object.values(params).join(':')}` : key,
  }),
}));

import { OfflineElectionTallyDialog } from '../OfflineElectionTallyDialog';
import { OfflineTallyDialog } from '../OfflineTallyDialog';

function requireDefined<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Expected captured mock value');
  return value;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.controller = {
    draft: {},
    totalVotes: 2,
    isOverTotalLimit: false,
    isOverEntryLimit: false,
    isOverLimit: false,
    overLimitEntryIds: [],
    onDraftValueChange: vi.fn(),
    onPasswordSubmit: vi.fn(),
  };
});
afterEach(cleanup);

const common = {
  open: true,
  onOpenChange: vi.fn(),
  title: 'Tally',
  description: 'Description',
  maxTotalVotes: 4,
  maxPerEntryVotes: 2,
  participantCount: 2,
  votesPerParticipant: 2,
  onSubmit: vi.fn(async () => undefined),
};

describe('offline tally dialog controllers', () => {
  it('drives tally steps, close resets, and a complete limit formula', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <OfflineTallyDialog
        {...common}
        onOpenChange={onOpenChange}
        phase="final"
        choices={[{ id: 'yes', label: 'Yes' }]}
        tallies={[{ id: 'yes', count: 2 }]}
      />
    );
    const initial = requireDefined(mocks.tallyView.mock.lastCall)[0] as any;
    act(() => initial.onConfirmCounts());
    expect((requireDefined(mocks.tallyView.mock.lastCall)[0] as any).step).toBe('password');
    act(() => (requireDefined(mocks.tallyView.mock.lastCall)[0] as any).onBackToCounts());
    expect((requireDefined(mocks.tallyView.mock.lastCall)[0] as any).step).toBe('counts');
    act(() => (requireDefined(mocks.tallyView.mock.lastCall)[0] as any).onOpenChange(true));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    act(() => (requireDefined(mocks.tallyView.mock.lastCall)[0] as any).onOpenChange(false));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <OfflineTallyDialog
        {...common}
        open={false}
        onOpenChange={onOpenChange}
        phase="final"
        choices={[{ id: 'yes', label: 'Yes' }]}
        tallies={[{ id: 'yes', count: 2 }]}
      />
    );
    expect((requireDefined(mocks.tallyView.mock.lastCall)[0] as any).step).toBe('counts');
    expect(mocks.overlay).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'idle',
        preview: expect.objectContaining({ badges: expect.arrayContaining([expect.any(String)]) }),
      })
    );
  });

  it('keeps tally counts locked when over limit and omits an incomplete formula', () => {
    mocks.controller = { ...mocks.controller, isOverLimit: true };
    render(
      <OfflineTallyDialog
        {...common}
        phase="indicative"
        choices={[]}
        tallies={[]}
        participantCount={null}
        isSubmitting
      />
    );
    const props = requireDefined(mocks.tallyView.mock.lastCall)[0] as any;
    act(() => props.onConfirmCounts());
    expect((requireDefined(mocks.tallyView.mock.lastCall)[0] as any).step).toBe('counts');
    expect(mocks.overlay).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'submitting' })
    );
    const overlayProps = requireDefined(mocks.overlay.mock.lastCall)[0] as any;
    act(() => overlayProps.onBack());
    act(() => overlayProps.onRetry());
  });

  it('drives election steps and resolves nullable tally ids', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <OfflineElectionTallyDialog
        {...common}
        onOpenChange={onOpenChange}
        phase="indicative"
        candidates={[{ id: 'candidate-1', label: 'Alice' }]}
        tallies={[{ candidate_id: null, count: null }]}
      />
    );
    act(() => (requireDefined(mocks.electionView.mock.lastCall)[0] as any).onConfirmCounts());
    expect((requireDefined(mocks.electionView.mock.lastCall)[0] as any).step).toBe('password');
    act(() => (requireDefined(mocks.electionView.mock.lastCall)[0] as any).onBackToCounts());
    act(() => (requireDefined(mocks.electionView.mock.lastCall)[0] as any).onOpenChange(true));
    act(() => (requireDefined(mocks.electionView.mock.lastCall)[0] as any).onOpenChange(false));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <OfflineElectionTallyDialog
        {...common}
        open={false}
        onOpenChange={onOpenChange}
        phase="indicative"
        candidates={[]}
        tallies={[]}
        votesPerParticipant={null}
      />
    );
    expect((requireDefined(mocks.electionView.mock.lastCall)[0] as any).step).toBe('counts');
  });

  it('blocks an over-limit election and covers the remaining formula operand', () => {
    mocks.controller = { ...mocks.controller, isOverLimit: true };
    render(
      <OfflineElectionTallyDialog
        {...common}
        phase="final"
        candidates={[]}
        tallies={[]}
        maxTotalVotes={null}
        isSubmitting
      />
    );
    act(() => (requireDefined(mocks.electionView.mock.lastCall)[0] as any).onConfirmCounts());
    expect((requireDefined(mocks.electionView.mock.lastCall)[0] as any).step).toBe('counts');
    expect(mocks.overlay).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'submitting' })
    );
  });
});
