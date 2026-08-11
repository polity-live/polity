/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gatedToast } from '@/features/notifications/utils/gated-toast';
import {
  clearCreateRecoveryDraft,
  consumeCreateRestoreDraft,
  getCreateFinalizationEntityKind,
  getCreateRecoveryDraft,
  getCreateRecoveryDraftForEntity,
  isCreateRecoveryDraftExpired,
  markCreateRecoveryDraftFailed,
  pruneExpiredCreateRecoveryDrafts,
  routeForCreateTarget,
  saveCreateRecoveryDraft,
  setCreateRestoreDraft,
  subscribeCreateRecoveryDrafts,
  trackCreateFinalization,
  useCreateRecoveryDraft,
  waitForOptimisticCreate,
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

  it('rejects incomplete entity identities', () => {
    expect(getCreateRecoveryDraftForEntity(null, 'group-1')).toBeNull();
    expect(getCreateRecoveryDraftForEntity('group', undefined)).toBeNull();

    const { result } = renderHook(() => useCreateRecoveryDraft(undefined, 'group-1'));
    expect(result.current).toBeNull();
  });

  it('invalidates corrupt and expired storage records when read', () => {
    window.sessionStorage.setItem('polity:create:recovery:corrupt', '{');
    expect(getCreateRecoveryDraft('corrupt')).toBeNull();
    expect(window.sessionStorage.getItem('polity:create:recovery:corrupt')).toBeNull();

    const expired = createDraft({ id: 'expired', submittedAt: 1 });
    window.sessionStorage.setItem('polity:create:recovery:expired', JSON.stringify(expired));
    expect(getCreateRecoveryDraft('expired')).toBeNull();
    expect(window.sessionStorage.getItem('polity:create:recovery:expired')).toBeNull();
  });

  it('reuses a cached snapshot while raw storage is unchanged', () => {
    const draft = createDraft();
    saveCreateRecoveryDraft(draft);
    const first = getCreateRecoveryDraft(draft.id);
    const second = getCreateRecoveryDraft(draft.id);
    expect(second).toBe(first);
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

  it('ignores missing failures and normalizes string and unknown errors', () => {
    markCreateRecoveryDraftFailed('missing', 'ignored');
    expect(getCreateRecoveryDraft('missing')).toBeNull();

    const draft = createDraft();
    saveCreateRecoveryDraft(draft);
    markCreateRecoveryDraftFailed(draft.id, 'server text');
    expect(getCreateRecoveryDraft(draft.id)?.status).toBe('failed');

    saveCreateRecoveryDraft(draft);
    markCreateRecoveryDraftFailed(draft.id, { reason: 'unknown' });
    expect(getCreateRecoveryDraft(draft.id)?.status).toBe('failed');
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

  it('removes a corrupt restore record', () => {
    window.sessionStorage.setItem('polity:create:restore', '{');
    expect(consumeCreateRestoreDraft('group')).toBeNull();
    expect(window.sessionStorage.getItem('polity:create:restore')).toBeNull();
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

  it('prunes null and corrupt recovery values while preserving valid and unrelated entries', () => {
    const now = Date.now();
    const valid = createDraft({ id: 'valid', submittedAt: now });
    window.sessionStorage.setItem('unrelated', 'value');
    window.sessionStorage.setItem('polity:create:recovery:null', 'null');
    window.sessionStorage.setItem('polity:create:recovery:corrupt', '{');
    window.sessionStorage.setItem('polity:create:recovery:valid', JSON.stringify(valid));

    pruneExpiredCreateRecoveryDrafts(now + 1, 100);

    expect(window.sessionStorage.getItem('unrelated')).toBe('value');
    expect(window.sessionStorage.getItem('polity:create:recovery:null')).toBeNull();
    expect(window.sessionStorage.getItem('polity:create:recovery:corrupt')).toBeNull();
    expect(getCreateRecoveryDraft('valid')).toMatchObject({ id: 'valid' });
  });

  it('leaves storage untouched when nothing is expired', () => {
    const event = vi.fn();
    window.addEventListener('polity:create:recovery-drafts-changed', event);
    window.sessionStorage.setItem(
      'polity:create:recovery:valid-only',
      JSON.stringify(createDraft({ id: 'valid-only', submittedAt: 20_000 }))
    );
    pruneExpiredCreateRecoveryDrafts(20_001, 100);
    expect(event).not.toHaveBeenCalled();
    window.removeEventListener('polity:create:recovery-drafts-changed', event);
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

  it('reacts only to relevant cross-tab storage events', () => {
    const { result } = renderHook(() => useCreateRecoveryDraft('group', 'group-1'));
    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' }));
    expect(result.current).toBeNull();

    act(() => {
      window.sessionStorage.setItem(
        'polity:create:recovery:group:group-1',
        JSON.stringify(createDraft())
      );
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'polity:create:recovery:group:group-1' })
      );
    });
    expect(result.current).toMatchObject({ id: 'group:group-1' });

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'polity:create:restore' }));
    });
    expect(result.current).toMatchObject({ id: 'group:group-1' });
  });

  it('treats the exact expiry boundary as valid', () => {
    expect(isCreateRecoveryDraftExpired({ submittedAt: 100 }, 200, 100)).toBe(false);
    expect(isCreateRecoveryDraftExpired({ submittedAt: 99 }, 200, 100)).toBe(true);
  });

  it('keeps every storage operation inert when browser storage is unavailable', () => {
    const browserWindow = window;
    vi.stubGlobal('window', undefined);
    try {
      expect(getCreateRecoveryDraft('missing')).toBeNull();
      expect(consumeCreateRestoreDraft('group')).toBeNull();
      expect(subscribeCreateRecoveryDrafts(vi.fn())).toEqual(expect.any(Function));
      pruneExpiredCreateRecoveryDrafts();
      saveCreateRecoveryDraft(createDraft());
      clearCreateRecoveryDraft('missing');
      setCreateRestoreDraft(createDraft());
    } finally {
      vi.stubGlobal('window', browserWindow);
    }
  });

  it('builds external and encoded internal recovery routes', () => {
    expect(
      routeForCreateTarget({
        kind: 'external',
        entityType: 'group',
        href: 'https://example.test/return',
      })
    ).toBe('https://example.test/return');
    expect(
      routeForCreateTarget({
        kind: 'route',
        entityType: 'group',
        to: '/group/$id/member/{member}',
        params: { id: 'a/b', member: 'Ada Lovelace' },
        search: { tab: 'members', page: 2, empty: '', absent: undefined, nil: null },
        hash: 'public notes',
      })
    ).toBe('/group/a%2Fb/member/Ada%20Lovelace?tab=members&page=2&empty=#public%20notes');
    expect(routeForCreateTarget({ kind: 'route', entityType: 'group', to: '/groups' })).toBe(
      '/groups'
    );
  });

  it('waits for present and absent optimistic client promises', async () => {
    const client = vi.fn();
    await waitForOptimisticCreate({ client: Promise.resolve().then(client) } as never);
    expect(client).toHaveBeenCalledOnce();
    await expect(waitForOptimisticCreate({} as never)).resolves.toBeUndefined();
  });

  it.each([
    ['agenda_item', 'agendaItem'],
    ['election', 'candidate'],
    ['group', 'group'],
    ['event', 'event'],
    ['amendment', 'amendment'],
    ['blog', 'blog'],
    ['statement', 'statement'],
    ['todo', 'todo'],
    ['payment', 'payment'],
    ['user', 'document'],
  ] as const)('maps %s finalization to %s', (entityType, expected) => {
    expect(getCreateFinalizationEntityKind(createDraft({ entityType } as any))).toBe(expected);
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

    const errorOptions = vi.mocked(gatedToast.finalizationError).mock.calls.at(-1)?.[1] as any;
    errorOptions.action.onClick();
    expect(consumeCreateRestoreDraft('group')).toMatchObject({ id: draft.id });
    clearCreateRecoveryDraft(draft.id);
    errorOptions.action.onClick();
    expect(consumeCreateRestoreDraft('group')).toMatchObject({ id: draft.id });
    errorOptions.cancel.onClick();
    expect(retry).toHaveBeenCalledOnce();
  });

  it('omits the retry action when no retry callback is supplied', async () => {
    const draft = createDraft({ id: 'group:without-retry' });
    trackCreateFinalization({
      result: {
        server: Promise.resolve({
          type: 'error',
          error: { type: 'server', message: 'Rejected' },
        }),
      },
      draft,
    });

    await vi.waitFor(() => expect(gatedToast.finalizationError).toHaveBeenCalled());
    const errorOptions = vi.mocked(gatedToast.finalizationError).mock.calls.at(-1)?.[1] as any;
    expect(errorOptions.cancel).toBeUndefined();
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
