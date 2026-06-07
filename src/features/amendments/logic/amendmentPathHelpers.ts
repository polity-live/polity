import type {
  NetworkGroupRow,
  NetworkGroupRelationshipRow,
  NetworkGroupMembershipRow,
  NetworkEventRow,
} from '@/zero/amendments/queries';
import { richTextToPlainText } from '@/features/shared/logic/richText';

export type { NetworkGroupRow as AmendmentNetworkGroup };
export type { NetworkGroupRelationshipRow as AmendmentNetworkRelationship };
export type { NetworkGroupMembershipRow as AmendmentNetworkMembership };
export type { NetworkEventRow as AmendmentNetworkEvent };

export interface PathWithEventSegment {
  groupId: string;
  groupName: string;
  eventId: string | null;
  eventTitle: string;
  eventStartDate: number | null;
  workflowStepId?: string | null;
  stepKind?: 'group_vote' | 'merge_vote' | 'workflow_handoff';
  selectionMode?: 'default_target_workflow' | 'explicit_workflow' | null;
  mergeStrategy?: 'winner_continues' | null;
  eventRule?: string | null;
  autoTaskOnMissingEvent?: boolean;
  targetWorkflowId?: string | null;
  requiredAfter?: number | null;
  requiredBefore?: number | null;
  missingEvent?: boolean;
}

export interface EnrichedPathSegment extends PathWithEventSegment {
  agendaItemId: string | null;
  amendmentVoteId: string | null;
  forwardingStatus: string;
}

interface BuildPathInput {
  sourceGroupId: string;
  targetGroupId: string;
  groups: NetworkGroupRow[];
  relationships: NetworkGroupRelationshipRow[];
  events: NetworkEventRow[];
  memberships?: NetworkGroupMembershipRow[];
  userId?: string;
}

const AMENDMENT_RIGHT = 'amendmentRight';

function isActiveMembershipStatus(status?: string | null) {
  return status === 'active' || status === 'admin' || status === 'member';
}

function getGroupName(group?: Pick<NetworkGroupRow, 'name' | 'description'> | null) {
  return group?.name ?? richTextToPlainText(group?.description) ?? 'Unknown';
}

function buildGroupsById(groups: NetworkGroupRow[]) {
  return new Map(groups.map(group => [group.id, group]));
}

function buildUpcomingEventsByGroupId(events: NetworkEventRow[]) {
  const now = Date.now();
  const eventsByGroupId = new Map<string, NetworkEventRow[]>();

  for (const event of events) {
    const groupId = event.group?.id ?? event.group_id ?? null;
    if (!groupId || (event.start_date ?? 0) <= now) {
      continue;
    }

    const existingEvents = eventsByGroupId.get(groupId) ?? [];
    existingEvents.push(event);
    eventsByGroupId.set(groupId, existingEvents);
  }

  for (const [groupId, groupEvents] of eventsByGroupId.entries()) {
    eventsByGroupId.set(
      groupId,
      [...groupEvents].sort((left, right) => (left.start_date ?? 0) - (right.start_date ?? 0))
    );
  }

  return eventsByGroupId;
}

function buildUserRoleIdsByGroupId(memberships: NetworkGroupMembershipRow[], userId?: string) {
  const roleIdsByGroupId = new Map<string, Set<string>>();

  for (const membership of memberships) {
    const groupId = membership.group?.id ?? null;
    if (
      !groupId ||
      !isActiveMembershipStatus(membership.status) ||
      membership.user?.id !== userId
    ) {
      continue;
    }

    const roleIds = roleIdsByGroupId.get(groupId) ?? new Set<string>();
    for (const roleLink of membership.membership_roles ?? []) {
      if (roleLink.role?.id) {
        roleIds.add(roleLink.role.id);
      }
    }
    roleIdsByGroupId.set(groupId, roleIds);
  }

  return roleIdsByGroupId;
}

