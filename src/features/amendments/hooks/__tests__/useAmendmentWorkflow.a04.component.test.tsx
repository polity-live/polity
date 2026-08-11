/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  updateAmendment: vi.fn(),
  updateProcessBranch: vi.fn(),
  createVote: vi.fn(),
  initializeVoting: vi.fn(),
  waitForClientApply: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  canTransition: vi.fn(() => true),
  terminal: vi.fn(() => false),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));
vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({
    updateAmendment: mocks.updateAmendment,
    updateProcessBranch: mocks.updateProcessBranch,
  }),
}));
vi.mock('@/zero/votes/useVoteActions', () => ({
  useVoteActions: () => ({ createVote: mocks.createVote }),
}));
vi.mock('@/zero/agendas/useAgendaActions', () => ({
  useAgendaActions: () => ({ initializeChangeRequestVoting: mocks.initializeVoting }),
}));
vi.mock('@/zero/amendments/editing-mode-policy', () => ({
  EDITING_MODE_TRANSITIONS: {
    edit: ['suggest_internal'],
    suggest_internal: ['vote_internal'],
    vote_internal: ['suggest_event'],
    suggest_event: ['event_final_closing_vote'],
    event_final_closing_vote: ['passed', 'rejected'],
    passed: [],
    rejected: [],
  },
  canTransitionTo: (...args: any[]) =>
    (mocks.canTransition as (...values: any[]) => unknown)(...args),
  isEventPhase: (status: string) => status.includes('event'),
  isTerminalEditingMode: (...args: any[]) =>
    (mocks.terminal as (...values: any[]) => unknown)(...args),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (...args: any[]) =>
    (mocks.waitForClientApply as (...values: any[]) => unknown)(...args),
}));

import { useAmendmentWorkflow } from '../useAmendmentWorkflow';

const renderWorkflow = (currentStatus: any = 'edit', overrides: Record<string, any> = {}) =>
  renderHook(() =>
    useAmendmentWorkflow({
      amendmentId: 'amendment',
      processBranchId: 'branch',
      currentStatus,
      ...overrides,
    })
  );

