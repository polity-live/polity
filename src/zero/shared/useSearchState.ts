import { useMemo } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { queries } from '../queries';
import { useAgendaState } from '../agendas/useAgendaState';
import { useElectionState } from '../elections/useElectionState';
import { useCommonState } from '../common/useCommonState';
import { checkEntityAccess } from '@/features/auth/logic/checkEntityAccess';
import { resolveRouteVisibilityAccess } from '@/features/auth/logic/routeVisibilityAccess';

function hasActiveGroupMembership(
  membership:
    | {
        status?: string | null;
        role?: { name?: string | null } | null;
      }
    | null
    | undefined
) {
  return (
    membership?.status === 'active' ||
    membership?.status === 'member' ||
    membership?.status === 'admin' ||
    membership?.role?.name === 'Board Member'
  );
}

function dedupeById<T extends { id: string }>(items: readonly T[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

export interface SearchLimits {
  users?: number;
  groups?: number;
  statements?: number;
  blogs?: number;
  amendments?: number;
  events?: number;
  todos?: number;
  votingSessions?: number;
}

export interface SearchOptions {
  userId?: string;
  limits?: SearchLimits;
}

export function useSearchState(options: SearchOptions = {}) {
  const { userId, limits = {} } = options;
  const usersLimit = limits.users ?? 20;
  const groupsLimit = limits.groups ?? 20;
  const statementsLimit = limits.statements ?? 20;
  const blogsLimit = limits.blogs ?? 20;
  const amendmentsLimit = limits.amendments ?? 20;
  const eventsLimit = limits.events ?? 20;
  const todosLimit = limits.todos ?? 20;

  // ── Basic entity queries ────────────────────────────────────────────
  const [users] = useQuery(queries.search.searchableUsers({ limit: usersLimit }));
  const [groups] = useQuery(queries.search.searchableGroups({ limit: groupsLimit }));
  const [statements] = useQuery(queries.search.searchableStatements({ limit: statementsLimit }));
  const [blogs] = useQuery(queries.search.searchableBlogs({ limit: blogsLimit }));
  const [amendments] = useQuery(queries.search.searchableAmendments({ limit: amendmentsLimit }));
  const [events] = useQuery(queries.search.searchableEvents({ limit: eventsLimit }));

  // ── User-specific queries ───────────────────────────────────────────
  const [groupMemberships] = useQuery(
    userId ? queries.search.userGroupMemberships({ user_id: userId }) : undefined
  );
  const [todoAssignments] = useQuery(
    userId ? queries.search.userTodoAssignments({ user_id: userId }) : undefined
  );

  // ── Derived: todo eligibility ───────────────────────────────────────
  const memberGroupIds = useMemo(
    () =>
      (groupMemberships ?? [])
        .filter(hasActiveGroupMembership)
        .map(m => m.group?.id)
        .filter((groupId): groupId is string => !!groupId),
    [groupMemberships]
  );

  const assignedTodoIds = useMemo(
    () =>
      (todoAssignments ?? []).map(a => a.todo?.id).filter((todoId): todoId is string => !!todoId),
    [todoAssignments]
  );

  const [publicTodos] = useQuery(queries.search.searchableTodos({ limit: todosLimit }));
  const [createdTodos] = useQuery(
    userId
      ? queries.search.searchableTodosByCreator({ user_id: userId, limit: todosLimit })
      : undefined
  );
  const [groupTodos] = useQuery(
    memberGroupIds.length > 0
      ? queries.search.searchableTodosByGroups({ group_ids: memberGroupIds, limit: todosLimit })
      : undefined
  );

  // ── Timeline events (via common facade) ─────────────────────────────
  const { timelineByContentTypes: timelineEvents, allHashtags } = useCommonState({
    timelineContentTypes: ['vote', 'election', 'video', 'image'],
    timelineContentLimit: 50,
    loadAllHashtags: true,
  });

  // ── Event-derived queries ───────────────────────────────────────────
  const eventIds = useMemo(() => (events ?? []).map(e => e.id).filter(Boolean), [events]);

  const { agendaItems } = useAgendaState({
    eventIds: eventIds.length > 0 ? eventIds : undefined,
  });

  const { electionsForSearch: elections } = useElectionState({
    includeElectionsForSearch: true,
  });

  // TODO: Removed with voting session migration
  // searchableVotingSessions query no longer exists

  // ── Visibility filtering ────────────────────────────────────────────
  // Only show public entities or private entities where the user has a relationship.

  const visibleUsers = useMemo(
    () => (users ?? []).filter(u => resolveRouteVisibilityAccess([u.visibility], !!userId).allowed),
    [users, userId]
  );

  const visibleGroups = useMemo(
    () =>
      (groups ?? []).filter(g => resolveRouteVisibilityAccess([g.visibility], !!userId).allowed),
    [groups, userId]
  );

  const visibleStatements = useMemo(
    () =>
      (statements ?? []).filter(s =>
        checkEntityAccess(s.visibility, !!userId, s.user_id === userId)
      ),
    [statements, userId]
  );

  const visibleBlogs = useMemo(
    () =>
      (blogs ?? []).filter(
        b =>
          resolveRouteVisibilityAccess(
            [
              b.visibility,
              b.group?.visibility,
              ...(b.group ? [] : (b.bloggers ?? []).map(blogger => blogger.user?.visibility)),
            ],
            !!userId
          ).allowed
      ),
    [blogs, userId]
  );

  const visibleAmendments = useMemo(
    () =>
      (amendments ?? []).filter(
        a => resolveRouteVisibilityAccess([a.visibility, a.group?.visibility], !!userId).allowed
      ),
    [amendments, userId]
  );

  const visibleEvents = useMemo(
    () =>
      (events ?? []).filter(
        e => resolveRouteVisibilityAccess([e.visibility, e.group?.visibility], !!userId).allowed
      ),
    [events, userId]
  );

  const visibleEventIds = useMemo(() => new Set(visibleEvents.map(e => e.id)), [visibleEvents]);

  const visibleTodos = useMemo(() => {
    const assignedTodos = (todoAssignments ?? []).flatMap(assignment =>
      assignment.todo ? [assignment.todo] : []
    );

    const rawTodos = dedupeById([
      ...(publicTodos ?? []),
      ...(createdTodos ?? []),
      ...(groupTodos ?? []),
      ...assignedTodos,
    ]);

    return rawTodos.filter(t =>
      checkEntityAccess(
        t.visibility,
        !!userId,
        t.creator_id === userId ||
          assignedTodoIds.includes(t.id) ||
          (t.group_id ? memberGroupIds.includes(t.group_id) : false)
      )
    );
  }, [
    publicTodos,
    createdTodos,
    groupTodos,
    todoAssignments,
    userId,
    assignedTodoIds,
    memberGroupIds,
  ]);

  // Agenda items inherit visibility from their parent event
  const visibleAgendaItems = useMemo(
    () => (agendaItems ?? []).filter(ai => visibleEventIds.has(ai.event_id ?? '')),
    [agendaItems, visibleEventIds]
  );

  return {
    users: visibleUsers,
    groups: visibleGroups,
    statements: visibleStatements,
    blogs: visibleBlogs,
    amendments: visibleAmendments,
    events: visibleEvents,
    groupMemberships: userId ? (groupMemberships ?? []) : [],
    todoAssignments: userId ? (todoAssignments ?? []) : [],
    memberGroupIds,
    assignedTodoIds,
    todos: visibleTodos,
    timelineEvents: timelineEvents ?? [],
    agendaItems: visibleAgendaItems,
    elections: elections ?? [],
    eventVotingSessions: [] as readonly { readonly id: string }[],
    allHashtags: allHashtags ?? [],
    isLoading: false,
  };
}
