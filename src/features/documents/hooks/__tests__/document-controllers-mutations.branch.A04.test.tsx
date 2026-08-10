/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  addCollaborator: vi.fn(),
  combine: vi.fn((..._args: unknown[]) => ({
    client: Promise.resolve(),
    server: Promise.resolve(),
  })),
  createAmendment: vi.fn(),
  createDocument: vi.fn(),
  deleteDocument: vi.fn(),
  facadeDocuments: [] as any[],
  navigate: vi.fn(),
  pql: { items: [] } as any,
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  track: vi.fn(),
  wait: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => state.navigate }));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: state.toastError, success: state.toastSuccess },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/zero/documents/useDocumentActions', () => ({
  useDocumentActions: () => ({
    addCollaborator: state.addCollaborator,
    createDocument: state.createDocument,
    deleteDocument: state.deleteDocument,
  }),
}));
vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({ createAmendment: state.createAmendment }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (...args: unknown[]) => state.wait(...args),
}));
vi.mock('@/features/notifications/utils/mutation-finalization', () => ({
  combineMutationResults: (...args: unknown[]) => state.combine(...args),
  trackMutationFinalization: (...args: unknown[]) => state.track(...args),
}));
vi.mock('../useGroupDocuments', () => ({
  useGroupDocuments: () => ({ documents: state.facadeDocuments, isLoading: false }),
}));
vi.mock('@/features/pql/hooks/usePqlCollection', () => ({
  usePqlCollection: () => state.pql,
}));

import { useCreateDocumentDialogController } from '../useCreateDocumentDialogController';
import { useDocumentMutations } from '../useDocumentMutations';
import { useGroupDocumentsList } from '../useGroupDocumentsList';

beforeEach(() => {
  vi.clearAllMocks();
  state.facadeDocuments = [];
  state.createAmendment.mockReturnValue({ client: Promise.resolve(), server: Promise.resolve() });
  state.createDocument.mockReturnValue({ client: Promise.resolve(), server: Promise.resolve() });
  state.addCollaborator.mockReturnValue({ client: Promise.resolve(), server: Promise.resolve() });
  state.deleteDocument.mockReturnValue({ client: Promise.resolve(), server: Promise.resolve() });
  state.wait.mockResolvedValue(undefined);
  vi.spyOn(crypto, 'randomUUID')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000002')
    .mockReturnValue('00000000-0000-4000-8000-000000000003');
});

afterEach(() => vi.restoreAllMocks());

describe('create document dialog controller remaining branches', () => {
  it('rejects blank titles and accepts a valid title', async () => {
    const onCreateDocument = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useCreateDocumentDialogController({ onCreateDocument, isCreating: false })
    );
    await act(() => result.current.onCreate());
    expect(onCreateDocument).not.toHaveBeenCalled();
    act(() => {
      result.current.onOpenChange(true);
      result.current.onTitleChange('Document');
    });
    await act(() => result.current.onCreate());
    expect(onCreateDocument).toHaveBeenCalledWith('Document');
    expect(result.current).toMatchObject({ isOpen: false, title: '' });
  });

  it('handles Enter, busy Enter, and unrelated keys independently', () => {
    const onCreateDocument = vi.fn(async () => undefined);
    const idle = renderHook(() =>
      useCreateDocumentDialogController({ onCreateDocument, isCreating: false })
    );
    act(() => idle.result.current.onTitleChange('Enter title'));
    act(() => idle.result.current.onKeyDown({ key: 'Other' } as never));
    act(() => idle.result.current.onKeyDown({ key: 'Enter' } as never));

    const busy = renderHook(() =>
      useCreateDocumentDialogController({ onCreateDocument, isCreating: true })
    );
    act(() => busy.result.current.onTitleChange('Busy title'));
    act(() => busy.result.current.onKeyDown({ key: 'Enter' } as never));
    expect(onCreateDocument).toHaveBeenCalledTimes(1);
  });
});

describe('document mutation remaining branches', () => {
  it('rejects a blank title and creates a valid document', async () => {
    const { result } = renderHook(() => useDocumentMutations('group-1'));
    await expect(result.current.createDocument('  ', 'group-1', 'user-1')).resolves.toBeNull();
    expect(state.toastError).toHaveBeenCalledTimes(1);

    await expect(result.current.createDocument('Title', 'group-1', 'user-1')).resolves.toBe(
      '00000000-0000-4000-8000-000000000002'
    );
    expect(state.track).toHaveBeenCalledOnce();
    expect(state.navigate).toHaveBeenCalledWith({
      to: '/group/group-1/editor/00000000-0000-4000-8000-000000000002',
    });
  });

  it('reports pre-finalization failure but suppresses duplicate post-finalization errors', async () => {
    const pre = renderHook(() => useDocumentMutations('group-1'));
    state.createAmendment.mockImplementationOnce(() => {
      throw new Error('early');
    });
    await expect(
      pre.result.current.createDocument('Title', 'group-1', 'user-1')
    ).resolves.toBeNull();
    expect(state.toastError).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    state.createAmendment.mockReturnValue({ client: Promise.resolve(), server: Promise.resolve() });
    state.createDocument.mockReturnValue({ client: Promise.resolve(), server: Promise.resolve() });
    state.addCollaborator.mockReturnValue({ client: Promise.resolve(), server: Promise.resolve() });
    state.wait.mockRejectedValueOnce(new Error('late'));
    const post = renderHook(() => useDocumentMutations('group-1'));
    await expect(
      post.result.current.createDocument('Title', 'group-1', 'user-1')
    ).resolves.toBeNull();
    expect(state.track).toHaveBeenCalledOnce();
    expect(state.toastError).not.toHaveBeenCalled();
  });

  it('deletes successfully and reports delete failures', async () => {
    const { result } = renderHook(() => useDocumentMutations('group-1'));
    await expect(result.current.deleteDocument('document-1')).resolves.toBe(true);
    expect(state.toastSuccess).toHaveBeenCalledOnce();
    state.wait.mockRejectedValueOnce(new Error('delete failed'));
    await expect(result.current.deleteDocument('document-1')).resolves.toBe(false);
    expect(state.toastError).toHaveBeenCalledOnce();
  });
});

describe('group documents list remaining branches', () => {
  it('skips creation without a user and creates when a user is present', async () => {
    const createDocument = state.createDocument;
    const missing = renderHook(() => useGroupDocumentsList({ groupId: 'group-1' }));
    await act(() => missing.result.current.onCreateDocument('Title'));
    expect(createDocument).not.toHaveBeenCalled();

    const present = renderHook(() =>
      useGroupDocumentsList({ groupId: 'group-1', groupName: 'Group', userId: 'user-1' })
    );
    await act(() => present.result.current.onCreateDocument('Title'));
    expect(createDocument).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: expect.any(Array), editing_mode: 'single' }),
      { notificationMode: 'silent' }
    );
  });
});