function canTraverseRelationship(args: {
  relationship: NetworkGroupRelationshipRow;
  sourceGroupId: string;
  userRoleIdsByGroupId: Map<string, Set<string>>;
}) {
  const { relationship, sourceGroupId, userRoleIdsByGroupId } = args;

  if (relationship.with_right !== AMENDMENT_RIGHT) {
    return false;
  }

  switch (relationship.membership_mode) {
    case 'role_members':
      return relationship.membership_role_id
        ? (userRoleIdsByGroupId.get(relationship.group_id)?.has(relationship.membership_role_id) ??
            false)
        : false;
    case 'selected_source_groups':
      return (
        !relationship.membership_source_group_ids?.length ||
        relationship.membership_source_group_ids.includes(sourceGroupId)
      );
    case 'all_members':
    case 'none':
    default:
      return true;
  }
}

function findShortestProcessPath(args: BuildPathInput) {
  const { sourceGroupId, targetGroupId, relationships, memberships = [], userId } = args;
  const userRoleIdsByGroupId = buildUserRoleIdsByGroupId(memberships, userId);
  const queue: string[][] = [[sourceGroupId]];
  const visited = new Set<string>([sourceGroupId]);

  while (queue.length > 0) {
    const currentPath = queue.shift();
    if (!currentPath) {
      break;
    }

    const currentGroupId = currentPath[currentPath.length - 1];
    if (currentGroupId === targetGroupId) {
      return currentPath;
    }

    const nextRelationships = relationships.filter(
      relationship =>
        relationship.group_id === currentGroupId &&
        canTraverseRelationship({
          relationship,
          sourceGroupId,
          userRoleIdsByGroupId,
        })
    );

    for (const relationship of nextRelationships) {
      const nextGroupId = relationship.related_group_id;
      if (visited.has(nextGroupId)) {
        continue;
      }

      visited.add(nextGroupId);
      queue.push([...currentPath, nextGroupId]);
    }
  }

  return null;
}

function findClosestEligibleEvent(args: {
  eventsByGroupId: Map<string, NetworkEventRow[]>;
  groupId: string;
  requiredAfter?: number | null;
  requiredBefore?: number | null;
}) {
  const groupEvents = args.eventsByGroupId.get(args.groupId) ?? [];
  return (
    groupEvents.find(event => {
      const startDate = event.start_date ?? null;
      if (startDate == null) {
        return false;
      }
      if (args.requiredAfter != null && startDate < args.requiredAfter) {
        return false;
      }
      if (args.requiredBefore != null && startDate > args.requiredBefore) {
        return false;
      }
      return true;
    }) ?? null
  );
}

function finalizeSegmentWindows(segments: PathWithEventSegment[]) {
  let nextKnownEventStart: number | null = null;

  for (let index = segments.length - 1; index >= 0; index--) {
    const segment = segments[index];
    segment.requiredBefore = nextKnownEventStart;
    if (segment.eventStartDate != null) {
      nextKnownEventStart = segment.eventStartDate;
    }
  }

  return segments.map(segment => ({
    ...segment,
    missingEvent: !segment.eventId,
  }));
}

function buildSegmentsFromGroupIds(args: {
  groupIds: string[];
  groupsById: Map<string, NetworkGroupRow>;
  eventsByGroupId: Map<string, NetworkEventRow[]>;
}) {
  const segments: PathWithEventSegment[] = [];
  let requiredAfter: number | null = null;

  for (const groupId of args.groupIds) {
    const group = args.groupsById.get(groupId);
    if (!group) {
      continue;
    }

    const event = findClosestEligibleEvent({
      eventsByGroupId: args.eventsByGroupId,
      groupId,
      requiredAfter,
    });

    const previousRequiredAfter = requiredAfter;
    const eventStartDate = event?.start_date ?? null;
    if (eventStartDate != null) {
      requiredAfter = eventStartDate;
    }

    segments.push({
      groupId,
      groupName: getGroupName(group),
      eventId: event?.id ?? null,
      eventTitle: event?.title ?? 'Pending event',
      eventStartDate,
      stepKind: 'group_vote',
      selectionMode: null,
      mergeStrategy: null,
      eventRule: null,
      autoTaskOnMissingEvent: true,
      targetWorkflowId: null,
      requiredAfter: previousRequiredAfter,
      requiredBefore: null,
    });
  }

  return finalizeSegmentWindows(segments);
}

