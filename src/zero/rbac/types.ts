/**
 * RBAC Type Definitions
 *
 * All type definitions for the Role-Based Access Control system.
 * Ported from db/rbac/types.ts — no InstantDB dependencies.
 */

// Resource types (all entities that can have permissions)
export type ResourceType =
  | 'accreditations'
  | 'agendaItems'
  | 'aiSkills'
  | 'aiTools'
  | 'amendments'
  | 'blogs'
  | 'blogBloggers'
  | 'calendarSubscriptions'
  | 'changeRequests'
  | 'comments'
  | 'commentVotes'
  | 'conversations'
  | 'documents'
  | 'documentCollaborators'
  | 'elections'
  | 'electionCandidates'
  | 'events'
  | 'eventParticipants'
  | 'follows'
  | 'groups'
  | 'groupDocuments'
  | 'groupLinks'
  | 'groupMemberships'
  | 'groupNotifications'
  | 'groupPayments'
  | 'groupRoles'
  | 'groupRelationships'
  | 'groupAccessRoles'
  | 'groupDatasets'
  | 'groupTodos'
  | 'messages'
  | 'notifications'
  | 'payments'
  | 'pqlFilters'
  | 'preferences'
  | 'roles'
  | 'actionRights'
  | 'statements'
  | 'statementSurveys'
  | 'statementSurveyVotes'
  | 'threads'
  | 'todos'
  | 'todoAssignments'
  | '$users'
  | '$files';

// Action types with inheritance
export type ActionType =
  | 'view'
  | 'manage'
  | 'create'
  | 'update'
  | 'delete'
  | 'vote'
  | 'active_voting'
  | 'passive_voting'
  | 'comment'
  | 'moderate'
  | 'invite_members'
  | 'manage_members'
  | 'manage_participants'
  | 'manage_relationships'
  | 'manage_roles'
  | 'manage_speakers'
  | 'manage_votes'
  | 'speak'
  | 'manageNotifications'
  | 'viewNotifications';

export interface ActionRight {
  id: string;
  resource: ResourceType;
  action: ActionType;
  group?: { id: string };
  event?: { id: string };
  amendment?: { id: string };
  blog?: { id: string };
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  scope: 'group' | 'event' | 'amendment' | 'blog';
  actionRights?: ActionRight[];
}

export interface Membership {
  id: string;
  group?: { id: string };
  roles?: Role[];
  status?: string;
}

export interface GuestAccess {
  id: string;
  group?: { id: string };
  roles?: Role[];
  status?: string;
}

export interface Participation {
  id: string;
  event?: { id: string };
  roles?: Role[];
  status?: string;
}

export interface BloggerRelation {
  id: string;
  blog?: { id: string };
  role?: Role;
}

export interface AmendmentCollaborator {
  id: string;
  user?: { id: string };
  roleName?: string;
  status?: string;
}

export interface AmendmentRoleCollaborator {
  id: string;
  user?: { id: string };
  role?: Role;
  status?: string;
}

export interface Amendment {
  id: string;
  user?: { id: string }; // Author
  owner?: { id: string }; // Owner relation from schema
  group?: { id: string };
  collaborators?: AmendmentCollaborator[];
  amendmentRoleCollaborators?: AmendmentRoleCollaborator[];
  roles?: Role[];
}

export interface PermissionContext {
  groupId?: string;
  eventId?: string;
  blogId?: string;
  amendmentId?: string;
  amendment?: Amendment; // Pass the amendment object for permission checks
}
