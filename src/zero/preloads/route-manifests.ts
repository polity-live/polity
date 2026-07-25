import { queries } from '@/zero/queries';
import { createPreloadEntry, stableStringify, type ZeroPreloadEntry } from './preload-registry';
import type { PreloadTask } from './preload-coordinator';
import {
  createSearchDocumentPageArgs,
  DEFAULT_SEARCH_PAGE_ARGS,
  HOME_DISCOVER_SEARCH_ARGS,
  type SearchRoutePreloadParams,
} from './search-context';
import { createEventAgendaBasePreloadEntries } from './event-agenda';

function task(key: string, href: string, entries: readonly ZeroPreloadEntry[]): PreloadTask {
  return { key, entries, route: { href } };
}

function dynamicTask(key: string, href: string, entries: readonly ZeroPreloadEntry[]): PreloadTask {
  return task(`${key}:${stableStringify(entries.map(entry => entry.key))}`, href, entries);
}

function createPermissionPreloadEntries(userId?: string): ZeroPreloadEntry[] {
  if (!userId) return [];
  return [
    createPreloadEntry('queries.rbac.viewerMemberships', {}, queries.rbac.viewerMemberships({})),
    createPreloadEntry(
      'queries.rbac.viewerGuestAccesses',
      {},
      queries.rbac.viewerGuestAccesses({})
    ),
    createPreloadEntry(
      'queries.rbac.viewerParticipations',
      {},
      queries.rbac.viewerParticipations({})
    ),
    createPreloadEntry(
      'queries.rbac.viewerBloggerRelations',
      {},
      queries.rbac.viewerBloggerRelations({})
    ),
    createPreloadEntry('queries.rbac.viewerOwnedGroups', {}, queries.rbac.viewerOwnedGroups({})),
  ];
}

export function createHomePreloadTask(userId: string): PreloadTask {
  return task('primary:home', '/home', [
    createPreloadEntry(
      'queries.search.searchDocumentPage',
      HOME_DISCOVER_SEARCH_ARGS,
      queries.search.searchDocumentPage(HOME_DISCOVER_SEARCH_ARGS)
    ),
    createPreloadEntry(
      'queries.common.userHashtags',
      { user_id: userId },
      queries.common.userHashtags({ user_id: userId })
    ),
  ]);
}

export function createSearchPreloadTask(
  userId: string,
  search: SearchRoutePreloadParams = {}
): PreloadTask {
  const args = createSearchDocumentPageArgs(search);
  const isDefault = stableStringify(args) === stableStringify(DEFAULT_SEARCH_PAGE_ARGS);
  return dynamicTask(isDefault ? 'primary:search:default' : 'primary:search', '/search', [
    createPreloadEntry(
      'queries.search.searchDocumentPage',
      args,
      queries.search.searchDocumentPage(args)
    ),
    createPreloadEntry(
      'queries.search.searchDocumentTopics',
      { limit: 160 },
      queries.search.searchDocumentTopics({ limit: 160 })
    ),
    createPreloadEntry(
      'queries.common.userHashtags',
      { user_id: userId },
      queries.common.userHashtags({ user_id: userId })
    ),
  ]);
}

export function createMessagesPreloadTask(selectedConversationId?: string): PreloadTask {
  const entries: ZeroPreloadEntry[] = [
    createPreloadEntry(
      'queries.messages.conversationsWithRelations',
      { limit: 40 },
      queries.messages.conversationsWithRelations({ limit: 40 })
    ),
  ];
  if (selectedConversationId) {
    entries.push(
      createPreloadEntry(
        'queries.messages.messagesWindow',
        { conversation_id: selectedConversationId, limit: 80 },
        queries.messages.messagesWindow({ conversation_id: selectedConversationId, limit: 80 })
      ),
      createPreloadEntry(
        'queries.messages.conversationById',
        { id: selectedConversationId },
        queries.messages.conversationById({ id: selectedConversationId })
      )
    );
  }
  return dynamicTask('primary:messages', '/messages', entries);
}

