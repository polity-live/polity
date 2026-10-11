import { projectChatQueries } from './project-chat/queries';
import { defineQueries } from '@rocicorp/zero';
import { memoizeQueryDefinitions } from './query-definitions';

import { userQueries } from './users/queries';
import { groupQueries } from './groups/queries';
import { eventQueries } from './events/queries';
import { amendmentQueries } from './amendments/queries';
import { documentQueries } from './documents/queries';
import { agendaQueries } from './agendas/queries';
import { todoQueries } from './todos/queries';
import { messageQueries } from './messages/queries';
import { notificationQueries } from './notifications/queries';
import { blogQueries } from './blogs/queries';
import { paymentQueries } from './payments/queries';
import { statementQueries } from './statements/queries';
import { commonQueries } from './common/queries';
import { searchQueries } from './shared/queries';
import { rbacQueries } from './rbac/queries';
import { preferenceQueries } from './preferences/queries';
import { aiQueries } from './ai/queries';
import { calendarSubscriptionQueries } from './calendar-subscriptions/queries';
import { electionQueries } from './elections/queries';
import { voteQueries } from './votes/queries';
import { votingPasswordQueries } from './voting-password/queries';
import { accreditationQueries } from './accreditation/queries';
import { networkQueries } from './network/queries';
import { pqlQueries } from './pql/queries';
import { datasetQueries } from './datasets/queries';
import { appearanceThemeQueries } from './appearance-themes/queries';
import { studioQueries } from './communication-studio/queries';

export const queries = defineQueries({
  users: userQueries,
  groups: memoizeQueryDefinitions(groupQueries),
  events: memoizeQueryDefinitions(eventQueries),
  amendments: memoizeQueryDefinitions(amendmentQueries),
  documents: documentQueries,
  agendas: memoizeQueryDefinitions(agendaQueries),
  todos: todoQueries,
  messages: memoizeQueryDefinitions(messageQueries),
  projectChat: projectChatQueries,
  notifications: memoizeQueryDefinitions(notificationQueries),
  blogs: memoizeQueryDefinitions(blogQueries),
  payments: paymentQueries,
  statements: statementQueries,
  common: commonQueries,
  search: searchQueries,
  rbac: memoizeQueryDefinitions(rbacQueries),
  preferences: preferenceQueries,
  ai: aiQueries,
  calendarSubscriptions: calendarSubscriptionQueries,
  elections: memoizeQueryDefinitions(electionQueries),
  votes: voteQueries,
  votingPassword: votingPasswordQueries,
  accreditation: accreditationQueries,
  network: memoizeQueryDefinitions(networkQueries),
  pql: pqlQueries,
  datasets: datasetQueries,
  appearanceThemes: appearanceThemeQueries,
  studio: studioQueries,
});
