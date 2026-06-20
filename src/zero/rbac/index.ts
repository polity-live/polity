/**
 * RBAC Module
 *
 * Role-Based Access Control system for the Polity application.
 *
 * Architecture:
 *   check.ts        — shared pure permission logic (single source of truth)
 *   can.ts          — server-side check for mutators (queries DB, throws PermissionError)
 *   usePermissions  — React hook for UI (uses Zero queries + check.ts)
 *   errors.ts       — typed PermissionError, surfaced as toast in UI
 */

// Types
export type {
  ResourceType,
  ActionType,
  ActionRight,
  Role,
  Membership,
  Participation,
  BloggerRelation,
  Amendment,
  AmendmentCollaborator,
  AmendmentRoleCollaborator,
  PermissionContext,
} from './types';

// Core permission checker (shared between client & server)
export {
  checkPermission,
  isSelf,
  isGroupMember,
  isEventParticipant,
  isBlogger,
  isAmendmentCollaborator,
  isAmendmentAuthor,
  hasActiveVotingRight,
  hasPassiveVotingRight,
} from './check';
export type { PermissionData, PermissionScope } from './check';

// Server-side permission check for mutators
export { can } from './can';
export type { PermissionCheck } from './can';

export {
  canReadVisibility,
  denyPublicApiMutation,
  isAuthenticatedUser,
  isClientTx,
  requireActorMatches,
  requireAuthenticated,
  requireOwner,
  requireSelf,
} from './authorize';
export {
  applyAgendaItemQueryAccess,
  applyAccreditationQueryAccess,
  applyAmendmentQueryAccess,
  applyBlogQueryAccess,
  applyDocumentQueryAccess,
  applyElectionElectorOrManagerQueryAccess,
  applyElectionManagerQueryAccess,
  applyElectionQueryAccess,
  applyEventManagerQueryAccess,
  applyEventParticipantOrManagerQueryAccess,
  applyEventQueryAccess,
  applyGroupQueryAccess,
  applyGroupManagerQueryAccess,
  applyGroupMembershipSelfOrManagerQueryAccess,
  applyStatementQueryAccess,
  applyTodoQueryAccess,
  applyUserQueryAccess,
  applyVoteManagerQueryAccess,
  applyVoteQueryAccess,
  applyVoteVoterOrManagerQueryAccess,
  denyAllRows,
  isAuthenticatedUserId,
  requireQueryUser,
} from './query-access';
export type { AuthContext } from './authorize';

// Typed permission error
export { PermissionError, isPermissionError } from './errors';

// Mutation error handler (for useXxxActions hooks)
export { handleMutationError } from './handleMutationError';

// Constants
export {
  PERMISSION_IMPLIES,
  DEFAULT_GROUP_ROLES,
  DEFAULT_BLOG_ROLES,
  DEFAULT_AMENDMENT_ROLES,
  DEFAULT_EVENT_ROLES,
  ACTION_RIGHTS,
} from './constants';

// Workflow constants
export type {
  EditingMode,
  WorkflowStatus,
  AmendmentStatus,
  VotingSessionType,
  VotingSessionStatus,
  ChangeRequestSource,
} from './workflow-constants';

export {
  AMENDMENT_EDITING_MODE_ORDER,
  AUTOMATIC_EVENT_MODES,
  EDITING_MODE_TRANSITIONS,
  MANUAL_INTERNAL_MODES,
  MANUALLY_SELECTABLE_MODES,
  SELECTABLE_MODES,
  EVENT_MODES,
  TERMINAL_MODES,
  EDITING_MODE_METADATA,
  canTransitionTo,
  isEventPhase,
  isTerminalStatus,
  isVotingMode,
  isSuggestingMode,
  isSelectableByCollaborator,
  getDefaultEditingMode,
  normalizeEditingMode,
  // Deprecated aliases
  WORKFLOW_TRANSITIONS,
  COLLABORATOR_SELECTABLE_STATUSES,
  EVENT_CONTROLLED_STATUSES,
  TERMINAL_STATUSES,
  WORKFLOW_STATUS_METADATA,
  getDefaultWorkflowStatus,
} from './workflow-constants';

// Queries
export { rbacQueries } from './queries';

// Hooks
export { usePermissions } from './usePermissions';