export function createCalendarPreloadTask(): PreloadTask {
  return task('primary:calendar', '/calendar', [
    createPreloadEntry(
      'queries.events.forCalendarWithExceptions',
      {},
      queries.events.forCalendarWithExceptions({})
    ),
  ]);
}

export function createTodosPreloadTask(): PreloadTask {
  return task('primary:todos', '/todos', [
    createPreloadEntry(
      'queries.todos.allWithRelations',
      { archive: 'active' },
      queries.todos.allWithRelations({ archive: 'active' })
    ),
  ]);
}

export function createNotificationsPreloadTask(): PreloadTask {
  return task('primary:notifications', '/notifications', [
    createPreloadEntry(
      'queries.notifications.page',
      {
        tab: 'all',
        query: '',
        entityId: null,
        entityType: null,
        limit: 51,
        start: null,
        dir: 'forward',
      },
      queries.notifications.page({
        tab: 'all',
        query: '',
        entityId: null,
        entityType: null,
        limit: 51,
        start: null,
        dir: 'forward',
      })
    ),
  ]);
}

export function createCreatePreloadTask(userId: string): PreloadTask {
  return task('primary:create', '/create', [
    createPreloadEntry('queries.common.allHashtags', {}, queries.common.allHashtags({})),
    createPreloadEntry(
      'queries.common.userHashtags',
      { user_id: userId },
      queries.common.userHashtags({ user_id: userId })
    ),
    createPreloadEntry(
      'queries.groups.currentUserMembershipsWithGroups',
      {},
      queries.groups.currentUserMembershipsWithGroups({})
    ),
    createPreloadEntry(
      'queries.groups.currentUserMembershipsWithRights',
      {},
      queries.groups.currentUserMembershipsWithRights({})
    ),
  ]);
}

export function createCreateEventPreloadTask(userId: string, groupId?: string): PreloadTask {
  const base = createCreatePreloadTask(userId);
  if (!groupId) return { ...base, key: 'create:event', route: { href: '/create/event' } };
  return dynamicTask('create:event', `/create/event?groupId=${encodeURIComponent(groupId)}`, [
    ...base.entries,
    createPreloadEntry(
      'queries.amendments.openProcessTasksByGroup',
      { group_id: groupId },
      queries.amendments.openProcessTasksByGroup({ group_id: groupId })
    ),
    createPreloadEntry(
      'queries.groups.byIdBasic',
      { id: groupId },
      queries.groups.byIdBasic({ id: groupId })
    ),
  ]);
}

export function createPrimaryIdleTasks(userId: string): PreloadTask[] {
  return [
    createHomePreloadTask(userId),
    createMessagesPreloadTask(),
    createSearchPreloadTask(userId),
    createCreatePreloadTask(userId),
    createCalendarPreloadTask(),
    createTodosPreloadTask(),
    createNotificationsPreloadTask(),
  ];
}

