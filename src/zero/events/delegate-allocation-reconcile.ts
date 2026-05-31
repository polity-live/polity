import {
  calculateDelegateAllocations,
  calculateTotalDelegates,
} from '@/features/shared/utils/delegate-calculations';
import {
  resolveMembershipProvenance,
  supportsMembershipComposition,
  type MembershipCompositionGroupLike,
  type MembershipCompositionRelationshipLike,
  type MembershipWithCompositionSource,
} from '@/features/groups/logic/membershipComposition';
import { getMembershipDisplayRoles } from '@/features/groups/logic/buildMembershipRightsSummary';
import { mutators } from '../mutators';
import { zql } from '../schema';

type EventServerTx = Parameters<typeof mutators.events.create.fn>[0]['tx'];

interface MembershipRoleLinkLike {
  role?: {
    id: string;
    name?: string | null;
    sort_order?: number | null;
    action_rights?: readonly { resource?: string | null; action?: string | null }[] | null;
  } | null;
}

type NormalizedMembership = MembershipWithCompositionSource<{
  id: string;
  name?: string | null;
  sort_order?: number | null;
  action_rights?: readonly { resource?: string | null; action?: string | null }[] | null;
}>;

function selectPrimaryRole(roles: readonly NonNullable<NormalizedMembership['roles']>[number][]) {
  return (
    [...roles].sort((left, right) => (right.sort_order ?? -1) - (left.sort_order ?? -1))[0] ?? null
  );
}

function normalizeMemberships(
  memberships:
    | readonly (MembershipWithCompositionSource & {
        membership_roles?: readonly MembershipRoleLinkLike[] | null;
      })[]
    | null
    | undefined
): NormalizedMembership[] {
  return (memberships || []).map(membership => {
    const roles =
      membership.membership_roles
        ?.map(link => link.role)
        .filter((role): role is NonNullable<NormalizedMembership['roles']>[number] =>
          Boolean(role?.id)
        ) ?? [];

    return {
      ...membership,
      roles,
      role: selectPrimaryRole(roles),
    };
  });
}

function isActiveMembership(membership: NormalizedMembership) {
  const status = membership.status?.toLowerCase() || '';
  if (status === 'active' || status === 'admin' || status === 'member') {
    return true;
  }

  return getMembershipDisplayRoles(membership).some(
    role => (role.name || '').toLowerCase() === 'board member'
  );
}

async function loadNetworkRelationships(tx: EventServerTx) {
  return (await tx.run(
    zql.group_relationship.related('group').related('related_group')
  )) as MembershipCompositionRelationshipLike[];
}

async function loadGroupMemberships(tx: EventServerTx, groupIds: readonly string[]) {
  if (groupIds.length === 0) {
    return [] as NormalizedMembership[];
  }

  const memberships = await tx.run(
    zql.group_membership
      .where('group_id', 'IN', [...groupIds])
      .related('group')
      .related('source_group')
      .related('user')
      .related('membership_roles', query => query.related('role'))
  );

  return normalizeMemberships(memberships);
}

function getMembersPerDelegate(event: { main_group_delegate_allocation_mode?: string | null }) {
  const parsed = Number.parseInt(event.main_group_delegate_allocation_mode || '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 50;
  }

  return parsed;
}

function buildOpenGroupAllocations(args: {
  bucketRows: { partGroupId: string; memberCount: number }[];
  lockedSeatCountsByGroupId: Map<string, number>;
  totalSeatCount: number;
}) {
  const { bucketRows, lockedSeatCountsByGroupId, totalSeatCount } = args;
  const lockedSeatTotal = [...lockedSeatCountsByGroupId.values()].reduce(
    (sum, count) => sum + count,
    0
  );
  const remainingSeatCount = Math.max(0, totalSeatCount - lockedSeatTotal);
  const openBucketRows = bucketRows.filter(row => !lockedSeatCountsByGroupId.has(row.partGroupId));
  const dynamicAllocations =
    remainingSeatCount > 0
      ? calculateDelegateAllocations(
          openBucketRows.map(row => ({ id: row.partGroupId, memberCount: row.memberCount })),
          remainingSeatCount
        )
      : [];

  return new Map(
    dynamicAllocations.map(allocation => [allocation.groupId, allocation.allocatedDelegates])
  );
}

