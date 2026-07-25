import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';

import { amendmentQueries } from '../amendments/queries';
import { blogQueries } from '../blogs/queries';
import { documentQueries } from '../documents/queries';
import { messageQueries } from '../messages/queries';
import { notificationQueries } from '../notifications/queries';
import { searchQueries } from '../shared/queries';
import { statementQueries } from '../statements/queries';
import { todoQueries } from '../todos/queries';
import { groupQueries } from '../groups/queries';
import { eventQueries } from '../events/queries';
import { agendaQueries } from '../agendas/queries';
import { commonQueries } from '../common/queries';
import { networkQueries } from '../network/queries';
import { electionQueries } from '../elections/queries';
import { voteQueries } from '../votes/queries';

const virtualizedPageQueries = [
  {
    name: 'amendment discussions',
    definition: amendmentQueries.discussionThreadPage,
    args: { amendmentId: 'a' },
  },
  { name: 'blogs', definition: blogQueries.pageByGroup, args: { groupId: 'g' } },
  { name: 'documents', definition: documentQueries.pageByGroup, args: { groupId: 'g' } },
  { name: 'conversations', definition: messageQueries.conversationPage, args: {} },
  { name: 'messages', definition: messageQueries.messagePage, args: { conversationId: 'c' } },
  { name: 'notifications', definition: notificationQueries.page, args: {} },
  { name: 'search documents', definition: searchQueries.searchDocumentPage, args: {} },
  {
    name: 'statements',
    definition: statementQueries.pageByGroup,
    args: { groupId: 'g', now: 1 },
  },
  { name: 'todos', definition: todoQueries.page, args: {} },
  { name: 'group memberships', definition: groupQueries.membershipPage, args: { groupId: 'g' } },
  { name: 'group guests', definition: groupQueries.guestAccessPage, args: { groupId: 'g' } },
  {
    name: 'user memberships',
    definition: groupQueries.membershipPageByUser,
    args: { userId: 'u' },
  },
  { name: 'event participants', definition: eventQueries.participantPage, args: { eventId: 'e' } },
  {
    name: 'user event participations',
    definition: eventQueries.participantPageByUser,
    args: { userId: 'u' },
  },
  { name: 'calendar events', definition: eventQueries.calendarPage, args: {} },
  { name: 'agenda speakers', definition: agendaQueries.speakerPage, args: { agendaItemId: 'a' } },
  {
    name: 'agenda change requests',
    definition: agendaQueries.changeRequestPage,
    args: { agendaItemId: 'a' },
  },
  { name: 'timeline feed', definition: commonQueries.timelineFeedPage, args: { now: 1 } },
  {
    name: 'subscriptions',
    definition: commonQueries.subscriptionPage,
    args: { subscriberId: 'u' },
  },
  {
    name: 'network connections',
    definition: networkQueries.groupConnectionPage,
    args: { groupId: 'g' },
  },
  {
    name: 'network requests',
    definition: networkQueries.groupConnectionRequestPage,
    args: { groupId: 'g', direction: 'incoming' },
  },
  { name: 'decision elections', definition: electionQueries.decisionPage, args: {} },
  { name: 'decision votes', definition: voteQueries.decisionPage, args: {} },
  {
    name: 'group amendments',
    definition: amendmentQueries.groupAmendmentPage,
    args: { groupId: 'g' },
  },
  {
    name: 'group amendments by display status',
    definition: amendmentQueries.groupAmendmentPage,
    args: { groupId: 'g', displayStatus: 'pending' },
  },
  {
    name: 'amendment collaborators',
    definition: amendmentQueries.collaboratorPage,
    args: { amendmentId: 'a' },
  },
  {
    name: 'user amendment collaborations',
    definition: amendmentQueries.collaborationPageByUser,
    args: { userId: 'u' },
  },
  {
    name: 'amendment change requests',
    definition: amendmentQueries.changeRequestPage,
    args: { amendmentId: 'a' },
  },
  {
    name: 'discussion comments',
    definition: amendmentQueries.discussionCommentPage,
    args: { threadId: 't' },
  },
  { name: 'user blogs', definition: blogQueries.pageByUser, args: { userId: 'u' } },
  { name: 'blog bloggers', definition: blogQueries.bloggerPage, args: { blogId: 'b' } },
  {
    name: 'user blogger memberships',
    definition: blogQueries.bloggerMembershipPageByUser,
    args: { userId: 'u' },
  },
  {
    name: 'user statements',
    definition: statementQueries.pageByUser,
    args: { userId: 'u', now: 1 },
  },
] as const;

describe('virtualized page query limits', () => {
  it.each(virtualizedPageQueries)(
    '$name accepts the virtualizer look-ahead row',
    ({ definition, args }) => {
      const validator = definition.validator as ZodType;

      expect(validator.safeParse({ ...args, limit: 51 }).success).toBe(true);
      expect(validator.safeParse({ ...args, limit: 101 }).success).toBe(true);
      expect(validator.safeParse({ ...args, limit: 201 }).success).toBe(false);
    }
  );
});