export function createGroupPreloadTasks(groupId: string, viewerId?: string): PreloadTask[] {
  const base = `/group/${groupId}`;
  const now = Date.now();
  const common = [
    createPreloadEntry(
      'queries.groups.wikiOverview',
      { id: groupId },
      queries.groups.wikiOverview({ id: groupId })
    ),
  ];
  return [
    task(`group:${groupId}:overview`, base, [
      createPreloadEntry(
        'queries.groups.wikiOverview',
        { id: groupId },
        queries.groups.wikiOverview({ id: groupId })
      ),
      createPreloadEntry(
        'queries.network.wikiNetwork',
        { groupId },
        queries.network.wikiNetwork({ groupId })
      ),
      createPreloadEntry(
        'queries.groups.wikiRoleProjection',
        { groupId },
        queries.groups.wikiRoleProjection({ groupId })
      ),
      createPreloadEntry(
        'queries.groups.byIdBasic',
        { id: groupId },
        queries.groups.byIdBasic({ id: groupId })
      ),
      createPreloadEntry(
        'queries.groups.subscribersByGroup',
        { groupId },
        queries.groups.subscribersByGroup({ groupId })
      ),
      createPreloadEntry(
        'queries.groups.membershipPage',
        {
          groupId,
          statuses: ['active', 'admin', 'collaborator', 'confirmed', 'member', 'owner'],
          roleIds: [],
          query: '',
          limit: 51,
          start: null,
          dir: 'forward',
        },
        queries.groups.membershipPage({
          groupId,
          statuses: ['active', 'admin', 'collaborator', 'confirmed', 'member', 'owner'],
          roleIds: [],
          query: '',
          limit: 51,
          start: null,
          dir: 'forward',
        })
      ),
      ...(viewerId
        ? [
            createPreloadEntry(
              'queries.groups.viewerMembershipOverview',
              { groupId },
              queries.groups.viewerMembershipOverview({ groupId })
            ),
          ]
        : []),
    ]),
    task(`group:${groupId}:operation`, `${base}/operation`, [
      ...common,
      createPreloadEntry(
        'queries.groups.todosByGroup',
        { groupId },
        queries.groups.todosByGroup({ groupId, archive: 'active' })
      ),
      createPreloadEntry(
        'queries.groups.linksByGroup',
        { groupId },
        queries.groups.linksByGroup({ groupId })
      ),
      createPreloadEntry(
        'queries.groups.paymentsReceivedByGroup',
        { groupId },
        queries.groups.paymentsReceivedByGroup({ groupId })
      ),
      createPreloadEntry(
        'queries.groups.paymentsPaidByGroup',
        { groupId },
        queries.groups.paymentsPaidByGroup({ groupId })
      ),
    ]),
    task(`group:${groupId}:events`, `${base}/events`, [
      ...common,
      createPreloadEntry(
        'queries.events.byGroupActive',
        { groupId },
        queries.events.byGroupActive({ groupId })
      ),
      createPreloadEntry(
        'queries.events.byGroupForCalendar',
        { groupId },
        queries.events.byGroupForCalendar({ groupId })
      ),
    ]),
    task(`group:${groupId}:amendments`, `${base}/amendments`, [
      ...common,
      createPreloadEntry(
        'queries.groups.amendmentsByGroup',
        { groupId },
        queries.groups.amendmentsByGroup({ groupId })
      ),
    ]),
    task(`group:${groupId}:blogs-and-statements`, `${base}/blogs-and-statements`, [
      ...common,
      createPreloadEntry(
        'queries.blogs.byGroupWithHashtags',
        { group_id: groupId },
        queries.blogs.byGroupWithHashtags({ group_id: groupId })
      ),
      createPreloadEntry(
        'queries.statements.byGroup',
        { group_id: groupId, now },
        queries.statements.byGroup({ group_id: groupId, now })
      ),
    ]),
    task(`group:${groupId}:network`, `${base}/network`, [
      ...common,
      createPreloadEntry(
        'queries.groups.byIdForNetwork',
        { id: groupId },
        queries.groups.byIdForNetwork({ id: groupId })
      ),
    ]),
    task(`group:${groupId}:editor`, `${base}/editor`, [
      ...common,
      createPreloadEntry(
        'queries.groups.amendmentsWithDocuments',
        { groupId },
        queries.groups.amendmentsWithDocuments({ groupId })
      ),
    ]),
    task(`group:${groupId}:memberships`, `${base}/memberships`, [
      ...common,
      createPreloadEntry(
        'queries.groups.roleManagementProjection',
        { groupId },
        queries.groups.roleManagementProjection({ groupId })
      ),
      createPreloadEntry(
        'queries.groups.membershipsWithRolesAndRights',
        { groupId },
        queries.groups.membershipsWithRolesAndRights({ groupId })
      ),
      createPreloadEntry(
        'queries.groups.guestAccessesWithRolesAndRights',
        { groupId },
        queries.groups.guestAccessesWithRolesAndRights({ groupId })
      ),
      createPreloadEntry(
        'queries.groups.offlineMembershipsWithRolesAndRights',
        { groupId },
        queries.groups.offlineMembershipsWithRolesAndRights({ groupId })
      ),
    ]),
    task(`group:${groupId}:notifications`, `${base}/notifications`, [
      ...common,
      createPreloadEntry(
        'queries.notifications.byEntity',
        { entityId: groupId, entityType: 'group' },
        queries.notifications.byEntity({ entityId: groupId, entityType: 'group' })
      ),
    ]),
    task(`group:${groupId}:settings`, `${base}/settings`, [
      ...common,
      createPreloadEntry(
        'queries.common.groupHashtags',
        { group_id: groupId },
        queries.common.groupHashtags({ group_id: groupId })
      ),
      createPreloadEntry('queries.common.allHashtags', {}, queries.common.allHashtags({})),
    ]),
  ];
}

