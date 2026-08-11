/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  mutatorCalls: [] as { domain: string; name: string; args: unknown }[],
  onServerError: vi.fn(),
  trackCreation: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  editingModeOption: vi.fn(),
}));

vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.mutate }) }));
vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: { error: mocks.toastError, success: mocks.toastSuccess },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: unknown) => `${key}${values ? JSON.stringify(values) : ''}`,
  }),
}));
vi.mock('@/features/shared/ui/status', () => ({
  getEditingModeOption: (mode: string, t: unknown) => mocks.editingModeOption(mode, t),
}));
vi.mock('../../mutate-with-server-check', () => ({
  onServerError: (result: unknown, callback: () => void) => mocks.onServerError(result, callback),
}));
vi.mock('@/features/notifications/utils/mutation-finalization', () => ({
  trackCreationUnlessSilent: (...args: unknown[]) => mocks.trackCreation(...args),
}));
vi.mock('../../mutators', () => {
  const domain = (domainName: string) =>
    new Proxy<Record<string, (args: unknown) => unknown>>(
      {},
      {
        get: (_target, property: string) => (args: unknown) => {
          const call = { domain: domainName, name: property, args };
          mocks.mutatorCalls.push(call);
          return call;
        },
      }
    );
  return { mutators: { amendments: domain('amendments'), common: domain('common') } };
});

import { useAmendmentActions } from '../useAmendmentActions';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mutatorCalls = [];
  mocks.mutate.mockImplementation(descriptor => ({ descriptor }));
  mocks.onServerError.mockImplementation((_result, callback: () => void) => callback());
  mocks.editingModeOption.mockReturnValue({ label: 'Mode label' });
});

describe('useAmendmentActions complete adapter contract', () => {
  it('executes every mutation adapter, success path, and registered server-error callback', () => {
    const { result } = renderHook(() => useAmendmentActions());
    const actions = result.current;
    const args = { id: 'entity-1', status: 'pending' } as never;

    actions.createAmendment({ id: 'amendment-1' } as never);
    actions.createAmendment({ id: 'amendment-silent' } as never, { notificationMode: 'silent' });
    actions.createFullAmendment({ amendment: { id: 'amendment-full' } } as never);
    actions.createFullAmendment({ amendment: { id: 'amendment-full-silent' } } as never, {
      notificationMode: 'silent',
    });
    actions.updateAmendment(args);
    actions.deleteAmendment('amendment-1');

    actions.requestCollaboration(args);
    actions.leaveCollaboration('collaborator-1');
    actions.acceptInvitation('collaborator-1');
    actions.updateCollaborator(args);
    actions.createCityDesign(args);
    actions.updateCityDesign(args);
    actions.deleteCityDesign('design-1');

    actions.updateEditingMode('branch-1', 'edit' as never);
    actions.submitToEvent('branch-1', 'event-1');
    actions.finalizeAmendment('branch-1', 'passed');
    actions.finalizeAmendment('branch-1', 'rejected');

    actions.createPath(args);
    actions.deletePath(args);
    actions.createPathSegment(args);
    actions.deletePathSegment(args);
    actions.createProcessRun(args);
    actions.updateProcessRun(args);
    actions.deleteProcessRun('run-1');
    actions.createProcessBranch(args);
    actions.updateProcessBranch(args);
    actions.deleteProcessBranch('branch-1');
    actions.createProcessStepRun(args);
    actions.updateProcessStepRun(args);
    actions.deleteProcessStepRun('step-1');
    actions.createProcessTask(args);
    actions.updateProcessTask(args);
    actions.deleteProcessTask('task-1');

    actions.createChangeRequest({ id: 'change-request-1' } as never);
    actions.createChangeRequest({ id: 'change-request-silent' } as never, {
      notificationMode: 'silent',
    });
    actions.createDocumentChangeRequest({ id: 'document-change-request-1' } as never);
    actions.createDocumentChangeRequest({ id: 'document-change-request-silent' } as never, {
      notificationMode: 'silent',
    });
    actions.createCityDesignChangeRequests(args);
    actions.deleteChangeRequest(args);
    actions.updateChangeRequest(args);
    actions.voteOnChangeRequest(args);
    actions.finalizeInternalChangeRequestVote(args);
    actions.finalizeExpiredInternalChangeRequestVotes(args);
    actions.repairInternalChangeRequestResolution(args);

    actions.supportAmendment(args);
    actions.updateSupportVote(args);
    actions.deleteSupportVote('support-1');
    actions.createSupportConfirmation(args);
    actions.updateSupportConfirmation({ id: 'support-1', status: 'confirmed' } as never);
    actions.updateSupportConfirmation({ id: 'support-1', status: 'declined' } as never);
    actions.updateSupportConfirmation({ id: 'support-1', status: 'pending' } as never);
    actions.upsertGroupDecision(args);
    actions.initializeProcessPath(args);
    actions.resolveProcessVote(args);
    actions.completeProcessTaskWithEvent(args);
    actions.replanProcessBranchEvents(args);

    actions.subscribe({ id: 'subscription-1', amendment_id: 'amendment-1' });
    actions.unsubscribe('subscription-1');

    expect(Object.keys(actions)).toHaveLength(51);
    expect(mocks.mutatorCalls.map(call => `${call.domain}.${call.name}`)).toEqual(
      expect.arrayContaining([
        'amendments.create',
        'amendments.createFull',
        'amendments.updateProcessBranch',
        'amendments.finalizeInternalChangeRequestVote',
        'amendments.replanProcessBranchEvents',
        'common.subscribe',
        'common.unsubscribe',
      ])
    );
    expect(mocks.mutate).toHaveBeenCalledTimes(mocks.mutatorCalls.length);
    expect(mocks.trackCreation).toHaveBeenCalledTimes(8);
    expect(mocks.onServerError).toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('features.amendments.toasts.supportConfirmed')
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('features.amendments.toasts.supportDeclined')
    );
  });
});
