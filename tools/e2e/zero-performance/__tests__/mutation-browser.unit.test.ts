import { describe, expect, it } from 'vitest';
import { browserMutationRouteURL, measureBrowserMutationPhases } from '../mutation-browser';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(complete => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe('browser mutation phase measurements', () => {
  it('resolves every action route absolutely for the journeys context without baseURL', () => {
    const currentURL = 'http://127.0.0.1:18880';
    for (const path of [
      '/group/fixture/settings',
      '/messages',
      '/group/fixture/memberships',
      '/event/fixture/agenda/fixture',
    ]) {
      expect(browserMutationRouteURL(path, currentURL)).toBe(`http://127.0.0.1:18880${path}`);
    }
  });

  it('requires the configured benchmark origin rather than guessing from page location', () => {
    expect(() => browserMutationRouteURL('/messages', undefined)).toThrow(
      'Benchmark application URL is required'
    );
    expect(() => browserMutationRouteURL('/messages', 'about:blank')).toThrow(
      'Benchmark application URL must use HTTP'
    );
  });

  it('requires a visible response and observes committed SQL independently of UI completion', async () => {
    const visible = deferred();
    const committed = deferred();
    const started = deferred();
    let time = 10;
    let finalCalls = 0;
    const recorded: [string, number][] = [];
    const run = measureBrowserMutationPhases(
      {
        perform: async () => {
          time = 12;
        },
        visibleReaction: () => visible.promise,
        committedState: () => {
          started.resolve();
          return committed.promise;
        },
        finalVisibleState: async () => {
          finalCalls++;
          time = 40;
        },
      },
      (phase, elapsed) => recorded.push([phase, elapsed]),
      () => time
    );
    await started.promise;
    expect(recorded).toEqual([]); // Clicking alone cannot create a UI or server metric.
    time = 20;
    committed.resolve();
    await committed.promise;
    await Promise.resolve();
    expect(recorded).toEqual([['serverConfirmedMs', 10]]);
    expect(finalCalls).toBe(0);
    time = 30;
    visible.resolve();
    await run;
    expect(recorded).toEqual([
      ['serverConfirmedMs', 10],
      ['uiMs', 20],
      ['finalVisibleMs', 30],
    ]);
    expect(finalCalls).toBe(1);
  });

  it('waits for every started observer before rejecting, so cleanup cannot race SQL polling', async () => {
    const committed = deferred();
    const started = deferred();
    const error = new Error('visible state missing');
    let finalCalls = 0;
    let finished = false;
    const run = measureBrowserMutationPhases(
      {
        perform: async () => undefined,
        visibleReaction: async () => {
          throw error;
        },
        committedState: () => {
          started.resolve();
          return committed.promise;
        },
        finalVisibleState: async () => {
          finalCalls++;
        },
      },
      () => undefined
    );
    const observed = run.catch(reason => {
      finished = true;
      return reason;
    });
    await started.promise;
    await Promise.resolve();
    expect(finished).toBe(false);
    committed.resolve();
    expect(await observed).toBe(error);
    expect(finalCalls).toBe(0);
  });

  it('does not start observers when the actual UI action fails', async () => {
    let calls = 0;
    await expect(
      measureBrowserMutationPhases(
        {
          perform: async () => {
            throw new Error('button unavailable');
          },
          visibleReaction: async () => {
            calls++;
          },
          committedState: async () => {
            calls++;
          },
          finalVisibleState: async () => {
            calls++;
          },
        },
        () => {
          calls++;
        }
      )
    ).rejects.toThrow('button unavailable');
    expect(calls).toBe(0);
  });
});
