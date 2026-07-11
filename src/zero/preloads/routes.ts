import { useMemo } from 'react';
import { useLocation } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';
import { useActivePreloadTask, useIdlePreloadTasks } from './preload-coordinator';
import {
  createCalendarPreloadTask,
  createCreateEventPreloadTask,
  createCreatePreloadTask,
  createHomePreloadTask,
  createMessagesPreloadTask,
  createNotificationsPreloadTask,
  createPrimaryIdleTasks,
  createSearchPreloadTask,
  createTodosPreloadTask,
} from './route-manifests';
import type { SearchRoutePreloadParams } from './search-context';

export function usePrimaryRouteIdlePreloads() {
  const { user } = useAuth();
  const pathname = useLocation().pathname;
  const tasks = useMemo(() => {
    if (!user?.id) return [];
    const ordered = createPrimaryIdleTasks(user.id);
    const activeIndex = ordered.findIndex(
      item => pathname === item.route.href || pathname.startsWith(`${item.route.href}/`)
    );
    return activeIndex < 0
      ? ordered
      : [...ordered.slice(activeIndex + 1), ...ordered.slice(0, activeIndex)];
  }, [pathname, user?.id]);
  useIdlePreloadTasks('primary', tasks, 3);
}

export function useHomePreloads() {
  const { user } = useAuth();
  const task = useMemo(() => (user?.id ? createHomePreloadTask(user.id) : undefined), [user?.id]);
  useActivePreloadTask(task);
}

export function useMessagesPreloads(selectedConversationId?: string) {
  const { user } = useAuth();
  const task = useMemo(
    () => (user?.id ? createMessagesPreloadTask(selectedConversationId) : undefined),
    [selectedConversationId, user?.id]
  );
  useActivePreloadTask(task);
}

export function useSearchPreloads(search: SearchRoutePreloadParams) {
  const { user } = useAuth();
  const task = useMemo(
    () => (user?.id ? createSearchPreloadTask(user.id, search) : undefined),
    [
      search.engagement,
      search.hashtag,
      search.q,
      search.range,
      search.sort,
      search.topics,
      search.types,
      user?.id,
    ]
  );
  useActivePreloadTask(task);
}

export function useCalendarPreloads() {
  const { user } = useAuth();
  const task = useMemo(() => (user?.id ? createCalendarPreloadTask() : undefined), [user?.id]);
  useActivePreloadTask(task);
}

export function useTodosPreloads() {
  const { user } = useAuth();
  const task = useMemo(() => (user?.id ? createTodosPreloadTask() : undefined), [user?.id]);
  useActivePreloadTask(task);
}

export function useNotificationsPreloads() {
  const { user } = useAuth();
  const task = useMemo(() => (user?.id ? createNotificationsPreloadTask() : undefined), [user?.id]);
  useActivePreloadTask(task);
}

export function useCreatePreloads() {
  const { user } = useAuth();
  const task = useMemo(() => (user?.id ? createCreatePreloadTask(user.id) : undefined), [user?.id]);
  useActivePreloadTask(task);
}

export function useCreateEventPreloads(groupId?: string) {
  const { user } = useAuth();
  const task = useMemo(
    () => (user?.id ? createCreateEventPreloadTask(user.id, groupId) : undefined),
    [groupId, user?.id]
  );
  useActivePreloadTask(task);
}