export function createEventPreloadTasks(eventId: string, viewerId?: string): PreloadTask[] {
  const base = `/event/${eventId}`;
  const common = [
    createPreloadEntry(
      'queries.events.byIdFull',
      { id: eventId },
      queries.events.byIdFull({ id: eventId })
    ),
  ];
  return [
    task(`event:${eventId}:overview`, base, [
      ...common,
      createPreloadEntry(
        'queries.events.wikiData',
        { id: eventId },
        queries.events.wikiData({ id: eventId })
      ),
      createPreloadEntry(
        'queries.events.wikiAgendaItems',
        { eventId },
        queries.events.wikiAgendaItems({ eventId })
      ),
      createPreloadEntry(
        'queries.events.participantsWithUserAndRole',
        { eventId },
        queries.events.participantsWithUserAndRole({ eventId })
      ),
      createPreloadEntry(
        'queries.events.byId',
        { id: eventId },
        queries.events.byId({ id: eventId })
      ),
      createPreloadEntry(
        'queries.events.subscribersByEvent',
        { eventId },
        queries.events.subscribersByEvent({ eventId })
      ),
      ...(viewerId
        ? [
            createPreloadEntry('queries.users.current', {}, queries.users.current({})),
            createPreloadEntry('queries.users.allUsers', {}, queries.users.allUsers({})),
          ]
        : []),
    ]),
    task(`event:${eventId}:agenda`, `${base}/agenda`, [
      ...common,
      ...createEventAgendaBasePreloadEntries(eventId),
    ]),
    task(`event:${eventId}:network`, `${base}/network`, common),
    task(`event:${eventId}:participants`, `${base}/participants`, [
      ...common,
      createPreloadEntry(
        'queries.events.participantsWithUserAndRole',
        { eventId },
        queries.events.participantsWithUserAndRole({ eventId })
      ),
      createPreloadEntry(
        'queries.events.offlineParticipants',
        { eventId },
        queries.events.offlineParticipants({ eventId })
      ),
      createPreloadEntry(
        'queries.events.accessRolesByEvent',
        { eventId },
        queries.events.accessRolesByEvent({ eventId })
      ),
      createPreloadEntry(
        'queries.events.delegateAssemblyComposition',
        { id: eventId },
        queries.events.delegateAssemblyComposition({ id: eventId })
      ),
      createPreloadEntry(
        'queries.events.assemblyScopesByEvent',
        { eventId },
        queries.events.assemblyScopesByEvent({ eventId })
      ),
      createPreloadEntry(
        'queries.events.delegateElectionAssignmentsByEvent',
        { eventId },
        queries.events.delegateElectionAssignmentsByEvent({ eventId })
      ),
    ]),
    task(`event:${eventId}:roles`, `${base}/roles`, [
      ...common,
      createPreloadEntry(
        'queries.events.forRoles',
        { id: eventId },
        queries.events.forRoles({ id: eventId })
      ),
      createPreloadEntry(
        'queries.events.rolesWithHolders',
        { eventId },
        queries.events.rolesWithHolders({ eventId })
      ),
    ]),
    task(`event:${eventId}:stream`, `${base}/stream`, [
      ...common,
      createPreloadEntry(
        'queries.events.streamEvent',
        { id: eventId },
        queries.events.streamEvent({ id: eventId })
      ),
    ]),
    task(`event:${eventId}:notifications`, `${base}/notifications`, [
      ...common,
      createPreloadEntry(
        'queries.notifications.byEntity',
        { entityId: eventId, entityType: 'event' },
        queries.notifications.byEntity({ entityId: eventId, entityType: 'event' })
      ),
    ]),
    task(`event:${eventId}:settings`, `${base}/settings`, [
      ...common,
      createPreloadEntry(
        'queries.events.forCancel',
        { id: eventId },
        queries.events.forCancel({ id: eventId })
      ),
    ]),
  ];
}

