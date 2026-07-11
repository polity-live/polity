import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { useZero } from '@rocicorp/zero/react';
import type { TTL } from '@rocicorp/zero';
import { useAuth } from '@/providers/auth-provider';
import { retainZeroPreloadHandle, type ZeroPreloadEntry } from './preload-registry';
import { createIntentTaskForHref } from './route-manifests';
import { withWikiTaskDependencies } from './task-dependencies';

export const PRELOAD_CACHE_TTL = '10m' as const;
export const PRELOAD_CACHE_TTL_MS = 10 * 60 * 1000;

export type PreloadTaskState = 'queued' | 'preloading' | 'ready' | 'failed';
export type PreloadTaskPriority = 1 | 2 | 3;

export interface PreloadRouteTarget {
  href: string;
}

export interface PreloadTask {
  key: string;
  entries: readonly ZeroPreloadEntry[];
  route: PreloadRouteTarget;
  resolveAfterComplete?: () => Promise<readonly ZeroPreloadEntry[]>;
}

interface PreloadableZero {
  preload: (
    query: unknown,
    options?: { ttl?: TTL }
  ) => { cleanup: () => void; complete: Promise<void> };
  run?: (
    query: unknown,
    options: { type: 'unknown' | 'complete'; ttl?: 'none' }
  ) => Promise<unknown>;
}

interface IdleScope {
  priority: PreloadTaskPriority;
  tasks: readonly PreloadTask[];
  visibleOnly: boolean;
}

interface RunningTask {
  generation: number;
  kind: 'foreground' | 'background';
  releases: (() => void)[];
  task: PreloadTask;
}

