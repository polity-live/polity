import { describe, expect, it, vi } from 'vitest';
import { watchMutationObservation } from '../mutation-observation';
function view(initial?: { data: unknown; type: string }) {
  let callback!: (data: unknown, type: string) => void;
  const release = vi.fn();
  return {
    release,
    addListener(listener: typeof callback) {
      callback = listener;
      if (initial) callback(initial.data, initial.type);
      return release;
    },
    emit(data: unknown, type = 'complete') {
      callback(data, type);
    },
  };
}
describe('real post-invocation mutation observation', () => {
  it('rechecks a complete no-op baseline at its actual post-start observation time', async () => {
    const source = view({ data: 'expected', type: 'complete' });
    let clock = 10;
    const watcher = watchMutationObservation(
      source,
      data => data === 'expected',
      false,
      () => clock
    );
    let settled = false;
    void watcher.promise.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    clock = 21;
    watcher.arm();
    expect(await watcher.promise).toBe(21);
  });
  it('retains an early complete update until invocation arms the observer', async () => {
    const source = view({ data: false, type: 'complete' });
    const watcher = watchMutationObservation(source, Boolean, false, () => 33);
    source.emit(true);
    watcher.arm();
    expect(await watcher.promise).toBe(33);
  });
  it('waits for a later matching update instead of satisfying an ordinary false baseline', async () => {
    const source = view({ data: false, type: 'complete' });
    const watcher = watchMutationObservation(source, Boolean, false, () => 44);
    let settled = false;
    void watcher.promise.then(() => {
      settled = true;
    });
    watcher.arm();
    await Promise.resolve();
    expect(settled).toBe(false);
    source.emit(true);
    expect(await watcher.promise).toBe(44);
  });
  it('does not invent proof without a complete callback, including partial data', async () => {
    const source = view();
    const watcher = watchMutationObservation(source, () => true, false);
    let settled = false;
    void watcher.promise.then(() => {
      settled = true;
    });
    watcher.arm();
    source.emit(true, 'unknown');
    await Promise.resolve();
    expect(settled).toBe(false);
    watcher.cancel();
  });
  it('rejects error states before or after arming', async () => {
    for (const armed of [true, false]) {
      const source = view();
      const watcher = watchMutationObservation(source, () => true, armed);
      source.emit(null, 'error');
      watcher.arm();
      await expect(watcher.promise).rejects.toThrow('query rejected');
      watcher.cancel();
    }
  });
  it('unsubscribes once and ignores callbacks and arming after cleanup', async () => {
    const source = view({ data: true, type: 'complete' });
    const now = vi.fn(() => 99);
    const watcher = watchMutationObservation(source, Boolean, false, now);
    watcher.cancel();
    watcher.cancel();
    watcher.arm();
    source.emit(true);
    expect(source.release).toHaveBeenCalledOnce();
    expect(now).not.toHaveBeenCalled();
  });
});
