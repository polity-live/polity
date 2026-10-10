// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { browserMutationRouteURL, measureBrowserMutationPhases } from '../mutation-browser';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(complete => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe('browser mutation phase measurements', () => {
  it('distinguishes a real rendered message from controlled composer textarea text', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    try {
      const composer = (value: string) =>
        createElement('textarea', { value, onChange: () => undefined });
      flushSync(() => root.render(composer('')));
      flushSync(() => root.render(composer('Unsent regression message')));
      expect(container.querySelector('textarea')?.textContent).toBe('Unsent regression message');
      expect(container.querySelectorAll('[id^="message-"]')).toHaveLength(0);
      flushSync(() =>
        root.render(
          createElement(
            'div',
            null,
            composer('Unsent regression message'),
            createElement('div', { id: 'message-regression' }, 'Unsent regression message')
          )
        )
      );
      expect(container.querySelector('[id^="message-"]')?.textContent).toBe(
        'Unsent regression message'
      );
    } finally {
      flushSync(() => root.unmount());
      // React's scheduler still drains queued callbacks after synchronous commits.
      await new Promise<void>(resolve => setImmediate(resolve));
      container.remove();
    }
  });

  it('keeps mandatory reload verification outside the completed mutation duration', async () => {
    let time = 0;
    const recorded: [string, number][] = [];
    await measureBrowserMutationPhases(
      {
        perform: async () => {
          time = 100;
        },
        visibleReaction: async () => undefined,
        committedState: async () => undefined,
        finalVisibleState: async () => {
          time = 200;
        },
        reloadState: async () => {
          time = 3200;
        },
      },
      (phase, elapsed) => recorded.push([phase, elapsed]),
      () => time
    );
    expect(recorded).toEqual([
      ['uiMs', 100],
      ['serverConfirmedMs', 100],
      ['finalVisibleMs', 200],
      ['reloadVerificationMs', 3000],
    ]);
  });

  it('retains actual successful action timings but fails a missing durable state after reload', async () => {
    const recorded: string[] = [];
    await expect(
      measureBrowserMutationPhases(
        {
          perform: async () => undefined,
          visibleReaction: async () => undefined,
          committedState: async () => undefined,
          finalVisibleState: async () => undefined,
          reloadState: async () => {
            throw new Error('durable state missing');
          },
        },
        phase => recorded.push(phase)
      )
    ).rejects.toThrow('durable state missing');
    expect(recorded).toEqual(['uiMs', 'serverConfirmedMs', 'finalVisibleMs']);
  });

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
