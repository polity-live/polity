import { expect, it, vi } from 'vitest';
import { observeStudio } from '../observe';
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
it('coalesces changes, rejects stale results and disposes views across project switches', async () => {
  let notify!: () => void;
  const view = {
    addListener: (listener: () => void) => {
      notify = listener;
      return () => undefined;
    },
    destroy: vi.fn(),
  };
  const pending: { resolve: (v: string) => void; reject: (e: unknown) => void }[] = [];
  const load = vi.fn(
    () => new Promise<string>((resolve, reject) => pending.push({ resolve, reject }))
  );
  const next = vi.fn(),
    failed = vi.fn();
  const dispose = observeStudio([view], load, next, failed);
  notify();
  notify();
  await flush();
  expect(load).toHaveBeenCalledOnce();
  notify();
  await flush();
  pending[0].resolve('old');
  await flush();
  expect(next).not.toHaveBeenCalled();
  pending[1].resolve('current');
  await flush();
  expect(next).toHaveBeenCalledWith('current');
  notify();
  await flush();
  pending[2].reject(new Error('network'));
  await flush();
  expect(failed).toHaveBeenCalledOnce();
  notify();
  await flush();
  notify();
  await flush();
  pending[3].reject(new Error('stale'));
  await flush();
  expect(failed).toHaveBeenCalledOnce();
  dispose();
  pending[4].resolve('unmounted');
  await flush();
  expect(next).toHaveBeenCalledOnce();
  notify();
  await flush();
  expect(load).toHaveBeenCalledTimes(5);
  expect(view.destroy).toHaveBeenCalledOnce();
  const dispose2 = observeStudio([view], load, next, failed);
  await flush();
  dispose2();
  pending[5].reject(new Error('late'));
  await flush();
  expect(failed).toHaveBeenCalledOnce();
});
