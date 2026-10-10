import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Zero } from '@rocicorp/zero';
import { initializeAppQueries } from '../startup';
import { createCoreZeroPreloadEntries } from '../global';
import { createSearchDocumentPageArgs } from '../search-context';
import { preloadKey, retainZeroPreloadHandle } from '../preload-registry';
import type { PreloadLifecycleEvent } from '../query-lifecycle';

function client(userID?: string) {
  let resolve!: () => void;
  const complete = new Promise<void>(done => (resolve = done));
  const cleanup = vi.fn();
  const zero = { userID, clientID: userID ?? '', preload: vi.fn(() => ({ complete, cleanup })) };
  return { zero, resolve, cleanup, complete };
}

function browser(href: string) {
  const events: PreloadLifecycleEvent[] = [];
  vi.stubGlobal('window', { location: { href } });
  vi.stubGlobal('__zeroPerformancePreload', (event: PreloadLifecycleEvent) => events.push(event));
  return events;
}

afterEach(() => vi.unstubAllGlobals());

describe('initial authenticated query registration', () => {
  it.each(['/', '/messages', '/user/viewer'])(
    'registers unique initial demand at %s',
    async pathname => {
      const events = browser(`https://app.example.test${pathname}`);
      const state = client('viewer');
      initializeAppQueries(state.zero as unknown as Zero);
      const keys = events.filter(event => event.phase === 'preload-start').map(event => event.key);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys).toContain(preloadKey('queries.users.current', {}));
      if (pathname === '/messages') {
        expect(keys).toContain(
          preloadKey('queries.messages.conversationsWithRelations', { limit: 20 })
        );
        expect(keys.some(key => key.startsWith('queries.messages.conversationById:'))).toBe(false);
      }
      if (pathname === '/') expect(keys).toHaveLength(4);
      state.resolve();
      await state.complete;
      expect(state.cleanup).toHaveBeenCalledTimes(keys.length);
    }
  );
  it('does not register signed-out or server-side demand', () => {
    browser('https://app.example.test/search?q=budget');
    for (const userID of [undefined, 'anon']) {
      const state = client(userID);
      initializeAppQueries(state.zero as unknown as Zero);
      expect(state.zero.preload).not.toHaveBeenCalled();
    }
    vi.stubGlobal('window', undefined);
    const state = client('viewer');
    initializeAppQueries(state.zero as unknown as Zero);
    expect(state.zero.preload).not.toHaveBeenCalled();
  });

  it('registers the exact initial search before child effects and keeps background routes out', async () => {
    const events = browser(
      'https://app.example.test/search?q=budget&types=group&topics=climate&sort=trending'
    );
    const state = client('viewer');
    initializeAppQueries(state.zero as unknown as Zero);
    const starts = events.filter(event => event.phase === 'preload-start');
    expect(starts).toHaveLength(7);
    expect(starts[0]?.key).toContain('queries.search.searchDocumentPage:');
    expect(starts.map(event => event.key)).toContain(
      preloadKey(
        'queries.search.searchDocumentPage',
        createSearchDocumentPageArgs({
          q: 'budget',
          types: 'group',
          topics: 'climate',
          sort: 'trending',
        })
      )
    );
    expect(starts.every(event => event.ttl === '10m')).toBe(true);
    expect(starts.some(event => /messages\.conversations|events\./.test(event.key))).toBe(false);
    expect(state.cleanup).not.toHaveBeenCalled();
    state.resolve();
    await state.complete;
    expect(state.cleanup).toHaveBeenCalledTimes(7);
  });

  it('uses the selected conversation and the shared visible-page limits', async () => {
    const events = browser('https://app.example.test/messages?conversationId=selected');
    const state = client('viewer');
    initializeAppQueries(state.zero as unknown as Zero);
    const keys = events.map(event => event.key);
    expect(keys).toContain(preloadKey('queries.messages.conversationById', { id: 'selected' }));
    expect(keys).toContain(
      preloadKey('queries.messages.messagesWindow', { conversation_id: 'selected', limit: 80 })
    );
    expect(keys).toContain(
      preloadKey('queries.messages.conversationsWithRelations', { limit: 20 })
    );
    state.resolve();
    await state.complete;
  });

  it('releases only the initial reference when an active shell joins the same query', async () => {
    browser('https://app.example.test/onboarding');
    const first = client('first-viewer');
    const second = client('second-viewer');
    initializeAppQueries(first.zero as unknown as Zero);
    initializeAppQueries(second.zero as unknown as Zero);
    const joined = retainZeroPreloadHandle(
      first.zero,
      createCoreZeroPreloadEntries('first-viewer')[0]!
    );
    expect(first.zero.preload).toHaveBeenCalledTimes(4);
    expect(second.zero.preload).toHaveBeenCalledTimes(4);
    first.resolve();
    second.resolve();
    await Promise.all([first.complete, second.complete]);
    expect(first.cleanup).toHaveBeenCalledTimes(3);
    expect(second.cleanup).toHaveBeenCalledTimes(4);
    joined.release();
    expect(first.cleanup).toHaveBeenCalledTimes(4);
  });
});
