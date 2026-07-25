import { describe, expect, it } from 'vitest';
import {
  createAmendmentPreloadTasks,
  createEventPreloadTasks,
  createBlogPreloadTasks,
  createGroupPreloadTasks,
  createHomePreloadTask,
  createIntentTaskForHref,
  createMessagesPreloadTask,
  createNotificationsPreloadTask,
  createSearchPreloadTask,
  createUserPreloadTasks,
} from '../route-manifests';

describe('prioritized preload route manifests', () => {
  it('preloads only the bounded first notification page', () => {
    const entries = createNotificationsPreloadTask().entries;

    expect(entries).toHaveLength(1);
    expect(entries[0]?.key).toContain('queries.notifications.page');
    expect(entries[0]?.key).toContain('"limit":51');
    expect(entries[0]?.key).not.toContain('byUserWithRelations');
  });

  it('keeps dynamic search and conversation arguments in separate task identities', () => {
    const recent = createSearchPreloadTask('user-1', { q: 'budget', sort: 'recent' });
    const trending = createSearchPreloadTask('user-1', { q: 'budget', sort: 'trending' });
    const firstConversation = createMessagesPreloadTask('conversation-1');
    const secondConversation = createMessagesPreloadTask('conversation-2');

    expect(recent.key).not.toBe(trending.key);
    expect(firstConversation.key).not.toBe(secondConversation.key);
  });

  it('keeps home narrow and defers search viewer state until after paint', () => {
    const homeKeys = createHomePreloadTask('user-1')
      .entries.map(entry => entry.key)
      .join('|');
    const searchKeys = createSearchPreloadTask('user-1')
      .entries.map(entry => entry.key)
      .join('|');

    expect(homeKeys).toContain('queries.common.userHashtags');
    expect(homeKeys).not.toContain('userSubscriptionsForTimeline');
    expect(homeKeys).not.toContain('votesWithDetails');
    expect(homeKeys).not.toContain('electionsWithDetails');
    expect(searchKeys).not.toContain('queries.common.viewerSubscriptions');
    expect(searchKeys).not.toContain('queries.amendments.viewerCollaborations');
    expect(searchKeys).not.toContain('queries.events.viewerDelegations');
    expect(searchKeys).toContain('"limit":19');
  });

  it('assigns expensive amendment queries only to their consuming subpages', () => {
    const tasks = createAmendmentPreloadTasks('amendment-1');
    const wiki = tasks.find(task => task.key.endsWith(':wiki'));
    const changeRequests = tasks.find(task => task.key.endsWith(':change-requests'));
    const notifications = tasks.find(task => task.key.endsWith(':notifications'));

    expect(wiki?.entries.map(entry => entry.key).join('|')).not.toContain(
      'changeRequestsWithVotes'
    );
    expect(changeRequests?.entries.map(entry => entry.key).join('|')).toContain(
      'changeRequestsWithVotes'
    );
    expect(notifications?.entries.map(entry => entry.key).join('|')).toContain(
      'notifications.byEntity'
    );
  });

  it('creates distinct route tasks for group and event subpages', () => {
    expect(createGroupPreloadTasks('group-1').map(task => task.route.href)).toContain(
      '/group/group-1/memberships'
    );
    expect(createEventPreloadTasks('event-1').map(task => task.route.href)).toContain(
      '/event/event-1/agenda'
    );
  });

  it('resolves concrete primary and entity intent targets without preloading every entity', () => {
    expect(createIntentTaskForHref('/home', 'user-1')?.key).toBe('primary:home');
    expect(createIntentTaskForHref('/create/event', 'user-1')?.key).toBe('create:event');
    expect(createIntentTaskForHref('/group/group-1', 'user-1')?.key).toBe('group:group-1:overview');
    expect(createIntentTaskForHref('/event/event-1/agenda', 'user-1')?.key).toBe(
      'event:event-1:agenda'
    );
    expect(createIntentTaskForHref('/amendment/amendment-1/collaborators', 'user-1')?.key).toBe(
      'amendment:amendment-1:collaborators'
    );
    expect(createIntentTaskForHref('/user/user-2/blog/blog-1', 'user-1')?.key).toBe(
      'blog:blog-1:overview'
    );
    expect(createIntentTaskForHref('/statement/statement-1', 'user-1')).toBeUndefined();
    expect(createIntentTaskForHref('/group/group-1/relationships', 'user-1')?.key).toBe(
      'group:group-1:network'
    );
    expect(createIntentTaskForHref('/group/group-1/blog', 'user-1')).toBeUndefined();
    expect(createIntentTaskForHref('/user/user-1/notifications', 'user-1')?.key).toBe(
      'user:user-1:settings'
    );
  });

  it('matches the exact cold-render query contracts of all wiki roots', () => {
    const keys = (entries: readonly { key: string }[]) => entries.map(entry => entry.key).join('|');
    const group = createGroupPreloadTasks('group-1', 'viewer-1')[0];
    const event = createEventPreloadTasks('event-1', 'viewer-1')[0];
    const amendment = createAmendmentPreloadTasks('amendment-1', 'viewer-1')[0];
    const user = createUserPreloadTasks('user-1', false)[0];
    const blog = createBlogPreloadTasks('blog-1', '/blog/blog-1', 'viewer-1')[0];

    const groupKeys = keys(group.entries);
    expect(groupKeys).toContain('queries.groups.wikiOverview');
    expect(groupKeys).toContain('queries.network.wikiNetwork');
    expect(groupKeys).toContain('queries.groups.wikiRoleProjection');
    expect(groupKeys).toContain('queries.groups.viewerMembershipOverview');
    expect(groupKeys).toContain('queries.groups.membershipPage');
    expect(groupKeys).toContain('queries.groups.subscribersByGroup');
    expect(groupKeys).not.toContain('queries.groups.wikiData');
    expect(groupKeys).not.toContain('queries.network.allGroupConnections');
    expect(groupKeys).not.toContain('queries.groups.userMembershipInGroup');
    expect(groupKeys).not.toContain('queries.groups.allMembershipsInGroupWithRole');
    expect(groupKeys).not.toContain('queries.groups.rolesFull');
    expect(keys(event.entries)).toContain('queries.events.participantsWithUserAndRole');
    expect(keys(event.entries)).toContain('queries.events.subscribersByEvent');
    expect(keys(amendment.entries)).toContain('queries.amendments.byIdWiki');
    expect(keys(amendment.entries)).not.toContain('queries.amendments.byIdWithRelations');
    expect(keys(amendment.entries)).not.toContain('queries.amendments.allGroupRelationships');
    expect(keys(amendment.entries)).not.toContain('queries.amendments.allGroupMemberships');
    expect(keys(amendment.entries)).not.toContain('queries.amendments.allEvents');
    expect(keys(amendment.entries)).not.toContain('queries.amendments.allUsers');
    expect(keys(user.entries)).toContain('queries.users.byId');
    expect(keys(user.entries)).toContain('queries.common.userHashtags');
    expect(keys(user.entries)).not.toContain('queries.users.wikiProfile');
    expect(keys(user.entries)).toContain('queries.payments.subscriptionStatusByUser');
    expect(keys(user.entries)).toContain('queries.common.userSubscribers');
    expect(keys(blog.entries)).toContain('queries.blogs.byId');
    expect(keys(blog.entries)).toContain('queries.rbac.viewerBloggerRelations');
    expect(keys(blog.entries)).toContain('queries.blogs.byIdWithBloggers');
    expect(
      keys(createBlogPreloadTasks('blog-1', '/group/group-1/blog/blog-1', 'viewer-1')[0].entries)
    ).not.toContain('queries.blogs.byIdWithBloggers');
  });

  it('keeps wiki task identities separate across entity IDs and nested blog paths', () => {
    expect(createGroupPreloadTasks('group-1')[0]?.key).not.toBe(
      createGroupPreloadTasks('group-2')[0]?.key
    );
    expect(createIntentTaskForHref('/group/group-1/blog/blog-1', 'viewer-1')?.route.href).toBe(
      '/group/group-1/blog/blog-1'
    );
    expect(createIntentTaskForHref('/user/user-1/blog/blog-1', 'viewer-1')?.route.href).toBe(
      '/user/user-1/blog/blog-1'
    );
  });
});
