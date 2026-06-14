import { relationships } from '@rocicorp/zero';

// Users
import { user, file } from './users/table';
// Groups
import {
  group,
  groupMembership,
  groupOfflineMember,
  groupOfflineMembership,
  groupMembershipRole,
  groupOfflineMembershipRole,
  groupGuestAccess,
  groupGuestRole,
  role,
  roleHolderHistory,
  actionRight,
} from './groups/table';
// Events
import {
  event,
  eventParticipant,
  eventOfflineParticipant,
  eventParticipantRole,
  participant,
  eventException,
} from './events/table';
// Amendments
import {
  amendment,
  amendmentCollaborator,
  amendmentPath,
  amendmentPathSegment,
  supportConfirmation,
  amendmentGroupDecision,
  amendmentProcessRun,
  amendmentProcessBranch,
  amendmentProcessStepRun,
  processTask,
} from './amendments/table';
// Documents
import { document, documentVersion, documentCollaborator, documentCursor } from './documents/table';
// Agendas
import { agendaItem, speakerList, agendaItemChangeRequest } from './agendas/table';
// Elections
import {
  election,
  electionCandidate,
  electionOfflineTally,
  elector,
  indicativeElectorParticipation,
  indicativeCandidateSelection,
  finalElectorParticipation,
  finalCandidateSelection,
} from './elections/table';
// Votes
import {
  vote,
  voteChoice,
  voteOfflineTally,
  voter,
  indicativeVoterParticipation,
  indicativeChoiceDecision,
  finalVoterParticipation,
  finalChoiceDecision,
  amendmentSupportVote,
  changeRequestVote,
  blogSupportVote,
  statementSupportVote,
  threadVote,
  commentVote,
} from './votes/table';
// Change Requests
import { changeRequest } from './change-requests/table';
// Discussions
import { thread, comment } from './discussions/table';
// Delegates
import { eventDelegate, groupDelegateAllocation } from './delegates/table';
// Network
import {
  follow,
  groupConnection,
  groupRightGrant,
  groupMembershipRule,
  groupMembershipRuleOrigin,
  groupConnectionRequest,
  groupRightGrantRequest,
  groupMembershipRuleRequest,
  groupMembershipRuleRequestOrigin,
  subscriber,
  groupWorkflow,
  groupWorkflowStep,
  groupWorkflowApproval,
} from './network/table';
// Todos
import { todo, todoAssignment } from './todos/table';
// Messages
import { conversation, conversationParticipant, message } from './messages/table';
import { searchDocument, searchDocumentAcl, searchDocumentTopic } from './search-documents/table';
// Notifications
import {
  notification,
  pushSubscription,
  notificationSetting,
  notificationRead,
} from './notifications/table';
// Blogs
import { blog, blogBlogger } from './blogs/table';
// Payments
import { payment, stripeCustomer, stripeSubscription, stripePayment } from './payments/table';
// Statements
import {
  statement,
  statementSurvey,
  statementSurveyOption,
  statementSurveyVote,
} from './statements/table';
// Preferences
import { userPreference } from './preferences/table';
import { aiSkill, aiTool } from './ai/table';
// Calendar Subscriptions
import { calendarSubscription } from './calendar-subscriptions/table';

// Voting Password
import { votingPassword } from './voting-password/table';
// Accreditation
import { accreditation } from './accreditation/table';
import {
  chartProjection,
  chartProjectionPoint,
  eurostatDataset,
  eurostatObservation,
} from './eurostat/table';
// Common
import {
  hashtag,
  userHashtag,
  groupHashtag,
  amendmentHashtag,
  eventHashtag,
  blogHashtag,
  statementHashtag,
  link,
  timelineEvent,
  reaction,
} from './common/table';

// ============================================
// User relationships
// ============================================
export const userRelationships = relationships(user, ({ many }) => ({
  follows_as_follower: many({
    sourceField: ['id'],
    destSchema: follow,
    destField: ['follower_id'],
  }),
  follows_as_followee: many({
    sourceField: ['id'],
    destSchema: follow,
    destField: ['followee_id'],
  }),
  group_memberships: many({
    sourceField: ['id'],
    destSchema: groupMembership,
    destField: ['user_id'],
  }),
  group_guest_accesses: many({
    sourceField: ['id'],
    destSchema: groupGuestAccess,
    destField: ['user_id'],
  }),
  invited_group_guest_accesses: many({
    sourceField: ['id'],
    destSchema: groupGuestAccess,
    destField: ['invited_by_id'],
  }),
  assigned_group_guest_roles: many({
    sourceField: ['id'],
    destSchema: groupGuestRole,
    destField: ['assigned_by_id'],
  }),
  owned_groups: many({ sourceField: ['id'], destSchema: group, destField: ['owner_id'] }),
  created_events: many({ sourceField: ['id'], destSchema: event, destField: ['creator_id'] }),
  event_participations: many({
    sourceField: ['id'],
    destSchema: eventParticipant,
    destField: ['user_id'],
  }),
  connected_group_offline_members: many({
    sourceField: ['id'],
    destSchema: groupOfflineMember,
    destField: ['connected_user_id'],
  }),
  created_group_offline_members: many({
    sourceField: ['id'],
    destSchema: groupOfflineMember,
    destField: ['created_by_id'],
  }),
  connected_event_offline_participants: many({
    sourceField: ['id'],
    destSchema: eventOfflineParticipant,
    destField: ['connected_user_id'],
  }),
  updated_vote_offline_tallies: many({
    sourceField: ['id'],
    destSchema: voteOfflineTally,
    destField: ['updated_by_id'],
  }),
  updated_election_offline_tallies: many({
    sourceField: ['id'],
    destSchema: electionOfflineTally,
    destField: ['updated_by_id'],
  }),
  event_delegates: many({ sourceField: ['id'], destSchema: eventDelegate, destField: ['user_id'] }),
  created_amendments: many({
    sourceField: ['id'],
    destSchema: amendment,
    destField: ['created_by_id'],
  }),
  amendment_collaborations: many({
    sourceField: ['id'],
    destSchema: amendmentCollaborator,
    destField: ['user_id'],
  }),
  amendment_support_votes: many({
    sourceField: ['id'],
    destSchema: amendmentSupportVote,
    destField: ['user_id'],
  }),
  change_requests: many({ sourceField: ['id'], destSchema: changeRequest, destField: ['user_id'] }),
  change_request_votes: many({
    sourceField: ['id'],
    destSchema: changeRequestVote,
    destField: ['user_id'],
  }),
  created_agenda_items: many({
    sourceField: ['id'],
    destSchema: agendaItem,
    destField: ['creator_id'],
  }),
  speaker_list_entries: many({
    sourceField: ['id'],
    destSchema: speakerList,
    destField: ['user_id'],
  }),
  election_candidacies: many({
    sourceField: ['id'],
    destSchema: electionCandidate,
    destField: ['user_id'],
  }),
  electors: many({ sourceField: ['id'], destSchema: elector, destField: ['user_id'] }),
  voters: many({ sourceField: ['id'], destSchema: voter, destField: ['user_id'] }),
  created_todos: many({ sourceField: ['id'], destSchema: todo, destField: ['creator_id'] }),
  todo_assignments: many({
    sourceField: ['id'],
    destSchema: todoAssignment,
    destField: ['user_id'],
  }),
  conversation_participations: many({
    sourceField: ['id'],
    destSchema: conversationParticipant,
    destField: ['user_id'],
  }),
  sent_messages: many({ sourceField: ['id'], destSchema: message, destField: ['sender_id'] }),
  notifications: many({
    sourceField: ['id'],
    destSchema: notification,
    destField: ['recipient_id'],
  }),
  sent_notifications: many({
    sourceField: ['id'],
    destSchema: notification,
    destField: ['sender_id'],
  }),
  push_subscriptions: many({
    sourceField: ['id'],
    destSchema: pushSubscription,
    destField: ['user_id'],
  }),
  notification_settings: many({
    sourceField: ['id'],
    destSchema: notificationSetting,
    destField: ['user_id'],
  }),
  blogger_relations: many({ sourceField: ['id'], destSchema: blogBlogger, destField: ['user_id'] }),
  blog_support_votes: many({
    sourceField: ['id'],
    destSchema: blogSupportVote,
    destField: ['user_id'],
  }),
  payments_made: many({ sourceField: ['id'], destSchema: payment, destField: ['payer_user_id'] }),
  payments_received: many({
    sourceField: ['id'],
    destSchema: payment,
    destField: ['receiver_user_id'],
  }),
  statements: many({ sourceField: ['id'], destSchema: statement, destField: ['user_id'] }),
  statement_support_votes: many({
    sourceField: ['id'],
    destSchema: statementSupportVote,
    destField: ['user_id'],
  }),
  statement_survey_votes: many({
    sourceField: ['id'],
    destSchema: statementSurveyVote,
    destField: ['user_id'],
  }),
  subscriptions: many({
    sourceField: ['id'],
    destSchema: subscriber,
    destField: ['subscriber_id'],
  }),
  subscribers: many({ sourceField: ['id'], destSchema: subscriber, destField: ['user_id'] }),
  user_hashtags: many({ sourceField: ['id'], destSchema: userHashtag, destField: ['user_id'] }),
  links: many({ sourceField: ['id'], destSchema: link, destField: ['user_id'] }),
  timeline_events: many({ sourceField: ['id'], destSchema: timelineEvent, destField: ['user_id'] }),
  performed_timeline_events: many({
    sourceField: ['id'],
    destSchema: timelineEvent,
    destField: ['actor_id'],
  }),
  reactions: many({ sourceField: ['id'], destSchema: reaction, destField: ['user_id'] }),
  position_holder_histories: many({
    sourceField: ['id'],
    destSchema: roleHolderHistory,
    destField: ['user_id'],
  }),
  event_role_holdings: many({
    sourceField: ['id'],
    destSchema: roleHolderHistory,
    destField: ['user_id'],
  }),
  document_versions: many({
    sourceField: ['id'],
    destSchema: documentVersion,
    destField: ['author_id'],
  }),
  document_collaborations: many({
    sourceField: ['id'],
    destSchema: documentCollaborator,
    destField: ['user_id'],
  }),
  document_cursors: many({
    sourceField: ['id'],
    destSchema: documentCursor,
    destField: ['user_id'],
  }),
  threads: many({ sourceField: ['id'], destSchema: thread, destField: ['user_id'] }),
  comments: many({ sourceField: ['id'], destSchema: comment, destField: ['user_id'] }),
  thread_votes: many({ sourceField: ['id'], destSchema: threadVote, destField: ['user_id'] }),
  comment_votes: many({ sourceField: ['id'], destSchema: commentVote, destField: ['user_id'] }),
  support_confirmations: many({
    sourceField: ['id'],
    destSchema: supportConfirmation,
    destField: ['confirmed_by_id'],
  }),
  requested_conversations: many({
    sourceField: ['id'],
    destSchema: conversation,
    destField: ['requested_by_id'],
  }),
  participants: many({ sourceField: ['id'], destSchema: participant, destField: ['user_id'] }),
  preferences: many({ sourceField: ['id'], destSchema: userPreference, destField: ['user_id'] }),
  ai_skills: many({ sourceField: ['id'], destSchema: aiSkill, destField: ['user_id'] }),
  ai_tools: many({ sourceField: ['id'], destSchema: aiTool, destField: ['user_id'] }),
  voting_passwords: many({
    sourceField: ['id'],
    destSchema: votingPassword,
    destField: ['user_id'],
  }),
  accreditations: many({ sourceField: ['id'], destSchema: accreditation, destField: ['user_id'] }),
}));

