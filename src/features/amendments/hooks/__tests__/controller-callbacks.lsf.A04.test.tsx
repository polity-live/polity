/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  failSubmission: false,
  reset: vi.fn(),
  retry: vi.fn(),
  updateDocument: vi.fn(),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => ({ supportConfirmations: [{ id: 'confirmation-1' }] }),
}));
vi.mock('@/zero/documents/useDocumentActions', () => ({
  useDocumentActions: () => ({ updateDocument: mocks.updateDocument }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/features/amendments/collaborators/hooks/useUserSearch', () => ({
  useUserSearch: () => ({ users: [], isLoading: false }),
}));
vi.mock('@/features/shared/ui/action-submission', () => ({
  useActionSubmission: () => ({
    isActive: false,
    reset: mocks.reset,
    retry: mocks.retry,
    runActionWithSubmission: async (
      action: () => Promise<unknown>,
      options?: { onSuccess?: () => void }
    ) => {
      if (mocks.failSubmission) throw new Error('submission failed');
      await action();
      options?.onSuccess?.();
    },
  }),
}));

import { useInviteDialogController } from '../../collaborators/hooks/useInviteDialogController';
import { useAmendmentProcessDetailsPanelController } from '../useAmendmentProcessDetailsPanelController';
import { useConfirmationRequestNoticeController } from '../useConfirmationRequestNoticeController';
import { useModeSelectorController } from '../useModeSelectorController';

afterEach(() => {
  cleanup();
  mocks.failSubmission = false;
  vi.clearAllMocks();
});

describe('amendment controller LSF contracts', () => {
  it('initializes and updates the process-details panel', () => {
    const { result } = renderHook(() => useAmendmentProcessDetailsPanelController(false));
    act(() => result.current.onOpenChange(true));
    expect(result.current.open).toBe(true);
    expect(result.current.labels.title).toBe('common.title');
  });

  it('runs confirmation accept and decline callbacks through their finally cleanup', async () => {
    const onConfirm = vi.fn();
    const onDecline = vi.fn();
    const { result } = renderHook(() =>
      useConfirmationRequestNoticeController({ userId: 'user-1', onConfirm, onDecline })
    );
    await act(async () => result.current.onConfirmClick('confirmation-1'));
    await act(async () => result.current.onDeclineClick('confirmation-1'));
    expect(onConfirm).toHaveBeenCalledWith('confirmation-1');
    expect(onDecline).toHaveBeenCalledWith('confirmation-1');
    expect(result.current.processingId).toBeNull();
  });

  it('persists an editing mode selection', async () => {
    const { result } = renderHook(() => useModeSelectorController({ documentId: 'document-1' }));
    await act(async () => result.current.handleModeChange('suggest_internal'));
    expect(mocks.updateDocument).toHaveBeenCalledWith({
      id: 'document-1',
      editing_mode: 'suggest_internal',
    });
  });

  it('cleans up invite submission success and failure callbacks', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onInviteUsers = vi.fn();
    const { result } = renderHook(() =>
      useInviteDialogController({
        amendmentId: 'amendment-1',
        existingCollaborators: [],
        roles: [{ id: 'role-1', name: 'Collaborator' }] as any,
        onInviteUsers,
      })
    );
    act(() => result.current.onSelectedUsersChange(['user-2']));
    act(() => result.current.onInviteUsersClick());
    await waitFor(() => expect(mocks.reset).toHaveBeenCalledOnce());

    mocks.failSubmission = true;
    act(() => result.current.onSelectedUsersChange(['user-3']));
    act(() => result.current.onInviteUsersClick());
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(result.current.isInviting).toBe(false);
  });
});
