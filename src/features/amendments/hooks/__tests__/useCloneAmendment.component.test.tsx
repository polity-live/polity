/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hookMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  createAmendment: vi.fn(() => ({
    client: Promise.resolve(),
    server: Promise.resolve({ type: 'success' as const }),
  })),
  updateAmendment: vi.fn(async () => undefined),
  addAmendmentCollaborator: vi.fn(),
  createDocument: vi.fn(() => ({
    client: Promise.resolve(),
    server: Promise.resolve({ type: 'success' as const }),
  })),
  createAmendmentPath: vi.fn(async () => undefined),
  waitForClientApply: vi.fn(async (result: unknown) => {
    void result;
  }),
  notifyAmendmentCloned: vi.fn(async (...args: unknown[]) => {
    void args;
  }),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastLoading: vi.fn((...args: unknown[]) => {
    void args;
    return 'toast-1';
  }),
  trackMutationFinalization: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => hookMocks.navigate,
}));

vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({
    createAmendment: hookMocks.createAmendment,
    updateAmendment: hookMocks.updateAmendment,
    addAmendmentCollaborator: hookMocks.addAmendmentCollaborator,
  }),
}));

vi.mock('@/zero/documents/useDocumentActions', () => ({
  useDocumentActions: () => ({
    createDocument: hookMocks.createDocument,
  }),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (result: unknown) => hookMocks.waitForClientApply(result),
}));

vi.mock('@/features/notifications/utils/mutation-finalization', () => ({
  combineMutationResults: (results: unknown[]) => results,
  trackMutationFinalization: (...args: unknown[]) => hookMocks.trackMutationFinalization(...args),
}));

vi.mock('../useCreateAmendmentPath', () => ({
  useCreateAmendmentPath: () => ({
    createAmendmentPath: hookMocks.createAmendmentPath,
  }),
}));

vi.mock('@/features/notifications/utils/notification-helpers.ts', () => ({
  notifyAmendmentCloned: (...args: unknown[]) => hookMocks.notifyAmendmentCloned(...args),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    success: (...args: unknown[]) => hookMocks.toastSuccess(...args),
    error: (...args: unknown[]) => hookMocks.toastError(...args),
    loading: (...args: unknown[]) => hookMocks.toastLoading(...args),
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, paramsOrFallback?: string | Record<string, unknown>) => {
    if (typeof paramsOrFallback === 'string') return paramsOrFallback;
    if (paramsOrFallback && typeof paramsOrFallback.valuea36c === 'string') {
      return `${paramsOrFallback.valuea36c} Clone`;
    }
    return _key;
  },
}));

import { useCloneAmendment } from '../useCloneAmendment';

const originalContent = [{ type: 'p', children: [{ text: 'Original text' }] }];

const amendment = {
  title: 'Original Amendment',
  code: 'A1',
  reason: 'Because',
  category: 'Policy',
  preamble: null,
  tags: ['traffic'],
  visibility: 'public',
  editing_mode: 'edit',
  discussions: [{ id: 'discussion-1' }],
  image_url: null,
  video_url: null,
  origin_amendment_id: null,
  document: { content: originalContent },
  documents: [],
};

const selection = {
  sourceGroupId: null,
  groupId: 'target-group',
  groupData: null,
  eventId: null,
  eventData: null,
  collaboratorUserId: 'user-1',
  pathWithEvents: [],
  pathMode: 'hierarchy' as const,
  workflowId: null,
};

beforeEach(() => {
  vi.spyOn(crypto, 'randomUUID')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000002');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.values(hookMocks).forEach(mock => mock.mockClear());
});

