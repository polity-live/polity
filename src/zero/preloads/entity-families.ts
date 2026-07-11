import { useMemo } from 'react';
import { useLocation } from '@tanstack/react-router';
import { useZero } from '@rocicorp/zero/react';
import { useAuth } from '@/providers/auth-provider';
import { queries } from '@/zero/queries';
import { createPreloadEntry, type ZeroPreloadEntry } from './preload-registry';
import { useActivePreloadTask, useIdlePreloadTasks, type PreloadTask } from './preload-coordinator';
import {
  createAmendmentPreloadTasks,
  createBlogPreloadTasks,
  createEventPreloadTasks,
  createGroupPreloadTasks,
  createUserPreloadTasks,
} from './route-manifests';
import {
  createEventAgendaDependentPreloadEntries,
  discoverEventAgendaPreloadDependencies,
} from './event-agenda';
import { withWikiTaskDependencies } from './task-dependencies';

interface RunnableZero {
  run: (
    query: unknown,
    options: { type: 'unknown' | 'complete'; ttl?: 'none' }
  ) => Promise<unknown>;
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    : [];
}

function idRows(value: unknown): string[] {
  return [
    ...new Set(
      rows(value)
        .map(row => row.id)
        .filter((id): id is string => typeof id === 'string')
    ),
  ].sort();
}

function taskBySuffix(tasks: readonly PreloadTask[], suffix: string) {
  return tasks.find(task => task.key.endsWith(`:${suffix}`));
}

function rotateAfter(tasks: readonly PreloadTask[], active?: PreloadTask) {
  if (!active) return [];
  const index = tasks.findIndex(task => task.key === active.key);
  if (index < 0) return tasks;
  return [...tasks.slice(index + 1), ...tasks.slice(0, index)].filter(
    task => task.key !== active.key
  );
}

function useEntityTaskFamily(scope: string, tasks: readonly PreloadTask[], active?: PreloadTask) {
  useActivePreloadTask(active);
  useIdlePreloadTasks(scope, active ? rotateAfter(tasks, active) : [], 2, true);
}

function selectGroupTask(tasks: readonly PreloadTask[], groupId: string, pathname: string) {
  const base = `/group/${groupId}`;
  if (pathname === base || pathname === `${base}/`) return taskBySuffix(tasks, 'overview');
  if (pathname.startsWith(`${base}/operation`)) return taskBySuffix(tasks, 'operation');
  if (pathname.startsWith(`${base}/events`)) return taskBySuffix(tasks, 'events');
  if (pathname.startsWith(`${base}/amendments`)) return taskBySuffix(tasks, 'amendments');
  if (pathname.startsWith(`${base}/blogs-and-statements`)) {
    return taskBySuffix(tasks, 'blogs-and-statements');
  }
  if (pathname.startsWith(`${base}/network`) || pathname.startsWith(`${base}/relationships`)) {
    return taskBySuffix(tasks, 'network');
  }
  if (pathname.startsWith(`${base}/editor`)) return taskBySuffix(tasks, 'editor');
  if (pathname.startsWith(`${base}/memberships`)) return taskBySuffix(tasks, 'memberships');
  if (pathname.startsWith(`${base}/notifications`)) return taskBySuffix(tasks, 'notifications');
  if (pathname.startsWith(`${base}/settings`)) return taskBySuffix(tasks, 'settings');
  return undefined;
}

