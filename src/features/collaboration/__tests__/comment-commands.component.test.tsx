/* @vitest-environment jsdom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CommentCommands, useCommentCommands } from '../ui/CommentCommands';

afterEach(cleanup);

it('uses only the commands provided by the owning editor and defaults to no shared commands', async () => {
  expect(renderHook(useCommentCommands).result.current).toBeNull();
  const remove = vi.fn(async () => undefined);
  const hook = renderHook(useCommentCommands, {
    wrapper: ({ children }) => (
      <CommentCommands.Provider value={{ remove }}>{children}</CommentCommands.Provider>
    ),
  });
  await act(() => hook.result.current!.remove('owned-comment'));
  expect(remove).toHaveBeenCalledExactlyOnceWith('owned-comment');
});
