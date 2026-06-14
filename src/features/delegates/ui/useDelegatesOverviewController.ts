import { useEventDelegates } from '@/zero/events/useEventState';
interface DelegatesOverviewProps {
  eventId: string;
  groupId?: string;
}

export function useDelegatesOverviewController({ eventId, groupId }: DelegatesOverviewProps) {
  void groupId;

  const { event } = useEventDelegates(eventId, groupId);

  const delegates = event?.delegates || [];

  const allocations = event?.delegate_allocations || [];

  const groupsById = new Map<string, { id: string; name: string; memberCount: number }>();

  for (const allocation of allocations) {
    if (!allocation.group?.id) continue;
    groupsById.set(allocation.group.id, {
      id: allocation.group.id,
      name: allocation.group.name || 'Untergruppe',
      memberCount: allocation.group.member_count ?? 0,
    });
  }

  for (const delegate of delegates) {
    if (!delegate.group?.id) continue;
    groupsById.set(delegate.group.id, {
      id: delegate.group.id,
      name: delegate.group.name || 'Untergruppe',
      memberCount: delegate.group.member_count ?? 0,
    });
  }

  const subgroups = [...groupsById.values()].sort((left, right) =>
    left.name.localeCompare(right.name)
  );

  // Group delegates by subgroup
  const delegatesByGroup = subgroups.map(subgroup => {
    const allocation = allocations.find(a => a.group_id === subgroup.id);
    const groupDelegates = delegates.filter(d => d.group_id === subgroup.id);

    const confirmedDelegates = groupDelegates.filter(d => d.status === 'confirmed');
    const nominatedDelegates = groupDelegates.filter(d => d.status === 'nominated');
    const standbyDelegates = groupDelegates.filter(d => d.status === 'standby');

    return {
      subgroup,
      allocation: allocation?.allocated_seats || 0,
      delegates: groupDelegates,
      confirmedDelegates,
      nominatedDelegates,
      standbyDelegates,
    };
  });

  const isDelegatesFinalized = event?.delegate_finalized_at;

  return {
    eventId,
    groupId,
    event,
    delegates,
    allocations,
    groupsById,
    subgroups,
    delegatesByGroup,
    isDelegatesFinalized,
  };
}
