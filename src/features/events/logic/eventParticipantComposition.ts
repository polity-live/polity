import {
  buildMembershipCompositionBuckets,
  supportsMembershipComposition,
  type MembershipCompositionGroupLike,
  type MembershipProvenanceFields,
  type MembershipWithCompositionSource,
} from '@/features/groups/logic/membershipComposition';
import type {
  ParticipationGroupLike,
  ParticipationLike,
  ParticipationProvenanceGroupLike,
} from '@/features/shared/types/participation';

interface EventParticipantCompositionDelegateLike {
  user_id?: string | null;
  group_id?: string | null;
  group?: MembershipCompositionGroupLike | null;
}

interface EventParticipantCompositionGroupMembershipLike extends MembershipWithCompositionSource {
  status?: string | null;
}

interface EventParticipantCompositionGroupLike extends MembershipCompositionGroupLike {
  memberships?: readonly EventParticipantCompositionGroupMembershipLike[] | null;
}

export interface EventParticipantCompositionEventLike {
  event_type?: string | null;
  group?: EventParticipantCompositionGroupLike | null;
  delegates?: readonly EventParticipantCompositionDelegateLike[] | null;
}

export type EventParticipantWithCompositionProvenance<TParticipant extends ParticipationLike> =
  TParticipant &
    MembershipWithCompositionSource &
    MembershipProvenanceFields & {
      __eventParticipantHasCompositionProvenance?: boolean;
    };

type EventCompositionBucketParticipant = Pick<
  ParticipationLike,
  'partGroup' | 'baseGroup' | 'provenanceBucketLabel' | 'roles' | 'role'
>;

interface EventParticipantCompositionBucketOptions {
  missingProvenanceLabel?: string;
}

interface EventParticipantCompositionSourceResult<TParticipant extends ParticipationLike> {
  isDelegateAssembly: boolean;
  shouldResolveGroupComposition: boolean;
  hasGroupBackedComposition: boolean;
  participants: EventParticipantWithCompositionProvenance<TParticipant>[];
}

export function buildEventParticipantCompositionSources<
  TParticipant extends ParticipationLike,
  TEvent extends EventParticipantCompositionEventLike,
>(
  event: TEvent | null | undefined,
  participants: readonly TParticipant[]
): EventParticipantCompositionSourceResult<TParticipant> {
  const isDelegateAssembly = event?.event_type === 'delegate_assembly';
  const group = event?.group ?? null;

  if (isDelegateAssembly) {
    return buildDelegateAssemblyCompositionSources(group, event?.delegates ?? [], participants);
  }

  if (!group) {
    return {
      isDelegateAssembly,
      shouldResolveGroupComposition: false,
      hasGroupBackedComposition: false,
      participants: participants.map(createParticipantWithoutCompositionProvenance),
    };
  }

  const membershipsByUserId = buildEventGroupMembershipsByUserId(group.memberships ?? []);
  const participantsWithSources = participants.map(participant => {
    const userId = getParticipantUserId(participant);
    const matchedMembership = userId ? membershipsByUserId.get(userId) : undefined;

    if (!matchedMembership) {
      if (group.group_type === 'base') {
        const participantWithSource = participant as TParticipant &
          Partial<MembershipWithCompositionSource>;
        const directGroup = toProvenanceGroup(group);
        return {
          ...participant,
          group_id: participant.group_id ?? group.id,
          group: participant.group ?? group,
          part_group_id: participantWithSource.part_group_id ?? group.id,
          base_group_id: participantWithSource.base_group_id ?? group.id,
          part_group: participantWithSource.part_group ?? group,
          base_group: participantWithSource.base_group ?? group,
          partGroup: directGroup,
          baseGroup: directGroup,
          provenanceBucketLabel: null,
          __eventParticipantHasCompositionProvenance: true,
        } as EventParticipantWithCompositionProvenance<TParticipant>;
      }

      return createParticipantWithoutCompositionProvenance(participant);
    }

    return applyMatchedMembershipProvenance(participant, matchedMembership, group);
  });

  const hasGroupBackedComposition = participantsWithSources.some(
    participant => participant.__eventParticipantHasCompositionProvenance
  );

  return {
    isDelegateAssembly,
    shouldResolveGroupComposition: supportsMembershipComposition(group),
    hasGroupBackedComposition,
    participants: participantsWithSources,
  };
}