export function createAmendmentPreloadTasks(amendmentId: string, viewerId?: string): PreloadTask[] {
  const base = `/amendment/${amendmentId}`;
  const basic = [
    createPreloadEntry(
      'queries.amendments.byId',
      { id: amendmentId },
      queries.amendments.byId({ id: amendmentId })
    ),
  ];
  const documents = [
    createPreloadEntry(
      'queries.amendments.documentsByAmendment',
      { amendment_id: amendmentId },
      queries.amendments.documentsByAmendment({ amendment_id: amendmentId })
    ),
  ];
  return [
    task(`amendment:${amendmentId}:wiki`, base, [
      createPreloadEntry(
        'queries.amendments.byIdWiki',
        { id: amendmentId },
        queries.amendments.byIdWiki({ id: amendmentId })
      ),
      createPreloadEntry(
        'queries.amendments.collaborators',
        { amendment_id: amendmentId },
        queries.amendments.collaborators({ amendment_id: amendmentId })
      ),
      createPreloadEntry(
        'queries.amendments.subscribers',
        { amendment_id: amendmentId },
        queries.amendments.subscribers({ amendment_id: amendmentId })
      ),
      createPreloadEntry(
        'queries.amendments.clonesBySource',
        { source_id: amendmentId },
        queries.amendments.clonesBySource({ source_id: amendmentId })
      ),
      createPreloadEntry(
        'queries.amendments.rolesByAmendment',
        { amendment_id: amendmentId },
        queries.amendments.rolesByAmendment({ amendment_id: amendmentId })
      ),
      ...(viewerId
        ? [
            createPreloadEntry(
              'queries.amendments.userCollaboration',
              { amendment_id: amendmentId, user_id: viewerId },
              queries.amendments.userCollaboration({
                amendment_id: amendmentId,
                user_id: viewerId,
              })
            ),
          ]
        : []),
    ]),
    task(`amendment:${amendmentId}:text`, `${base}/text`, [
      ...basic,
      ...documents,
      createPreloadEntry(
        'queries.amendments.byIdWithProcessData',
        { id: amendmentId },
        queries.amendments.byIdWithProcessData({ id: amendmentId })
      ),
      createPreloadEntry(
        'queries.amendments.byIdWithDocsAndCollabs',
        { id: amendmentId },
        queries.amendments.byIdWithDocsAndCollabs({ id: amendmentId })
      ),
    ]),
    task(`amendment:${amendmentId}:process`, `${base}/process`, [
      ...basic,
      createPreloadEntry(
        'queries.amendments.byIdWithProcessData',
        { id: amendmentId },
        queries.amendments.byIdWithProcessData({ id: amendmentId })
      ),
    ]),
    task(`amendment:${amendmentId}:change-requests`, `${base}/change-requests`, [
      ...basic,
      ...documents,
      createPreloadEntry(
        'queries.amendments.changeRequestsWithVotes',
        { amendment_id: amendmentId },
        queries.amendments.changeRequestsWithVotes({ amendment_id: amendmentId })
      ),
      createPreloadEntry(
        'queries.amendments.streetDesigns',
        { amendment_id: amendmentId },
        queries.amendments.streetDesigns({ amendment_id: amendmentId })
      ),
    ]),
    task(`amendment:${amendmentId}:discussions`, `${base}/discussions`, [
      ...basic,
      ...documents,
      createPreloadEntry(
        'queries.amendments.threads',
        { amendment_id: amendmentId },
        queries.amendments.threads({ amendment_id: amendmentId })
      ),
    ]),
    task(`amendment:${amendmentId}:streetscape`, `${base}/streetscape`, [
      ...basic,
      createPreloadEntry(
        'queries.amendments.streetDesigns',
        { amendment_id: amendmentId },
        queries.amendments.streetDesigns({ amendment_id: amendmentId })
      ),
      createPreloadEntry(
        'queries.amendments.changeRequestsWithVotes',
        { amendment_id: amendmentId },
        queries.amendments.changeRequestsWithVotes({ amendment_id: amendmentId })
      ),
    ]),
    task(`amendment:${amendmentId}:collaborators`, `${base}/collaborators`, [
      ...basic,
      createPreloadEntry(
        'queries.amendments.collaborators',
        { amendment_id: amendmentId },
        queries.amendments.collaborators({ amendment_id: amendmentId })
      ),
      createPreloadEntry(
        'queries.amendments.rolesByAmendment',
        { amendment_id: amendmentId },
        queries.amendments.rolesByAmendment({ amendment_id: amendmentId })
      ),
      createPreloadEntry('queries.groups.allUsersLimited', {}, queries.groups.allUsersLimited({})),
    ]),
    task(`amendment:${amendmentId}:notifications`, `${base}/notifications`, [
      ...basic,
      createPreloadEntry(
        'queries.amendments.rolesByAmendment',
        { amendment_id: amendmentId },
        queries.amendments.rolesByAmendment({ amendment_id: amendmentId })
      ),
      createPreloadEntry(
        'queries.notifications.byEntity',
        { entityId: amendmentId, entityType: 'amendment' },
        queries.notifications.byEntity({ entityId: amendmentId, entityType: 'amendment' })
      ),
    ]),
    task(`amendment:${amendmentId}:settings`, `${base}/settings`, [
      ...basic,
      createPreloadEntry(
        'queries.amendments.byIdWithProcessData',
        { id: amendmentId },
        queries.amendments.byIdWithProcessData({ id: amendmentId })
      ),
    ]),
  ];
}