describe('useCloneAmendment', () => {
  it('opens the dialog only for authenticated users', () => {
    const anonymous = renderHook(() =>
      useCloneAmendment('source-amendment', amendment, undefined, undefined)
    );
    act(() => anonymous.result.current.handleClone());
    expect(anonymous.result.current.cloneDialogOpen).toBe(false);
    expect(hookMocks.toastError).toHaveBeenCalled();
    anonymous.unmount();

    const authenticated = renderHook(() =>
      useCloneAmendment('source-amendment', amendment, 'user-1', undefined)
    );
    act(() => authenticated.result.current.handleClone());
    expect(authenticated.result.current.cloneDialogOpen).toBe(true);
  });

  it('guards confirmation when authentication or amendment data is missing', async () => {
    const anonymous = renderHook(() =>
      useCloneAmendment('source-amendment', amendment, undefined, undefined)
    );
    await act(async () => anonymous.result.current.handleConfirmClone(selection));
    anonymous.unmount();

    const missing = renderHook(() =>
      useCloneAmendment('source-amendment', null, 'user-1', undefined)
    );
    await act(async () => missing.result.current.handleConfirmClone(selection));
    expect(hookMocks.toastError).toHaveBeenCalledTimes(2);
    expect(hookMocks.createAmendment).not.toHaveBeenCalled();
  });

  it('creates an independent clone document without copying collaborators or discussions', async () => {
    const { result } = renderHook(() =>
      useCloneAmendment('source-amendment', amendment, 'user-1', 'user@example.com')
    );

    await act(async () => {
      await result.current.handleConfirmClone(selection);
    });

    expect(hookMocks.createAmendment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000001',
        clone_source_id: 'source-amendment',
        document_id: null,
        discussions: [],
      }),
      { notificationMode: 'silent' }
    );
    expect(hookMocks.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000002',
        amendment_id: '00000000-0000-4000-8000-000000000001',
        content: originalContent,
      }),
      { notificationMode: 'silent' }
    );
    expect(hookMocks.updateAmendment).toHaveBeenCalledWith({
      id: '00000000-0000-4000-8000-000000000001',
      document_id: '00000000-0000-4000-8000-000000000002',
    });
    expect(hookMocks.addAmendmentCollaborator).not.toHaveBeenCalled();
    expect(hookMocks.createAmendmentPath).not.toHaveBeenCalled();
    expect(hookMocks.navigate).toHaveBeenCalledWith({
      to: '/amendment/00000000-0000-4000-8000-000000000001',
    });
  });

  it('clones all populated fields and builds an event path with forwarding states', async () => {
    const populated = {
      ...amendment,
      title: null,
      code: null,
      reason: null,
      category: null,
      preamble: 'Preamble',
      tags: null,
      visibility: null as any,
      image_url: 'image.png',
      video_url: 'video.mp4',
      country: 'DE',
      region: 'BE',
      post_code: '10115',
      city: 'Berlin',
      street: 'Street',
      house_number: '1',
      latitude: 52.5,
      longitude: 13.4,
      origin_amendment_id: 'origin',
      document: null,
      documents: [{ content: null }],
    };
    const eventSelection = {
      ...selection,
      eventId: 'selected-event',
      workflowId: 'workflow',
      pathMode: 'workflow' as const,
      pathWithEvents: [
        { groupId: 'plain', eventId: null, eventStartDate: null },
        { groupId: 'later', eventId: 'later-event', eventStartDate: '2026-09-01' },
        { groupId: 'empty-date', eventId: 'empty-event', eventStartDate: '' },
        { groupId: 'earlier', eventId: 'earlier-event', eventStartDate: '2026-08-01' },
      ],
    } as any;
    const { result } = renderHook(() =>
      useCloneAmendment('source-amendment', populated, 'user-1', undefined)
    );

    await act(async () => result.current.handleConfirmClone(eventSelection));

    expect(hookMocks.createAmendment).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.any(String),
        code: '',
        reason: '',
        category: '',
        preamble: 'Preamble',
        tags: [],
        visibility: 'public',
        image_url: 'image.png',
        video_url: 'video.mp4',
        country: 'DE',
        origin_amendment_id: 'origin',
      }),
      { notificationMode: 'silent' }
    );
    expect(hookMocks.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({ content: { type: 'doc', content: [] } }),
      { notificationMode: 'silent' }
    );
    expect(hookMocks.createAmendmentPath).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'workflow',
        pathMode: 'workflow',
        enrichedPath: expect.arrayContaining([
          expect.objectContaining({
            groupId: 'plain',
            forwardingStatus: 'previous_decision_outstanding',
          }),
          expect.objectContaining({ groupId: 'empty-date', forwardingStatus: 'forward_confirmed' }),
          expect.objectContaining({
            groupId: 'later',
            forwardingStatus: 'previous_decision_outstanding',
          }),
        ]),
      })
    );
    expect(hookMocks.trackMutationFinalization).toHaveBeenCalled();
  });

  it('does not create an empty selected-event path', async () => {
    const { result } = renderHook(() =>
      useCloneAmendment('source-amendment', amendment, 'user-1', undefined)
    );
    await act(async () =>
      result.current.handleConfirmClone({ ...selection, eventId: 'event', pathWithEvents: [] })
    );
    expect(hookMocks.createAmendmentPath).not.toHaveBeenCalled();
  });

  it('reports clone failures and always clears the loading state', async () => {
    hookMocks.waitForClientApply.mockRejectedValueOnce(new Error('clone failed'));
    const { result } = renderHook(() =>
      useCloneAmendment('source-amendment', amendment, 'user-1', undefined)
    );
    await act(async () => result.current.handleConfirmClone(selection));
    expect(hookMocks.toastError).toHaveBeenCalled();
    expect(result.current.isCloning).toBe(false);
  });
});