export function buildEventParticipantCompositionBuckets<
  TParticipant extends EventCompositionBucketParticipant,
>(participants: readonly TParticipant[], options: EventParticipantCompositionBucketOptions = {}) {
  const missingProvenanceLabel = options.missingProvenanceLabel ?? 'No base group';

  return buildMembershipCompositionBuckets(
    participants.map(participant => {
      if (participant.partGroup || participant.provenanceBucketLabel) {
        return participant;
      }

      if (participant.baseGroup) {
        return {
          ...participant,
          partGroup: participant.baseGroup,
        };
      }

      return {
        ...participant,
        provenanceBucketLabel: missingProvenanceLabel,
      };
    })
  );
}

export function maskUnmatchedEventParticipantComposition<TParticipant extends ParticipationLike>(
  participants: readonly EventParticipantWithCompositionProvenance<TParticipant>[]
): EventParticipantWithCompositionProvenance<TParticipant>[] {
  return participants.map(participant => {
    if (participant.__eventParticipantHasCompositionProvenance) {
      return participant;
    }

    return {
      ...participant,
      partGroup: null,
      baseGroup: null,
      provenanceBucketLabel: null,
    };
  });
}

function buildDelegateAssemblyCompositionSources<TParticipant extends ParticipationLike>(
  group: EventParticipantCompositionGroupLike | null,
  delegates: readonly EventParticipantCompositionDelegateLike[],
  participants: readonly TParticipant[]
): EventParticipantCompositionSourceResult<TParticipant> {
  const delegateByUserId = new Map<string, EventParticipantCompositionDelegateLike>();

  for (const delegate of delegates) {
    if (!delegate.user_id || !delegate.group_id) {
      continue;
    }

    delegateByUserId.set(delegate.user_id, delegate);
  }

  const participantsWithSources = participants.map(participant => {
    const userId = getParticipantUserId(participant);
    const delegate = userId ? delegateByUserId.get(userId) : undefined;

    if (!delegate?.group_id) {
      return createParticipantWithoutCompositionProvenance(participant);
    }

    return {
      ...participant,
      source_group_id: delegate.group_id,
      source_group: delegate.group ?? participant.source_group ?? null,
      __eventParticipantHasCompositionProvenance: true,
      partGroup: participant.partGroup ?? null,
      baseGroup: participant.baseGroup ?? null,
      provenanceBucketLabel: participant.provenanceBucketLabel ?? null,
    } as EventParticipantWithCompositionProvenance<TParticipant>;
  });

  return {
    isDelegateAssembly: true,
    shouldResolveGroupComposition: supportsMembershipComposition(group),
    hasGroupBackedComposition: participantsWithSources.some(
      participant => participant.__eventParticipantHasCompositionProvenance
    ),
    participants: participantsWithSources,
  };
}

function applyMatchedMembershipProvenance<TParticipant extends ParticipationLike>(
  participant: TParticipant,
  membership: EventParticipantCompositionGroupMembershipLike,
  eventGroup: EventParticipantCompositionGroupLike
): EventParticipantWithCompositionProvenance<TParticipant> {
  const participantWithSource = participant as TParticipant &
    Partial<MembershipWithCompositionSource>;
  const sourceGroup = resolveMembershipGroupReference(membership, 'sourceGroup');
  const partGroup = resolveMembershipGroupReference(membership, 'partGroup') ?? sourceGroup;
  const baseGroup = resolveMembershipGroupReference(membership, 'baseGroup') ?? sourceGroup;
  const fallbackGroup = eventGroup.group_type === 'base' ? toProvenanceGroup(eventGroup) : null;
  const resolvedPartGroup = partGroup ?? fallbackGroup;
  const resolvedBaseGroup = baseGroup ?? fallbackGroup;

  return {
    ...participant,
    group_id: participant.group_id ?? membership.group_id ?? eventGroup.id,
    group: participant.group ?? membership.group ?? eventGroup,
    source_group_id: participant.source_group_id ?? membership.source_group_id ?? null,
    source_group: participant.source_group ?? membership.source_group ?? null,
    part_group_id:
      participantWithSource.part_group_id ??
      membership.part_group_id ??
      membership.origins?.[0]?.part_group_id ??
      resolvedPartGroup?.id ??
      null,
    base_group_id:
      participantWithSource.base_group_id ??
      membership.base_group_id ??
      membership.origins?.[0]?.base_group_id ??
      resolvedBaseGroup?.id ??
      null,
    part_group:
      participantWithSource.part_group ??
      membership.part_group ??
      membership.origins?.[0]?.part_group ??
      null,
    base_group:
      participantWithSource.base_group ??
      membership.base_group ??
      membership.origins?.[0]?.base_group ??
      null,
    origins: participantWithSource.origins ?? membership.origins ?? null,
    partGroup: participant.partGroup ?? resolvedPartGroup,
    baseGroup: participant.baseGroup ?? resolvedBaseGroup,
    provenanceBucketLabel: participant.provenanceBucketLabel ?? null,
    __eventParticipantHasCompositionProvenance: Boolean(resolvedPartGroup || resolvedBaseGroup),
  } as EventParticipantWithCompositionProvenance<TParticipant>;
}

