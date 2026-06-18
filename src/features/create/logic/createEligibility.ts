const ACTIVE_PARTICIPATION_STATUSES = new Set(['active', 'admin', 'member', 'confirmed']);

interface EventLike {
  id?: string | null;
  group_id?: string | null;
}

interface EventParticipationLike {
  status?: string | null;
  event_id?: string | null;
  event?: EventLike | null;
}

interface ElectionLike {
  agenda_item?: {
    event_id?: string | null;
    event?: EventLike | null;
  } | null;
}

export function isActiveCreateParticipationStatus(status: string | null | undefined) {
  return ACTIVE_PARTICIPATION_STATUSES.has(status ?? '');
}

export function getParticipatingEventIds(participations: readonly EventParticipationLike[]) {
  const eventIds = new Set<string>();

  for (const participation of participations) {
    if (!isActiveCreateParticipationStatus(participation.status)) {
      continue;
    }

    const eventId = participation.event?.id ?? participation.event_id;
    if (eventId) {
      eventIds.add(eventId);
    }
  }

  return eventIds;
}

export function isCreateSelectableEvent(
  event: EventLike,
  activeGroupIds: ReadonlySet<string>,
  participatingEventIds: ReadonlySet<string>
) {
  if (!event.id) {
    return false;
  }

  return (
    participatingEventIds.has(event.id) ||
    (event.group_id ? activeGroupIds.has(event.group_id) : false)
  );
}

export function getCreateSelectableEventIds(
  events: readonly EventLike[],
  activeGroupIds: ReadonlySet<string>,
  participations: readonly EventParticipationLike[]
) {
  const participatingEventIds = getParticipatingEventIds(participations);

  return new Set(
    events
      .filter(event => isCreateSelectableEvent(event, activeGroupIds, participatingEventIds))
      .map(event => event.id)
      .filter((eventId): eventId is string => Boolean(eventId))
  );
}

export function getElectionEventId(election: ElectionLike) {
  return election.agenda_item?.event?.id ?? election.agenda_item?.event_id ?? null;
}

export function isCreateSelectableElection(
  election: ElectionLike,
  selectableEventIds: ReadonlySet<string>
) {
  const eventId = getElectionEventId(election);
  return eventId ? selectableEventIds.has(eventId) : false;
}