export function useGroupRouteFamilyPreloads(groupId?: string) {
  const { user } = useAuth();
  const zero = useZero() as RunnableZero;
  const pathname = useLocation().pathname;
  const tasks = useMemo(() => {
    if (!user?.id || !groupId) return [];
    return createGroupPreloadTasks(groupId, user.id)
      .map(item => withWikiTaskDependencies(item, zero, user.id))
      .map<PreloadTask>(item =>
        item.key.endsWith(':events')
          ? {
              ...item,
              resolveAfterComplete: async () => {
                const eventRows = await zero.run(queries.events.byGroupActive({ groupId }), {
                  type: 'unknown',
                  ttl: 'none',
                });
                const eventIds = idRows(eventRows);
                return eventIds.length
                  ? [
                      createPreloadEntry(
                        'queries.groups.amendmentEventStepRunsByEventIds',
                        { eventIds },
                        queries.groups.amendmentEventStepRunsByEventIds({ eventIds })
                      ),
                    ]
                  : [];
              },
            }
          : item
      );
  }, [groupId, user?.id, zero]);
  const active = groupId ? selectGroupTask(tasks, groupId, pathname) : undefined;
  useEntityTaskFamily(groupId ? `group:${groupId}` : 'group:none', tasks, active);
}

function selectEventTask(tasks: readonly PreloadTask[], eventId: string, pathname: string) {
  const base = `/event/${eventId}`;
  if (pathname === base || pathname === `${base}/`) return taskBySuffix(tasks, 'overview');
  if (pathname.startsWith(`${base}/agenda`)) return taskBySuffix(tasks, 'agenda');
  if (pathname.startsWith(`${base}/network`)) return taskBySuffix(tasks, 'network');
  if (pathname.startsWith(`${base}/participants`)) return taskBySuffix(tasks, 'participants');
  if (pathname.startsWith(`${base}/roles`)) return taskBySuffix(tasks, 'roles');
  if (pathname.startsWith(`${base}/stream`)) return taskBySuffix(tasks, 'stream');
  if (pathname.startsWith(`${base}/notifications`)) return taskBySuffix(tasks, 'notifications');
  if (pathname.startsWith(`${base}/settings`)) return taskBySuffix(tasks, 'settings');
  return undefined;
}

export function useEventRouteFamilyPreloads(eventId?: string) {
  const { user } = useAuth();
  const zero = useZero() as RunnableZero;
  const pathname = useLocation().pathname;
  const tasks = useMemo(() => {
    if (!user?.id || !eventId) return [];
    return createEventPreloadTasks(eventId, user.id).map<PreloadTask>(item => {
      if (item.key.endsWith(':agenda')) {
        return {
          ...item,
          resolveAfterComplete: async () => {
            const agendaRows = await zero.run(queries.events.agendaItemsFull({ eventId }), {
              type: 'unknown',
              ttl: 'none',
            });
            return createEventAgendaDependentPreloadEntries(
              discoverEventAgendaPreloadDependencies(agendaRows, user?.id)
            );
          },
        };
      }
      if (item.key.endsWith(':network')) {
        return {
          ...item,
          resolveAfterComplete: async () => {
            const eventRows = rows(
              await zero.run(queries.events.byIdFull({ id: eventId }), {
                type: 'unknown',
                ttl: 'none',
              })
            );
            const groupId = eventRows[0]?.group_id;
            return typeof groupId === 'string'
              ? [
                  createPreloadEntry(
                    'queries.events.groupRelationships',
                    { groupId },
                    queries.events.groupRelationships({ groupId })
                  ),
                ]
              : [];
          },
        };
      }
      return item;
    });
  }, [eventId, user?.id, zero]);
  const active = eventId ? selectEventTask(tasks, eventId, pathname) : undefined;
  useEntityTaskFamily(eventId ? `event:${eventId}` : 'event:none', tasks, active);
}

function selectAmendmentTask(tasks: readonly PreloadTask[], amendmentId: string, pathname: string) {
  const base = `/amendment/${amendmentId}`;
  if (pathname === base || pathname === `${base}/`) return taskBySuffix(tasks, 'wiki');
  const page = pathname.slice(base.length + 1).split('/')[0];
  return page ? taskBySuffix(tasks, page) : undefined;
}

