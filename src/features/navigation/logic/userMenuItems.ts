interface RoleLike {
  id?: string | null;
}

interface RoleLinkLike<TRole extends RoleLike = RoleLike> {
  role?: TRole | null;
}

interface UserMenuGroupSource<TRole extends RoleLike = RoleLike> {
  status?: string | null;
  group?: {
    id?: string | null;
    name?: string | null;
    image_url?: string | null;
  } | null;
  role?: TRole | null;
  roles?: readonly TRole[] | null;
  membership_roles?: readonly RoleLinkLike<TRole>[] | null;
}

interface UserMenuEventSource<TRole extends RoleLike = RoleLike> {
  id?: string | null;
  status?: string | null;
  instance_date?: number | null;
  event?: {
    id?: string | null;
    title?: string | null;
    status?: string | null;
    start_date?: number | null;
    end_date?: number | null;
    location_name?: string | null;
    city?: string | null;
    group?: {
      id?: string | null;
      name?: string | null;
    } | null;
  } | null;
  role?: TRole | null;
  roles?: readonly TRole[] | null;
  participant_roles?: readonly RoleLinkLike<TRole>[] | null;
}

export interface UserMenuGroup {
  id: string;
  name?: string | null;
  image_url?: string | null;
}

export interface UserMenuEvent {
  key: string;
  id: string;
  title?: string | null;
  start_date: number;
  end_date?: number | null;
  groupName?: string | null;
  locationName?: string | null;
}

const ACTIVE_GROUP_MEMBERSHIP_STATUSES = new Set(['active', 'member', 'admin']);
const ACTIVE_EVENT_PARTICIPANT_STATUSES = new Set(['active', 'member', 'admin', 'confirmed']);

function hasAssignedRole<TRole extends RoleLike>(source: {
  role?: TRole | null;
  roles?: readonly TRole[] | null;
  membership_roles?: readonly RoleLinkLike<TRole>[] | null;
  participant_roles?: readonly RoleLinkLike<TRole>[] | null;
}) {
  return Boolean(
    source.role ||
    (source.roles?.length ?? 0) > 0 ||
    source.membership_roles?.some(link => Boolean(link.role)) ||
    source.participant_roles?.some(link => Boolean(link.role))
  );
}

function normalizeTimestamp(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getParticipationStartDate(participation: UserMenuEventSource) {
  return (
    normalizeTimestamp(participation.instance_date) ??
    normalizeTimestamp(participation.event?.start_date)
  );
}

function getParticipationEndDate(participation: UserMenuEventSource, startDate: number) {
  const eventStartDate = normalizeTimestamp(participation.event?.start_date);
  const eventEndDate = normalizeTimestamp(participation.event?.end_date);
  const instanceDate = normalizeTimestamp(participation.instance_date);

  if (instanceDate !== null && eventStartDate !== null && eventEndDate !== null) {
    const duration = eventEndDate - eventStartDate;
    return duration > 0 ? startDate + duration : startDate;
  }

  return eventEndDate;
}

export function buildUserMenuGroups(memberships: readonly UserMenuGroupSource[]) {
  const groupsById = new Map<string, UserMenuGroup>();

  for (const membership of memberships) {
    const group = membership.group;
    if (
      !group?.id ||
      !ACTIVE_GROUP_MEMBERSHIP_STATUSES.has(membership.status ?? '') ||
      !hasAssignedRole(membership)
    ) {
      continue;
    }

    groupsById.set(group.id, {
      id: group.id,
      name: group.name,
      image_url: group.image_url,
    });
  }

  return [...groupsById.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

function compareUserMenuEventsByTitle(a: UserMenuEvent, b: UserMenuEvent) {
  const titleComparison = (a.title || '').localeCompare(b.title || '');
  return titleComparison === 0 ? a.start_date - b.start_date : titleComparison;
}

export function buildUserMenuEvents(
  participations: readonly UserMenuEventSource[],
  now = Date.now()
) {
  const eventsByKey = new Map<string, UserMenuEvent>();

  for (const participation of participations) {
    const event = participation.event;
    const startDate = getParticipationStartDate(participation);
    if (
      !event?.id ||
      event.status === 'cancelled' ||
      startDate === null ||
      !ACTIVE_EVENT_PARTICIPANT_STATUSES.has(participation.status ?? '') ||
      !hasAssignedRole(participation)
    ) {
      continue;
    }

    const endDate = getParticipationEndDate(participation, startDate);
    if ((endDate ?? startDate) < now) {
      continue;
    }

    const key = `${event.id}:${participation.instance_date ?? participation.id ?? 'base'}`;
    eventsByKey.set(key, {
      key,
      id: event.id,
      title: event.title,
      start_date: startDate,
      end_date: endDate,
      groupName: event.group?.name,
      locationName: event.location_name ?? event.city,
    });
  }

  return [...eventsByKey.values()].sort(compareUserMenuEventsByTitle);
}
