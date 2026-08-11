/* @vitest-environment jsdom */

import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createIntentTask: vi.fn(),
  preload: vi.fn(),
  preloadRoute: vi.fn(),
  routerStatus: 'idle',
  run: vi.fn(),
  user: { id: 'user-1' } as { id: string } | null,
  withDependencies: vi.fn((task: unknown) => task),
  zeroHasRun: true,
}));

vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({
    preload: mocks.preload,
    ...(mocks.zeroHasRun ? { run: mocks.run } : {}),
  }),
}));
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ preloadRoute: mocks.preloadRoute }),
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ status: mocks.routerStatus }),
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('../route-manifests', () => ({ createIntentTaskForHref: mocks.createIntentTask }));
vi.mock('../task-dependencies', () => ({ withWikiTaskDependencies: mocks.withDependencies }));

import {
  PrioritizedPreloadProvider,
  useActivePreloadTask,
  useIdlePreloadTasks,
  usePreloadCoordinator,
  useVisiblePreloadRoutes,
  type PreloadTask,
} from '../preload-coordinator';

const activeTask: PreloadTask = {
  key: 'active',
  entries: [{ key: 'active-query', query: {} }],
  route: { href: '/active' },
};

let latestContext: ReturnType<typeof usePreloadCoordinator>;

function Consumer() {
  latestContext = usePreloadCoordinator();
  useActivePreloadTask(activeTask);
  useActivePreloadTask(undefined);
  useIdlePreloadTasks('scope', [activeTask], 2);
  useVisiblePreloadRoutes(['/active']);
  return null;
}

function BareHooks() {
  useActivePreloadTask(activeTask);
  useIdlePreloadTasks('scope', [activeTask], 2, true);
  useVisiblePreloadRoutes(['/active']);
  return null;
}

describe('prioritized preload provider and hooks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.user = { id: 'user-1' };
    mocks.zeroHasRun = true;
    mocks.routerStatus = 'idle';
    mocks.preload.mockReturnValue({ cleanup: vi.fn(), complete: Promise.resolve() });
    mocks.preloadRoute.mockResolvedValue(undefined);
    mocks.createIntentTask.mockImplementation((href: string) =>
      href === '/none' ? undefined : { ...activeTask, key: `intent:${href}`, route: { href } }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('coordinates active, idle, visible, begin, cancel, availability, and cleanup effects', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.preloadRoute.mockRejectedValueOnce(new Error('route unavailable'));
    const view = render(
      <PrioritizedPreloadProvider>
        <Consumer />
      </PrioritizedPreloadProvider>
    );
    await Promise.resolve();
    expect(latestContext).toBeTruthy();

    latestContext?.beginIntent('/intent');
    latestContext?.beginIntent('/none');
    latestContext?.cancelIntent('/intent');
    latestContext?.cancelIntent('/none');
    expect(mocks.withDependencies).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(50);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    window.dispatchEvent(new Event('online'));
    expect(warning).toHaveBeenCalled();
    view.unmount();
  });

  it('supports missing context, user, and Zero run capability', () => {
    render(<BareHooks />);
    mocks.user = null;
    mocks.zeroHasRun = false;
    render(
      <PrioritizedPreloadProvider>
        <Consumer />
      </PrioritizedPreloadProvider>
    );
    latestContext?.beginIntent('/plain');
    latestContext?.cancelIntent('/plain');
    expect(mocks.createIntentTask).toHaveBeenCalledWith('/plain', undefined);
  });
});