export function createUserPreloadTasks(userId: string, isOwnUser: boolean): PreloadTask[] {
  const base = `/user/${userId}`;
  const profile = [
    createPreloadEntry('queries.users.current', {}, queries.users.current({})),
    createPreloadEntry('queries.users.byId', { id: userId }, queries.users.byId({ id: userId })),
    createPreloadEntry(
      'queries.common.userHashtags',
      { user_id: userId },
      queries.common.userHashtags({ user_id: userId })
    ),
    createPreloadEntry('queries.users.followers', { userId }, queries.users.followers({ userId })),
    createPreloadEntry('queries.users.following', { userId }, queries.users.following({ userId })),
    createPreloadEntry(
      'queries.payments.subscriptionStatusByUser',
      { userId },
      queries.payments.subscriptionStatusByUser({ userId })
    ),
    createPreloadEntry(
      'queries.common.userSubscribers',
      { user_id: userId },
      queries.common.userSubscribers({ user_id: userId })
    ),
  ];
  const tasks = [
    task(`user:${userId}:profile`, base, profile),
    task(`user:${userId}:memberships`, `${base}/memberships`, [
      ...profile,
      createPreloadEntry(
        'queries.groups.membershipsByUser',
        { user_id: userId },
        queries.groups.membershipsByUser({ user_id: userId })
      ),
      createPreloadEntry(
        'queries.events.userParticipationsWithEvent',
        { userId },
        queries.events.userParticipationsWithEvent({ userId })
      ),
      createPreloadEntry(
        'queries.amendments.collaboratorsByUser',
        { user_id: userId },
        queries.amendments.collaboratorsByUser({ user_id: userId })
      ),
      createPreloadEntry(
        'queries.blogs.bloggersByUser',
        { user_id: userId },
        queries.blogs.bloggersByUser({ user_id: userId })
      ),
    ]),
    task(`user:${userId}:subscriptions`, `${base}/subscriptions`, [
      ...profile,
      createPreloadEntry(
        'queries.common.userSubscriptions',
        { subscriber_id: userId },
        queries.common.userSubscriptions({ subscriber_id: userId })
      ),
      createPreloadEntry(
        'queries.common.userSubscribers',
        { user_id: userId },
        queries.common.userSubscribers({ user_id: userId })
      ),
    ]),
    task(`user:${userId}:meet`, `${base}/meet`, [
      ...profile,
      createPreloadEntry(
        'queries.calendarSubscriptions.byUserAndUser',
        { targetUserId: userId },
        queries.calendarSubscriptions.byUserAndUser({ targetUserId: userId })
      ),
      createPreloadEntry(
        'queries.events.byCreator',
        { userId },
        queries.events.byCreator({ userId })
      ),
    ]),
    task(`user:${userId}:network`, `${base}/network`, [
      ...profile,
      createPreloadEntry(
        'queries.users.withGroupMemberships',
        { id: userId },
        queries.users.withGroupMemberships({ id: userId })
      ),
      createPreloadEntry(
        'queries.network.allGroupConnections',
        {},
        queries.network.allGroupConnections({})
      ),
    ]),
    task(`user:${userId}:blog`, `${base}/blog`, profile),
    task(`user:${userId}:editor`, `${base}/editor`, profile),
  ];
  if (isOwnUser) {
    tasks.push(
      task(`user:${userId}:settings`, `${base}/settings`, [
        ...profile,
        createPreloadEntry('queries.preferences.byUser', {}, queries.preferences.byUser({})),
      ]),
      task(`user:${userId}:notification-settings`, `${base}/notification-settings`, [
        ...profile,
        createPreloadEntry(
          'queries.notifications.settings',
          {},
          queries.notifications.settings({})
        ),
      ])
    );
  }
  return tasks;
}