export async function reconcileDelegateAllocationsForEvent(tx: EventServerTx, eventId: string) {
  const event = await tx.run(zql.event.where('id', eventId).one());
  if (!event) {
    return { affectedGroupIds: [] as string[] };
  }

  if (event.event_type !== 'delegate_assembly' || !event.group_id) {
    const existingRows = await tx.run(zql.group_delegate_allocation.where('event_id', eventId));
    for (const existingRow of existingRows) {
      await tx.mutate.group_delegate_allocation.delete({ id: existingRow.id });
    }

    return { affectedGroupIds: [] as string[] };
  }

  const targetGroup = (await tx.run(
    zql.group.where('id', event.group_id).one()
  )) as MembershipCompositionGroupLike | null;

  if (!targetGroup || !supportsMembershipComposition(targetGroup)) {
    return { affectedGroupIds: [] as string[] };
  }

  const targetMemberships = (await loadGroupMemberships(tx, [targetGroup.id])).filter(
    isActiveMembership
  );
  const sourceGroupIds =
    targetGroup.group_type === 'sibling'
      ? [
          ...new Set(
            targetMemberships
              .map(membership => membership.source_group_id)
              .filter((groupId): groupId is string => Boolean(groupId))
          ),
        ]
      : [];
  const [relationships, rootMemberships, existingRows, confirmedDelegates] = await Promise.all([
    loadNetworkRelationships(tx),
    loadGroupMemberships(tx, sourceGroupIds),
    tx.run(zql.group_delegate_allocation.where('event_id', eventId)),
    tx.run(zql.event_delegate.where('event_id', eventId).where('status', 'confirmed')),
  ]);

  const membershipsWithProvenance = resolveMembershipProvenance({
    group: targetGroup,
    memberships: targetMemberships,
    relationships,
    rootMemberships: rootMemberships.filter(isActiveMembership),
  });

  const memberCountsByPartGroupId = new Map<string, number>();
  for (const membership of membershipsWithProvenance) {
    const partGroupId = membership.partGroup?.id;
    if (!partGroupId) {
      continue;
    }

    memberCountsByPartGroupId.set(
      partGroupId,
      (memberCountsByPartGroupId.get(partGroupId) ?? 0) + 1
    );
  }

  const bucketRows = [...memberCountsByPartGroupId.entries()].map(([partGroupId, memberCount]) => ({
    partGroupId,
    memberCount,
  }));

  const totalSeatCount =
    event.delegate_seat_allocation_type === 'fixed_total'
      ? Math.max(0, event.total_delegate_seats ?? 0)
      : calculateTotalDelegates(
          bucketRows.reduce((sum, bucketRow) => sum + bucketRow.memberCount, 0),
          getMembersPerDelegate(event)
        );

  const lockedSeatCountsByGroupId = new Map<string, number>();
  for (const delegate of confirmedDelegates) {
    if (!delegate.group_id) {
      continue;
    }

    lockedSeatCountsByGroupId.set(
      delegate.group_id,
      (lockedSeatCountsByGroupId.get(delegate.group_id) ?? 0) +
        Math.max(1, delegate.seat_count ?? 1)
    );
  }

  const openSeatCountsByGroupId = buildOpenGroupAllocations({
    bucketRows,
    lockedSeatCountsByGroupId,
    totalSeatCount,
  });

  const desiredSeatCountsByGroupId = new Map<string, number>();
  for (const bucketRow of bucketRows) {
    const lockedSeats = lockedSeatCountsByGroupId.get(bucketRow.partGroupId) ?? 0;
    const openSeats = openSeatCountsByGroupId.get(bucketRow.partGroupId) ?? 0;
    const desiredSeatCount = lockedSeats + openSeats;
    if (desiredSeatCount > 0) {
      desiredSeatCountsByGroupId.set(bucketRow.partGroupId, desiredSeatCount);
    }
  }

  const now = Date.now();
  const existingRowsByGroupId = new Map(
    existingRows.filter(row => row.group_id).map(row => [row.group_id as string, row])
  );

  for (const [groupId, allocatedSeats] of desiredSeatCountsByGroupId.entries()) {
    const existingRow = existingRowsByGroupId.get(groupId);
    if (existingRow) {
      if (existingRow.allocated_seats !== allocatedSeats) {
        await tx.mutate.group_delegate_allocation.update({
          id: existingRow.id,
          allocated_seats: allocatedSeats,
        });
      }
      existingRowsByGroupId.delete(groupId);
      continue;
    }

    await tx.mutate.group_delegate_allocation.insert({
      id: crypto.randomUUID(),
      event_id: eventId,
      group_id: groupId,
      allocated_seats: allocatedSeats,
      created_at: now,
    });
  }

  for (const staleRow of existingRowsByGroupId.values()) {
    await tx.mutate.group_delegate_allocation.delete({ id: staleRow.id });
  }

  await tx.mutate.event.update({
    id: event.id,
    delegate_count: totalSeatCount,
    delegate_distribution_method:
      event.delegate_seat_allocation_type === 'fixed_total'
        ? 'fixed_total'
        : 'members_per_delegate',
    delegate_distribution_status: event.delegate_finalized_at ? 'finalized' : 'synced',
    updated_at: now,
  });

  return { affectedGroupIds: [...desiredSeatCountsByGroupId.keys()] };
}

export async function reconcileDelegateAllocationsForGroups(
  tx: EventServerTx,
  groupIds: Iterable<string>
) {
  const uniqueGroupIds = [...new Set([...groupIds].filter(Boolean))];
  if (uniqueGroupIds.length === 0) {
    return;
  }

  const events = await tx.run(
    zql.event
      .where('event_type', 'delegate_assembly')
      .where('group_id', 'IN', uniqueGroupIds)
      .where('status', '!=', 'cancelled')
  );

  for (const event of events) {
    await reconcileDelegateAllocationsForEvent(tx, event.id);
  }
}
