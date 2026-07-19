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
  toastLoading: vi.fn(() => 'toast-1'),
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
});