export function createBlogPreloadTasks(
  blogId: string,
  base = `/blog/${blogId}`,
  viewerId?: string
): PreloadTask[] {
  const common = [
    createPreloadEntry('queries.blogs.byId', { id: blogId }, queries.blogs.byId({ id: blogId })),
    createPreloadEntry(
      'queries.blogs.entries',
      { blog_id: blogId },
      queries.blogs.entries({ blog_id: blogId })
    ),
    ...(base === `/blog/${blogId}`
      ? [
          createPreloadEntry(
            'queries.blogs.byIdWithBloggers',
            { id: blogId },
            queries.blogs.byIdWithBloggers({ id: blogId })
          ),
        ]
      : []),
  ];
  return [
    task(`blog:${blogId}:overview`, base, [
      ...common,
      createPreloadEntry(
        'queries.blogs.byIdWithDetails',
        { id: blogId },
        queries.blogs.byIdWithDetails({ id: blogId })
      ),
      createPreloadEntry(
        'queries.blogs.blogThread',
        { blog_id: blogId },
        queries.blogs.blogThread({ blog_id: blogId })
      ),
      createPreloadEntry(
        'queries.blogs.subscribers',
        { blog_id: blogId },
        queries.blogs.subscribers({ blog_id: blogId })
      ),
      ...createPermissionPreloadEntries(viewerId),
    ]),
    task(`blog:${blogId}:editor`, `${base}/editor`, [
      ...common,
      createPreloadEntry(
        'queries.blogs.byIdForEditor',
        { id: blogId },
        queries.blogs.byIdForEditor({ id: blogId })
      ),
      createPreloadEntry(
        'queries.blogs.versionsByBlogId',
        { blog_id: blogId },
        queries.blogs.versionsByBlogId({ blog_id: blogId })
      ),
    ]),
    task(`blog:${blogId}:edit`, `${base}/edit`, [
      ...common,
      createPreloadEntry(
        'queries.blogs.byIdWithHashtags',
        { id: blogId },
        queries.blogs.byIdWithHashtags({ id: blogId })
      ),
      createPreloadEntry(
        'queries.common.blogHashtags',
        { blog_id: blogId },
        queries.common.blogHashtags({ blog_id: blogId })
      ),
      createPreloadEntry('queries.common.allHashtags', {}, queries.common.allHashtags({})),
    ]),
    task(`blog:${blogId}:notifications`, `${base}/notifications`, [
      ...common,
      createPreloadEntry(
        'queries.notifications.byEntity',
        { entityId: blogId, entityType: 'blog' },
        queries.notifications.byEntity({ entityId: blogId, entityType: 'blog' })
      ),
    ]),
  ];
}

