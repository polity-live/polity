import { describe, expect, it, vi } from 'vitest';

import { attachProcessTaskToEvent } from '../attachProcessTaskToEvent';

const mocks = vi.hoisted(() => ({
  waitForClientApply: vi.fn(async (_result: unknown) => undefined),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (result: unknown) => mocks.waitForClientApply(result),
}));

describe('attachProcessTaskToEvent', () => {
  it('completes the task, waits for the client apply and returns the mutation result', async () => {
    const mutationResult = {
      client: Promise.resolve(),
      server: Promise.resolve({ type: 'success' as const }),
    };
    const completeProcessTaskWithEvent = vi.fn(() => mutationResult);

    await expect(
      attachProcessTaskToEvent({
        task: { id: 'task-1', process_run_id: 'run-1' },
        event: { id: 'event-1' },
        description: 'Discuss during the assembly',
        completeProcessTaskWithEvent,
      })
    ).resolves.toBe(mutationResult);

    expect(completeProcessTaskWithEvent).toHaveBeenCalledWith({
      process_task_id: 'task-1',
      event_id: 'event-1',
      description: 'Discuss during the assembly',
    });
    expect(mocks.waitForClientApply).toHaveBeenCalledWith(mutationResult);
  });
});