/**
 * Enrich path segments with IDs for agenda items, votes, and forwarding status.
 * Pure computation — generates UUIDs and determines status, no side effects.
 */
export function enrichPathSegments(
  pathWithEvents: PathWithEventSegment[],
  targetGroupId: string,
  targetEventId: string | null,
  targetEventTitle: string | null,
  targetEventStartDate: number | null
): EnrichedPathSegment[] {
  const segments = pathWithEvents.map(segment => ({ ...segment }));
  const lastSegment = segments[segments.length - 1];
  if (lastSegment && lastSegment.groupId === targetGroupId && targetEventId) {
    lastSegment.eventId = targetEventId;
    lastSegment.eventTitle = targetEventTitle ?? 'Pending event';
    lastSegment.eventStartDate = targetEventStartDate ?? null;
    lastSegment.missingEvent = false;
  }

  const eventsWithDates = segments.filter(segment => segment.eventStartDate != null);
  eventsWithDates.sort((left, right) => (left.eventStartDate ?? 0) - (right.eventStartDate ?? 0));
  const closestEventId = eventsWithDates[0]?.eventId ?? null;

  return segments.map(segment => {
    let agendaItemId: string | null = null;
    let amendmentVoteId: string | null = null;
    let forwardingStatus = 'previous_decision_outstanding';

    if (segment.eventId) {
      agendaItemId = crypto.randomUUID();
      amendmentVoteId = crypto.randomUUID();

      if (segment.eventId === closestEventId) {
        forwardingStatus = 'forward_confirmed';
      }
    }

    return {
      ...segment,
      agendaItemId,
      amendmentVoteId,
      forwardingStatus,
    };
  });
}

export function getActiveUserGroupIds(
  memberships: NetworkGroupMembershipRow[],
  userId: string
): string[] {
  return memberships
    .filter(
      membership => isActiveMembershipStatus(membership.status) && membership.user?.id === userId
    )
    .map(membership => membership.group?.id)
    .filter((groupId): groupId is string => Boolean(groupId));
}

export function calculateProcessPathWithClosestEvents({
  sourceGroupId,
  targetGroupId,
  groups,
  relationships,
  events,
  memberships = [],
  userId,
}: BuildPathInput): PathWithEventSegment[] | null {
  if (!sourceGroupId || !targetGroupId) {
    return null;
  }

  const groupIds = findShortestProcessPath({
    sourceGroupId,
    targetGroupId,
    groups,
    relationships,
    events,
    memberships,
    userId,
  });

  if (!groupIds || groupIds.length === 0) {
    return null;
  }

  return buildSegmentsFromGroupIds({
    groupIds,
    groupsById: buildGroupsById(groups),
    eventsByGroupId: buildUpcomingEventsByGroupId(events),
  });
}

export function calculateUpwardPathWithClosestEvents(args: {
  userGroupIds: string[];
  targetGroupId: string;
  groups: NetworkGroupRow[];
  relationships: NetworkGroupRelationshipRow[];
  events: NetworkEventRow[];
}): PathWithEventSegment[] | null {
  for (const sourceGroupId of args.userGroupIds) {
    const path = calculateProcessPathWithClosestEvents({
      sourceGroupId,
      targetGroupId: args.targetGroupId,
      groups: args.groups,
      relationships: args.relationships,
      events: args.events,
    });

    if (path) {
      return path;
    }
  }

  return null;
}

