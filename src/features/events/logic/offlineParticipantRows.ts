import type {
  OfflineRosterConnectedUser,
  OfflineRosterGroupReference,
  OfflineRosterRow,
} from '@/features/offline-roster/types';
import type { ParticipationUserLike } from '@/features/shared/types/participation';

export type EventAttendanceMode = 'online' | 'hybrid' | 'offline';

interface ActiveParticipantLike {
  id: string;
  user_id?: string | null;
  user?: ParticipationUserLike | null;
  roles?: readonly { id: string; name?: string | null }[] | null;
  partGroup?: unknown;
  baseGroup?: unknown;
}

interface OfflineParticipantLike {
  id: string;
  first_name: string;
  last_name: string;
  reason_not_signed_up?: string | null;
  source_type?: string | null;
  attendance_status?: string | null;
  participation_channel?: string | null;
  connected_user_id?: string | null;
  connected_user?: OfflineRosterConnectedUser | null;
  group_offline_member?: {
    group?: {
      id?: string | null;
      name?: string | null;
    } | null;
  } | null;
}

function normalizeGroupReference(value: unknown): OfflineRosterGroupReference | null {
  if (!value || typeof value !== 'object' || !('id' in value)) {
    return null;
  }

  const id = (value as { id?: unknown }).id;
  if (typeof id !== 'string' || !id) {
    return null;
  }

  const name = (value as { name?: unknown }).name;
  return {
    id,
    name: typeof name === 'string' ? name : null,
  };
}

function getUserId(participant: ActiveParticipantLike) {
  return participant.user_id ?? participant.user?.id ?? null;
}

function getUserFirstName(user?: ParticipationUserLike | null) {
  return user?.first_name || '';
}

function getUserLastName(user?: ParticipationUserLike | null) {
  return user?.last_name || '';
}

function getActiveAttendanceStatus(
  attendanceMode: EventAttendanceMode,
  offlineParticipant?: OfflineParticipantLike | null
): 'listed' | 'confirmed' | null {
  if (offlineParticipant) {
    if (attendanceMode === 'hybrid' && offlineParticipant.participation_channel !== 'offline') {
      return 'confirmed';
    }

    return offlineParticipant.attendance_status === 'confirmed' ? 'confirmed' : 'listed';
  }

  if (attendanceMode === 'hybrid') {
    return 'confirmed';
  }

  if (attendanceMode === 'offline') {
    return 'listed';
  }

  return null;
}

function getActiveParticipationChannel(
  attendanceMode: EventAttendanceMode,
  offlineParticipant?: OfflineParticipantLike | null
): 'online' | 'offline' | null {
  if (offlineParticipant) {
    return offlineParticipant.participation_channel === 'offline' ? 'offline' : 'online';
  }

  if (attendanceMode === 'hybrid') {
    return 'online';
  }

  if (attendanceMode === 'offline') {
    return 'offline';
  }

  return null;
}

function buildProvenanceGroup(args: {
  offlineParticipant: OfflineParticipantLike;
  eventBaseGroupReference?: OfflineRosterGroupReference | null;
}) {
  return (
    normalizeGroupReference(args.offlineParticipant.group_offline_member?.group) ??
    args.eventBaseGroupReference ??
    null
  );
}

export function buildOfflineRosterRowsForEvent(args: {
  attendanceMode: EventAttendanceMode;
  activeParticipants: readonly ActiveParticipantLike[];
  offlineParticipants: readonly OfflineParticipantLike[];
  eventBaseGroupReference?: OfflineRosterGroupReference | null;
  showParticipantComposition?: boolean;
  showBaseGroupColumn?: boolean;
}) {
  const offlineParticipantByConnectedUserId = new Map<string, OfflineParticipantLike>();
  for (const offlineParticipant of args.offlineParticipants) {
    if (
      offlineParticipant.connected_user_id &&
      !offlineParticipantByConnectedUserId.has(offlineParticipant.connected_user_id)
    ) {
      offlineParticipantByConnectedUserId.set(
        offlineParticipant.connected_user_id,
        offlineParticipant
      );
    }
  }

  const activeUserIds = new Set(
    args.activeParticipants.map(getUserId).filter((userId): userId is string => Boolean(userId))
  );

  const activeRows = args.activeParticipants.map<OfflineRosterRow>(participant => {
    const userId = getUserId(participant);
    const offlineParticipant = userId
      ? (offlineParticipantByConnectedUserId.get(userId) ?? null)
      : null;
    const attendanceStatus = getActiveAttendanceStatus(args.attendanceMode, offlineParticipant);
    const participationChannel = getActiveParticipationChannel(
      args.attendanceMode,
      offlineParticipant
    );
    const isOfflineChannel = participationChannel === 'offline';

    return {
      id: `active:${participant.id}`,
      kind: 'active',
      attendanceParticipantId: offlineParticipant?.id ?? null,
      user: participant.user ?? null,
      firstName: getUserFirstName(participant.user),
      lastName: getUserLastName(participant.user),
      isActiveUser: true,
      connectedUser: null,
      reasonNotSignedUp: null,
      roles: participant.roles ?? null,
      partGroup: args.showParticipantComposition
        ? normalizeGroupReference(participant.partGroup)
        : null,
      baseGroup: args.showBaseGroupColumn ? normalizeGroupReference(participant.baseGroup) : null,
      canConfirmParticipation:
        args.attendanceMode !== 'online' && isOfflineChannel && attendanceStatus !== 'confirmed',
      canWithdrawParticipation:
        args.attendanceMode !== 'online' && isOfflineChannel && attendanceStatus === 'confirmed',
      canToggleChannel: args.attendanceMode === 'hybrid' && Boolean(offlineParticipant),
      attendanceStatus,
      participationChannel,
    };
  });

  const offlineRows = args.offlineParticipants
    .filter(
      offlineParticipant =>
        !offlineParticipant.connected_user_id ||
        !activeUserIds.has(offlineParticipant.connected_user_id)
    )
    .map<OfflineRosterRow>(offlineParticipant => {
      const provenanceGroup = buildProvenanceGroup({
        offlineParticipant,
        eventBaseGroupReference: args.eventBaseGroupReference,
      });

      return {
        id: offlineParticipant.id,
        kind: 'offline',
        attendanceParticipantId: offlineParticipant.id,
        firstName: offlineParticipant.first_name,
        lastName: offlineParticipant.last_name,
        isActiveUser: false,
        reasonNotSignedUp: offlineParticipant.reason_not_signed_up,
        connectedUser: offlineParticipant.connected_user ?? null,
        partGroup:
          args.showParticipantComposition || args.showBaseGroupColumn ? provenanceGroup : null,
        baseGroup: args.showBaseGroupColumn ? provenanceGroup : null,
        readOnlyIdentity: offlineParticipant.source_type === 'group_member',
        canConnect: offlineParticipant.source_type === 'event_extra',
        canEdit: offlineParticipant.source_type === 'event_extra',
        canDelete: offlineParticipant.source_type === 'event_extra',
        canConfirmParticipation: offlineParticipant.attendance_status !== 'confirmed',
        canWithdrawParticipation: offlineParticipant.attendance_status === 'confirmed',
        canToggleChannel:
          args.attendanceMode === 'hybrid' && Boolean(offlineParticipant.connected_user_id),
        attendanceStatus:
          offlineParticipant.attendance_status === 'confirmed' ? 'confirmed' : 'listed',
        participationChannel:
          offlineParticipant.participation_channel === 'online' ? 'online' : 'offline',
      };
    });

  return {
    activeRows,
    offlineRows,
    allRows: [...activeRows, ...offlineRows],
  };
}