export function createIntentTaskForHref(href: string, userId?: string): PreloadTask | undefined {
  if (!userId) return undefined;
  const pathname = href.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/';
  if (pathname === '/home') return createHomePreloadTask(userId);
  if (pathname === '/messages') return createMessagesPreloadTask();
  if (pathname === '/search') return createSearchPreloadTask(userId);
  if (pathname === '/create') return createCreatePreloadTask(userId);
  if (pathname === '/calendar') return createCalendarPreloadTask();
  if (pathname === '/todos') return createTodosPreloadTask();
  if (pathname === '/notifications') return createNotificationsPreloadTask();
  if (pathname.startsWith('/create/')) {
    const page = pathname.slice('/create/'.length).split('/')[0];
    const createTask =
      page === 'event' ? createCreateEventPreloadTask(userId) : createCreatePreloadTask(userId);
    return {
      ...createTask,
      key: `create:${page}`,
      route: { href: pathname },
    };
  }

  const nestedBlog = pathname.match(/^(\/(?:group|user)\/[^/]+\/blog\/([^/]+))(?:\/.*)?$/);
  if (nestedBlog) {
    return taskForPath(createBlogPreloadTasks(nestedBlog[2], nestedBlog[1], userId), pathname);
  }
  const blog = pathname.match(/^(\/blog\/([^/]+))(?:\/.*)?$/);
  if (blog) return taskForPath(createBlogPreloadTasks(blog[2], blog[1], userId), pathname);

  const group = pathname.match(/^\/group\/([^/]+)/);
  if (group) {
    const tasks = createGroupPreloadTasks(group[1], userId);
    const base = `/group/${group[1]}`;
    if (pathname.startsWith(`${base}/relationships`)) {
      return taskForAlias(tasks, 'network', pathname);
    }
    return taskForPath(tasks, pathname);
  }
  const event = pathname.match(/^\/event\/([^/]+)/);
  if (event) return taskForPath(createEventPreloadTasks(event[1], userId), pathname);
  const amendment = pathname.match(/^\/amendment\/([^/]+)/);
  if (amendment) return taskForPath(createAmendmentPreloadTasks(amendment[1], userId), pathname);
  const user = pathname.match(/^\/user\/([^/]+)/);
  if (user) {
    const tasks = createUserPreloadTasks(user[1], user[1] === userId);
    if (pathname.startsWith(`/user/${user[1]}/notifications`)) {
      return taskForAlias(tasks, 'settings', pathname);
    }
    return taskForPath(tasks, pathname);
  }
  return undefined;
}

function taskForPath(tasks: readonly PreloadTask[], pathname: string) {
  const rootHref = tasks.reduce(
    (shortest, item) => (item.route.href.length < shortest.length ? item.route.href : shortest),
    tasks[0]?.route.href ?? ''
  );
  return [...tasks]
    .sort((left, right) => right.route.href.length - left.route.href.length)
    .find(
      item =>
        pathname === item.route.href ||
        (item.route.href !== rootHref && pathname.startsWith(`${item.route.href}/`))
    );
}

function taskForAlias(tasks: readonly PreloadTask[], suffix: string, pathname: string) {
  const matched = tasks.find(item => item.key.endsWith(`:${suffix}`));
  return matched ? { ...matched, route: { href: pathname } } : undefined;
}
