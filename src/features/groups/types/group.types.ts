/**
 * Group Feature Types
 *
 * Entity types are re-exported from Zero (single source of truth).
 * UI-only types are defined locally.
 */

// ── Zero-derived entity types ───────────────────────────────────────
export type { GroupAccessRoleWithRightsRow as GroupRole } from '@/zero/groups/queries';
export type { GroupLinkRow as GroupLink } from '@/zero/groups/queries';
export type { GroupPaymentRow as GroupPayment } from '@/zero/groups/queries';
import type {
  GroupMembershipWithRolesAndRightsRow,
  GroupAccessRoleWithRightsRow,
} from '@/zero/groups/queries';
import type { ParticipationProvenanceGroupLike } from '@/features/shared/types/participation';

export type GroupMembershipWithUser = GroupMembershipWithRolesAndRightsRow & {
  roles?: GroupAccessRoleWithRightsRow[];
  role?: GroupAccessRoleWithRightsRow | null;
  partGroup?: ParticipationProvenanceGroupLike | null;
  baseGroup?: ParticipationProvenanceGroupLike | null;
  provenanceBucketLabel?: string | null;
};

// ── UI-only types (not in Zero schema) ──────────────────────────────

export interface ActionRightOption {
  resource: string;
  action: string;
  label: string;
}

export interface FinancialSummary {
  income: number;
  expenditure: number;
  balance: number;
}

export interface ChartData {
  name: string;
  value: number;
  fill: string;
}

export type MembershipProvenanceGroup = ParticipationProvenanceGroupLike;

export interface MembershipCompositionBucket {
  key: string;
  label: string;
  memberCount: number;
  leadershipAssignmentCount: number;
  memberPercentage: number;
  leadershipPercentage: number;
}

export type MembershipTab =
  | 'membershipsByUser'
  | 'membershipsByRole'
  | 'composition'
  | 'rightsAlignment'
  | 'openAssignments'
  | 'guests'
  | 'roles';
export type MembershipSortField = 'user' | 'role';
export type MembershipSortDirection = 'asc' | 'desc';

export interface MembershipSort {
  field: MembershipSortField;
  direction: MembershipSortDirection;
}

export type TodoViewMode = 'kanban' | 'list';

export type RoleAssignmentMode = 'assigned' | 'elected';
export type RoleVisibility = 'public' | 'authenticated' | 'private';
export type RoleTermPattern = 'none' | 'yearly' | 'four-yearly';
export type RoleAssigneeKind = 'member' | 'guest';

export interface RoleEditorFormState {
  name: string;
  description: string;
  assignee_kind: RoleAssigneeKind;
  assignment_mode: RoleAssignmentMode;
  visibility: RoleVisibility;
  term_pattern: RoleTermPattern;
  term_interval: number;
  term_start_date: string;
  scheduled_revote_date: string;
  default_request_role: boolean;
  default_invite_role: boolean;
}
