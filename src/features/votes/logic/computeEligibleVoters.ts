/**
 * Pure functions for computing eligible voters from event participants.
 */

export interface EligibleVoter {
  id: string;
  name?: string;
  hasVoted: boolean;
}

export const ACTIVE_EVENT_PARTICIPANT_STATUSES = new Set([
  'active',
  'confirmed',
  'member',
  'admin',
]);

interface ActionRight {
  action: string | null;
  resource: string | null;
}

interface Role {
  action_rights?: readonly ActionRight[] | null;
}

interface ParticipantRoleLink {
  role?: Role | null;
}

interface Participant {
  status?: string | null;
  user_id?: string | null;
  role?: Role | null;
  roles?: readonly Role[] | null;
  participant_roles?: readonly ParticipantRoleLink[] | null;
  user?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    name?: string | null;
  } | null;
}

interface OfflineParticipant {
  id: string;
  connected_user_id?: string | null;
  attendance_status?: string | null;
  participation_channel?: string | null;
}

function getParticipantUserId(participant: Participant) {
  return participant.user?.id ?? participant.user_id ?? null;
}

function* getParticipantRoles(participant: Participant): Iterable<Role> {
  if (participant.roles?.length) {
    yield* participant.roles;
  }

  if (participant.role) {
    yield participant.role;
  }

  if (participant.participant_roles) {
    for (const roleLink of participant.participant_roles) {
      if (roleLink.role) {
        yield roleLink.role;
      }
    }
  }
}

export function participantHasActiveVotingRight(participant: Participant) {
  for (const role of getParticipantRoles(participant)) {
    if (
      role.action_rights?.some(
        actionRight => actionRight.action === 'active_voting' && actionRight.resource === 'events'
      )
    ) {
      return true;
    }
  }

  return false;
}

export function getHybridOfflineOverrideUserIds(
  offlineParticipants: readonly OfflineParticipant[] | null | undefined
) {
  const userIds = new Set<string>();

  if (!offlineParticipants) return userIds;

  for (const participant of offlineParticipants) {
    if (participant.connected_user_id && participant.participation_channel === 'offline') {
      userIds.add(participant.connected_user_id);
    }
  }

  return userIds;
}

export function countConfirmedOfflineAttendees(
  offlineParticipants: readonly OfflineParticipant[] | null | undefined
) {
  const personIds = new Set<string>();

  if (!offlineParticipants) return 0;

  for (const participant of offlineParticipants) {
    if (
      participant.attendance_status !== 'confirmed' ||
      participant.participation_channel !== 'offline'
    ) {
      continue;
    }

    if (participant.connected_user_id) {
      personIds.add(`user:${participant.connected_user_id}`);
    } else {
      personIds.add(`offline:${participant.id}`);
    }
  }

  return personIds.size;
}

export function computeEligibleFinalVoterCount({
  participants,
  offlineParticipants,
}: {
  participants: readonly Participant[] | null | undefined;
  offlineParticipants?: readonly OfflineParticipant[] | null;
}) {
  const forcedOfflineUserIds = getHybridOfflineOverrideUserIds(offlineParticipants);
  const eligibleOnlineUserIds = new Set<string>();

  if (!participants) return countConfirmedOfflineAttendees(offlineParticipants);

  for (const participant of participants) {
    const userId = getParticipantUserId(participant);
    if (
      userId &&
      participant.status &&
      ACTIVE_EVENT_PARTICIPANT_STATUSES.has(participant.status) &&
      !forcedOfflineUserIds.has(userId) &&
      participantHasActiveVotingRight(participant)
    ) {
      eligibleOnlineUserIds.add(userId);
    }
  }

  return eligibleOnlineUserIds.size + countConfirmedOfflineAttendees(offlineParticipants);
}

export function computeEligibleVoters(
  participants: readonly Participant[],
  votedUserIds: Set<string>
): EligibleVoter[] {
  const voters: EligibleVoter[] = [];

  for (const participant of participants) {
    if (participantHasActiveVotingRight(participant) && participant.user) {
      voters.push({
        id: participant.user.id,
        name:
          (participant.user.name ??
            `${participant.user.first_name ?? ''} ${participant.user.last_name ?? ''}`.trim()) ||
          undefined,
        hasVoted: votedUserIds.has(participant.user.id),
      });
    }
  }

  return voters;
}