function buildEventGroupMembershipsByUserId(
  memberships: readonly EventParticipantCompositionGroupMembershipLike[]
) {
  const membershipsByUserId = new Map<string, EventParticipantCompositionGroupMembershipLike>();

  for (const membership of memberships) {
    const userId = getParticipantUserId(membership);
    if (!userId) {
      continue;
    }

    const currentMembership = membershipsByUserId.get(userId);
    if (
      !currentMembership ||
      compareMembershipProvenancePriority(membership, currentMembership) < 0
    ) {
      membershipsByUserId.set(userId, membership);
    }
  }

  return membershipsByUserId;
}

function compareMembershipProvenancePriority(
  left: EventParticipantCompositionGroupMembershipLike,
  right: EventParticipantCompositionGroupMembershipLike
) {
  return getMembershipProvenancePriority(left) - getMembershipProvenancePriority(right);
}

function getMembershipProvenancePriority(
  membership: EventParticipantCompositionGroupMembershipLike
) {
  const activeOffset = isActiveMembership(membership) ? 0 : 10;
  const hasExplicitProvenance =
    membership.part_group_id ||
    membership.base_group_id ||
    membership.source_group_id ||
    membership.origins?.[0]?.part_group_id ||
    membership.origins?.[0]?.base_group_id;

  return activeOffset + (hasExplicitProvenance ? 0 : 1);
}

function isActiveMembership(membership: EventParticipantCompositionGroupMembershipLike) {
  const status = membership.status?.toLowerCase();
  return status === 'active' || status === 'member' || status === 'admin' || status === 'confirmed';
}

function resolveMembershipGroupReference(
  membership: EventParticipantCompositionGroupMembershipLike,
  kind: 'sourceGroup' | 'partGroup' | 'baseGroup'
): ParticipationProvenanceGroupLike | null {
  const origin = membership.origins?.[0] ?? null;

  switch (kind) {
    case 'sourceGroup':
      return toProvenanceGroup(membership.source_group, membership.source_group_id);
    case 'partGroup':
      return toProvenanceGroup(
        membership.part_group ?? origin?.part_group,
        membership.part_group_id ?? origin?.part_group_id
      );
    case 'baseGroup':
      return toProvenanceGroup(
        membership.base_group ?? origin?.base_group,
        membership.base_group_id ?? origin?.base_group_id
      );
  }
}

function createParticipantWithoutCompositionProvenance<TParticipant extends ParticipationLike>(
  participant: TParticipant
): EventParticipantWithCompositionProvenance<TParticipant> {
  return {
    ...participant,
    partGroup: participant.partGroup ?? null,
    baseGroup: participant.baseGroup ?? null,
    provenanceBucketLabel: participant.provenanceBucketLabel ?? null,
    __eventParticipantHasCompositionProvenance: Boolean(
      participant.partGroup || participant.baseGroup || participant.provenanceBucketLabel
    ),
  } as EventParticipantWithCompositionProvenance<TParticipant>;
}

function toProvenanceGroup(
  group: ParticipationGroupLike | MembershipCompositionGroupLike | null | undefined,
  fallbackId?: string | null
): ParticipationProvenanceGroupLike | null {
  const id = group?.id ?? fallbackId;
  if (!id) {
    return null;
  }

  return {
    id,
    name: group?.name || id,
    group_type: group?.group_type ?? null,
  };
}

function getParticipantUserId(participant: ParticipationLike) {
  return participant.user_id || participant.user?.id || null;
}
