/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn((mutation: unknown) => ({ mutation })),
  onServerError: vi.fn((_result: unknown, callback: (message: string) => void) =>
    callback('server-error')
  ),
  trackCreation: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: mocks.mutate }),
}));

vi.mock('@/zero/mutators', () => ({
  mutators: {
    documents: new Proxy(
      {},
      {
        get: (_target, name) => (args: unknown) => ({ name, args }),
      }
    ),
  },
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  onServerError: mocks.onServerError,
}));

vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: { success: mocks.success, error: mocks.error },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/notifications/utils/mutation-finalization', () => ({
  trackCreationUnlessSilent: mocks.trackCreation,
}));

import { useDocumentActions } from '../useDocumentActions';

beforeEach(() => vi.clearAllMocks());

it('invokes every document action and every optimistic error callback', () => {
  const { result } = renderHook(() => useDocumentActions());
  const actions = result.current;
  const args = { id: 'entity-id' } as never;

  expect(actions.createDocument(args)).toBeDefined();
  expect(actions.updateDocument(args)).toBeDefined();
  expect(actions.updateGroupDocumentTitle(args)).toBeDefined();
  expect(actions.deleteDocument('document-id')).toBeDefined();
  expect(actions.createVersion(args)).toBeDefined();
  expect(actions.updateVersion(args)).toBeDefined();
  expect(actions.deleteVersion('version-id')).toBeDefined();
  expect(actions.createThread(args)).toBeDefined();
  expect(actions.voteThread(args)).toBeDefined();
  expect(actions.updateThreadVote(args)).toBeDefined();
  expect(actions.deleteThreadVote('thread-vote-id')).toBeDefined();
  expect(actions.updateThread(args)).toBeDefined();
  expect(actions.addComment(args)).toBeDefined();
  expect(actions.voteComment(args)).toBeDefined();
  expect(actions.updateCommentVote(args)).toBeDefined();
  expect(actions.deleteCommentVote('comment-vote-id')).toBeDefined();
  expect(actions.updateComment(args)).toBeDefined();
  expect(actions.addCollaborator(args)).toBeDefined();

  expect(mocks.mutate).toHaveBeenCalledTimes(18);
  expect(mocks.trackCreation).toHaveBeenCalledTimes(5);
  expect(mocks.onServerError).toHaveBeenCalledTimes(13);
  expect(mocks.success).toHaveBeenCalledTimes(2);
  expect(mocks.error).toHaveBeenCalledTimes(11);
});
