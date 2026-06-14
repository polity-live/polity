import type { ParticipationUserLike } from '@/features/shared/types/participation';

export interface OfflineRosterConnectedUser {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  handle?: string | null;
  avatar?: string | null;
  email?: string | null;
}

export interface OfflineRosterGroupReference {
  id: string;
  name?: string | null;
}

export interface OfflineRosterRow {
  id: string;
  kind: 'active' | 'offline';
  effectiveMembershipId?: string | null;
  user?: ParticipationUserLike | null;
  firstName: string;
  lastName: string;
  isActiveUser: boolean;
  reasonNotSignedUp?: string | null;
  connectedUser?: OfflineRosterConnectedUser | null;
  roles?: readonly { id: string; name?: string | null }[] | null;
  partGroup?: OfflineRosterGroupReference | null;
  baseGroup?: OfflineRosterGroupReference | null;
  readOnlyIdentity?: boolean;
  canConnect?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canViewRights?: boolean;
  canManageRoles?: boolean;
  canConfirmParticipation?: boolean;
  canWithdrawParticipation?: boolean;
  canToggleChannel?: boolean;
  attendanceStatus?: 'listed' | 'confirmed' | null;
  participationChannel?: 'online' | 'offline' | null;
}

export type OfflineRosterCandidateUser = OfflineRosterConnectedUser;

export interface DraftRosterEntry {
  firstName: string;
  lastName: string;
  reasonNotSignedUp: string;
}

export interface OfflineRosterCardProps {
  title: string;
  description: string;
  rows: OfflineRosterRow[];
  connectedUserCandidates?: OfflineRosterCandidateUser[];
  showManageButton?: boolean;
  showProvenanceColumns?: boolean;
  manageButtonLabel?: string;
  tableVariant?: 'default' | 'membership';
  fallbackRoleLabel?: string;
  manageDialogTitle: string;
  manageDialogDescription: string;
  emptyStateLabel?: string;
  onCreate?: (entry: DraftRosterEntry, correlationId: string) => Promise<unknown>;
  onImport?: (entries: DraftRosterEntry[], correlationId: string) => Promise<unknown>;
  onConnect?: (row: OfflineRosterRow, userId: string, correlationId: string) => Promise<unknown>;
  onEdit?: (
    row: OfflineRosterRow,
    entry: DraftRosterEntry,
    correlationId: string
  ) => Promise<unknown>;
  onDelete?: (row: OfflineRosterRow, correlationId: string) => Promise<unknown>;
  onOpenRightsDialog?: (row: OfflineRosterRow) => void;
  onOpenChangeRoleDialog?: (row: OfflineRosterRow) => void;
  onSetParticipationStatus?: (
    row: OfflineRosterRow,
    nextStatus: 'listed' | 'confirmed',
    correlationId: string
  ) => Promise<unknown>;
  onToggleChannel?: (
    row: OfflineRosterRow,
    nextChannel: 'online' | 'offline',
    correlationId: string
  ) => Promise<unknown>;
}
