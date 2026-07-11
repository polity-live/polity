import { describe, expect, it } from 'vitest';
import {
  createAmendmentPreloadTasks,
  createEventPreloadTasks,
  createGroupPreloadTasks,
  createIntentTaskForHref,
  createMessagesPreloadTask,
  createSearchPreloadTask,
} from '../route-manifests';

describe('prioritized preload route manifests', () => {
  it('keeps dynamic search and conversation arguments in separate task identities', () => {
    const recent = createSearchPreloadTask('user-1', { q: 'budget', sort: 'recent' });
    const trending = createSearchPreloadTask('user-1', { q: 'budget', sort: 'trending' });
    const firstConversation = createMessagesPreloadTask('conversation-1');
    const secondConversation = createMessagesPreloadTask('conversation-2');

    expect(recent.key).not.toBe(trending.key);
    expect(firstConversation.key).not.toBe(secondConversation.key);
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
  });
});
