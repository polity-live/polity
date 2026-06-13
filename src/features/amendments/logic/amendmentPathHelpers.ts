import type {
  NetworkGroupRow,
  NetworkGroupRelationshipRow,
  NetworkGroupMembershipRow,
  NetworkEventRow,
} from '@/zero/amendments/queries';
import { richTextToPlainText } from '@/features/shared/logic/richText';

export type AmendmentNetworkGroup = NetworkGroupRow;
export type AmendmentNetworkRelationship = NetworkGroupRelationshipRow;
export type AmendmentNetworkMembership = NetworkGroupMembershipRow;
export type AmendmentNetworkEvent = NetworkEventRow;

export interface PathWithEventSegment {
  segmentKey: string;
  groupId: string;
  groupName: string;
  eventId: string | null;
  eventTitle: string;
  eventStartDate: number | null;
  eventEndDate?: number | null;
  stepLabel?: string | null;
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

export interface ProcessPathGroupOption {
  id: string;
  groupIds: string[];
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

interface WorkflowPathStep {
  id?: string;
  group_id: string;
  group?: { id: string; name: string | null } | null;
  order_index?: number | null;
  label?: string | null;
  step_kind?: string | null;
  selection_mode?: string | null;
  merge_strategy?: string | null;
  event_rule?: string | null;
  auto_task_on_missing_event?: boolean | null;
  target_workflow_id?: string | null;
}

const AMENDMENT_RIGHT = 'amendmentRight';

interface UserMembershipTraversalContext {
  activeGroupIds: Set<string>;
  roleIdsByGroupId: Map<string, Set<string>>;
  hasUserContext: boolean;
}

function isActiveMembershipStatus(status?: string | null) {
  return status === 'active' || status === 'admin' || status === 'member';
}

function isAcceptedRelationshipStatus(status?: string | null) {
  return status == null || status === 'active' || status === 'accepted';
}

function getGroupName(group?: Pick<NetworkGroupRow, 'name' | 'description'> | null) {
  return group?.name ?? richTextToPlainText(group?.description) ?? 'Unknown';
}

function buildGroupsById(groups: NetworkGroupRow[]) {
  return new Map(groups.map(group => [group.id, group]));
}

function buildProcessPathOptionId(groupIds: readonly string[]) {
  return groupIds.join('>');
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

function buildUserMembershipTraversalContext(
  memberships: NetworkGroupMembershipRow[],
  userId?: string
): UserMembershipTraversalContext {
  const activeGroupIds = new Set<string>();
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

    activeGroupIds.add(groupId);
    const roleIds = roleIdsByGroupId.get(groupId) ?? new Set<string>();
    for (const roleLink of membership.membership_roles ?? []) {
      if (roleLink.role?.id) {
        roleIds.add(roleLink.role.id);
      }
    }
    roleIdsByGroupId.set(groupId, roleIds);
  }

  return {
    activeGroupIds,
    roleIdsByGroupId,
    hasUserContext: Boolean(userId),
  };
}

function getMembershipGateGroupId(relationship: NetworkGroupRelationshipRow) {
  if (
    relationship.membership_direction !== 'forward' &&
    relationship.membership_direction !== 'backward'
  ) {
    return relationship.group_id;
  }

  if (
    relationship.relationship_direction !== 'forward' &&
    relationship.relationship_direction !== 'backward'
  ) {
    return relationship.group_id;
  }

  return relationship.membership_direction === relationship.relationship_direction
    ? relationship.group_id
    : relationship.related_group_id;
}

function getAmendmentTraversalEndpoints(relationship: NetworkGroupRelationshipRow) {
  if (relationship.relationship_direction === 'forward') {
    return {
      sourceGroupId: relationship.related_group_id,
      targetGroupId: relationship.group_id,
      sourceGroup: relationship.related_group ?? null,
      targetGroup: relationship.group ?? null,
    };
  }

  if (relationship.relationship_direction === 'backward') {
    return {
      sourceGroupId: relationship.group_id,
      targetGroupId: relationship.related_group_id,
      sourceGroup: relationship.group ?? null,
      targetGroup: relationship.related_group ?? null,
    };
  }

  return null;
}

function canTraverseRelationship(args: {
  relationship: NetworkGroupRelationshipRow;
  pathGroupIds: readonly string[];
  membershipContext: UserMembershipTraversalContext;
}) {
  const { relationship, pathGroupIds, membershipContext } = args;

  if (
    relationship.with_right !== AMENDMENT_RIGHT ||
    !isAcceptedRelationshipStatus(relationship.status)
  ) {
    return false;
  }

  const gateGroupId = getMembershipGateGroupId(relationship);

  if (relationship.membership_mode === 'selected_source_groups') {
    return (
      !relationship.membership_source_group_ids?.length ||
      pathGroupIds.some(groupId => relationship.membership_source_group_ids?.includes(groupId))
    );
  }

  if (!membershipContext.hasUserContext) {
    return true;
  }

  if (relationship.membership_mode === 'role_members') {
    return relationship.membership_role_id
      ? (membershipContext.roleIdsByGroupId
          .get(gateGroupId)
          ?.has(relationship.membership_role_id) ?? false)
      : false;
  }

  return true;
}

function getTraversableRelationshipsForPath(args: {
  relationships: NetworkGroupRelationshipRow[];
  currentPathGroupIds: readonly string[];
  membershipContext: UserMembershipTraversalContext;
}) {
  const currentGroupId = args.currentPathGroupIds[args.currentPathGroupIds.length - 1];

  if (!currentGroupId) {
    return [];
  }

  return args.relationships
    .flatMap(relationship => {
      if (
        !canTraverseRelationship({
          relationship,
          pathGroupIds: args.currentPathGroupIds,
          membershipContext: args.membershipContext,
        })
      ) {
        return [];
      }

      const endpoints = getAmendmentTraversalEndpoints(relationship);
      if (!endpoints || endpoints.sourceGroupId !== currentGroupId) {
        return [];
      }

      return [
        {
          ...relationship,
          group_id: endpoints.sourceGroupId,
          related_group_id: endpoints.targetGroupId,
          group: endpoints.sourceGroup,
          related_group: endpoints.targetGroup,
        },
      ];
    })
    .sort((left, right) => {
      const leftName = left.related_group?.name ?? left.related_group_id;
      const rightName = right.related_group?.name ?? right.related_group_id;
      return leftName.localeCompare(rightName);
    });
}

function findShortestProcessPath(args: BuildPathInput) {
  const { sourceGroupId, targetGroupId, relationships, memberships = [], userId } = args;
  const membershipContext = buildUserMembershipTraversalContext(memberships, userId);
  const queue: string[][] = [[sourceGroupId]];
  const visitedPathKeys = new Set<string>([buildProcessPathOptionId([sourceGroupId])]);

  while (queue.length > 0) {
    const currentPath = queue.shift();
    if (!currentPath) {
      break;
    }

    const currentGroupId = currentPath[currentPath.length - 1];
    if (currentGroupId === targetGroupId) {
      return currentPath;
    }

    for (const relationship of getTraversableRelationshipsForPath({
      relationships,
      currentPathGroupIds: currentPath,
      membershipContext,
    })) {
      const nextGroupId = relationship.related_group_id;
      if (currentPath.includes(nextGroupId)) {
        continue;
      }

      const nextPath = [...currentPath, nextGroupId];
      const nextPathKey = buildProcessPathOptionId(nextPath);
      if (visitedPathKeys.has(nextPathKey)) {
        continue;
      }

      visitedPathKeys.add(nextPathKey);
      queue.push(nextPath);
    }
  }

  return null;
}

function getSortedTraversalTargets(
  relationships: NetworkGroupRelationshipRow[],
  currentPathGroupIds: readonly string[],
  membershipContext: UserMembershipTraversalContext
) {
  return getTraversableRelationshipsForPath({
    relationships,
    currentPathGroupIds,
    membershipContext,
  });
}

export function getProcessPathGroupOptions(args: {
  sourceGroupId: string;
  targetGroupId: string;
  groups: NetworkGroupRow[];
  relationships: NetworkGroupRelationshipRow[];
  memberships?: NetworkGroupMembershipRow[];
  userId?: string;
  maxPaths?: number;
  maxExtraSteps?: number;
}): ProcessPathGroupOption[] {
  if (!args.sourceGroupId || !args.targetGroupId) {
    return [];
  }

  const membershipContext = buildUserMembershipTraversalContext(
    args.memberships ?? [],
    args.userId
  );
  const maxPaths = args.maxPaths ?? 8;
  const maxExtraSteps = args.maxExtraSteps ?? 3;
  const maxDepth = Math.max(args.groups.length + 1, 6);
  const queue: string[][] = [[args.sourceGroupId]];
  const queued = new Set<string>([buildProcessPathOptionId([args.sourceGroupId])]);
  const discovered = new Set<string>();
  const results: string[][] = [];
  let shortestLength: number | null = null;

  while (queue.length > 0 && results.length < maxPaths) {
    const currentPath = queue.shift();
    if (!currentPath) {
      break;
    }

    const currentGroupId = currentPath[currentPath.length - 1];
    if (shortestLength != null && currentPath.length > shortestLength + maxExtraSteps) {
      continue;
    }
    if (currentPath.length > maxDepth) {
      continue;
    }

    if (currentGroupId === args.targetGroupId) {
      const resultKey = buildProcessPathOptionId(currentPath);
      if (!discovered.has(resultKey)) {
        discovered.add(resultKey);
        results.push(currentPath);
        shortestLength ??= currentPath.length;
      }
      continue;
    }

    for (const relationship of getSortedTraversalTargets(
      args.relationships,
      currentPath,
      membershipContext
    )) {
      const nextGroupId = relationship.related_group_id;
      if (currentPath.includes(nextGroupId)) {
        continue;
      }

      const nextPath = [...currentPath, nextGroupId];
      const nextKey = buildProcessPathOptionId(nextPath);
      if (queued.has(nextKey)) {
        continue;
      }

      queued.add(nextKey);
      queue.push(nextPath);
    }
  }

  return results.map(groupIds => ({
    id: buildProcessPathOptionId(groupIds),
    groupIds,
  }));
}

function collectReachableGroupIds(args: {
  sourceGroupId: string;
  relationships: NetworkGroupRelationshipRow[];
  memberships?: NetworkGroupMembershipRow[];
  userId?: string;
}) {
  const membershipContext = buildUserMembershipTraversalContext(
    args.memberships ?? [],
    args.userId
  );
  const visited = new Set<string>([args.sourceGroupId]);
  const queue: string[][] = [[args.sourceGroupId]];
  const queuedPathKeys = new Set<string>([buildProcessPathOptionId([args.sourceGroupId])]);

  while (queue.length > 0) {
    const currentPath = queue.shift();
    if (!currentPath) {
      continue;
    }

    for (const relationship of getTraversableRelationshipsForPath({
      relationships: args.relationships,
      currentPathGroupIds: currentPath,
      membershipContext,
    })) {
      if (visited.has(relationship.related_group_id)) {
        if (!currentPath.includes(relationship.related_group_id)) {
          const nextPath = [...currentPath, relationship.related_group_id];
          const nextPathKey = buildProcessPathOptionId(nextPath);
          if (!queuedPathKeys.has(nextPathKey)) {
            queuedPathKeys.add(nextPathKey);
            queue.push(nextPath);
          }
        }
        continue;
      }

      if (currentPath.includes(relationship.related_group_id)) {
        continue;
      }

      visited.add(relationship.related_group_id);
      const nextPath = [...currentPath, relationship.related_group_id];
      const nextPathKey = buildProcessPathOptionId(nextPath);
      if (queuedPathKeys.has(nextPathKey)) {
        continue;
      }

      queuedPathKeys.add(nextPathKey);
      queue.push(nextPath);
    }
  }

  return visited;
}

function getEventOrderingAnchor(
  segment: Pick<PathWithEventSegment, 'eventStartDate' | 'eventEndDate'>
) {
  return segment.eventEndDate ?? segment.eventStartDate ?? null;
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
      const endDate = event.end_date ?? event.start_date ?? null;
      if (startDate == null) {
        return false;
      }
      if (args.requiredAfter != null && startDate < args.requiredAfter) {
        return false;
      }
      if (args.requiredBefore != null && endDate != null && endDate > args.requiredBefore) {
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

function recomputeSegmentWindows(segments: PathWithEventSegment[]) {
  let requiredAfter: number | null = null;

  const forwardPass = segments.map(segment => {
    const nextSegment = {
      ...segment,
      requiredAfter,
      requiredBefore: null,
    };

    const orderingAnchor = getEventOrderingAnchor(segment);
    if (orderingAnchor != null) {
      requiredAfter = orderingAnchor;
    }

    return nextSegment;
  });

  return finalizeSegmentWindows(forwardPass);
}

export function rehydratePathSegmentsWithWindows(
  segments: readonly PathWithEventSegment[]
): PathWithEventSegment[] {
  return recomputeSegmentWindows(segments.map(segment => ({ ...segment })));
}

export function getEligibleEventsForPathSegment(args: {
  segment: Pick<PathWithEventSegment, 'groupId' | 'requiredAfter' | 'requiredBefore'>;
  events: readonly AmendmentNetworkEvent[];
}) {
  return [...args.events]
    .filter(event => (event.group?.id ?? event.group_id) === args.segment.groupId)
    .filter(event => {
      const startDate = event.start_date ?? null;
      const endDate = event.end_date ?? event.start_date ?? null;

      if (startDate == null || startDate <= Date.now()) {
        return false;
      }
      if (args.segment.requiredAfter != null && startDate < args.segment.requiredAfter) {
        return false;
      }
      if (
        args.segment.requiredBefore != null &&
        endDate != null &&
        endDate > args.segment.requiredBefore
      ) {
        return false;
      }
      return true;
    })
    .sort((left, right) => (left.start_date ?? 0) - (right.start_date ?? 0));
}

function buildSegmentsFromGroupIds(args: {
  groupIds: string[];
  groupsById: Map<string, NetworkGroupRow>;
  eventsByGroupId: Map<string, NetworkEventRow[]>;
  segmentPrefix?: string;
}) {
  const segments: PathWithEventSegment[] = [];
  let requiredAfter: number | null = null;

  for (const [index, groupId] of args.groupIds.entries()) {
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
    const eventEndDate = event?.end_date ?? event?.start_date ?? null;
    if (eventEndDate != null) {
      requiredAfter = eventEndDate;
    }

    segments.push({
      segmentKey: `${args.segmentPrefix ?? 'hierarchy'}:${index}:${groupId}`,
      groupId,
      groupName: getGroupName(group),
      eventId: event?.id ?? null,
      eventTitle: event?.title ?? 'Pending event',
      eventStartDate,
      eventEndDate,
      stepLabel: null,
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

  return recomputeSegmentWindows(segments);
}

export function calculateProcessPathWithClosestEventsForGroupIds(args: {
  groupIds: string[];
  groups: NetworkGroupRow[];
  events: NetworkEventRow[];
  segmentPrefix?: string;
}) {
  if (args.groupIds.length === 0) {
    return null;
  }

  return buildSegmentsFromGroupIds({
    groupIds: args.groupIds,
    groupsById: buildGroupsById(args.groups),
    eventsByGroupId: buildUpcomingEventsByGroupId(args.events),
    segmentPrefix: args.segmentPrefix,
  });
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
  targetEventStartDate: number | null,
  targetEventEndDate?: number | null
): EnrichedPathSegment[] {
  const segments = pathWithEvents.map(segment => ({ ...segment }));
  const lastSegment = segments[segments.length - 1];
  if (lastSegment && lastSegment.groupId === targetGroupId && targetEventId) {
    lastSegment.eventId = targetEventId;
    lastSegment.eventTitle = targetEventTitle ?? 'Pending event';
    lastSegment.eventStartDate = targetEventStartDate ?? null;
    lastSegment.eventEndDate = targetEventEndDate ?? targetEventStartDate ?? null;
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

  const groupIds =
    getProcessPathGroupOptions({
      sourceGroupId,
      targetGroupId,
      groups,
      relationships,
      memberships,
      userId,
    })[0]?.groupIds ??
    findShortestProcessPath({
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

  return calculateProcessPathWithClosestEventsForGroupIds({
    groupIds,
    groups,
    events,
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
  includeSourceGroup?: boolean;
}) {
  const reachableGroupIds = collectReachableGroupIds(args);
  return args.groups.filter(
    group =>
      reachableGroupIds.has(group.id) &&
      (args.includeSourceGroup || group.id !== args.sourceGroupId)
  );
}

export function getDirectReachableTargetGroupsFromSource(args: {
  sourceGroupId: string;
  groups: NetworkGroupRow[];
  relationships: NetworkGroupRelationshipRow[];
  memberships?: NetworkGroupMembershipRow[];
  userId?: string;
  includeSourceGroup?: boolean;
}) {
  const membershipContext = buildUserMembershipTraversalContext(
    args.memberships ?? [],
    args.userId
  );
  const directGroupIds = new Set(
    getTraversableRelationshipsForPath({
      relationships: args.relationships,
      currentPathGroupIds: [args.sourceGroupId],
      membershipContext,
    }).map(relationship => relationship.related_group_id)
  );

  if (args.includeSourceGroup) {
    directGroupIds.add(args.sourceGroupId);
  }

  return args.groups.filter(
    group =>
      directGroupIds.has(group.id) && (args.includeSourceGroup || group.id !== args.sourceGroupId)
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
      includeSourceGroup: true,
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
  workflowSteps: readonly WorkflowPathStep[],
  events: NetworkEventRow[]
): PathWithEventSegment[] {
  const sorted = [...workflowSteps].sort(
    (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
  );
  const eventsByGroupId = buildUpcomingEventsByGroupId(events);
  const segments: PathWithEventSegment[] = [];
  let requiredAfter: number | null = null;

  for (const [index, step] of sorted.entries()) {
    const event = findClosestEligibleEvent({
      eventsByGroupId,
      groupId: step.group_id,
      requiredAfter,
    });
    const previousRequiredAfter = requiredAfter;
    const eventStartDate = event?.start_date ?? null;
    const eventEndDate = event?.end_date ?? event?.start_date ?? null;
    if (eventEndDate != null) {
      requiredAfter = eventEndDate;
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
      segmentKey: step.id ? `workflow:${step.id}` : `workflow:${step.group_id}:${index}`,
      groupId: step.group_id,
      groupName: step.group?.name ?? 'Unknown',
      eventId: event?.id ?? null,
      eventTitle: event?.title ?? 'Pending event',
      eventStartDate,
      eventEndDate,
      stepLabel: step.label ?? null,
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

  return recomputeSegmentWindows(segments);
}

export function getWorkflowStartGroupId(workflow: {
  start_group_id?: string | null;
  group_id?: string | null;
  steps?: readonly WorkflowPathStep[] | null;
}) {
  if (workflow.start_group_id) {
    return workflow.start_group_id;
  }

  const sortedSteps = [...(workflow.steps ?? [])].sort(
    (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
  );
  return sortedSteps[0]?.group_id ?? workflow.group_id ?? null;
}

export function getWorkflowFinalGroupId(workflow: {
  group_id?: string | null;
  steps?: readonly WorkflowPathStep[] | null;
}) {
  const sortedSteps = [...(workflow.steps ?? [])].sort(
    (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
  );
  return sortedSteps[sortedSteps.length - 1]?.group_id ?? workflow.group_id ?? null;
}

export function getReachableWorkflowsFromSource<
  TWorkflow extends {
    id: string;
    start_group_id?: string | null;
    status?: string | null;
    group_id?: string | null;
    steps?: readonly WorkflowPathStep[] | null;
  },
>(args: {
  sourceGroupId: string;
  workflows: readonly TWorkflow[];
  groups: NetworkGroupRow[];
  relationships: NetworkGroupRelationshipRow[];
  memberships?: NetworkGroupMembershipRow[];
  userId?: string;
}) {
  return args.workflows.filter(workflow => {
    if (workflow.status != null && workflow.status !== 'active') {
      return false;
    }

    const startGroupId = getWorkflowStartGroupId(workflow);
    if (!startGroupId) {
      return false;
    }

    return (
      calculateProcessPathWithClosestEvents({
        sourceGroupId: args.sourceGroupId,
        targetGroupId: startGroupId,
        groups: args.groups,
        relationships: args.relationships,
        events: [],
        memberships: args.memberships,
        userId: args.userId,
      }) !== null
    );
  });
}

export function calculateWorkflowProcessPathWithClosestEvents(args: {
  sourceGroupId: string;
  workflow: {
    start_group_id?: string | null;
    group_id?: string | null;
    steps?: readonly WorkflowPathStep[] | null;
  };
  groups: NetworkGroupRow[];
  relationships: NetworkGroupRelationshipRow[];
  events: NetworkEventRow[];
  memberships?: NetworkGroupMembershipRow[];
  userId?: string;
}): PathWithEventSegment[] | null {
  const sortedSteps = [...(args.workflow.steps ?? [])].sort(
    (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
  );
  if (sortedSteps.length === 0) {
    return null;
  }

  const startGroupId = getWorkflowStartGroupId(args.workflow);
  if (!startGroupId) {
    return null;
  }

  const prefixPath = calculateProcessPathWithClosestEvents({
    sourceGroupId: args.sourceGroupId,
    targetGroupId: startGroupId,
    groups: args.groups,
    relationships: args.relationships,
    events: args.events,
    memberships: args.memberships,
    userId: args.userId,
  });

  if (!prefixPath || prefixPath.length === 0) {
    return null;
  }

  const workflowPath = calculateWorkflowPathWithClosestEvents(sortedSteps, args.events);

  if (workflowPath.length === 0) {
    return null;
  }

  const dedupedPrefix =
    prefixPath[prefixPath.length - 1]?.groupId === workflowPath[0]?.groupId
      ? prefixPath.slice(0, -1)
      : prefixPath;

  return recomputeSegmentWindows([...dedupedPrefix, ...workflowPath]);
}