export const fileRelationships = relationships(file, () => ({}));

// ============================================
// User Preference relationships
// ============================================
export const userPreferenceRelationships = relationships(userPreference, ({ one }) => ({
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

export const aiSkillRelationships = relationships(aiSkill, ({ one }) => ({
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

export const aiToolRelationships = relationships(aiTool, ({ one }) => ({
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

// ============================================
// Follow relationships
// ============================================
export const followRelationships = relationships(follow, ({ one }) => ({
  follower: one({ sourceField: ['follower_id'], destSchema: user, destField: ['id'] }),
  followee: one({ sourceField: ['followee_id'], destSchema: user, destField: ['id'] }),
}));

// ============================================
// Group relationships
// ============================================
export const groupRelationships = relationships(group, ({ one, many }) => ({
  owner: one({ sourceField: ['owner_id'], destSchema: user, destField: ['id'] }),
  memberships: many({ sourceField: ['id'], destSchema: groupMembership, destField: ['group_id'] }),
  offline_members: many({
    sourceField: ['id'],
    destSchema: groupOfflineMember,
    destField: ['group_id'],
  }),
  offline_memberships: many({
    sourceField: ['id'],
    destSchema: groupOfflineMembership,
    destField: ['group_id'],
  }),
  guest_accesses: many({
    sourceField: ['id'],
    destSchema: groupGuestAccess,
    destField: ['group_id'],
  }),
  connections_as_group_a: many({
    sourceField: ['id'],
    destSchema: groupConnection,
    destField: ['group_a_id'],
  }),
  connections_as_group_b: many({
    sourceField: ['id'],
    destSchema: groupConnection,
    destField: ['group_b_id'],
  }),
  roles: many({ sourceField: ['id'], destSchema: role, destField: ['group_id'] }),
  events: many({ sourceField: ['id'], destSchema: event, destField: ['group_id'] }),
  amendments: many({ sourceField: ['id'], destSchema: amendment, destField: ['group_id'] }),
  amendment_group_decisions: many({
    sourceField: ['id'],
    destSchema: amendmentGroupDecision,
    destField: ['group_id'],
  }),
  todos: many({ sourceField: ['id'], destSchema: todo, destField: ['group_id'] }),
  blogs: many({ sourceField: ['id'], destSchema: blog, destField: ['group_id'] }),
  statements: many({ sourceField: ['id'], destSchema: statement, destField: ['group_id'] }),
  subscribers: many({ sourceField: ['id'], destSchema: subscriber, destField: ['group_id'] }),
  owned_workflows: many({
    sourceField: ['id'],
    destSchema: groupWorkflow,
    destField: ['group_id'],
  }),
  workflow_starts: many({
    sourceField: ['id'],
    destSchema: groupWorkflow,
    destField: ['start_group_id'],
  }),
  workflow_steps: many({
    sourceField: ['id'],
    destSchema: groupWorkflowStep,
    destField: ['group_id'],
  }),
  workflow_approvals: many({
    sourceField: ['id'],
    destSchema: groupWorkflowApproval,
    destField: ['group_id'],
  }),
  requested_workflow_approvals: many({
    sourceField: ['id'],
    destSchema: groupWorkflowApproval,
    destField: ['requested_by_group_id'],
  }),
  group_hashtags: many({ sourceField: ['id'], destSchema: groupHashtag, destField: ['group_id'] }),
  links: many({ sourceField: ['id'], destSchema: link, destField: ['group_id'] }),
  timeline_events: many({
    sourceField: ['id'],
    destSchema: timelineEvent,
    destField: ['group_id'],
  }),
  payments_made: many({ sourceField: ['id'], destSchema: payment, destField: ['payer_group_id'] }),
  payments_received: many({
    sourceField: ['id'],
    destSchema: payment,
    destField: ['receiver_group_id'],
  }),
  conversations: many({ sourceField: ['id'], destSchema: conversation, destField: ['group_id'] }),
}));

export const groupMembershipRelationships = relationships(groupMembership, ({ one, many }) => ({
  group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
  source_group: one({ sourceField: ['source_group_id'], destSchema: group, destField: ['id'] }),
  membership_roles: many({
    sourceField: ['id'],
    destSchema: groupMembershipRole,
    destField: ['group_membership_id'],
  }),
}));

export const groupOfflineMemberRelationships = relationships(
  groupOfflineMember,
  ({ one, many }) => ({
    group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
    connected_user: one({
      sourceField: ['connected_user_id'],
      destSchema: user,
      destField: ['id'],
    }),
    created_by: one({ sourceField: ['created_by_id'], destSchema: user, destField: ['id'] }),
    event_offline_participants: many({
      sourceField: ['id'],
      destSchema: eventOfflineParticipant,
      destField: ['group_offline_member_id'],
    }),
    offline_memberships: many({
      sourceField: ['id'],
      destSchema: groupOfflineMembership,
      destField: ['group_offline_member_id'],
    }),
  })
);

export const groupMembershipRoleRelationships = relationships(groupMembershipRole, ({ one }) => ({
  group_membership: one({
    sourceField: ['group_membership_id'],
    destSchema: groupMembership,
    destField: ['id'],
  }),
  role: one({ sourceField: ['role_id'], destSchema: role, destField: ['id'] }),
  assigned_by: one({ sourceField: ['assigned_by_id'], destSchema: user, destField: ['id'] }),
}));

export const groupOfflineMembershipRelationships = relationships(
  groupOfflineMembership,
  ({ one, many }) => ({
    group_offline_member: one({
      sourceField: ['group_offline_member_id'],
      destSchema: groupOfflineMember,
      destField: ['id'],
    }),
    group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
    source_group: one({ sourceField: ['source_group_id'], destSchema: group, destField: ['id'] }),
    membership_roles: many({
      sourceField: ['id'],
      destSchema: groupOfflineMembershipRole,
      destField: ['group_offline_membership_id'],
    }),
  })
);

export const groupOfflineMembershipRoleRelationships = relationships(
  groupOfflineMembershipRole,
  ({ one }) => ({
    group_offline_membership: one({
      sourceField: ['group_offline_membership_id'],
      destSchema: groupOfflineMembership,
      destField: ['id'],
    }),
    role: one({ sourceField: ['role_id'], destSchema: role, destField: ['id'] }),
    assigned_by: one({ sourceField: ['assigned_by_id'], destSchema: user, destField: ['id'] }),
  })
);

export const groupGuestAccessRelationships = relationships(groupGuestAccess, ({ one, many }) => ({
  group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
  invited_by: one({ sourceField: ['invited_by_id'], destSchema: user, destField: ['id'] }),
  guest_roles: many({
    sourceField: ['id'],
    destSchema: groupGuestRole,
    destField: ['group_guest_access_id'],
  }),
}));

export const groupGuestRoleRelationships = relationships(groupGuestRole, ({ one }) => ({
  group_guest_access: one({
    sourceField: ['group_guest_access_id'],
    destSchema: groupGuestAccess,
    destField: ['id'],
  }),
  role: one({ sourceField: ['role_id'], destSchema: role, destField: ['id'] }),
  assigned_by: one({ sourceField: ['assigned_by_id'], destSchema: user, destField: ['id'] }),
}));

export const groupConnectionRelationships = relationships(groupConnection, ({ one, many }) => ({
  group_a: one({ sourceField: ['group_a_id'], destSchema: group, destField: ['id'] }),
  group_b: one({ sourceField: ['group_b_id'], destSchema: group, destField: ['id'] }),
  parent_group: one({ sourceField: ['parent_group_id'], destSchema: group, destField: ['id'] }),
  child_group: one({ sourceField: ['child_group_id'], destSchema: group, destField: ['id'] }),
  created_by: one({ sourceField: ['created_by_id'], destSchema: user, destField: ['id'] }),
  grants: many({
    sourceField: ['id'],
    destSchema: groupRightGrant,
    destField: ['connection_id'],
  }),
  membership_rule: one({
    sourceField: ['id'],
    destSchema: groupMembershipRule,
    destField: ['connection_id'],
  }),
  change_requests: many({
    sourceField: ['id'],
    destSchema: groupConnectionRequest,
    destField: ['active_connection_id'],
  }),
}));

export const groupRightGrantRelationships = relationships(groupRightGrant, ({ one }) => ({
  connection: one({
    sourceField: ['connection_id'],
    destSchema: groupConnection,
    destField: ['id'],
  }),
  holder_group: one({ sourceField: ['holder_group_id'], destSchema: group, destField: ['id'] }),
  scope_group: one({ sourceField: ['scope_group_id'], destSchema: group, destField: ['id'] }),
  initiator_group: one({
    sourceField: ['initiator_group_id'],
    destSchema: group,
    destField: ['id'],
  }),
}));

export const groupMembershipRuleRelationships = relationships(
  groupMembershipRule,
  ({ one, many }) => ({
    connection: one({
      sourceField: ['connection_id'],
      destSchema: groupConnection,
      destField: ['id'],
    }),
    member_source_group: one({
      sourceField: ['member_source_group_id'],
      destSchema: group,
      destField: ['id'],
    }),
    member_target_group: one({
      sourceField: ['member_target_group_id'],
      destSchema: group,
      destField: ['id'],
    }),
    required_source_role: one({
      sourceField: ['required_source_role_id'],
      destSchema: role,
      destField: ['id'],
    }),
    origins: many({
      sourceField: ['id'],
      destSchema: groupMembershipRuleOrigin,
      destField: ['membership_rule_id'],
    }),
  })
);

export const groupMembershipRuleOriginRelationships = relationships(
  groupMembershipRuleOrigin,
  ({ one }) => ({
    membership_rule: one({
      sourceField: ['membership_rule_id'],
      destSchema: groupMembershipRule,
      destField: ['id'],
    }),
    eligible_origin_group: one({
      sourceField: ['eligible_origin_group_id'],
      destSchema: group,
      destField: ['id'],
    }),
  })
);

export const groupConnectionRequestRelationships = relationships(
  groupConnectionRequest,
  ({ one, many }) => ({
    active_connection: one({
      sourceField: ['active_connection_id'],
      destSchema: groupConnection,
      destField: ['id'],
    }),
    group_a: one({
      sourceField: ['group_a_id'],
      destSchema: group,
      destField: ['id'],
    }),
    group_b: one({
      sourceField: ['group_b_id'],
      destSchema: group,
      destField: ['id'],
    }),
    initiator_group: one({
      sourceField: ['initiator_group_id'],
      destSchema: group,
      destField: ['id'],
    }),
    grant_requests: many({
      sourceField: ['id'],
      destSchema: groupRightGrantRequest,
      destField: ['connection_request_id'],
    }),
    membership_rule_requests: many({
      sourceField: ['id'],
      destSchema: groupMembershipRuleRequest,
      destField: ['connection_request_id'],
    }),
  })
);

export const groupRightGrantRequestRelationships = relationships(
  groupRightGrantRequest,
  ({ one }) => ({
    connection_request: one({
      sourceField: ['connection_request_id'],
      destSchema: groupConnectionRequest,
      destField: ['id'],
    }),
    holder_group: one({ sourceField: ['holder_group_id'], destSchema: group, destField: ['id'] }),
    scope_group: one({ sourceField: ['scope_group_id'], destSchema: group, destField: ['id'] }),
    initiator_group: one({
      sourceField: ['initiator_group_id'],
      destSchema: group,
      destField: ['id'],
    }),
  })
);

export const groupMembershipRuleRequestRelationships = relationships(
  groupMembershipRuleRequest,
  ({ one, many }) => ({
    connection_request: one({
      sourceField: ['connection_request_id'],
      destSchema: groupConnectionRequest,
      destField: ['id'],
    }),
    required_source_role: one({
      sourceField: ['required_source_role_id'],
      destSchema: role,
      destField: ['id'],
    }),
    origins: many({
      sourceField: ['id'],
      destSchema: groupMembershipRuleRequestOrigin,
      destField: ['membership_rule_request_id'],
    }),
  })
);

export const groupMembershipRuleRequestOriginRelationships = relationships(
  groupMembershipRuleRequestOrigin,
  ({ one }) => ({
    membership_rule_request: one({
      sourceField: ['membership_rule_request_id'],
      destSchema: groupMembershipRuleRequest,
      destField: ['id'],
    }),
    eligible_origin_group: one({
      sourceField: ['eligible_origin_group_id'],
      destSchema: group,
      destField: ['id'],
    }),
  })
);

export const roleRelationships = relationships(role, helpers => ({
  group: helpers.one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
  event: helpers.one({ sourceField: ['event_id'], destSchema: event, destField: ['id'] }),
  amendment: helpers.one({
    sourceField: ['amendment_id'],
    destSchema: amendment,
    destField: ['id'],
  }),
  blog: helpers.one({ sourceField: ['blog_id'], destSchema: blog, destField: ['id'] }),
  group_membership_roles: helpers.many({
    sourceField: ['id'],
    destSchema: groupMembershipRole,
    destField: ['role_id'],
  }),
  group_offline_membership_roles: helpers.many({
    sourceField: ['id'],
    destSchema: groupOfflineMembershipRole,
    destField: ['role_id'],
  }),
  group_guest_roles: helpers.many({
    sourceField: ['id'],
    destSchema: groupGuestRole,
    destField: ['role_id'],
  }),
  event_participant_roles: helpers.many({
    sourceField: ['id'],
    destSchema: eventParticipantRole,
    destField: ['role_id'],
  }),
  action_rights: helpers.many({
    sourceField: ['id'],
    destSchema: actionRight,
    destField: ['role_id'],
  }),
  holder_history: helpers.many({
    sourceField: ['id'],
    destSchema: roleHolderHistory,
    destField: ['role_id'],
  }),
  holders: helpers.many({
    sourceField: ['id'],
    destSchema: roleHolderHistory,
    destField: ['role_id'],
  }),
  elections: helpers.many({ sourceField: ['id'], destSchema: election, destField: ['role_id'] }),
}));

export const actionRightRelationships = relationships(actionRight, ({ one }) => ({
  role: one({ sourceField: ['role_id'], destSchema: role, destField: ['id'] }),
}));

export const roleHolderHistoryRelationships = relationships(roleHolderHistory, ({ one }) => ({
  role: one({ sourceField: ['role_id'], destSchema: role, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

// ============================================
// Event relationships
// ============================================
export const eventRelationships = relationships(event, ({ one, many }) => ({
  group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
  creator: one({ sourceField: ['creator_id'], destSchema: user, destField: ['id'] }),
  participants: many({
    sourceField: ['id'],
    destSchema: eventParticipant,
    destField: ['event_id'],
  }),
  offline_participants: many({
    sourceField: ['id'],
    destSchema: eventOfflineParticipant,
    destField: ['event_id'],
  }),
  delegates: many({ sourceField: ['id'], destSchema: eventDelegate, destField: ['event_id'] }),
  delegate_allocations: many({
    sourceField: ['id'],
    destSchema: groupDelegateAllocation,
    destField: ['event_id'],
  }),
  links: many({ sourceField: ['id'], destSchema: link, destField: ['event_id'] }),
  event_participants: many({
    sourceField: ['id'],
    destSchema: participant,
    destField: ['event_id'],
  }),
  roles: many({
    sourceField: ['id'],
    destSchema: role,
    destField: ['event_id'],
  }),
  agenda_items: many({ sourceField: ['id'], destSchema: agendaItem, destField: ['event_id'] }),
  todos: many({ sourceField: ['id'], destSchema: todo, destField: ['event_id'] }),
  subscribers: many({ sourceField: ['id'], destSchema: subscriber, destField: ['event_id'] }),
  event_hashtags: many({ sourceField: ['id'], destSchema: eventHashtag, destField: ['event_id'] }),
  timeline_events: many({
    sourceField: ['id'],
    destSchema: timelineEvent,
    destField: ['event_id'],
  }),
  exceptions: many({
    sourceField: ['id'],
    destSchema: eventException,
    destField: ['parent_event_id'],
  }),
  conversations: many({ sourceField: ['id'], destSchema: conversation, destField: ['event_id'] }),
  accreditations: many({ sourceField: ['id'], destSchema: accreditation, destField: ['event_id'] }),
}));

export const eventParticipantRelationships = relationships(eventParticipant, ({ one, many }) => ({
  event: one({ sourceField: ['event_id'], destSchema: event, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
  participant_roles: many({
    sourceField: ['id'],
    destSchema: eventParticipantRole,
    destField: ['event_participant_id'],
  }),
}));

export const eventOfflineParticipantRelationships = relationships(
  eventOfflineParticipant,
  ({ one }) => ({
    event: one({ sourceField: ['event_id'], destSchema: event, destField: ['id'] }),
    group_offline_member: one({
      sourceField: ['group_offline_member_id'],
      destSchema: groupOfflineMember,
      destField: ['id'],
    }),
    connected_user: one({
      sourceField: ['connected_user_id'],
      destSchema: user,
      destField: ['id'],
    }),
  })
);

export const eventParticipantRoleRelationships = relationships(eventParticipantRole, ({ one }) => ({
  event_participant: one({
    sourceField: ['event_participant_id'],
    destSchema: eventParticipant,
    destField: ['id'],
  }),
  role: one({ sourceField: ['role_id'], destSchema: role, destField: ['id'] }),
  assigned_by: one({ sourceField: ['assigned_by_id'], destSchema: user, destField: ['id'] }),
}));

export const eventDelegateRelationships = relationships(eventDelegate, ({ one }) => ({
  event: one({ sourceField: ['event_id'], destSchema: event, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
  group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
}));

export const groupDelegateAllocationRelationships = relationships(
  groupDelegateAllocation,
  ({ one }) => ({
    event: one({ sourceField: ['event_id'], destSchema: event, destField: ['id'] }),
    group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
  })
);

export const participantRelationships = relationships(participant, ({ one }) => ({
  event: one({ sourceField: ['event_id'], destSchema: event, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

export const eventExceptionRelationships = relationships(eventException, ({ one }) => ({
  parent_event: one({ sourceField: ['parent_event_id'], destSchema: event, destField: ['id'] }),
}));

export const calendarSubscriptionRelationships = relationships(calendarSubscription, ({ one }) => ({
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
  target_group: one({ sourceField: ['target_group_id'], destSchema: group, destField: ['id'] }),
  target_user: one({ sourceField: ['target_user_id'], destSchema: user, destField: ['id'] }),
}));

// ============================================
// Amendment relationships
// ============================================
export const amendmentRelationships = relationships(amendment, ({ one, many }) => ({
  created_by: one({ sourceField: ['created_by_id'], destSchema: user, destField: ['id'] }),
  group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
  event: one({ sourceField: ['event_id'], destSchema: event, destField: ['id'] }),
  clone_source: one({ sourceField: ['clone_source_id'], destSchema: amendment, destField: ['id'] }),
  origin_amendment: one({
    sourceField: ['origin_amendment_id'],
    destSchema: amendment,
    destField: ['id'],
  }),
  document: one({ sourceField: ['document_id'], destSchema: document, destField: ['id'] }),
  current_process_run: one({
    sourceField: ['current_process_run_id'],
    destSchema: amendmentProcessRun,
    destField: ['id'],
  }),
  vote_entries: many({ sourceField: ['id'], destSchema: vote, destField: ['amendment_id'] }),
  support_votes: many({
    sourceField: ['id'],
    destSchema: amendmentSupportVote,
    destField: ['amendment_id'],
  }),
  change_requests: many({
    sourceField: ['id'],
    destSchema: changeRequest,
    destField: ['amendment_id'],
  }),
  collaborators: many({
    sourceField: ['id'],
    destSchema: amendmentCollaborator,
    destField: ['amendment_id'],
  }),
  paths: many({ sourceField: ['id'], destSchema: amendmentPath, destField: ['amendment_id'] }),
  process_runs: many({
    sourceField: ['id'],
    destSchema: amendmentProcessRun,
    destField: ['amendment_id'],
  }),
  support_confirmations: many({
    sourceField: ['id'],
    destSchema: supportConfirmation,
    destField: ['amendment_id'],
  }),
  group_decisions: many({
    sourceField: ['id'],
    destSchema: amendmentGroupDecision,
    destField: ['amendment_id'],
  }),
  documents: many({ sourceField: ['id'], destSchema: document, destField: ['amendment_id'] }),
  agenda_items: many({ sourceField: ['id'], destSchema: agendaItem, destField: ['amendment_id'] }),
  todos: many({ sourceField: ['id'], destSchema: todo, destField: ['amendment_id'] }),
  subscribers: many({ sourceField: ['id'], destSchema: subscriber, destField: ['amendment_id'] }),
  amendment_hashtags: many({
    sourceField: ['id'],
    destSchema: amendmentHashtag,
    destField: ['amendment_id'],
  }),
  timeline_events: many({
    sourceField: ['id'],
    destSchema: timelineEvent,
    destField: ['amendment_id'],
  }),
  threads: many({ sourceField: ['id'], destSchema: thread, destField: ['amendment_id'] }),
}));

export const amendmentSupportVoteRelationships = relationships(amendmentSupportVote, ({ one }) => ({
  amendment: one({ sourceField: ['amendment_id'], destSchema: amendment, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

export const changeRequestRelationships = relationships(changeRequest, ({ one, many }) => ({
  amendment: one({ sourceField: ['amendment_id'], destSchema: amendment, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
  votes: many({
    sourceField: ['id'],
    destSchema: changeRequestVote,
    destField: ['change_request_id'],
  }),
  agenda_item_links: many({
    sourceField: ['id'],
    destSchema: agendaItemChangeRequest,
    destField: ['change_request_id'],
  }),
}));

export const changeRequestVoteRelationships = relationships(changeRequestVote, ({ one }) => ({
  change_request: one({
    sourceField: ['change_request_id'],
    destSchema: changeRequest,
    destField: ['id'],
  }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

export const amendmentCollaboratorRelationships = relationships(
  amendmentCollaborator,
  ({ one }) => ({
    amendment: one({ sourceField: ['amendment_id'], destSchema: amendment, destField: ['id'] }),
    user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
    role: one({ sourceField: ['role_id'], destSchema: role, destField: ['id'] }),
  })
);

export const amendmentPathRelationships = relationships(amendmentPath, ({ one, many }) => ({
  amendment: one({ sourceField: ['amendment_id'], destSchema: amendment, destField: ['id'] }),
  process_run: one({
    sourceField: ['process_run_id'],
    destSchema: amendmentProcessRun,
    destField: ['id'],
  }),
  segments: many({ sourceField: ['id'], destSchema: amendmentPathSegment, destField: ['path_id'] }),
}));

export const amendmentPathSegmentRelationships = relationships(amendmentPathSegment, ({ one }) => ({
  path: one({ sourceField: ['path_id'], destSchema: amendmentPath, destField: ['id'] }),
  process_branch: one({
    sourceField: ['process_branch_id'],
    destSchema: amendmentProcessBranch,
    destField: ['id'],
  }),
  process_step_run: one({
    sourceField: ['process_step_run_id'],
    destSchema: amendmentProcessStepRun,
    destField: ['id'],
  }),
  group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
  event: one({ sourceField: ['event_id'], destSchema: event, destField: ['id'] }),
}));

export const supportConfirmationRelationships = relationships(supportConfirmation, ({ one }) => ({
  amendment: one({ sourceField: ['amendment_id'], destSchema: amendment, destField: ['id'] }),
  process_run: one({
    sourceField: ['process_run_id'],
    destSchema: amendmentProcessRun,
    destField: ['id'],
  }),
  process_step_run: one({
    sourceField: ['process_step_run_id'],
    destSchema: amendmentProcessStepRun,
    destField: ['id'],
  }),
  process_task: one({
    sourceField: ['process_task_id'],
    destSchema: processTask,
    destField: ['id'],
  }),
  group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
  event: one({ sourceField: ['event_id'], destSchema: event, destField: ['id'] }),
  confirmed_by: one({ sourceField: ['confirmed_by_id'], destSchema: user, destField: ['id'] }),
}));

export const amendmentGroupDecisionRelationships = relationships(
  amendmentGroupDecision,
  ({ one }) => ({
    amendment: one({ sourceField: ['amendment_id'], destSchema: amendment, destField: ['id'] }),
    group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
    process_run: one({
      sourceField: ['process_run_id'],
      destSchema: amendmentProcessRun,
      destField: ['id'],
    }),
    process_branch: one({
      sourceField: ['process_branch_id'],
      destSchema: amendmentProcessBranch,
      destField: ['id'],
    }),
    process_step_run: one({
      sourceField: ['process_step_run_id'],
      destSchema: amendmentProcessStepRun,
      destField: ['id'],
    }),
  })
);

export const amendmentProcessRunRelationships = relationships(
  amendmentProcessRun,
  ({ one, many }) => ({
    amendment: one({ sourceField: ['amendment_id'], destSchema: amendment, destField: ['id'] }),
    root_workflow: one({
      sourceField: ['root_workflow_id'],
      destSchema: groupWorkflow,
      destField: ['id'],
    }),
    selected_source_group: one({
      sourceField: ['selected_source_group_id'],
      destSchema: group,
      destField: ['id'],
    }),
    selected_target_group: one({
      sourceField: ['selected_target_group_id'],
      destSchema: group,
      destField: ['id'],
    }),
    selected_target_workflow: one({
      sourceField: ['selected_target_workflow_id'],
      destSchema: groupWorkflow,
      destField: ['id'],
    }),
    active_branch: one({
      sourceField: ['active_branch_id'],
      destSchema: amendmentProcessBranch,
      destField: ['id'],
    }),
    terminal_step_run: one({
      sourceField: ['terminal_step_run_id'],
      destSchema: amendmentProcessStepRun,
      destField: ['id'],
    }),
    created_by: one({ sourceField: ['created_by_id'], destSchema: user, destField: ['id'] }),
    branches: many({
      sourceField: ['id'],
      destSchema: amendmentProcessBranch,
      destField: ['process_run_id'],
    }),
    step_runs: many({
      sourceField: ['id'],
      destSchema: amendmentProcessStepRun,
      destField: ['process_run_id'],
    }),
    tasks: many({
      sourceField: ['id'],
      destSchema: processTask,
      destField: ['process_run_id'],
    }),
    group_decisions: many({
      sourceField: ['id'],
      destSchema: amendmentGroupDecision,
      destField: ['process_run_id'],
    }),
    compatibility_paths: many({
      sourceField: ['id'],
      destSchema: amendmentPath,
      destField: ['process_run_id'],
    }),
  })
);

export const amendmentProcessBranchRelationships = relationships(
  amendmentProcessBranch,
  ({ one, many }) => ({
    process_run: one({
      sourceField: ['process_run_id'],
      destSchema: amendmentProcessRun,
      destField: ['id'],
    }),
    parent_branch: one({
      sourceField: ['parent_branch_id'],
      destSchema: amendmentProcessBranch,
      destField: ['id'],
    }),
    merged_into_branch: one({
      sourceField: ['merged_into_branch_id'],
      destSchema: amendmentProcessBranch,
      destField: ['id'],
    }),
    source_step_run: one({
      sourceField: ['source_step_run_id'],
      destSchema: amendmentProcessStepRun,
      destField: ['id'],
    }),
    document_version: one({
      sourceField: ['document_version_id'],
      destSchema: documentVersion,
      destField: ['id'],
    }),
    child_branches: many({
      sourceField: ['id'],
      destSchema: amendmentProcessBranch,
      destField: ['parent_branch_id'],
    }),
    merged_branches: many({
      sourceField: ['id'],
      destSchema: amendmentProcessBranch,
      destField: ['merged_into_branch_id'],
    }),
    step_runs: many({
      sourceField: ['id'],
      destSchema: amendmentProcessStepRun,
      destField: ['branch_id'],
    }),
    tasks: many({
      sourceField: ['id'],
      destSchema: processTask,
      destField: ['branch_id'],
    }),
    group_decisions: many({
      sourceField: ['id'],
      destSchema: amendmentGroupDecision,
      destField: ['process_branch_id'],
    }),
    compatibility_segments: many({
      sourceField: ['id'],
      destSchema: amendmentPathSegment,
      destField: ['process_branch_id'],
    }),
  })
);

export const amendmentProcessStepRunRelationships = relationships(
  amendmentProcessStepRun,
  ({ one, many }) => ({
    process_run: one({
      sourceField: ['process_run_id'],
      destSchema: amendmentProcessRun,
      destField: ['id'],
    }),
    branch: one({
      sourceField: ['branch_id'],
      destSchema: amendmentProcessBranch,
      destField: ['id'],
    }),
    workflow: one({ sourceField: ['workflow_id'], destSchema: groupWorkflow, destField: ['id'] }),
    workflow_step: one({
      sourceField: ['workflow_step_id'],
      destSchema: groupWorkflowStep,
      destField: ['id'],
    }),
    source_group: one({ sourceField: ['source_group_id'], destSchema: group, destField: ['id'] }),
    target_group: one({ sourceField: ['target_group_id'], destSchema: group, destField: ['id'] }),
    event: one({ sourceField: ['event_id'], destSchema: event, destField: ['id'] }),
    agenda_item: one({
      sourceField: ['agenda_item_id'],
      destSchema: agendaItem,
      destField: ['id'],
    }),
    vote: one({ sourceField: ['vote_id'], destSchema: vote, destField: ['id'] }),
    support_confirmation: one({
      sourceField: ['support_confirmation_id'],
      destSchema: supportConfirmation,
      destField: ['id'],
    }),
    generated_branches: many({
      sourceField: ['id'],
      destSchema: amendmentProcessBranch,
      destField: ['source_step_run_id'],
    }),
    tasks: many({
      sourceField: ['id'],
      destSchema: processTask,
      destField: ['step_run_id'],
    }),
    group_decisions: many({
      sourceField: ['id'],
      destSchema: amendmentGroupDecision,
      destField: ['process_step_run_id'],
    }),
    compatibility_segments: many({
      sourceField: ['id'],
      destSchema: amendmentPathSegment,
      destField: ['process_step_run_id'],
    }),
  })
);

export const processTaskRelationships = relationships(processTask, ({ one }) => ({
  process_run: one({
    sourceField: ['process_run_id'],
    destSchema: amendmentProcessRun,
    destField: ['id'],
  }),
  branch: one({
    sourceField: ['branch_id'],
    destSchema: amendmentProcessBranch,
    destField: ['id'],
  }),
  step_run: one({
    sourceField: ['step_run_id'],
    destSchema: amendmentProcessStepRun,
    destField: ['id'],
  }),
  group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
  target_group: one({
    sourceField: ['target_group_id'],
    destSchema: group,
    destField: ['id'],
  }),
  event: one({ sourceField: ['event_id'], destSchema: event, destField: ['id'] }),
  agenda_item: one({
    sourceField: ['agenda_item_id'],
    destSchema: agendaItem,
    destField: ['id'],
  }),
  support_confirmation: one({
    sourceField: ['support_confirmation_id'],
    destSchema: supportConfirmation,
    destField: ['id'],
  }),
}));

// ============================================
// Document relationships
// ============================================
export const documentRelationships = relationships(document, ({ one, many }) => ({
  amendment: one({ sourceField: ['amendment_id'], destSchema: amendment, destField: ['id'] }),
  versions: many({ sourceField: ['id'], destSchema: documentVersion, destField: ['document_id'] }),
  collaborators: many({
    sourceField: ['id'],
    destSchema: documentCollaborator,
    destField: ['document_id'],
  }),
  cursors: many({ sourceField: ['id'], destSchema: documentCursor, destField: ['document_id'] }),
  threads: many({ sourceField: ['id'], destSchema: thread, destField: ['document_id'] }),
}));

export const documentVersionRelationships = relationships(documentVersion, ({ one }) => ({
  document: one({ sourceField: ['document_id'], destSchema: document, destField: ['id'] }),
  amendment: one({ sourceField: ['amendment_id'], destSchema: amendment, destField: ['id'] }),
  blog: one({ sourceField: ['blog_id'], destSchema: blog, destField: ['id'] }),
  author: one({ sourceField: ['author_id'], destSchema: user, destField: ['id'] }),
}));

export const documentCollaboratorRelationships = relationships(documentCollaborator, ({ one }) => ({
  document: one({ sourceField: ['document_id'], destSchema: document, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

export const documentCursorRelationships = relationships(documentCursor, ({ one }) => ({
  document: one({ sourceField: ['document_id'], destSchema: document, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

export const threadRelationships = relationships(thread, ({ one, many }) => ({
  document: one({ sourceField: ['document_id'], destSchema: document, destField: ['id'] }),
  amendment: one({ sourceField: ['amendment_id'], destSchema: amendment, destField: ['id'] }),
  statement: one({ sourceField: ['statement_id'], destSchema: statement, destField: ['id'] }),
  blog: one({ sourceField: ['blog_id'], destSchema: blog, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
  comments: many({ sourceField: ['id'], destSchema: comment, destField: ['thread_id'] }),
  votes: many({ sourceField: ['id'], destSchema: threadVote, destField: ['thread_id'] }),
}));

export const commentRelationships = relationships(comment, ({ one, many }) => ({
  thread: one({ sourceField: ['thread_id'], destSchema: thread, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
  parent: one({ sourceField: ['parent_id'], destSchema: comment, destField: ['id'] }),
  replies: many({ sourceField: ['id'], destSchema: comment, destField: ['parent_id'] }),
  votes: many({ sourceField: ['id'], destSchema: commentVote, destField: ['comment_id'] }),
}));

export const threadVoteRelationships = relationships(threadVote, ({ one }) => ({
  thread: one({ sourceField: ['thread_id'], destSchema: thread, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

export const commentVoteRelationships = relationships(commentVote, ({ one }) => ({
  comment: one({ sourceField: ['comment_id'], destSchema: comment, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

// ============================================
// Agenda relationships
// ============================================
export const agendaItemRelationships = relationships(agendaItem, ({ one, many }) => ({
  event: one({ sourceField: ['event_id'], destSchema: event, destField: ['id'] }),
  amendment: one({ sourceField: ['amendment_id'], destSchema: amendment, destField: ['id'] }),
  creator: one({ sourceField: ['creator_id'], destSchema: user, destField: ['id'] }),
  speaker_list: many({
    sourceField: ['id'],
    destSchema: speakerList,
    destField: ['agenda_item_id'],
  }),
  election: many({ sourceField: ['id'], destSchema: election, destField: ['agenda_item_id'] }),
  votes: many({ sourceField: ['id'], destSchema: vote, destField: ['agenda_item_id'] }),
  accreditations: many({
    sourceField: ['id'],
    destSchema: accreditation,
    destField: ['agenda_item_id'],
  }),
  change_request_timeline: many({
    sourceField: ['id'],
    destSchema: agendaItemChangeRequest,
    destField: ['agenda_item_id'],
  }),
}));

export const speakerListRelationships = relationships(speakerList, ({ one }) => ({
  agenda_item: one({ sourceField: ['agenda_item_id'], destSchema: agendaItem, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

export const agendaItemChangeRequestRelationships = relationships(
  agendaItemChangeRequest,
  ({ one }) => ({
    agenda_item: one({
      sourceField: ['agenda_item_id'],
      destSchema: agendaItem,
      destField: ['id'],
    }),
    change_request: one({
      sourceField: ['change_request_id'],
      destSchema: changeRequest,
      destField: ['id'],
    }),
    vote: one({ sourceField: ['vote_id'], destSchema: vote, destField: ['id'] }),
  })
);

export const electionRelationships = relationships(election, ({ one, many }) => ({
  agenda_item: one({ sourceField: ['agenda_item_id'], destSchema: agendaItem, destField: ['id'] }),
  role: one({ sourceField: ['role_id'], destSchema: role, destField: ['id'] }),
  candidates: many({
    sourceField: ['id'],
    destSchema: electionCandidate,
    destField: ['election_id'],
  }),
  electors: many({ sourceField: ['id'], destSchema: elector, destField: ['election_id'] }),
  offline_tallies: many({
    sourceField: ['id'],
    destSchema: electionOfflineTally,
    destField: ['election_id'],
  }),
  indicative_participations: many({
    sourceField: ['id'],
    destSchema: indicativeElectorParticipation,
    destField: ['election_id'],
  }),
  indicative_selections: many({
    sourceField: ['id'],
    destSchema: indicativeCandidateSelection,
    destField: ['election_id'],
  }),
  final_participations: many({
    sourceField: ['id'],
    destSchema: finalElectorParticipation,
    destField: ['election_id'],
  }),
  final_selections: many({
    sourceField: ['id'],
    destSchema: finalCandidateSelection,
    destField: ['election_id'],
  }),
  timeline_events: many({
    sourceField: ['id'],
    destSchema: timelineEvent,
    destField: ['election_id'],
  }),
}));

export const electionCandidateRelationships = relationships(electionCandidate, ({ one, many }) => ({
  election: one({ sourceField: ['election_id'], destSchema: election, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
  indicative_selections: many({
    sourceField: ['id'],
    destSchema: indicativeCandidateSelection,
    destField: ['candidate_id'],
  }),
  final_selections: many({
    sourceField: ['id'],
    destSchema: finalCandidateSelection,
    destField: ['candidate_id'],
  }),
}));

export const electorRelationships = relationships(elector, ({ one }) => ({
  election: one({ sourceField: ['election_id'], destSchema: election, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

export const indicativeElectorParticipationRelationships = relationships(
  indicativeElectorParticipation,
  ({ one, many }) => ({
    election: one({ sourceField: ['election_id'], destSchema: election, destField: ['id'] }),
    elector: one({ sourceField: ['elector_id'], destSchema: elector, destField: ['id'] }),
    selections: many({
      sourceField: ['id'],
      destSchema: indicativeCandidateSelection,
      destField: ['elector_participation_id'],
    }),
  })
);

export const indicativeCandidateSelectionRelationships = relationships(
  indicativeCandidateSelection,
  ({ one }) => ({
    election: one({ sourceField: ['election_id'], destSchema: election, destField: ['id'] }),
    candidate: one({
      sourceField: ['candidate_id'],
      destSchema: electionCandidate,
      destField: ['id'],
    }),
    participation: one({
      sourceField: ['elector_participation_id'],
      destSchema: indicativeElectorParticipation,
      destField: ['id'],
    }),
  })
);

export const finalElectorParticipationRelationships = relationships(
  finalElectorParticipation,
  ({ one, many }) => ({
    election: one({ sourceField: ['election_id'], destSchema: election, destField: ['id'] }),
    elector: one({ sourceField: ['elector_id'], destSchema: elector, destField: ['id'] }),
    selections: many({
      sourceField: ['id'],
      destSchema: finalCandidateSelection,
      destField: ['elector_participation_id'],
    }),
  })
);

export const finalCandidateSelectionRelationships = relationships(
  finalCandidateSelection,
  ({ one }) => ({
    election: one({ sourceField: ['election_id'], destSchema: election, destField: ['id'] }),
    candidate: one({
      sourceField: ['candidate_id'],
      destSchema: electionCandidate,
      destField: ['id'],
    }),
    participation: one({
      sourceField: ['elector_participation_id'],
      destSchema: finalElectorParticipation,
      destField: ['id'],
    }),
  })
);

export const electionOfflineTallyRelationships = relationships(electionOfflineTally, ({ one }) => ({
  election: one({ sourceField: ['election_id'], destSchema: election, destField: ['id'] }),
  candidate: one({
    sourceField: ['candidate_id'],
    destSchema: electionCandidate,
    destField: ['id'],
  }),
  updated_by: one({ sourceField: ['updated_by_id'], destSchema: user, destField: ['id'] }),
}));

// ============================================
// Todo relationships
// ============================================
export const todoRelationships = relationships(todo, ({ one, many }) => ({
  creator: one({ sourceField: ['creator_id'], destSchema: user, destField: ['id'] }),
  group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
  event: one({ sourceField: ['event_id'], destSchema: event, destField: ['id'] }),
  amendment: one({ sourceField: ['amendment_id'], destSchema: amendment, destField: ['id'] }),
  assignments: many({ sourceField: ['id'], destSchema: todoAssignment, destField: ['todo_id'] }),
  timeline_events: many({ sourceField: ['id'], destSchema: timelineEvent, destField: ['todo_id'] }),
}));

export const todoAssignmentRelationships = relationships(todoAssignment, ({ one }) => ({
  todo: one({ sourceField: ['todo_id'], destSchema: todo, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

// ============================================
// Message relationships
// ============================================
export const conversationRelationships = relationships(conversation, ({ one, many }) => ({
  group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
  event: one({ sourceField: ['event_id'], destSchema: event, destField: ['id'] }),
  requested_by: one({ sourceField: ['requested_by_id'], destSchema: user, destField: ['id'] }),
  participants: many({
    sourceField: ['id'],
    destSchema: conversationParticipant,
    destField: ['conversation_id'],
  }),
  messages: many({ sourceField: ['id'], destSchema: message, destField: ['conversation_id'] }),
}));

export const conversationParticipantRelationships = relationships(
  conversationParticipant,
  ({ one }) => ({
    conversation: one({
      sourceField: ['conversation_id'],
      destSchema: conversation,
      destField: ['id'],
    }),
    user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
  })
);

export const messageRelationships = relationships(message, ({ one }) => ({
  conversation: one({
    sourceField: ['conversation_id'],
    destSchema: conversation,
    destField: ['id'],
  }),
  sender: one({ sourceField: ['sender_id'], destSchema: user, destField: ['id'] }),
}));

// ============================================
// Search document relationships
// ============================================
export const searchDocumentRelationships = relationships(searchDocument, ({ one, many }) => ({
  owner: one({ sourceField: ['owner_user_id'], destSchema: user, destField: ['id'] }),
  group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
  topics: many({
    sourceField: ['id'],
    destSchema: searchDocumentTopic,
    destField: ['document_id'],
  }),
  acl: many({
    sourceField: ['id'],
    destSchema: searchDocumentAcl,
    destField: ['document_id'],
  }),
}));

export const searchDocumentTopicRelationships = relationships(searchDocumentTopic, ({ one }) => ({
  document: one({
    sourceField: ['document_id'],
    destSchema: searchDocument,
    destField: ['id'],
  }),
}));

export const searchDocumentAclRelationships = relationships(searchDocumentAcl, ({ one }) => ({
  document: one({
    sourceField: ['document_id'],
    destSchema: searchDocument,
    destField: ['id'],
  }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

// ============================================
// Notification relationships
// ============================================
export const notificationRelationships = relationships(notification, ({ one, many }) => ({
  recipient: one({ sourceField: ['recipient_id'], destSchema: user, destField: ['id'] }),
  sender: one({ sourceField: ['sender_id'], destSchema: user, destField: ['id'] }),
  related_user: one({ sourceField: ['related_user_id'], destSchema: user, destField: ['id'] }),
  related_group: one({ sourceField: ['related_group_id'], destSchema: group, destField: ['id'] }),
  related_event: one({ sourceField: ['related_event_id'], destSchema: event, destField: ['id'] }),
  related_amendment: one({
    sourceField: ['related_amendment_id'],
    destSchema: amendment,
    destField: ['id'],
  }),
  related_blog: one({ sourceField: ['related_blog_id'], destSchema: blog, destField: ['id'] }),
  on_behalf_of_group: one({
    sourceField: ['on_behalf_of_group_id'],
    destSchema: group,
    destField: ['id'],
  }),
  on_behalf_of_event: one({
    sourceField: ['on_behalf_of_event_id'],
    destSchema: event,
    destField: ['id'],
  }),
  on_behalf_of_amendment: one({
    sourceField: ['on_behalf_of_amendment_id'],
    destSchema: amendment,
    destField: ['id'],
  }),
  on_behalf_of_blog: one({
    sourceField: ['on_behalf_of_blog_id'],
    destSchema: blog,
    destField: ['id'],
  }),
  recipient_group: one({
    sourceField: ['recipient_group_id'],
    destSchema: group,
    destField: ['id'],
  }),
  recipient_event: one({
    sourceField: ['recipient_event_id'],
    destSchema: event,
    destField: ['id'],
  }),
  recipient_amendment: one({
    sourceField: ['recipient_amendment_id'],
    destSchema: amendment,
    destField: ['id'],
  }),
  recipient_blog: one({ sourceField: ['recipient_blog_id'], destSchema: blog, destField: ['id'] }),
  reads: many({
    sourceField: ['id'],
    destSchema: notificationRead,
    destField: ['notification_id'],
  }),
}));

export const pushSubscriptionRelationships = relationships(pushSubscription, ({ one }) => ({
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

export const notificationSettingRelationships = relationships(notificationSetting, ({ one }) => ({
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

export const notificationReadRelationships = relationships(notificationRead, ({ one }) => ({
  notification: one({
    sourceField: ['notification_id'],
    destSchema: notification,
    destField: ['id'],
  }),
  read_by_user: one({ sourceField: ['read_by_user_id'], destSchema: user, destField: ['id'] }),
}));

// ============================================
// Blog relationships
// ============================================
export const blogRelationships = relationships(blog, ({ one, many }) => ({
  group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
  bloggers: many({ sourceField: ['id'], destSchema: blogBlogger, destField: ['blog_id'] }),
  support_votes: many({ sourceField: ['id'], destSchema: blogSupportVote, destField: ['blog_id'] }),
  roles: many({ sourceField: ['id'], destSchema: role, destField: ['blog_id'] }),
  subscribers: many({ sourceField: ['id'], destSchema: subscriber, destField: ['blog_id'] }),
  blog_hashtags: many({ sourceField: ['id'], destSchema: blogHashtag, destField: ['blog_id'] }),
  timeline_events: many({ sourceField: ['id'], destSchema: timelineEvent, destField: ['blog_id'] }),
  document_versions: many({
    sourceField: ['id'],
    destSchema: documentVersion,
    destField: ['blog_id'],
  }),
  threads: many({ sourceField: ['id'], destSchema: thread, destField: ['blog_id'] }),
}));

export const blogBloggerRelationships = relationships(blogBlogger, ({ one }) => ({
  blog: one({ sourceField: ['blog_id'], destSchema: blog, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
  role: one({ sourceField: ['role_id'], destSchema: role, destField: ['id'] }),
}));

export const blogSupportVoteRelationships = relationships(blogSupportVote, ({ one }) => ({
  blog: one({ sourceField: ['blog_id'], destSchema: blog, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

// ============================================
// Payment relationships
// ============================================
export const paymentRelationships = relationships(payment, ({ one }) => ({
  payer_user: one({ sourceField: ['payer_user_id'], destSchema: user, destField: ['id'] }),
  payer_group: one({ sourceField: ['payer_group_id'], destSchema: group, destField: ['id'] }),
  receiver_user: one({ sourceField: ['receiver_user_id'], destSchema: user, destField: ['id'] }),
  receiver_group: one({ sourceField: ['receiver_group_id'], destSchema: group, destField: ['id'] }),
}));

export const stripeCustomerRelationships = relationships(stripeCustomer, ({ one, many }) => ({
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
  subscriptions: many({
    sourceField: ['id'],
    destSchema: stripeSubscription,
    destField: ['customer_id'],
  }),
  payments: many({ sourceField: ['id'], destSchema: stripePayment, destField: ['customer_id'] }),
}));

export const stripeSubscriptionRelationships = relationships(
  stripeSubscription,
  ({ one, many }) => ({
    customer: one({ sourceField: ['customer_id'], destSchema: stripeCustomer, destField: ['id'] }),
    payments: many({
      sourceField: ['id'],
      destSchema: stripePayment,
      destField: ['stripe_subscription_id'],
    }),
  })
);

export const stripePaymentRelationships = relationships(stripePayment, ({ one }) => ({
  customer: one({ sourceField: ['customer_id'], destSchema: stripeCustomer, destField: ['id'] }),
}));

// ============================================
// Statement relationships
// ============================================
export const statementRelationships = relationships(statement, ({ one, many }) => ({
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
  group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
  support_votes: many({
    sourceField: ['id'],
    destSchema: statementSupportVote,
    destField: ['statement_id'],
  }),
  statement_hashtags: many({
    sourceField: ['id'],
    destSchema: statementHashtag,
    destField: ['statement_id'],
  }),
  surveys: many({ sourceField: ['id'], destSchema: statementSurvey, destField: ['statement_id'] }),
  threads: many({ sourceField: ['id'], destSchema: thread, destField: ['statement_id'] }),
  timeline_events: many({
    sourceField: ['id'],
    destSchema: timelineEvent,
    destField: ['statement_id'],
  }),
}));

export const statementSupportVoteRelationships = relationships(statementSupportVote, ({ one }) => ({
  statement: one({ sourceField: ['statement_id'], destSchema: statement, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

export const statementSurveyRelationships = relationships(statementSurvey, ({ one, many }) => ({
  statement: one({ sourceField: ['statement_id'], destSchema: statement, destField: ['id'] }),
  options: many({
    sourceField: ['id'],
    destSchema: statementSurveyOption,
    destField: ['survey_id'],
  }),
}));

export const statementSurveyOptionRelationships = relationships(
  statementSurveyOption,
  ({ one, many }) => ({
    survey: one({ sourceField: ['survey_id'], destSchema: statementSurvey, destField: ['id'] }),
    votes: many({ sourceField: ['id'], destSchema: statementSurveyVote, destField: ['option_id'] }),
  })
);

export const statementSurveyVoteRelationships = relationships(statementSurveyVote, ({ one }) => ({
  option: one({ sourceField: ['option_id'], destSchema: statementSurveyOption, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

export const statementHashtagRelationships = relationships(statementHashtag, ({ one }) => ({
  statement: one({ sourceField: ['statement_id'], destSchema: statement, destField: ['id'] }),
  hashtag: one({ sourceField: ['hashtag_id'], destSchema: hashtag, destField: ['id'] }),
}));

// ============================================
// Common relationships
// ============================================
export const subscriberRelationships = relationships(subscriber, ({ one }) => ({
  subscriber_user: one({ sourceField: ['subscriber_id'], destSchema: user, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
  group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
  amendment: one({ sourceField: ['amendment_id'], destSchema: amendment, destField: ['id'] }),
  event: one({ sourceField: ['event_id'], destSchema: event, destField: ['id'] }),
  blog: one({ sourceField: ['blog_id'], destSchema: blog, destField: ['id'] }),
}));

export const groupWorkflowRelationships = relationships(groupWorkflow, ({ one, many }) => ({
  group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
  start_group: one({ sourceField: ['start_group_id'], destSchema: group, destField: ['id'] }),
  created_by: one({ sourceField: ['created_by_id'], destSchema: user, destField: ['id'] }),
  steps: many({ sourceField: ['id'], destSchema: groupWorkflowStep, destField: ['workflow_id'] }),
  approvals: many({
    sourceField: ['id'],
    destSchema: groupWorkflowApproval,
    destField: ['workflow_id'],
  }),
  default_entry_from_steps: many({
    sourceField: ['id'],
    destSchema: groupWorkflowStep,
    destField: ['target_workflow_id'],
  }),
  incoming_process_runs: many({
    sourceField: ['id'],
    destSchema: amendmentProcessRun,
    destField: ['selected_target_workflow_id'],
  }),
  root_process_runs: many({
    sourceField: ['id'],
    destSchema: amendmentProcessRun,
    destField: ['root_workflow_id'],
  }),
}));

export const groupWorkflowStepRelationships = relationships(groupWorkflowStep, ({ one }) => ({
  workflow: one({ sourceField: ['workflow_id'], destSchema: groupWorkflow, destField: ['id'] }),
  group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
  target_workflow: one({
    sourceField: ['target_workflow_id'],
    destSchema: groupWorkflow,
    destField: ['id'],
  }),
}));

export const groupWorkflowApprovalRelationships = relationships(
  groupWorkflowApproval,
  ({ one }) => ({
    workflow: one({ sourceField: ['workflow_id'], destSchema: groupWorkflow, destField: ['id'] }),
    group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
    requested_by_group: one({
      sourceField: ['requested_by_group_id'],
      destSchema: group,
      destField: ['id'],
    }),
  })
);

export const hashtagRelationships = relationships(hashtag, ({ many }) => ({
  user_hashtags: many({ sourceField: ['id'], destSchema: userHashtag, destField: ['hashtag_id'] }),
  group_hashtags: many({
    sourceField: ['id'],
    destSchema: groupHashtag,
    destField: ['hashtag_id'],
  }),
  amendment_hashtags: many({
    sourceField: ['id'],
    destSchema: amendmentHashtag,
    destField: ['hashtag_id'],
  }),
  event_hashtags: many({
    sourceField: ['id'],
    destSchema: eventHashtag,
    destField: ['hashtag_id'],
  }),
  blog_hashtags: many({ sourceField: ['id'], destSchema: blogHashtag, destField: ['hashtag_id'] }),
  statement_hashtags: many({
    sourceField: ['id'],
    destSchema: statementHashtag,
    destField: ['hashtag_id'],
  }),
}));

export const userHashtagRelationships = relationships(userHashtag, ({ one }) => ({
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
  hashtag: one({ sourceField: ['hashtag_id'], destSchema: hashtag, destField: ['id'] }),
}));

export const groupHashtagRelationships = relationships(groupHashtag, ({ one }) => ({
  group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
  hashtag: one({ sourceField: ['hashtag_id'], destSchema: hashtag, destField: ['id'] }),
}));

export const amendmentHashtagRelationships = relationships(amendmentHashtag, ({ one }) => ({
  amendment: one({ sourceField: ['amendment_id'], destSchema: amendment, destField: ['id'] }),
  hashtag: one({ sourceField: ['hashtag_id'], destSchema: hashtag, destField: ['id'] }),
}));

export const eventHashtagRelationships = relationships(eventHashtag, ({ one }) => ({
  event: one({ sourceField: ['event_id'], destSchema: event, destField: ['id'] }),
  hashtag: one({ sourceField: ['hashtag_id'], destSchema: hashtag, destField: ['id'] }),
}));

export const blogHashtagRelationships = relationships(blogHashtag, ({ one }) => ({
  blog: one({ sourceField: ['blog_id'], destSchema: blog, destField: ['id'] }),
  hashtag: one({ sourceField: ['hashtag_id'], destSchema: hashtag, destField: ['id'] }),
}));

export const linkRelationships = relationships(link, ({ one }) => ({
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
  group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
  event: one({
    sourceField: ['event_id'],
    destSchema: event,
    destField: ['id'],
  }),
}));

export const timelineEventRelationships = relationships(timelineEvent, ({ one, many }) => ({
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
  group: one({ sourceField: ['group_id'], destSchema: group, destField: ['id'] }),
  amendment: one({ sourceField: ['amendment_id'], destSchema: amendment, destField: ['id'] }),
  event: one({ sourceField: ['event_id'], destSchema: event, destField: ['id'] }),
  todo: one({ sourceField: ['todo_id'], destSchema: todo, destField: ['id'] }),
  blog: one({ sourceField: ['blog_id'], destSchema: blog, destField: ['id'] }),
  statement: one({ sourceField: ['statement_id'], destSchema: statement, destField: ['id'] }),
  actor: one({ sourceField: ['actor_id'], destSchema: user, destField: ['id'] }),
  election: one({ sourceField: ['election_id'], destSchema: election, destField: ['id'] }),
  reactions: many({ sourceField: ['id'], destSchema: reaction, destField: ['timeline_event_id'] }),
}));

export const reactionRelationships = relationships(reaction, ({ one }) => ({
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
  timeline_event: one({
    sourceField: ['timeline_event_id'],
    destSchema: timelineEvent,
    destField: ['id'],
  }),
}));

// ============================================
// Vote relationships (new)
// ============================================
export const voteRelationships = relationships(vote, ({ one, many }) => ({
  agenda_item: one({ sourceField: ['agenda_item_id'], destSchema: agendaItem, destField: ['id'] }),
  amendment: one({ sourceField: ['amendment_id'], destSchema: amendment, destField: ['id'] }),
  choices: many({ sourceField: ['id'], destSchema: voteChoice, destField: ['vote_id'] }),
  voters: many({ sourceField: ['id'], destSchema: voter, destField: ['vote_id'] }),
  offline_tallies: many({
    sourceField: ['id'],
    destSchema: voteOfflineTally,
    destField: ['vote_id'],
  }),
  indicative_participations: many({
    sourceField: ['id'],
    destSchema: indicativeVoterParticipation,
    destField: ['vote_id'],
  }),
  indicative_decisions: many({
    sourceField: ['id'],
    destSchema: indicativeChoiceDecision,
    destField: ['vote_id'],
  }),
  final_participations: many({
    sourceField: ['id'],
    destSchema: finalVoterParticipation,
    destField: ['vote_id'],
  }),
  final_decisions: many({
    sourceField: ['id'],
    destSchema: finalChoiceDecision,
    destField: ['vote_id'],
  }),
  agenda_item_change_request: many({
    sourceField: ['id'],
    destSchema: agendaItemChangeRequest,
    destField: ['vote_id'],
  }),
}));

export const voteChoiceRelationships = relationships(voteChoice, ({ one, many }) => ({
  vote: one({ sourceField: ['vote_id'], destSchema: vote, destField: ['id'] }),
  indicative_decisions: many({
    sourceField: ['id'],
    destSchema: indicativeChoiceDecision,
    destField: ['choice_id'],
  }),
  final_decisions: many({
    sourceField: ['id'],
    destSchema: finalChoiceDecision,
    destField: ['choice_id'],
  }),
}));

export const voterRelationships = relationships(voter, ({ one }) => ({
  vote: one({ sourceField: ['vote_id'], destSchema: vote, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

export const indicativeVoterParticipationRelationships = relationships(
  indicativeVoterParticipation,
  ({ one, many }) => ({
    vote: one({ sourceField: ['vote_id'], destSchema: vote, destField: ['id'] }),
    voter: one({ sourceField: ['voter_id'], destSchema: voter, destField: ['id'] }),
    decisions: many({
      sourceField: ['id'],
      destSchema: indicativeChoiceDecision,
      destField: ['voter_participation_id'],
    }),
  })
);

export const indicativeChoiceDecisionRelationships = relationships(
  indicativeChoiceDecision,
  ({ one }) => ({
    vote: one({ sourceField: ['vote_id'], destSchema: vote, destField: ['id'] }),
    choice: one({ sourceField: ['choice_id'], destSchema: voteChoice, destField: ['id'] }),
    participation: one({
      sourceField: ['voter_participation_id'],
      destSchema: indicativeVoterParticipation,
      destField: ['id'],
    }),
  })
);

export const finalVoterParticipationRelationships = relationships(
  finalVoterParticipation,
  ({ one, many }) => ({
    vote: one({ sourceField: ['vote_id'], destSchema: vote, destField: ['id'] }),
    voter: one({ sourceField: ['voter_id'], destSchema: voter, destField: ['id'] }),
    decisions: many({
      sourceField: ['id'],
      destSchema: finalChoiceDecision,
      destField: ['voter_participation_id'],
    }),
  })
);

export const finalChoiceDecisionRelationships = relationships(finalChoiceDecision, ({ one }) => ({
  vote: one({ sourceField: ['vote_id'], destSchema: vote, destField: ['id'] }),
  choice: one({ sourceField: ['choice_id'], destSchema: voteChoice, destField: ['id'] }),
  participation: one({
    sourceField: ['voter_participation_id'],
    destSchema: finalVoterParticipation,
    destField: ['id'],
  }),
}));

export const voteOfflineTallyRelationships = relationships(voteOfflineTally, ({ one }) => ({
  vote: one({ sourceField: ['vote_id'], destSchema: vote, destField: ['id'] }),
  choice: one({ sourceField: ['choice_id'], destSchema: voteChoice, destField: ['id'] }),
  updated_by: one({ sourceField: ['updated_by_id'], destSchema: user, destField: ['id'] }),
}));

// ============================================
// Voting Password relationships
// ============================================
export const votingPasswordRelationships = relationships(votingPassword, ({ one }) => ({
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

// ============================================
// Accreditation relationships
// ============================================
export const accreditationRelationships = relationships(accreditation, ({ one }) => ({
  event: one({ sourceField: ['event_id'], destSchema: event, destField: ['id'] }),
  agenda_item: one({ sourceField: ['agenda_item_id'], destSchema: agendaItem, destField: ['id'] }),
  user: one({ sourceField: ['user_id'], destSchema: user, destField: ['id'] }),
}));

// ============================================
// Eurostat relationships
// ============================================
export const eurostatDatasetRelationships = relationships(eurostatDataset, ({ many }) => ({
  observations: many({
    sourceField: ['id'],
    destSchema: eurostatObservation,
    destField: ['dataset_id'],
  }),
  projections: many({
    sourceField: ['id'],
    destSchema: chartProjection,
    destField: ['dataset_id'],
  }),
}));

export const eurostatObservationRelationships = relationships(eurostatObservation, ({ one }) => ({
  dataset: one({
    sourceField: ['dataset_id'],
    destSchema: eurostatDataset,
    destField: ['id'],
  }),
}));

export const chartProjectionRelationships = relationships(chartProjection, ({ one, many }) => ({
  dataset: one({
    sourceField: ['dataset_id'],
    destSchema: eurostatDataset,
    destField: ['id'],
  }),
  points: many({
    sourceField: ['id'],
    destSchema: chartProjectionPoint,
    destField: ['projection_id'],
  }),
}));

export const chartProjectionPointRelationships = relationships(chartProjectionPoint, ({ one }) => ({
  projection: one({
    sourceField: ['projection_id'],
    destSchema: chartProjection,
    destField: ['id'],
  }),
}));

// ============================================
// All relationships array for schema assembly
// ============================================
export const allRelationships = [
  // Users
  userRelationships,
  fileRelationships,
  userPreferenceRelationships,
  aiSkillRelationships,
  aiToolRelationships,
  followRelationships,
  // Groups
  groupRelationships,
  groupMembershipRelationships,
  groupOfflineMemberRelationships,
  groupOfflineMembershipRelationships,
  groupMembershipRoleRelationships,
  groupOfflineMembershipRoleRelationships,
  groupGuestAccessRelationships,
  groupGuestRoleRelationships,
  groupConnectionRelationships,
  groupRightGrantRelationships,
  groupMembershipRuleRelationships,
  groupMembershipRuleOriginRelationships,
  groupConnectionRequestRelationships,
  groupRightGrantRequestRelationships,
  groupMembershipRuleRequestRelationships,
  groupMembershipRuleRequestOriginRelationships,
  roleRelationships,
  actionRightRelationships,
  roleHolderHistoryRelationships,
  // Events
  eventRelationships,
  eventParticipantRelationships,
  eventOfflineParticipantRelationships,
  eventParticipantRoleRelationships,
  eventDelegateRelationships,
  groupDelegateAllocationRelationships,
  participantRelationships,
  // Amendments
  amendmentRelationships,
  amendmentSupportVoteRelationships,
  changeRequestRelationships,
  changeRequestVoteRelationships,
  amendmentCollaboratorRelationships,
  amendmentPathRelationships,
  amendmentPathSegmentRelationships,
  supportConfirmationRelationships,
  amendmentGroupDecisionRelationships,
  amendmentProcessRunRelationships,
  amendmentProcessBranchRelationships,
  amendmentProcessStepRunRelationships,
  processTaskRelationships,
  // Documents
  documentRelationships,
  documentVersionRelationships,
  documentCollaboratorRelationships,
  documentCursorRelationships,
  threadRelationships,
  commentRelationships,
  threadVoteRelationships,
  commentVoteRelationships,
  // Agendas
  agendaItemRelationships,
  speakerListRelationships,
  agendaItemChangeRequestRelationships,
  electionRelationships,
  electionCandidateRelationships,
  electorRelationships,
  indicativeElectorParticipationRelationships,
  indicativeCandidateSelectionRelationships,
  finalElectorParticipationRelationships,
  finalCandidateSelectionRelationships,
  electionOfflineTallyRelationships,
  // Todos
  todoRelationships,
  todoAssignmentRelationships,
  // Messages
  conversationRelationships,
  conversationParticipantRelationships,
  messageRelationships,
  // Search Documents
  searchDocumentRelationships,
  searchDocumentTopicRelationships,
  searchDocumentAclRelationships,
  // Notifications
  notificationRelationships,
  pushSubscriptionRelationships,
  notificationSettingRelationships,
  notificationReadRelationships,
  // Blogs
  blogRelationships,
  blogBloggerRelationships,
  blogSupportVoteRelationships,
  // Payments
  paymentRelationships,
  stripeCustomerRelationships,
  stripeSubscriptionRelationships,
  stripePaymentRelationships,
  // Statements
  statementRelationships,
  statementSupportVoteRelationships,
  statementSurveyRelationships,
  statementSurveyOptionRelationships,
  statementSurveyVoteRelationships,
  statementHashtagRelationships,
  // Common
  subscriberRelationships,
  hashtagRelationships,
  userHashtagRelationships,
  groupHashtagRelationships,
  amendmentHashtagRelationships,
  eventHashtagRelationships,
  blogHashtagRelationships,
  linkRelationships,
  timelineEventRelationships,
  reactionRelationships,
  // Calendar Subscriptions
  calendarSubscriptionRelationships,
  eventExceptionRelationships,
  // Votes (new)
  voteRelationships,
  voteChoiceRelationships,
  voterRelationships,
  indicativeVoterParticipationRelationships,
  indicativeChoiceDecisionRelationships,
  finalVoterParticipationRelationships,
  finalChoiceDecisionRelationships,
  voteOfflineTallyRelationships,
  // Voting Password
  votingPasswordRelationships,
  // Accreditation
  accreditationRelationships,
  // Eurostat
  eurostatDatasetRelationships,
  eurostatObservationRelationships,
  chartProjectionRelationships,
  chartProjectionPointRelationships,
  // Workflows
  groupWorkflowRelationships,
  groupWorkflowStepRelationships,
  groupWorkflowApprovalRelationships,
] as const;