function amendmentDocumentEntries(
  page: string,
  documentIds: readonly string[]
): ZeroPreloadEntry[] {
  return documentIds.flatMap(documentId => {
    const base = [
      createPreloadEntry(
        'queries.amendments.documentById',
        { id: documentId },
        queries.amendments.documentById({ id: documentId })
      ),
    ];
    if (page === 'discussions') {
      return [
        ...base,
        createPreloadEntry(
          'queries.documents.threads',
          { document_id: documentId },
          queries.documents.threads({ document_id: documentId })
        ),
      ];
    }
    return [
      ...base,
      createPreloadEntry(
        'queries.documents.collaborators',
        { document_id: documentId },
        queries.documents.collaborators({ document_id: documentId })
      ),
      createPreloadEntry(
        'queries.documents.versions',
        { document_id: documentId },
        queries.documents.versions({ document_id: documentId })
      ),
    ];
  });
}

export function useAmendmentRouteFamilyPreloads(amendmentId?: string) {
  const { user } = useAuth();
  const zero = useZero() as RunnableZero;
  const pathname = useLocation().pathname;
  const tasks = useMemo(() => {
    if (!user?.id || !amendmentId) return [];
    return createAmendmentPreloadTasks(amendmentId, user.id).map<PreloadTask>(item => {
      const page = item.key.split(':').at(-1) ?? '';
      if (!['text', 'change-requests', 'discussions'].includes(page)) return item;
      return {
        ...item,
        resolveAfterComplete: async () => {
          const documentRows = await zero.run(
            queries.amendments.documentsByAmendment({ amendment_id: amendmentId }),
            { type: 'unknown', ttl: 'none' }
          );
          return amendmentDocumentEntries(page, idRows(documentRows));
        },
      };
    });
  }, [amendmentId, user?.id, zero]);
  const active = amendmentId ? selectAmendmentTask(tasks, amendmentId, pathname) : undefined;
  useEntityTaskFamily(amendmentId ? `amendment:${amendmentId}` : 'amendment:none', tasks, active);
}

function selectUserTask(tasks: readonly PreloadTask[], userId: string, pathname: string) {
  const base = `/user/${userId}`;
  if (pathname === base || pathname === `${base}/`) return taskBySuffix(tasks, 'profile');
  if (pathname.startsWith(`${base}/blog/`)) return undefined;
  const page = pathname.slice(base.length + 1).split('/')[0];
  return page ? taskBySuffix(tasks, page) : undefined;
}

export function useUserRouteFamilyPreloads(userId?: string, isOwnUser = false) {
  const { user } = useAuth();
  const pathname = useLocation().pathname;
  const tasks = useMemo(
    () => (user?.id && userId ? createUserPreloadTasks(userId, isOwnUser) : []),
    [isOwnUser, user?.id, userId]
  );
  const active = userId ? selectUserTask(tasks, userId, pathname) : undefined;
  useEntityTaskFamily(userId ? `user:${userId}` : 'user:none', tasks, active);
}

export function useBlogRouteFamilyPreloads(blogId?: string) {
  const { user } = useAuth();
  const pathname = useLocation().pathname;
  const directBase = blogId ? `/blog/${blogId}` : '';
  const nestedBase = blogId
    ? pathname.match(new RegExp(`^\\/(?:group|user)\\/[^/]+\\/blog\\/${blogId}`))?.[0]
    : undefined;
  const base = nestedBase ?? directBase;
  const tasks = useMemo(
    () => (user?.id && blogId ? createBlogPreloadTasks(blogId, base, user.id) : []),
    [base, blogId, user?.id]
  );
  const active = useMemo(() => {
    if (!blogId || !base) return undefined;
    if (pathname === base || pathname === `${base}/`) return taskBySuffix(tasks, 'overview');
    const page = pathname.slice(base.length + 1).split('/')[0];
    return page ? taskBySuffix(tasks, page) : undefined;
  }, [base, blogId, pathname, tasks]);
  useEntityTaskFamily(blogId ? `blog:${blogId}` : 'blog:none', tasks, active);
}
