import { useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useUserState } from '@/zero/users/useUserState';
import { useGroupState } from '@/zero/groups/useGroupState';
import { useSearchState } from '@/zero/shared/useSearchState';
import { useAllEvents, useAllAmendments, useRolesWithGroups } from '@/zero/events/useEventState';
import { useElectionState } from '@/zero/elections/useElectionState';
import { useVoteState } from '@/zero/votes/useVoteState';
import { extractHashtagTags } from '@/zero/common/hashtagHelpers';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import type { EntityType, TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';

interface UseTypeaheadDataOptions {
  entityTypes: EntityType[];
}

const SEARCH_DATA_LIMIT = 500;

function buildUserDisplayName(user: {
  first_name?: string | null;
  last_name?: string | null;
  handle?: string | null;
  email?: string | null;
}) {
  return (
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.handle ||
    user.email ||
    'User'
  );
}

function getPreview(value: unknown, maxLength = 120) {
  const text = richTextToPlainText(value);
  return text ? text.substring(0, maxLength) : undefined;
}

function getFormattedDate(value: number | string | null | undefined) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function compactStrings(values: readonly (string | null | undefined | false)[]) {
  return values.filter((value): value is string => Boolean(value));
}

/**
 * Encapsulates conditional data fetching based on requested entity types.
 * Merges multiple data sources into a unified TypeaheadItem[] shape.
 */
export function useTypeaheadData({ entityTypes }: UseTypeaheadDataOptions) {
  const { user } = useAuth();
  const includeUsers = entityTypes.includes('user');
  const includeGroups = entityTypes.includes('group');
  const includeEvents = entityTypes.includes('event');
  const includeAmendments = entityTypes.includes('amendment');
  const includeBlogs = entityTypes.includes('blog');
  const includeTodos = entityTypes.includes('todo');
  const includeVotes = entityTypes.includes('vote');
  const includeElections = entityTypes.includes('election');
  const includeAgendaItems = entityTypes.includes('agenda_item');
  const includeRoles = entityTypes.includes('role');
  const includeSearchBackedEntities =
    includeBlogs || includeTodos || includeVotes || includeAgendaItems;

  const { allUsers } = useUserState({
    includeAllUsers: includeUsers,
  });

  const { searchResults } = useGroupState({
    includeSearch: includeGroups,
  });

  const { events } = useAllEvents();
  const { amendments } = useAllAmendments();
  const { roles } = useRolesWithGroups();
  const { electionsForSearch } = useElectionState({
    includeElectionsForSearch: includeElections,
  });
  const { votesWithDetails } = useVoteState({
    includeVotesWithDetails: includeVotes,
  });
  const searchState = useSearchState(
    includeSearchBackedEntities
      ? {
          userId: user?.id,
          limits: {
            users: 1,
            groups: 1,
            statements: 1,
            blogs: includeBlogs ? SEARCH_DATA_LIMIT : 1,
            amendments: 1,
            events: includeAgendaItems || includeVotes ? SEARCH_DATA_LIMIT : 1,
            todos: includeTodos ? SEARCH_DATA_LIMIT : 1,
          },
        }
      : {
          userId: user?.id,
          limits: {
            users: 1,
            groups: 1,
            statements: 1,
            blogs: 1,
            amendments: 1,
            events: 1,
            todos: 1,
          },
        }
  );

  const items = useMemo<TypeaheadItem[]>(() => {
    const result: TypeaheadItem[] = [];

    if (includeUsers && allUsers) {
      for (const currentUser of allUsers) {
        const displayName = buildUserDisplayName(currentUser);
        result.push({
          id: currentUser.id,
          entityType: 'user',
          label: displayName,
          secondaryLabel: currentUser.handle ? `@${currentUser.handle}` : undefined,
          description: currentUser.email || undefined,
          avatar: currentUser.avatar,
          hashtags: extractHashtagTags(
            (
              currentUser as {
                user_hashtags?: readonly { hashtag?: { tag?: string | null } | null }[];
              }
            ).user_hashtags
          ),
          keywords: compactStrings([currentUser.handle, currentUser.email]),
          url: `/user/${currentUser.id}`,
        });
      }
    }

    if (includeGroups && searchResults) {
      for (const group of searchResults) {
        result.push({
          id: group.id,
          entityType: 'group',
          label: group.name || 'Group',
          secondaryLabel: group.visibility || undefined,
          description: getPreview(group.description),
          avatar: group.image_url,
          hashtags: extractHashtagTags(
            (
              group as {
                group_hashtags?: readonly { hashtag?: { tag?: string | null } | null }[];
              }
            ).group_hashtags
          ),
          keywords: compactStrings([group.email, group.city, group.country]),
          url: `/group/${group.id}`,
        });
      }
    }

    if (includeEvents && events) {
      for (const event of events) {
        result.push({
          id: event.id,
          entityType: 'event',
          label: event.title || 'Event',
          secondaryLabel: event.status || undefined,
          description: getPreview(event.description),
          avatar: null,
          hashtags: extractHashtagTags(
            (
              event as {
                event_hashtags?: readonly { hashtag?: { tag?: string | null } | null }[];
              }
            ).event_hashtags
          ),
          keywords: compactStrings([event.location_name, event.event_type]),
          metadata: compactStrings([getFormattedDate(event.start_date), event.location_name]),
          url: `/event/${event.id}`,
        });
      }
    }

    if (includeAmendments && amendments) {
      for (const amendment of amendments) {
        result.push({
          id: amendment.id,
          entityType: 'amendment',
          label: amendment.title || 'Amendment',
          secondaryLabel: amendment.code || undefined,
          description: getPreview(amendment.reason),
          avatar: null,
          hashtags: extractHashtagTags(
            (
              amendment as {
                amendment_hashtags?: readonly { hashtag?: { tag?: string | null } | null }[];
              }
            ).amendment_hashtags
          ),
          keywords: compactStrings([amendment.code, amendment.category]),
          url: `/amendment/${amendment.id}`,
        });
      }
    }

    if (includeBlogs) {
      for (const blog of searchState.blogs ?? []) {
        const bloggerNames =
          blog.bloggers?.map(blogger => buildUserDisplayName(blogger.user ?? {})).filter(Boolean) ??
          [];
        result.push({
          id: blog.id,
          entityType: 'blog',
          label: blog.title || 'Blog',
          secondaryLabel: blog.group?.name || bloggerNames[0],
          description: getPreview(blog.description ?? blog.content),
          avatar: null,
          hashtags: extractHashtagTags(blog.blog_hashtags),
          keywords: compactStrings([
            blog.group?.name,
            ...bloggerNames,
            ...(blog.bloggers?.flatMap(blogger => [blogger.user?.handle, blogger.user?.email]) ??
              []),
          ]),
          metadata: bloggerNames.length > 0 ? bloggerNames.slice(0, 2) : undefined,
          url: `/blog/${blog.id}`,
        });
      }
    }

    if (includeTodos) {
      for (const todo of searchState.todos ?? []) {
        const assigneeNames =
          todo.assignments
            ?.map(assignment => buildUserDisplayName(assignment.user ?? {}))
            .filter(Boolean) ?? [];
        const creatorName = todo.creator ? buildUserDisplayName(todo.creator) : undefined;
        result.push({
          id: todo.id,
          entityType: 'todo',
          label: todo.title || 'Task',
          secondaryLabel: todo.group?.name || creatorName,
          description: getPreview(todo.description),
          avatar: null,
          hashtags: todo.tags ?? undefined,
          keywords: compactStrings([
            todo.group?.name,
            creatorName,
            ...assigneeNames,
            ...(todo.assignments?.flatMap(assignment => [
              assignment.user?.handle,
              assignment.user?.email,
            ]) ?? []),
          ]),
          metadata: compactStrings([
            creatorName ? `Creator: ${creatorName}` : undefined,
            assigneeNames.length > 0 ? `${assigneeNames.length} assigned` : undefined,
          ]),
          url: `/todos/${todo.id}`,
        });
      }
    }

    if (includeAgendaItems) {
      for (const agendaItem of searchState.agendaItems ?? []) {
        result.push({
          id: agendaItem.id,
          entityType: 'agenda_item',
          label: agendaItem.title || 'Agenda Point',
          secondaryLabel: agendaItem.event?.title || undefined,
          description: getPreview(agendaItem.description),
          avatar: null,
          keywords: compactStrings([
            agendaItem.type,
            agendaItem.event?.title,
            agendaItem.amendment?.title,
            ...(agendaItem.election?.map(election => election.title) ?? []),
          ]),
          metadata: compactStrings([
            agendaItem.type ? `Type: ${agendaItem.type}` : undefined,
            typeof agendaItem.order_index === 'number'
              ? `#${agendaItem.order_index + 1}`
              : undefined,
          ]),
          url: agendaItem.event?.id
            ? `/event/${agendaItem.event.id}/agenda/${agendaItem.id}`
            : undefined,
        });
      }
    }

    if (includeVotes) {
      const visibleAgendaItemIds = new Set((searchState.agendaItems ?? []).map(item => item.id));
      const visibleEventIds = new Set((searchState.events ?? []).map(event => event.id));

      for (const vote of votesWithDetails) {
        const eventId = vote.agenda_item?.event?.id;
        if (visibleAgendaItemIds.size > 0 || visibleEventIds.size > 0) {
          const isVisible =
            visibleAgendaItemIds.has(vote.agenda_item_id ?? '') ||
            (eventId ? visibleEventIds.has(eventId) : false);
          if (!isVisible) {
            continue;
          }
        }

        result.push({
          id: vote.id,
          entityType: 'vote',
          label: vote.title || vote.amendment?.title || vote.agenda_item?.title || 'Vote',
          secondaryLabel: vote.agenda_item?.event?.title || vote.agenda_item?.title || undefined,
          description: getPreview(vote.description),
          avatar: null,
          keywords: compactStrings([
            vote.amendment?.title,
            vote.agenda_item?.title,
            vote.agenda_item?.event?.title,
            ...(vote.choices?.map(choice => choice.label) ?? []),
          ]),
          metadata: compactStrings([
            vote.status || undefined,
            typeof vote.choices?.length === 'number' ? `${vote.choices.length} choices` : undefined,
          ]),
        });
      }
    }

    if (includeElections) {
      for (const election of electionsForSearch ?? []) {
        result.push({
          id: election.id,
          entityType: 'election',
          label: election.title || election.role?.name || 'Election',
          secondaryLabel:
            election.role?.group?.name || election.agenda_item?.event?.title || undefined,
          description: getPreview(election.description),
          avatar: null,
          keywords: compactStrings([
            election.role?.name,
            election.role?.group?.name,
            election.agenda_item?.title,
            election.agenda_item?.event?.title,
          ]),
          metadata: compactStrings([
            election.role?.name || undefined,
            typeof election.candidates?.length === 'number'
              ? `${election.candidates.length} candidates`
              : undefined,
          ]),
        });
      }
    }

    if (includeRoles && roles) {
      for (const role of roles) {
        result.push({
          id: role.id,
          entityType: 'role',
          label: role.name || 'Role',
          secondaryLabel: role.group?.name || undefined,
          description: getPreview(role.description),
          avatar: null,
          keywords: compactStrings([role.group?.name, role.scope, role.name]),
          metadata: compactStrings([role.scope ? `Scope: ${role.scope}` : undefined]),
        });
      }
    }

    return result;
  }, [
    includeUsers,
    includeGroups,
    includeEvents,
    includeAmendments,
    includeBlogs,
    includeTodos,
    includeVotes,
    includeElections,
    includeAgendaItems,
    includeRoles,
    allUsers,
    searchResults,
    events,
    amendments,
    roles,
    electionsForSearch,
    searchState.blogs,
    searchState.todos,
    searchState.agendaItems,
    searchState.events,
    votesWithDetails,
  ]);

  return { items };
}