export function getReachableTargetGroupsFromSource(args: {
  sourceGroupId: string;
  groups: NetworkGroupRow[];
  relationships: NetworkGroupRelationshipRow[];
  memberships?: NetworkGroupMembershipRow[];
  userId?: string;
}) {
  return args.groups.filter(
    group =>
      calculateProcessPathWithClosestEvents({
        sourceGroupId: args.sourceGroupId,
        targetGroupId: group.id,
        groups: args.groups,
        relationships: args.relationships,
        events: [],
        memberships: args.memberships,
        userId: args.userId,
      }) !== null
  );
}

export function getUpwardConnectedGroupsForUser(
  userGroupIds: string[],
  groups: NetworkGroupRow[],
  relationships: NetworkGroupRelationshipRow[]
): NetworkGroupRow[] {
  if (userGroupIds.length === 0) {
    return [];
  }

  const connectedGroupIds = new Set<string>();
  for (const sourceGroupId of userGroupIds) {
    for (const group of getReachableTargetGroupsFromSource({
      sourceGroupId,
      groups,
      relationships,
    })) {
      connectedGroupIds.add(group.id);
    }
  }

  return groups.filter(group => connectedGroupIds.has(group.id));
}

/**
 * Build a path from a workflow's ordered step sequence,
 * assigning the closest upcoming event for each step's group.
 */
export function calculateWorkflowPathWithClosestEvents(
  workflowSteps: readonly {
    id?: string;
    group_id: string;
    group?: { id: string; name: string | null } | null;
    order_index?: number | null;
    step_kind?: string | null;
    selection_mode?: string | null;
    merge_strategy?: string | null;
    event_rule?: string | null;
    auto_task_on_missing_event?: boolean | null;
    target_workflow_id?: string | null;
  }[],
  events: NetworkEventRow[],
  options?: {
    sourceGroupId?: string | null;
    targetGroupId?: string | null;
  }
): PathWithEventSegment[] {
  const sorted = [...workflowSteps].sort(
    (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
  );
  const startIndex =
    options?.sourceGroupId != null
      ? Math.max(
          0,
          sorted.findIndex(step => step.group_id === options.sourceGroupId)
        )
      : 0;
  const endIndex =
    options?.targetGroupId != null
      ? sorted.findIndex(step => step.group_id === options.targetGroupId)
      : sorted.length - 1;

  if (endIndex < 0) {
    return [];
  }

  const relevantSteps = sorted.slice(startIndex, endIndex + 1);
  const eventsByGroupId = buildUpcomingEventsByGroupId(events);
  const segments: PathWithEventSegment[] = [];
  let requiredAfter: number | null = null;

  for (const step of relevantSteps) {
    const event = findClosestEligibleEvent({
      eventsByGroupId,
      groupId: step.group_id,
      requiredAfter,
    });
    const previousRequiredAfter = requiredAfter;
    const eventStartDate = event?.start_date ?? null;
    if (eventStartDate != null) {
      requiredAfter = eventStartDate;
    }

    const stepKind =
      step.step_kind === 'merge_vote' || step.step_kind === 'workflow_handoff'
        ? step.step_kind
        : 'group_vote';
    const selectionMode =
      step.selection_mode === 'default_target_workflow' ||
      step.selection_mode === 'explicit_workflow'
        ? step.selection_mode
        : 'explicit_workflow';
    const mergeStrategy = step.merge_strategy === 'winner_continues' ? step.merge_strategy : null;

    segments.push({
      groupId: step.group_id,
      groupName: step.group?.name ?? 'Unknown',
      eventId: event?.id ?? null,
      eventTitle: event?.title ?? 'Pending event',
      eventStartDate,
      workflowStepId: step.id ?? null,
      stepKind,
      selectionMode,
      mergeStrategy,
      eventRule: step.event_rule ?? null,
      autoTaskOnMissingEvent: step.auto_task_on_missing_event ?? true,
      targetWorkflowId: step.target_workflow_id ?? null,
      requiredAfter: previousRequiredAfter,
      requiredBefore: null,
    });
  }

  return finalizeSegmentWindows(segments);
}