function normalizeHref(href: string): string {
  const queryIndex = href.indexOf('?');
  const hashIndex = href.indexOf('#');
  const cutAt = [queryIndex, hashIndex].filter(index => index >= 0).sort((a, b) => a - b)[0];
  const pathname = cutAt === undefined ? href : href.slice(0, cutAt);
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function canSpeculate(): boolean {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;

  const connection =
    typeof navigator === 'undefined'
      ? undefined
      : (
          navigator as Navigator & {
            connection?: { effectiveType?: string; saveData?: boolean };
          }
        ).connection;

  return (
    !connection?.saveData &&
    connection?.effectiveType !== 'slow-2g' &&
    connection?.effectiveType !== '2g'
  );
}

export class PreloadCoordinator {
  private readonly readyUntil = new Map<string, number>();
  private readonly failed = new Set<string>();
  private readonly scopes = new Map<string, IdleScope>();
  private readonly intentQueue = new Map<string, PreloadTask>();
  private readonly intentTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private visibleRoutes = new Set<string>();
  private running: RunningTask | null = null;
  private foregroundKey: string | null = null;
  private foregroundPending = false;
  private idleHandle: number | ReturnType<typeof setTimeout> | null = null;
  private idleUsesWindowApi = false;
  private generation = 0;
  private disposed = false;
  private routerIdle = true;

  constructor(
    private readonly zero: PreloadableZero,
    private readonly preloadRoute: (href: string) => unknown,
    private readonly now: () => number = () => Date.now()
  ) {}

  activate(task: PreloadTask) {
    if (this.disposed) return;
    this.foregroundKey = task.key;
    this.cancelScheduledIdle();

    if (this.running?.task.key === task.key) {
      this.running.task = task;
      this.running.kind = 'foreground';
      this.foregroundPending = true;
      return;
    }

    this.cancelRunning();
    this.intentQueue.delete(task.key);

    if (this.isReady(task.key)) {
      this.foregroundPending = false;
      void this.preloadRoute(task.route.href);
      this.scheduleIdle();
      return;
    }

    this.foregroundPending = true;
    this.start(task, 'foreground', 0);
  }

  deactivate(key: string) {
    if (this.foregroundKey !== key) return;
    this.foregroundKey = null;
    this.foregroundPending = false;
    if (this.running?.kind === 'foreground' && this.running.task.key === key) {
      this.cancelRunning();
    }
    this.scheduleIdle();
  }

  setIdleTasks(
    scope: string,
    tasks: readonly PreloadTask[],
    priority: PreloadTaskPriority,
    visibleOnly = false
  ) {
    this.scopes.set(scope, { priority, tasks, visibleOnly });
    this.failed.clear();
    this.scheduleIdle();
  }

  clearIdleTasks(scope: string) {
    this.scopes.delete(scope);
    if (this.running?.kind === 'background' && this.running.task.key.startsWith(`${scope}:`)) {
      this.cancelRunning();
    }
    this.scheduleIdle();
  }

  setVisibleRoutes(hrefs: readonly string[]) {
    this.visibleRoutes = new Set(hrefs.map(normalizeHref));
    this.scheduleIdle();
  }

  scheduleIntent(task: PreloadTask, delay = 50) {
    this.cancelIntent(task.key);
    const enqueue = () => {
      if (this.isReady(task.key)) return;
      this.intentQueue.set(task.key, task);

      if (!this.foregroundPending) {
        if (this.running?.kind === 'background' && this.running.task.key !== task.key) {
          this.cancelRunning();
        }
        this.cancelScheduledIdle();
        const next = this.intentQueue.get(task.key);
        if (next && !this.running) {
          this.intentQueue.delete(task.key);
          this.start(next, 'background', 0);
        }
      }
    };
    if (delay <= 0) {
      enqueue();
      return;
    }
    const timer = setTimeout(() => {
      this.intentTimers.delete(task.key);
      enqueue();
    }, delay);
    this.intentTimers.set(task.key, timer);
  }

  cancelIntent(key: string) {
    const timer = this.intentTimers.get(key);
    if (timer) clearTimeout(timer);
    this.intentTimers.delete(key);
    this.intentQueue.delete(key);
  }

  getState(key: string): PreloadTaskState {
    if (this.running?.task.key === key) return 'preloading';
    if (this.isReady(key)) return 'ready';
    if (this.failed.has(key)) return 'failed';
    return 'queued';
  }

  resume() {
    this.scheduleIdle();
  }

  setRouterIdle(idle: boolean) {
    this.routerIdle = idle;
    if (!idle) this.cancelScheduledIdle();
    else this.scheduleIdle();
  }

  pauseSpeculation() {
    this.cancelScheduledIdle();
    if (this.running?.kind === 'background') this.cancelRunning();
  }

  dispose() {
    this.disposed = true;
    this.cancelScheduledIdle();
    this.cancelRunning();
    for (const timer of this.intentTimers.values()) clearTimeout(timer);
    this.intentTimers.clear();
    this.intentQueue.clear();
    this.scopes.clear();
  }

  private isReady(key: string) {
    const expiresAt = this.readyUntil.get(key) ?? 0;
    if (expiresAt > this.now()) return true;
    this.readyUntil.delete(key);
    return false;
  }

  private start(task: PreloadTask, kind: RunningTask['kind'], attempt: number) {
    if (this.disposed) return;

    const generation = ++this.generation;
    const running: RunningTask = { generation, kind, releases: [], task };
    this.running = running;
    this.failed.delete(task.key);
    void this.preloadRoute(task.route.href);

    void this.runEntries(running, task.entries)
      .then(async () => {
        if (!this.isCurrent(running)) return;
        if (running.task.resolveAfterComplete) {
          const dependentEntries = await running.task.resolveAfterComplete();
          if (!this.isCurrent(running)) return;
          await this.runEntries(running, dependentEntries);
        }
      })
      .then(() => {
        if (!this.isCurrent(running)) return;
        this.finish(running, true);
      })
      .catch(error => {
        if (!this.isCurrent(running)) return;
        this.release(running);
        this.running = null;

        if (kind === 'background' && attempt === 0 && canSpeculate()) {
          setTimeout(() => {
            if (
              !this.disposed &&
              !this.foregroundPending &&
              !this.running &&
              !this.isReady(task.key)
            ) {
              this.start(task, 'background', 1);
            }
          }, 2_000);
          return;
        }

        this.failed.add(task.key);
        if (kind === 'foreground' && this.foregroundKey === task.key) {
          this.foregroundPending = false;
        }
        console.warn(`Prioritized preload failed for ${task.key}`, error);
        this.scheduleIdle();
      });
  }

  private async runEntries(running: RunningTask, entries: readonly ZeroPreloadEntry[]) {
    if (entries.length === 0) return;
    const handles = entries.map(entry =>
      retainZeroPreloadHandle(this.zero, { ...entry, ttl: entry.ttl ?? PRELOAD_CACHE_TTL })
    );
    running.releases.push(...handles.map(handle => handle.release));
    await Promise.all(handles.map(handle => handle.complete));
  }

  private finish(running: RunningTask, succeeded: boolean) {
    this.release(running);
    this.running = null;
    if (succeeded) this.readyUntil.set(running.task.key, this.now() + PRELOAD_CACHE_TTL_MS);
    if (running.kind === 'foreground' && this.foregroundKey === running.task.key) {
      this.foregroundPending = false;
    }
    this.scheduleIdle();
  }

  private isCurrent(running: RunningTask) {
    return this.running?.generation === running.generation;
  }

  private release(running: RunningTask) {
    for (const release of running.releases.splice(0)) release();
  }

  private cancelRunning() {
    if (!this.running) return;
    const running = this.running;
    this.running = null;
    this.generation += 1;
    this.release(running);
  }

  private scheduleIdle() {
    if (
      this.disposed ||
      this.foregroundPending ||
      !this.routerIdle ||
      this.running ||
      this.idleHandle !== null ||
      !canSpeculate()
    ) {
      return;
    }

    const run = () => {
      this.idleHandle = null;
      if (
        this.disposed ||
        this.foregroundPending ||
        !this.routerIdle ||
        this.running ||
        !canSpeculate()
      )
        return;
      const next = this.takeNextBackgroundTask();
      if (next) this.start(next, 'background', 0);
    };

    const idleWindow = typeof window === 'undefined' ? undefined : window;
    if (idleWindow && typeof idleWindow.requestIdleCallback === 'function') {
      this.idleUsesWindowApi = true;
      this.idleHandle = idleWindow.requestIdleCallback(run, { timeout: 1_500 });
    } else {
      this.idleUsesWindowApi = false;
      this.idleHandle = setTimeout(run, 250);
    }
  }

  private cancelScheduledIdle() {
    if (this.idleHandle === null) return;
    const idleWindow = typeof window === 'undefined' ? undefined : window;
    if (
      this.idleUsesWindowApi &&
      idleWindow &&
      typeof idleWindow.cancelIdleCallback === 'function'
    ) {
      idleWindow.cancelIdleCallback(this.idleHandle as number);
    } else {
      clearTimeout(this.idleHandle as ReturnType<typeof setTimeout>);
    }
    this.idleHandle = null;
  }

  private takeNextBackgroundTask(): PreloadTask | undefined {
    for (const [key, task] of this.intentQueue) {
      this.intentQueue.delete(key);
      if (!this.isReady(task.key) && !this.failed.has(task.key)) return task;
    }

    const scopes = [...this.scopes.values()].sort((a, b) => a.priority - b.priority);
    for (const scope of scopes) {
      for (const task of scope.tasks) {
        if (this.isReady(task.key) || this.failed.has(task.key)) continue;
        if (scope.visibleOnly && !this.visibleRoutes.has(normalizeHref(task.route.href))) continue;
        return task;
      }
    }
    return undefined;
  }
}

interface PreloadCoordinatorContextValue {
  coordinator: PreloadCoordinator;
  beginIntent: (href: string, delay?: number) => void;
  cancelIntent: (href: string) => void;
}

const PreloadCoordinatorContext = createContext<PreloadCoordinatorContextValue | null>(null);

export function PrioritizedPreloadProvider({ children }: { children: ReactNode }) {
  const zero = useZero() as PreloadableZero;
  const router = useRouter();
  const routerIdle = useRouterState({ select: state => state.status === 'idle' });
  const { user } = useAuth();
  const coordinator = useMemo(
    () =>
      new PreloadCoordinator(zero, href =>
        router.preloadRoute({ to: href } as never).catch(error => {
          console.warn(`Route preload failed for ${href}`, error);
        })
      ),
    [router, zero]
  );

  useEffect(() => () => coordinator.dispose(), [coordinator]);
  useEffect(() => coordinator.setRouterIdle(routerIdle), [coordinator, routerIdle]);
  useEffect(() => {
    const updateAvailability = () => {
      if (canSpeculate()) coordinator.resume();
      else coordinator.pauseSpeculation();
    };
    document.addEventListener('visibilitychange', updateAvailability);
    window.addEventListener('online', updateAvailability);
    window.addEventListener('offline', updateAvailability);
    return () => {
      document.removeEventListener('visibilitychange', updateAvailability);
      window.removeEventListener('online', updateAvailability);
      window.removeEventListener('offline', updateAvailability);
    };
  }, [coordinator]);

  const value = useMemo<PreloadCoordinatorContextValue>(() => {
    const taskFor = (href: string) => {
      const task = createIntentTaskForHref(href, user?.id);
      return task && zero.run
        ? withWikiTaskDependencies(task, { run: zero.run.bind(zero) }, user?.id)
        : task;
    };
    return {
      coordinator,
      beginIntent: (href, delay = 50) => {
        const task = taskFor(href);
        if (task) coordinator.scheduleIntent(task, delay);
      },
      cancelIntent: href => {
        const task = taskFor(href);
        if (task) coordinator.cancelIntent(task.key);
      },
    };
  }, [coordinator, user?.id, zero]);

  return (
    <PreloadCoordinatorContext.Provider value={value}>
      {children}
    </PreloadCoordinatorContext.Provider>
  );
}

export function usePreloadCoordinator() {
  return useContext(PreloadCoordinatorContext);
}

export function useActivePreloadTask(task: PreloadTask | undefined) {
  const context = usePreloadCoordinator();
  useEffect(() => {
    if (!context || !task) return;
    context.coordinator.activate(task);
    return () => context.coordinator.deactivate(task.key);
  }, [context, task?.key]);
}

export function useIdlePreloadTasks(
  scope: string,
  tasks: readonly PreloadTask[],
  priority: PreloadTaskPriority,
  visibleOnly = false
) {
  const context = usePreloadCoordinator();
  const taskKeys = tasks.map(task => task.key).join('|');
  useEffect(() => {
    if (!context) return;
    context.coordinator.setIdleTasks(scope, tasks, priority, visibleOnly);
    return () => context.coordinator.clearIdleTasks(scope);
  }, [context, priority, scope, taskKeys, visibleOnly]);
}

export function useVisiblePreloadRoutes(hrefs: readonly string[]) {
  const context = usePreloadCoordinator();
  const hrefKey = hrefs.join('|');
  useEffect(() => {
    context?.coordinator.setVisibleRoutes(hrefs);
  }, [context, hrefKey]);
}
