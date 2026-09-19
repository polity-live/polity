/* @vitest-environment jsdom */
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
  query: vi.fn(),
  list: vi.fn(args => ({ list: args })),
  exports: vi.fn(args => ({ exports: args })),
}));
vi.mock('@rocicorp/zero/react', () => ({ useQuery: io.query }));
vi.mock('../../queries', () => ({ queries: { studio: { list: io.list, exports: io.exports } } }));
import { useStudioState } from '../useStudioState';
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('does not request private exports before selecting a project, then tracks its confirmed result', () => {
  io.query.mockReturnValue([undefined, { type: 'unknown' }]);
  const hook = renderHook(({ id }) => useStudioState(null, id), {
    initialProps: { id: undefined as string | undefined },
  });
  expect(hook.result.current).toMatchObject({ exports: [], isLoading: true });
  expect(io.exports).not.toHaveBeenCalled();
  expect(io.query).toHaveBeenCalledWith(undefined);
  io.query.mockImplementation((q: any) =>
    q.list
      ? [[{ id: 'project' }], { type: 'complete' }]
      : [[{ id: 'export', status: 'completed' }], { type: 'complete' }]
  );
  hook.rerender({ id: 'project' });
  expect(io.exports).toHaveBeenCalledWith({ projectId: 'project' });
  expect(hook.result.current).toMatchObject({
    projects: [{ id: 'project' }],
    exports: [{ status: 'completed' }],
    isLoading: false,
    exportResult: { type: 'complete' },
  });
});
