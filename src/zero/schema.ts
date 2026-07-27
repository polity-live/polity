import { createSchema, createBuilder, type Row } from '@rocicorp/zero';

// Table imports
import { user, file } from './users/table';
import {
  group,
  groupMembership,
  groupMembershipOrigin,
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
import {
  event,
  eventParticipant,
  eventOfflineParticipant,
  eventParticipantRole,
  participant,
  eventException,
  eventAssemblyScope,
} from './events/table';
import {
  amendment,
  amendmentCollaborator,
  amendmentCityDesign,
  amendmentPath,
  amendmentPathSegment,
  supportConfirmation,
  amendmentGroupDecision,
  amendmentProcessRun,
  amendmentProcessBranch,
  amendmentProcessStepRun,
  processTask,
} from './amendments/table';
import { document, documentVersion, documentCollaborator, documentCursor } from './documents/table';
import { agendaItem, speakerList, agendaItemChangeRequest } from './agendas/table';
import { todo, todoAssignment } from './todos/table';
import { conversation, conversationParticipant, message } from './messages/table';
import { searchDocument, searchDocumentAcl, searchDocumentTopic } from './search-documents/table';
import {
  notification,
  pushSubscription,
  notificationSetting,
  notificationRead,
  notificationUserState,
} from './notifications/table';
import { blog, blogBlogger } from './blogs/table';
import { payment, stripeCustomer, stripeSubscription, stripePayment } from './payments/table';
import {
  statement,
  statementSurvey,
  statementSurveyOption,
  statementSurveyVote,
} from './statements/table';
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
// New domain imports
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
import { changeRequest } from './change-requests/table';
import { thread, comment } from './discussions/table';
import {
  eventDelegate,
  groupDelegateAllocation,
  delegateElectionAssignment,
} from './delegates/table';
import {
  follow,
  groupConnection,
  groupRightGrant,
  groupMembershipRule,
  groupMembershipRuleOrigin,
  groupHierarchyPath,
  groupEffectiveRight,
  groupMembershipExclusivityLock,
  groupSiblingSourceLock,
  groupConnectionRequest,
  groupRightGrantRequest,
  groupMembershipRuleRequest,
  groupMembershipRuleRequestOrigin,
  subscriber,
  groupWorkflow,
  groupWorkflowStep,
  groupWorkflowApproval,
} from './network/table';
import { userPreference } from './preferences/table';
import { pqlFilter } from './pql/table';
import { aiSkill, aiTool } from './ai/table';
import { calendarSubscription } from './calendar-subscriptions/table';
// Voting Password
import { votingPassword } from './voting-password/table';
// Accreditation
import { accreditation, accreditationAudit } from './accreditation/table';
import { dataset, datasetSnapshot } from './datasets/table';
import { appearanceTheme, appearanceThemeRevision } from './appearance-themes/table';
import {
  appTutorialRun,
  appTutorialCheckpointEffect,
  appTutorialEntity,
} from './app-tutorial/table';

// Relationship imports
import { allRelationships } from './relationships';

// ============================================
// Schema Export
// ============================================
const zeroTables = [
  // Users
  user,
  file,
  // Groups
  group,
  groupMembership,
  groupMembershipOrigin,
  groupOfflineMember,
  groupOfflineMembership,
  groupMembershipRole,
  groupOfflineMembershipRole,
  groupGuestAccess,
  groupGuestRole,
  role,
  roleHolderHistory,
  actionRight,
  // Events
  event,
  eventParticipant,
  eventOfflineParticipant,
  eventParticipantRole,
  participant,
  eventException,
  eventAssemblyScope,
  // Amendments
  amendment,
  amendmentCollaborator,
  amendmentCityDesign,
  amendmentPath,
  amendmentPathSegment,
  supportConfirmation,
  amendmentGroupDecision,
  amendmentProcessRun,
  amendmentProcessBranch,
  amendmentProcessStepRun,
  processTask,
  // Documents
  document,
  documentVersion,
  documentCollaborator,
  documentCursor,
  // Agendas
  agendaItem,
  speakerList,
  agendaItemChangeRequest,
  // Elections
  election,
  electionCandidate,
  electionOfflineTally,
  elector,
  indicativeElectorParticipation,
  indicativeCandidateSelection,
  finalElectorParticipation,
  finalCandidateSelection,
  // Votes
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
  // Change Requests
  changeRequest,
  // Discussions
  thread,
  comment,
  // Delegates
  eventDelegate,
  groupDelegateAllocation,
  delegateElectionAssignment,
  // Network
  follow,
  groupConnection,
  groupRightGrant,
  groupMembershipRule,
  groupMembershipRuleOrigin,
  groupHierarchyPath,
  groupEffectiveRight,
  groupMembershipExclusivityLock,
  groupSiblingSourceLock,
  groupConnectionRequest,
  groupRightGrantRequest,
  groupMembershipRuleRequest,
  groupMembershipRuleRequestOrigin,
  subscriber,
  groupWorkflow,
  groupWorkflowStep,
  groupWorkflowApproval,
  // Todos
  todo,
  todoAssignment,
  // Messages
  conversation,
  conversationParticipant,
  message,
  // Search Documents
  searchDocument,
  searchDocumentTopic,
  searchDocumentAcl,
  // Notifications
  notification,
  pushSubscription,
  notificationSetting,
  notificationRead,
  notificationUserState,
  // Blogs
  blog,
  blogBlogger,
  // Payments
  payment,
  stripeCustomer,
  stripeSubscription,
  stripePayment,
  // Statements
  statement,
  statementSurvey,
  statementSurveyOption,
  statementSurveyVote,
  // Preferences
  userPreference,
  // PQL
  pqlFilter,
  // AI
  aiSkill,
  aiTool,
  // Common
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
  // Calendar Subscriptions
  calendarSubscription,
  // Voting Password
  votingPassword,
  // Accreditation
  accreditation,
  accreditationAudit,
  // Dataset metadata
  dataset,
  datasetSnapshot,
  // Appearance themes
  appearanceTheme,
  appearanceThemeRevision,
  // Live tutorial
  appTutorialRun,
  appTutorialCheckpointEffect,
  appTutorialEntity,
] as const;

export const schema = createSchema({
  tables: zeroTables,
  relationships: allRelationships,
});

export type Schema = typeof schema;

export const zql = createBuilder(schema);

// ============================================
// Row type exports
// ============================================
// Users
export type User = Row<Schema['tables']['user']>;
export type File = Row<Schema['tables']['file']>;
export type Follow = Row<Schema['tables']['follow']>;

// Groups
export type Group = Row<Schema['tables']['group']>;
export type GroupMembership = Row<Schema['tables']['group_membership']>;
export type GroupMembershipOrigin = Row<Schema['tables']['group_membership_origin']>;
export type GroupOfflineMember = Row<Schema['tables']['group_offline_member']>;
export type GroupOfflineMembership = Row<Schema['tables']['group_offline_membership']>;
export type GroupMembershipRole = Row<Schema['tables']['group_membership_role']>;
export type GroupOfflineMembershipRole = Row<Schema['tables']['group_offline_membership_role']>;
export type GroupGuestAccess = Row<Schema['tables']['group_guest_access']>;
export type GroupGuestRole = Row<Schema['tables']['group_guest_role']>;
export type GroupConnection = Row<Schema['tables']['group_connection']>;
export type GroupRightGrant = Row<Schema['tables']['group_right_grant']>;
export type GroupMembershipRule = Row<Schema['tables']['group_membership_rule']>;
export type GroupHierarchyPath = Row<Schema['tables']['group_hierarchy_path']>;
export type GroupEffectiveRight = Row<Schema['tables']['group_effective_right']>;
export type GroupMembershipExclusivityLock = Row<
  Schema['tables']['group_membership_exclusivity_lock']
>;
export type GroupSiblingSourceLock = Row<Schema['tables']['group_sibling_source_lock']>;
export type Role = Row<Schema['tables']['role']>;
export type RoleHolderHistory = Row<Schema['tables']['role_holder_history']>;
export type ActionRight = Row<Schema['tables']['action_right']>;

// Events
export type Event = Row<Schema['tables']['event']>;
export type EventParticipant = Row<Schema['tables']['event_participant']>;
export type EventOfflineParticipant = Row<Schema['tables']['event_offline_participant']>;
export type EventParticipantRole = Row<Schema['tables']['event_participant_role']>;
export type EventAssemblyScope = Row<Schema['tables']['event_assembly_scope']>;
export type EventDelegate = Row<Schema['tables']['event_delegate']>;
export type GroupDelegateAllocation = Row<Schema['tables']['group_delegate_allocation']>;
export type DelegateElectionAssignment = Row<Schema['tables']['delegate_election_assignment']>;
export type Participant = Row<Schema['tables']['participant']>;
export type EventException = Row<Schema['tables']['event_exception']>;
export type CalendarSubscription = Row<Schema['tables']['calendar_subscription']>;

// Amendments
export type Amendment = Row<Schema['tables']['amendment']>;
export type AmendmentSupportVote = Row<Schema['tables']['amendment_support_vote']>;
export type ChangeRequest = Row<Schema['tables']['change_request']>;
export type ChangeRequestVote = Row<Schema['tables']['change_request_vote']>;
export type AmendmentCollaborator = Row<Schema['tables']['amendment_collaborator']>;
export type AmendmentCityDesign = Row<Schema['tables']['amendment_city_design']>;
export type AmendmentPath = Row<Schema['tables']['amendment_path']>;
export type AmendmentPathSegment = Row<Schema['tables']['amendment_path_segment']>;
export type SupportConfirmation = Row<Schema['tables']['support_confirmation']>;
export type AmendmentGroupDecision = Row<Schema['tables']['amendment_group_decision']>;
export type AmendmentProcessRun = Row<Schema['tables']['amendment_process_run']>;
export type AmendmentProcessBranch = Row<Schema['tables']['amendment_process_branch']>;
export type AmendmentProcessStepRun = Row<Schema['tables']['amendment_process_step_run']>;
export type ProcessTask = Row<Schema['tables']['process_task']>;

// Documents
export type Document = Row<Schema['tables']['document']>;
export type DocumentVersion = Row<Schema['tables']['document_version']>;
export type DocumentCollaborator = Row<Schema['tables']['document_collaborator']>;
export type DocumentCursor = Row<Schema['tables']['document_cursor']>;
export type Thread = Row<Schema['tables']['thread']>;
export type Comment = Row<Schema['tables']['comment']>;
export type ThreadVote = Row<Schema['tables']['thread_vote']>;
export type CommentVote = Row<Schema['tables']['comment_vote']>;

// Agendas
export type AgendaItem = Row<Schema['tables']['agenda_item']>;
export type SpeakerList = Row<Schema['tables']['speaker_list']>;
export type AgendaItemChangeRequestRow = Row<Schema['tables']['agenda_item_change_request']>;
export type Election = Row<Schema['tables']['election']>;
export type ElectionCandidate = Row<Schema['tables']['election_candidate']>;
export type ElectionOfflineTally = Row<Schema['tables']['election_offline_tally']>;
export type Elector = Row<Schema['tables']['elector']>;
export type IndicativeElectorParticipation = Row<
  Schema['tables']['indicative_elector_participation']
>;
export type IndicativeCandidateSelection = Row<Schema['tables']['indicative_candidate_selection']>;
export type FinalElectorParticipation = Row<Schema['tables']['final_elector_participation']>;
export type FinalCandidateSelection = Row<Schema['tables']['final_candidate_selection']>;
export type Vote = Row<Schema['tables']['vote']>;
export type VoteChoice = Row<Schema['tables']['vote_choice']>;
export type VoteOfflineTally = Row<Schema['tables']['vote_offline_tally']>;
export type Voter = Row<Schema['tables']['voter']>;
export type IndicativeVoterParticipation = Row<Schema['tables']['indicative_voter_participation']>;
export type IndicativeChoiceDecision = Row<Schema['tables']['indicative_choice_decision']>;
export type FinalVoterParticipation = Row<Schema['tables']['final_voter_participation']>;
export type FinalChoiceDecision = Row<Schema['tables']['final_choice_decision']>;

// Todos
export type Todo = Row<Schema['tables']['todo']>;
export type TodoAssignment = Row<Schema['tables']['todo_assignment']>;

// Messages
export type Conversation = Row<Schema['tables']['conversation']>;
export type ConversationParticipant = Row<Schema['tables']['conversation_participant']>;
export type Message = Row<Schema['tables']['message']>;

// Search Documents
export type SearchDocument = Row<Schema['tables']['search_document']>;
export type SearchDocumentTopic = Row<Schema['tables']['search_document_topic']>;
export type SearchDocumentAcl = Row<Schema['tables']['search_document_acl']>;

// Notifications
export type Notification = Row<Schema['tables']['notification']>;
export type PushSubscription = Row<Schema['tables']['push_subscription']>;
export type NotificationSetting = Row<Schema['tables']['notification_setting']>;
export type NotificationUserState = Row<Schema['tables']['notification_user_state']>;

// Blogs
export type Blog = Row<Schema['tables']['blog']>;
export type BlogBlogger = Row<Schema['tables']['blog_blogger']>;
export type BlogSupportVote = Row<Schema['tables']['blog_support_vote']>;

// Payments
export type Payment = Row<Schema['tables']['payment']>;
export type StripeCustomer = Row<Schema['tables']['stripe_customer']>;
export type StripeSubscription = Row<Schema['tables']['stripe_subscription']>;
export type StripePayment = Row<Schema['tables']['stripe_payment']>;

// Statements
export type Statement = Row<Schema['tables']['statement']>;
export type StatementSupportVote = Row<Schema['tables']['statement_support_vote']>;
export type StatementSurvey = Row<Schema['tables']['statement_survey']>;
export type StatementSurveyOption = Row<Schema['tables']['statement_survey_option']>;
export type StatementSurveyVote = Row<Schema['tables']['statement_survey_vote']>;
export type StatementHashtag = Row<Schema['tables']['statement_hashtag']>;

// Preferences
export type UserPreference = Row<Schema['tables']['user_preference']>;
export type AppearanceThemeRow = Row<Schema['tables']['appearance_theme']>;
export type AppearanceThemeRevisionRow = Row<Schema['tables']['appearance_theme_revision']>;
export type StoredPqlFilter = Row<Schema['tables']['pql_filter']>;
export type AiSkill = Row<Schema['tables']['ai_skill']>;
export type AiTool = Row<Schema['tables']['ai_tool']>;

// Voting Password
export type VotingPasswordRow = Row<Schema['tables']['voting_password']>;

// Accreditation
export type AccreditationRow = Row<Schema['tables']['accreditation']>;

// Datasets
export type Dataset = Row<Schema['tables']['dataset']>;
export type DatasetSnapshot = Row<Schema['tables']['dataset_snapshot']>;

// Workflows
export type GroupWorkflowRow = Row<Schema['tables']['group_workflow']>;
export type GroupWorkflowStepRow = Row<Schema['tables']['group_workflow_step']>;
export type GroupWorkflowApprovalRow = Row<Schema['tables']['group_workflow_approval']>;

// Live tutorial
export type AppTutorialRunRow = Row<Schema['tables']['app_tutorial_run']>;
export type AppTutorialCheckpointEffectRow = Row<
  Schema['tables']['app_tutorial_checkpoint_effect']
>;
export type AppTutorialEntityRow = Row<Schema['tables']['app_tutorial_entity']>;

// Common
export type Subscriber = Row<Schema['tables']['subscriber']>;
export type Hashtag = Row<Schema['tables']['hashtag']>;
export type UserHashtag = Row<Schema['tables']['user_hashtag']>;
export type GroupHashtag = Row<Schema['tables']['group_hashtag']>;
export type AmendmentHashtag = Row<Schema['tables']['amendment_hashtag']>;
export type EventHashtag = Row<Schema['tables']['event_hashtag']>;
export type BlogHashtag = Row<Schema['tables']['blog_hashtag']>;
export type StatementHashtagJunction = Row<Schema['tables']['statement_hashtag']>;
export type Link = Row<Schema['tables']['link']>;
export type TimelineEvent = Row<Schema['tables']['timeline_event']>;
export type Reaction = Row<Schema['tables']['reaction']>;

// ============================================
// Register default types
// ============================================
declare module '@rocicorp/zero' {
  interface DefaultTypes {
    schema: Schema;
  }
}