describe('useAmendmentWorkflow A04 branch accountability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canTransition.mockReturnValue(true);
    mocks.terminal.mockReturnValue(false);
    mocks.updateAmendment.mockImplementation(value => value);
    mocks.updateProcessBranch.mockImplementation(value => value);
    mocks.createVote.mockImplementation(value => value);
    mocks.initializeVoting.mockImplementation(value => value);
    mocks.waitForClientApply.mockResolvedValue(undefined);
  });

  afterEach(() => cleanup());

  it('exposes derived workflow metadata and rejects invalid or terminal transitions', async () => {
    mocks.canTransition.mockReturnValue(false);
    const invalid = renderWorkflow();
    expect(invalid.result.current.canTransitionTo('suggest_internal')).toBe(false);
    expect(invalid.result.current.isInEventPhase).toBe(false);
    expect(invalid.result.current.isTerminal).toBe(false);
    expect(await invalid.result.current.transitionTo('suggest_internal')).toBe(false);
    invalid.unmount();

    mocks.canTransition.mockReturnValue(true);
    mocks.terminal.mockReturnValue(true);
    const terminal = renderWorkflow('passed');
    expect(await terminal.result.current.transitionTo('rejected')).toBe(false);
    expect(terminal.result.current.isTerminal).toBe(true);
  });

  it('transitions normally and initializes final-event voting when an agenda exists', async () => {
    const regular = renderWorkflow();
    await act(async () => {
      expect(await regular.result.current.transitionTo('suggest_internal')).toBe(true);
    });
    expect(mocks.updateProcessBranch).toHaveBeenCalledWith({
      id: 'branch',
      editing_mode: 'suggest_internal',
    });
    expect(mocks.initializeVoting).not.toHaveBeenCalled();
    regular.unmount();

    const closing = renderWorkflow('suggest_event', { agendaItemId: 'agenda' });
    await act(async () => {
      expect(await closing.result.current.transitionTo('event_final_closing_vote')).toBe(true);
    });
    expect(mocks.initializeVoting).toHaveBeenCalledWith({
      amendment_id: 'amendment',
      agenda_item_id: 'agenda',
    });
  });

  it('warns for a missing final agenda and handles transition failures and loading', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const missingAgenda = renderWorkflow('suggest_event');
    expect(await missingAgenda.result.current.transitionTo('event_final_closing_vote')).toBe(true);
    expect(warn).toHaveBeenCalled();
    missingAgenda.unmount();

    const missingBranch = renderWorkflow('edit', { processBranchId: null });
    expect(await missingBranch.result.current.transitionTo('suggest_internal')).toBe(false);
    expect(mocks.toastError).toHaveBeenCalled();
    missingBranch.unmount();

    let rejectApply: ((error: Error) => void) | undefined;
    mocks.waitForClientApply.mockImplementationOnce(
      () => new Promise<void>((_resolve, reject) => (rejectApply = reject))
    );
    const pending = renderWorkflow();
    let transitionPromise: Promise<boolean> = Promise.resolve(false);
    act(() => {
      transitionPromise = pending.result.current.transitionTo('suggest_internal');
    });
    await waitFor(() => expect(pending.result.current.isTransitioning).toBe(true));
    await act(async () => rejectApply?.(new Error('transition failed')));
    await expect(transitionPromise).resolves.toBe(false);
    expect(pending.result.current.isTransitioning).toBe(false);
    warn.mockRestore();
  });

  it('starts voting from suggesting and vote modes, and rejects unrelated modes', async () => {
    const invalid = renderWorkflow('edit');
    expect(await invalid.result.current.startInternalVoting(10)).toBeNull();
    invalid.unmount();

    const suggesting = renderWorkflow('suggest_internal');
    const created = await suggesting.result.current.startInternalVoting(15);
    expect(created).toEqual(expect.any(String));
    expect(mocks.updateProcessBranch).toHaveBeenCalledWith(
      expect.objectContaining({ editing_mode: 'vote_internal' })
    );
    expect(mocks.createVote).toHaveBeenCalledWith(
      expect.objectContaining({ closing_duration_seconds: 900, visibility: 'private' })
    );
    suggesting.unmount();

    mocks.updateProcessBranch.mockClear();
    const voting = renderWorkflow('vote_internal');
    expect(await voting.result.current.startInternalVoting(1)).toEqual(expect.any(String));
    expect(mocks.updateProcessBranch).not.toHaveBeenCalled();
  });

  it('returns null when internal vote creation fails', async () => {
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('create failed'));
    const workflow = renderWorkflow('vote_internal');
    expect(await workflow.result.current.startInternalVoting(5)).toBeNull();
    expect(mocks.toastError).toHaveBeenCalled();
  });

  it('submits collaborator phases to events and handles invalid or failed submissions', async () => {
    const invalid = renderWorkflow('suggest_event');
    expect(await invalid.result.current.submitToEvent('event')).toBe(false);
    invalid.unmount();

    for (const status of ['edit', 'suggest_internal', 'vote_internal'] as const) {
      const workflow = renderWorkflow(status);
      expect(await workflow.result.current.submitToEvent('event')).toBe(true);
      workflow.unmount();
    }
    expect(mocks.updateAmendment).toHaveBeenCalledWith({ id: 'amendment', event_id: 'event' });

    const missingBranch = renderWorkflow('edit', { processBranchId: undefined });
    expect(await missingBranch.result.current.submitToEvent('event')).toBe(false);
    missingBranch.unmount();

    mocks.waitForClientApply.mockRejectedValueOnce(new Error('submit failed'));
    const failed = renderWorkflow('edit');
    expect(await failed.result.current.submitToEvent('event')).toBe(false);
  });

  it('adds a supporter and covers its guarded error path', async () => {
    const workflow = renderWorkflow();
    expect(await workflow.result.current.addGroupSupporter()).toBe(true);

    mocks.toastSuccess.mockImplementationOnce(() => {
      throw new Error('toast failed');
    });
    expect(await workflow.result.current.addGroupSupporter()).toBe(false);
  });

  it('finalizes passed and rejected outcomes and handles invalid or failed finalization', async () => {
    mocks.canTransition.mockReturnValue(false);
    const invalid = renderWorkflow('event_final_closing_vote');
    expect(await invalid.result.current.finalizeAmendment('passed')).toBe(false);
    invalid.unmount();

    mocks.canTransition.mockReturnValue(true);
    const passed = renderWorkflow('event_final_closing_vote');
    expect(await passed.result.current.finalizeAmendment('passed')).toBe(true);
    expect(await passed.result.current.finalizeAmendment('rejected')).toBe(true);
    passed.unmount();

    const missingBranch = renderWorkflow('event_final_closing_vote', { processBranchId: '' });
    expect(await missingBranch.result.current.finalizeAmendment('passed')).toBe(false);
    missingBranch.unmount();

    mocks.waitForClientApply.mockRejectedValueOnce(new Error('finalize failed'));
    const failed = renderWorkflow('event_final_closing_vote');
    expect(await failed.result.current.finalizeAmendment('rejected')).toBe(false);
  });
});
