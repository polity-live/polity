/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gatedToast } from '@/features/notifications/utils/gated-toast';
import {
  clearCreateRecoveryDraft,
  consumeCreateRestoreDraft,
  getCreateRecoveryDraft,
  getCreateRecoveryDraftForEntity,
  markCreateRecoveryDraftFailed,
  pruneExpiredCreateRecoveryDrafts,
  saveCreateRecoveryDraft,
  setCreateRestoreDraft,
  trackCreateFinalization,
  useCreateRecoveryDraft,
  type CreateRecoveryDraft,
} from '../createFinalization';
import { parseAppError } from '@/features/shared/errors';

vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: {
    dismiss: vi.fn(),
    error: vi.fn(),
    finalizationError: vi.fn(),
    finalizationSuccess: vi.fn(),
    loading: vi.fn(),
  },
}));

function createDraft(overrides: Partial<CreateRecoveryDraft> = {}): CreateRecoveryDraft {
  return {
    id: 'group:group-1',
    entityType: 'group',
    entityId: 'group-1',
    createPath: '/create/group',
    formState: { name: 'Alpha' },
    mutationPayload: { group: { id: 'group-1' } },
    target: {
      kind: 'route',
      entityType: 'group',
      to: '/group/$id',
      params: { id: 'group-1' },
    },
    submittedAt: Date.now(),
    status: 'pending',
    ...overrides,
  };
}

describe('create recovery drafts', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('saves and resolves drafts by entity type and id', () => {
    saveCreateRecoveryDraft(createDraft());

    expect(getCreateRecoveryDraft('group:group-1')).toMatchObject({ status: 'pending' });
    expect(getCreateRecoveryDraftForEntity('group', 'group-1')).toMatchObject({
      entityId: 'group-1',
    });
  });

  it('marks drafts as failed with the server error message', () => {
    const draft = createDraft();
    saveCreateRecoveryDraft(draft);

    markCreateRecoveryDraftFailed(draft.id, new Error('Server rejected create'));

    expect(getCreateRecoveryDraft(draft.id)).toMatchObject({
      status: 'failed',
    });
    expect(parseAppError(getCreateRecoveryDraft(draft.id)?.errorMessage)).toMatchObject({
      code: 'mutation_server_failed',
    });
  });

  it('clears drafts', () => {
    const draft = createDraft();
    saveCreateRecoveryDraft(draft);

    clearCreateRecoveryDraft(draft.id);

    expect(getCreateRecoveryDraft(draft.id)).toBeNull();
  });

  it('consumes restore drafts once for the matching entity type', () => {
    const draft = createDraft();

    setCreateRestoreDraft(draft);

    expect(consumeCreateRestoreDraft<{ name: string }>('group')).toMatchObject({
      entityType: 'group',
      formState: { name: 'Alpha' },
    });
    expect(consumeCreateRestoreDraft('group')).toBeNull();
  });

  it('keeps restore drafts available when another create form asks first', () => {
    const draft = createDraft();

    setCreateRestoreDraft(draft);

    expect(consumeCreateRestoreDraft('event')).toBeNull();
    expect(consumeCreateRestoreDraft<{ name: string }>('group')).toMatchObject({
      formState: { name: 'Alpha' },
    });
  });

  it('prunes expired drafts', () => {
    const draft = createDraft({ submittedAt: 1_000 });
    saveCreateRecoveryDraft(draft);

    pruneExpiredCreateRecoveryDrafts(1_000 + 24 * 60 * 60 * 1000 + 1);

    expect(getCreateRecoveryDraft(draft.id)).toBeNull();
  });

  it('notifies same-tab subscribers when drafts change', () => {
    const { result } = renderHook(() => useCreateRecoveryDraft('group', 'group-1'));

    expect(result.current).toBeNull();

    act(() => {
      saveCreateRecoveryDraft(createDraft());
    });

    expect(result.current).toMatchObject({ status: 'pending' });

    act(() => {
      clearCreateRecoveryDraft('group:group-1');
    });

    expect(result.current).toBeNull();
  });
});

describe('create finalization tracking', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('turns the pending toast into a short success state after server success', async () => {
    const draft = createDraft();

    trackCreateFinalization({
      result: {
        server: Promise.resolve({ type: 'success' }),
      },
      draft,
    });

    expect(gatedToast.loading).toHaveBeenCalledWith(
      'Group is being finalized in the background…',
      expect.objectContaining({
        id: 'creation:group:group:group-1',
        testId: 'create-finalization-pending-toast',
      })
    );
    expect(getCreateRecoveryDraft(draft.id)).toMatchObject({ status: 'pending' });

    await vi.waitFor(() => expect(getCreateRecoveryDraft(draft.id)).toBeNull());

    expect(gatedToast.finalizationSuccess).toHaveBeenCalledWith('Group was created successfully.', {
      id: 'creation:group:group:group-1',
      duration: 1500,
      testId: 'create-finalization-saved-toast',
    });
  });

  it('turns the same toast into an error with recovery actions after server rejection', async () => {
    const draft = createDraft();
    const retry = vi.fn();

    trackCreateFinalization({
      result: {
        server: Promise.resolve({
          type: 'error',
          error: { type: 'server', message: 'Server rejected create' },
        }),
      },
      draft,
      retry,
    });

    await vi.waitFor(() =>
      expect(getCreateRecoveryDraft(draft.id)).toMatchObject({ status: 'failed' })
    );

    expect(getCreateRecoveryDraft(draft.id)).toMatchObject({
      status: 'failed',
    });
    expect(parseAppError(getCreateRecoveryDraft(draft.id)?.errorMessage)).toMatchObject({
      code: 'mutation_server_failed',
    });
    expect(gatedToast.finalizationError).toHaveBeenCalledWith(
      'Group could not be created.',
      expect.objectContaining({
        id: 'creation:group:group:group-1',
        description: 'Something went wrong. Please try again.',
        action: expect.objectContaining({ label: 'Restore' }),
        cancel: expect.objectContaining({ label: 'Retry', onClick: retry }),
      })
    );
    expect(gatedToast.finalizationSuccess).not.toHaveBeenCalled();
  });

  it('uses an entity-specific candidate message', async () => {
    const draft = createDraft();

    trackCreateFinalization({
      result: {
        server: Promise.resolve({ type: 'success' }),
      },
      draft: {
        ...draft,
        entityType: 'election',
        createPath: '/create/election-candidate',
      },
    });

    expect(gatedToast.loading).toHaveBeenCalledWith(
      'Candidacy is being finalized in the background…',
      expect.any(Object)
    );
  });
});
