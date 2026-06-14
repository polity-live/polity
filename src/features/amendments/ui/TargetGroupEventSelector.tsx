'use client';

import { BadgeControl } from '@/features/shared/ui/status';
import {
  FormControlLabel,
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/features/shared/ui/ui/tabs';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import { useWorkflowState } from '@/zero/network/useWorkflowState';
import {
  type AmendmentNetworkEvent,
  type AmendmentNetworkGroup,
  calculateProcessPathWithClosestEventsForGroupIds,
  type PathWithEventSegment,
  calculateProcessPathWithClosestEvents,
  calculateWorkflowProcessPathWithClosestEvents,
  getActiveUserGroupIds,
  getEligibleEventsForPathSegment,
  getProcessPathGroupOptions,
  getReachableTargetGroupsFromSource,
  getReachableWorkflowsFromSource,
  getWorkflowFinalGroupId,
  getWorkflowStartGroupId,
  rehydratePathSegmentsWithWindows,
} from '@/features/amendments/logic/amendmentPathHelpers';
import { CalendarClock, ChevronRight, GitBranch, Target, User, Workflow } from 'lucide-react';
import { GroupTimelineCard } from '@/features/timeline/ui/cards/GroupTimelineCard';
import { EventTimelineCard } from '@/features/timeline/ui/cards/EventTimelineCard';
import { UserNetworkFlow } from '@/features/network/ui/UserNetworkFlow';
import { GroupNetworkFlow } from '@/features/network/ui/GroupNetworkFlow';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export interface TargetGroupEventSelection {
  sourceGroupId: string;
  groupId: string;
  groupData: AmendmentNetworkGroup;
  eventId: string | null;
  eventData: AmendmentNetworkEvent | null;
  pathWithEvents: PathWithEventSegment[];
  missingEventSteps: PathWithEventSegment[];
  selectedUserId: string;
  pathMode: 'hierarchy' | 'workflow';
  workflowId: string | null;
}

interface TargetGroupEventSelectorProps {
  userId: string;
  collaborators?: { id: string; name?: string; email?: string; avatar?: string }[];
  onSelect: (data: TargetGroupEventSelection | null) => void;
  onSourceGroupSelectionChange?: (groupId: string | null) => void;
  onGroupSelectionChange?: (groupId: string | null) => void;
  onPathModeChange?: (mode: 'hierarchy' | 'workflow') => void;
  onWorkflowSelectionChange?: (workflowId: string | null) => void;
  selectedSourceGroupId?: string;
  selectedGroupId?: string;
  selectedEventId?: string;
  selectedPathMode?: 'hierarchy' | 'workflow';
  selectedWorkflowId?: string;
  disablePortal?: boolean;
  allowGroupWithoutEvent?: boolean;
  allowSourceGroupAsTarget?: boolean;
  layoutScope?: string;
}

function formatEventWindowLabel(timestamp?: number | null) {
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dedupeGroupsById(groups: AmendmentNetworkGroup[]) {
  const seen = new Set<string>();
  return groups.filter(group => {
    if (seen.has(group.id)) {
      return false;
    }
    seen.add(group.id);
    return true;
  });
}

function formatPathOptionLabel(
  pathOption: { groupIds: string[] },
  groups: AmendmentNetworkGroup[]
) {
  const groupsById = new Map(groups.map(group => [group.id, group]));
  return pathOption.groupIds.map(groupId => groupsById.get(groupId)?.name ?? groupId).join(' -> ');
}

export function TargetGroupEventSelector({
  userId,
  collaborators = [],
  onSelect,
  onSourceGroupSelectionChange,
  onGroupSelectionChange,
  onPathModeChange,
  onWorkflowSelectionChange,
  selectedSourceGroupId,
  selectedGroupId,
  selectedEventId,
  selectedPathMode,
  selectedWorkflowId,
  disablePortal = false,
  allowGroupWithoutEvent = false,
  allowSourceGroupAsTarget = false,
  layoutScope = 'default',
}: TargetGroupEventSelectorProps) {
  const hasInitializedUserSelection = useRef(false);
  const sourcePrefillRef = useRef<string | null>(null);
  const targetPrefillRef = useRef<string | null>(null);
  const lastEmittedSelectionRef = useRef<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<string>(userId);
  const [pathMode, setPathMode] = useState<'hierarchy' | 'workflow'>(
    selectedPathMode ?? 'hierarchy'
  );
  const [selectedWorkflowIdState, setSelectedWorkflowIdState] = useState<string>(
    selectedWorkflowId ?? ''
  );
  const [selectedSourceGroup, setSelectedSourceGroup] = useState<{
    id: string;
    data: AmendmentNetworkGroup;
  } | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<{
    id: string;
    data: AmendmentNetworkGroup;
  } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<{
    id: string;
    data: AmendmentNetworkEvent;
  } | null>(null);
  const [pathWithEvents, setPathWithEvents] = useState<PathWithEventSegment[]>([]);
  const [selectedHierarchyPathId, setSelectedHierarchyPathId] = useState<string>('');
  const [pathValidationError, setPathValidationError] = useState<string | null>(null);

  const { allWorkflows } = useWorkflowState({});
  const {
    allGroups: groups,
    allGroupRelationships,
    allGroupMemberships,
    allEvents,
  } = useAmendmentState({
    includeNetworkData: true,
    includeEventsByGroup: !!selectedGroup?.id,
    eventGroupId: selectedGroup?.id,
  });

  const networkGroups = groups ?? [];
  const networkRelationships = allGroupRelationships ?? [];
  const networkMemberships = allGroupMemberships ?? [];
  const networkEvents = allEvents ?? [];
  const currentUserId = selectedUserId || userId;

  const activeSourceGroups = useMemo(() => {
    const sourceGroupIds = getActiveUserGroupIds(networkMemberships, currentUserId);
    return dedupeGroupsById(networkGroups.filter(group => sourceGroupIds.includes(group.id)));
  }, [currentUserId, networkGroups, networkMemberships]);

  const reachableHierarchyGroups = useMemo(() => {
    if (!selectedSourceGroup?.id) {
      return [];
    }

    return getReachableTargetGroupsFromSource({
      sourceGroupId: selectedSourceGroup.id,
      groups: networkGroups,
      relationships: networkRelationships,
      memberships: networkMemberships,
      userId: currentUserId,
    });
  }, [
    currentUserId,
    networkGroups,
    networkMemberships,
    networkRelationships,
    selectedSourceGroup?.id,
  ]);

  const selectedWorkflow = useMemo(
    () => allWorkflows.find(workflow => workflow.id === selectedWorkflowIdState) ?? null,
    [allWorkflows, selectedWorkflowIdState]
  );

  const selectedWorkflowStartGroup = useMemo(() => {
    if (!selectedWorkflow) {
      return null;
    }

    const startGroupId = getWorkflowStartGroupId(selectedWorkflow);
    return networkGroups.find(group => group.id === startGroupId) ?? null;
  }, [networkGroups, selectedWorkflow]);

  const selectedWorkflowFinalGroup = useMemo(() => {
    if (!selectedWorkflow) {
      return null;
    }

    const finalGroupId = getWorkflowFinalGroupId(selectedWorkflow);
    return networkGroups.find(group => group.id === finalGroupId) ?? null;
  }, [networkGroups, selectedWorkflow]);

  const reachableWorkflows = useMemo(
    () =>
      selectedSourceGroup?.id
        ? getReachableWorkflowsFromSource({
            sourceGroupId: selectedSourceGroup.id,
            workflows: allWorkflows,
            groups: networkGroups,
            relationships: networkRelationships,
            memberships: networkMemberships,
            userId: currentUserId,
          })
        : [],
    [
      allWorkflows,
      currentUserId,
      networkGroups,
      networkMemberships,
      networkRelationships,
      selectedSourceGroup?.id,
    ]
  );

  const availableTargetGroups = useMemo(() => {
    if (!selectedSourceGroup) {
      return [];
    }

    if (pathMode === 'workflow') {
      return selectedWorkflowFinalGroup ? [selectedWorkflowFinalGroup] : [];
    }

    const groups = [...reachableHierarchyGroups];
    if (allowSourceGroupAsTarget && !groups.some(group => group.id === selectedSourceGroup.id)) {
      groups.unshift(selectedSourceGroup.data);
    }

    return dedupeGroupsById(groups);
  }, [
    allowSourceGroupAsTarget,
    pathMode,
    reachableHierarchyGroups,
    selectedSourceGroup,
    selectedWorkflowFinalGroup,
  ]);

  const availableHierarchyPaths = useMemo(() => {
    if (pathMode !== 'hierarchy' || !selectedSourceGroup?.id || !selectedGroup?.id) {
      return [];
    }

    return getProcessPathGroupOptions({
      sourceGroupId: selectedSourceGroup.id,
      targetGroupId: selectedGroup.id,
      groups: networkGroups,
      relationships: networkRelationships,
      memberships: networkMemberships,
      userId: currentUserId,
    });
  }, [
    currentUserId,
    networkGroups,
    networkMemberships,
    networkRelationships,
    pathMode,
    selectedGroup?.id,
    selectedSourceGroup?.id,
  ]);

  const targetPathSegment = useMemo(
    () =>
      pathMode === 'workflow'
        ? (pathWithEvents[pathWithEvents.length - 1] ?? null)
        : (pathWithEvents.find(segment => segment.groupId === selectedGroup?.id) ?? null),
    [pathMode, pathWithEvents, selectedGroup?.id]
  );

  const getUpcomingEventsForGroup = useCallback(
    (
      groupId: string,
      segment?: Pick<PathWithEventSegment, 'groupId' | 'requiredAfter' | 'requiredBefore'> | null
    ) =>
      getEligibleEventsForPathSegment({
        segment: segment ?? { groupId, requiredAfter: null, requiredBefore: null },
        events: networkEvents,
      }),
    [networkEvents]
  );

  const upcomingEvents = useMemo(
    () => (selectedGroup?.id ? getUpcomingEventsForGroup(selectedGroup.id, targetPathSegment) : []),
    [getUpcomingEventsForGroup, selectedGroup?.id, targetPathSegment]
  );

  useEffect(() => {
    if (selectedPathMode) {
      setPathMode(selectedPathMode);
    }
  }, [selectedPathMode]);

  useEffect(() => {
    if (selectedWorkflowId !== undefined) {
      setSelectedWorkflowIdState(selectedWorkflowId ?? '');
    }
  }, [selectedWorkflowId]);

  useEffect(() => {
    if (!selectedWorkflowIdState || !selectedSourceGroup?.id || allWorkflows.length === 0) {
      return;
    }

    if (reachableWorkflows.some(workflow => workflow.id === selectedWorkflowIdState)) {
      return;
    }

    setSelectedWorkflowIdState('');
    setSelectedGroup(null);
    setSelectedEvent(null);
    setPathWithEvents([]);
    setSelectedHierarchyPathId('');
    setPathValidationError(null);
    onWorkflowSelectionChange?.(null);
    onSelect(null);
  }, [
    allWorkflows.length,
    onSelect,
    onWorkflowSelectionChange,
    reachableWorkflows,
    selectedSourceGroup?.id,
    selectedWorkflowIdState,
  ]);

  useEffect(() => {
    if (pathMode !== 'workflow') {
      return;
    }

    if (!selectedWorkflowIdState || !selectedWorkflowFinalGroup) {
      setSelectedGroup(null);
      onGroupSelectionChange?.(null);
      return;
    }

    if (selectedGroup?.id === selectedWorkflowFinalGroup.id) {
      return;
    }

    setSelectedGroup({ id: selectedWorkflowFinalGroup.id, data: selectedWorkflowFinalGroup });
    onGroupSelectionChange?.(selectedWorkflowFinalGroup.id);
  }, [
    onGroupSelectionChange,
    pathMode,
    selectedGroup?.id,
    selectedWorkflowFinalGroup,
    selectedWorkflowIdState,
  ]);

  useEffect(() => {
    if (pathMode !== 'hierarchy') {
      if (selectedHierarchyPathId) {
        setSelectedHierarchyPathId('');
      }
      return;
    }

    if (availableHierarchyPaths.length === 0) {
      if (selectedHierarchyPathId) {
        setSelectedHierarchyPathId('');
      }
      return;
    }

    if (availableHierarchyPaths.some(path => path.id === selectedHierarchyPathId)) {
      return;
    }

    setSelectedHierarchyPathId(availableHierarchyPaths[0].id);
  }, [availableHierarchyPaths, pathMode, selectedHierarchyPathId]);

  useEffect(() => {
    if (!selectedGroup) {
      return;
    }

    if (availableTargetGroups.some(group => group.id === selectedGroup.id)) {
      return;
    }

    // Keep externally controlled selection stable while target options are still reconciling.
    if (selectedGroupId === selectedGroup.id || availableTargetGroups.length === 0) {
      return;
    }

    setSelectedGroup(null);
    setSelectedEvent(null);
    setPathWithEvents([]);
    setPathValidationError(null);
    onGroupSelectionChange?.(null);
    onSelect(null);
  }, [availableTargetGroups, onGroupSelectionChange, onSelect, selectedGroup, selectedGroupId]);

  useEffect(() => {
    if (selectedSourceGroupId && selectedSourceGroupId !== sourcePrefillRef.current) {
      const nextSourceGroup = activeSourceGroups.find(group => group.id === selectedSourceGroupId);
      if (nextSourceGroup) {
        setSelectedSourceGroup({ id: nextSourceGroup.id, data: nextSourceGroup });
        sourcePrefillRef.current = selectedSourceGroupId;
      }
      return;
    }

    if (!selectedSourceGroupId && !selectedSourceGroup && activeSourceGroups.length === 1) {
      const defaultSourceGroup = activeSourceGroups[0];
      setSelectedSourceGroup({ id: defaultSourceGroup.id, data: defaultSourceGroup });
      onSourceGroupSelectionChange?.(defaultSourceGroup.id);
    }
  }, [
    activeSourceGroups,
    onSourceGroupSelectionChange,
    selectedSourceGroup,
    selectedSourceGroupId,
  ]);

  useEffect(() => {
    if (
      !selectedGroupId ||
      selectedGroupId === targetPrefillRef.current ||
      availableTargetGroups.length === 0
    ) {
      return;
    }

    const nextTargetGroup = availableTargetGroups.find(group => group.id === selectedGroupId);
    if (!nextTargetGroup) {
      return;
    }

    setSelectedGroup({ id: nextTargetGroup.id, data: nextTargetGroup });
    targetPrefillRef.current = selectedGroupId;
  }, [availableTargetGroups, selectedGroupId]);

  useEffect(() => {
    if (!selectedEventId || !selectedGroup?.id) {
      return;
    }

    const nextEvent = networkEvents.find(
      event =>
        event.id === selectedEventId && (event.group?.id ?? event.group_id) === selectedGroup.id
    );
    if (nextEvent) {
      setSelectedEvent({ id: nextEvent.id, data: nextEvent });
    }
  }, [networkEvents, selectedEventId, selectedGroup?.id]);

  useEffect(() => {
    if (!hasInitializedUserSelection.current) {
      hasInitializedUserSelection.current = true;
      return;
    }

    setSelectedSourceGroup(null);
    setSelectedGroup(null);
    setSelectedEvent(null);
    setPathWithEvents([]);
    setSelectedHierarchyPathId('');
    setPathValidationError(null);
    onSourceGroupSelectionChange?.(null);
    onGroupSelectionChange?.(null);
    onSelect(null);
  }, [onGroupSelectionChange, onSelect, onSourceGroupSelectionChange, selectedUserId]);

  useEffect(() => {
    if (!selectedSourceGroup || (pathMode === 'hierarchy' && !selectedGroup)) {
      setPathWithEvents([]);
      setPathValidationError(null);
      lastEmittedSelectionRef.current = null;
      onSelect(null);
      return;
    }

    let calculatedPath: PathWithEventSegment[] | null = null;

    if (pathMode === 'workflow' && selectedWorkflowIdState) {
      calculatedPath = selectedWorkflow
        ? calculateWorkflowProcessPathWithClosestEvents({
            sourceGroupId: selectedSourceGroup.id,
            workflow: selectedWorkflow,
            groups: networkGroups,
            relationships: networkRelationships,
            events: networkEvents,
            memberships: networkMemberships,
            userId: currentUserId,
          })
        : null;
    } else {
      const selectedHierarchyPath =
        availableHierarchyPaths.find(path => path.id === selectedHierarchyPathId) ??
        availableHierarchyPaths[0] ??
        null;

      calculatedPath = selectedHierarchyPath
        ? calculateProcessPathWithClosestEventsForGroupIds({
            groupIds: selectedHierarchyPath.groupIds,
            groups: networkGroups,
            events: networkEvents,
          })
        : calculateProcessPathWithClosestEvents({
            sourceGroupId: selectedSourceGroup.id,
            targetGroupId: selectedGroup?.id ?? '',
            groups: networkGroups,
            relationships: networkRelationships,
            events: networkEvents,
            memberships: networkMemberships,
            userId: currentUserId,
          });
    }

    if (!calculatedPath || calculatedPath.length === 0) {
      setPathWithEvents([]);
      setPathValidationError(
        'Kein zulaessiger Prozesspfad zwischen Start- und Zielgruppe gefunden.'
      );
      lastEmittedSelectionRef.current = null;
      onSelect(null);
      return;
    }

    setPathWithEvents(previous => {
      let nextPath = rehydratePathSegmentsWithWindows(calculatedPath);
      const previousBySegmentKey = new Map(
        previous.map(segment => [segment.segmentKey, segment] as const)
      );

      for (const segment of nextPath) {
        const previousSegment = previousBySegmentKey.get(segment.segmentKey);
        if (!previousSegment) {
          continue;
        }

        const matchingEvent = previousSegment.eventId
          ? (getUpcomingEventsForGroup(segment.groupId, segment).find(
              event => event.id === previousSegment.eventId
            ) ?? null)
          : null;

        nextPath = rehydratePathSegmentsWithWindows(
          nextPath.map(currentSegment =>
            currentSegment.groupId !== segment.groupId
              ? currentSegment
              : {
                  ...currentSegment,
                  eventId: matchingEvent?.id ?? null,
                  eventTitle: matchingEvent?.title ?? 'Pending event',
                  eventStartDate: matchingEvent?.start_date ?? null,
                  eventEndDate: matchingEvent?.end_date ?? matchingEvent?.start_date ?? null,
                  missingEvent: !matchingEvent,
                }
          )
        );
      }

      return nextPath;
    });
  }, [
    availableHierarchyPaths,
    currentUserId,
    pathMode,
    networkEvents,
    networkGroups,
    networkMemberships,
    networkRelationships,
    getUpcomingEventsForGroup,
    onSelect,
    selectedSourceGroup,
    selectedGroup?.id,
    selectedHierarchyPathId,
    selectedWorkflow,
    selectedWorkflowIdState,
  ]);

  useEffect(() => {
    if (!targetPathSegment?.segmentKey || !selectedEvent?.id || pathWithEvents.length === 0) {
      return;
    }

    const selectedSegment = pathWithEvents.find(
      segment => segment.segmentKey === targetPathSegment.segmentKey
    );
    if (selectedSegment?.eventId === selectedEvent.id) {
      return;
    }

    const nextEvent = networkEvents.find(
      event =>
        event.id === selectedEvent.id && (event.group?.id ?? event.group_id) === selectedGroup?.id
    );
    if (!nextEvent) {
      return;
    }

    setPathWithEvents(previous =>
      rehydratePathSegmentsWithWindows(
        previous.map(segment =>
          segment.segmentKey !== targetPathSegment.segmentKey
            ? segment
            : {
                ...segment,
                eventId: nextEvent.id,
                eventTitle: String(nextEvent.title ?? ''),
                eventStartDate: nextEvent.start_date ?? null,
                eventEndDate: nextEvent.end_date ?? nextEvent.start_date ?? null,
                missingEvent: false,
              }
        )
      )
    );
  }, [
    networkEvents,
    pathWithEvents,
    selectedEvent?.id,
    selectedGroup?.id,
    targetPathSegment?.segmentKey,
  ]);

  useEffect(() => {
    if (!selectedGroup?.id) {
      if (selectedEvent) {
        setSelectedEvent(null);
      }
      return;
    }

    const selectedSegment =
      targetPathSegment ??
      pathWithEvents.find(segment => segment.groupId === selectedGroup.id) ??
      null;
    if (!selectedSegment?.eventId) {
      if (selectedEvent) {
        setSelectedEvent(null);
      }
      return;
    }

    const nextEvent = networkEvents.find(
      event =>
        event.id === selectedSegment.eventId &&
        (event.group?.id ?? event.group_id) === selectedGroup.id
    );
    if (!nextEvent || selectedEvent?.id === nextEvent.id) {
      return;
    }

    setSelectedEvent({ id: nextEvent.id, data: nextEvent });
  }, [networkEvents, pathWithEvents, selectedEvent, selectedGroup?.id, targetPathSegment]);

  const validatePathEventOrder = useCallback((segments: PathWithEventSegment[]): string | null => {
    for (const current of segments) {
      const currentEventEnd = current.eventEndDate ?? current.eventStartDate;
      if (
        current.eventStartDate != null &&
        current.requiredAfter != null &&
        current.eventStartDate < current.requiredAfter
      ) {
        return 'Ein Event liegt vor dem vorherigen Prozessschritt.';
      }
      if (
        currentEventEnd != null &&
        current.requiredBefore != null &&
        currentEventEnd > current.requiredBefore
      ) {
        return 'Ein Event liegt nach dem naechsten bereits geplanten Prozessschritt.';
      }
    }

    return null;
  }, []);

  const updatePathSegmentEvent = useCallback(
    (segmentKey: string, item: TypeaheadItem | null) => {
      const targetSegment = pathWithEvents.find(segment => segment.segmentKey === segmentKey);
      if (!targetSegment) {
        return;
      }

      if (!item) {
        setPathWithEvents(previous =>
          rehydratePathSegmentsWithWindows(
            previous.map(segment =>
              segment.segmentKey === segmentKey
                ? {
                    ...segment,
                    eventId: null,
                    eventTitle: 'Pending event',
                    eventStartDate: null,
                    eventEndDate: null,
                    missingEvent: true,
                  }
                : segment
            )
          )
        );

        if (targetPathSegment?.segmentKey === segmentKey) {
          setSelectedEvent(null);
        }
        return;
      }

      const event =
        (targetPathSegment?.segmentKey === segmentKey
          ? upcomingEvents.find(candidateEvent => candidateEvent.id === item.id)
          : undefined) ??
        getUpcomingEventsForGroup(targetSegment.groupId, targetSegment).find(
          candidateEvent => candidateEvent.id === item.id
        );

      if (!event) {
        return;
      }

      setPathWithEvents(previous =>
        rehydratePathSegmentsWithWindows(
          previous.map(segment =>
            segment.segmentKey === segmentKey
              ? {
                  ...segment,
                  eventId: event.id,
                  eventTitle: String(event.title ?? ''),
                  eventStartDate: event.start_date ?? null,
                  eventEndDate: event.end_date ?? event.start_date ?? null,
                  missingEvent: false,
                }
              : segment
          )
        )
      );

      if (targetPathSegment?.segmentKey === segmentKey) {
        setSelectedEvent({ id: event.id, data: event });
      }
    },
    [getUpcomingEventsForGroup, pathWithEvents, targetPathSegment?.segmentKey, upcomingEvents]
  );

  useEffect(() => {
    if (!selectedSourceGroup || !selectedGroup) {
      return;
    }

    if (pathWithEvents.length === 0) {
      return;
    }

    const validationError = validatePathEventOrder(pathWithEvents);
    setPathValidationError(validationError);
    if (validationError) {
      lastEmittedSelectionRef.current = null;
      onSelect(null);
      return;
    }

    const finalSegment = targetPathSegment ?? pathWithEvents[pathWithEvents.length - 1] ?? null;
    const targetEventId = finalSegment?.eventId ?? selectedEvent?.id ?? null;
    if (!targetEventId && !allowGroupWithoutEvent) {
      lastEmittedSelectionRef.current = null;
      onSelect(null);
      return;
    }

    const targetEvent = targetEventId
      ? (getUpcomingEventsForGroup(finalSegment?.groupId ?? selectedGroup.id, finalSegment).find(
          event => event.id === targetEventId
        ) ??
        selectedEvent?.data ??
        null)
      : null;
    const missingEventSteps = pathWithEvents.filter(segment => !segment.eventId);
    const selectionSignature = JSON.stringify({
      sourceGroupId: selectedSourceGroup.id,
      groupId: selectedGroup.id,
      eventId: targetEventId,
      pathMode,
      workflowId: selectedWorkflowIdState || null,
      path: pathWithEvents.map(segment => ({
        segmentKey: segment.segmentKey,
        groupId: segment.groupId,
        eventId: segment.eventId,
        requiredAfter: segment.requiredAfter,
        requiredBefore: segment.requiredBefore,
      })),
    });

    if (lastEmittedSelectionRef.current === selectionSignature) {
      return;
    }

    lastEmittedSelectionRef.current = selectionSignature;
    onSelect({
      sourceGroupId: selectedSourceGroup.id,
      groupId: selectedGroup.id,
      groupData: selectedGroup.data,
      eventId: targetEventId,
      eventData: targetEvent,
      pathWithEvents,
      missingEventSteps,
      selectedUserId,
      pathMode,
      workflowId: selectedWorkflowIdState || null,
    });
  }, [
    allowGroupWithoutEvent,
    getUpcomingEventsForGroup,
    onSelect,
    pathMode,
    pathWithEvents,
    selectedEvent?.data,
    selectedEvent?.id,
    selectedGroup,
    selectedHierarchyPathId,
    selectedSourceGroup,
    selectedUserId,
    selectedWorkflowIdState,
    targetPathSegment,
    upcomingEvents,
    validatePathEventOrder,
  ]);

  const selectSourceGroup = useCallback(
    (group: AmendmentNetworkGroup | null) => {
      if (!group) {
        setSelectedSourceGroup(null);
        setSelectedGroup(null);
        setSelectedEvent(null);
        setPathWithEvents([]);
        setSelectedHierarchyPathId('');
        setPathValidationError(null);
        onSourceGroupSelectionChange?.(null);
        onGroupSelectionChange?.(null);
        onSelect(null);
        return;
      }

      setSelectedSourceGroup({ id: group.id, data: group });
      setSelectedGroup(null);
      setSelectedEvent(null);
      setPathWithEvents([]);
      setSelectedHierarchyPathId('');
      setPathValidationError(null);
      onSourceGroupSelectionChange?.(group.id);
      onGroupSelectionChange?.(null);
    },
    [onGroupSelectionChange, onSelect, onSourceGroupSelectionChange]
  );

  const selectTargetGroup = useCallback(
    (group: AmendmentNetworkGroup | null) => {
      if (!group) {
        setSelectedGroup(null);
        setSelectedEvent(null);
        setPathWithEvents([]);
        setSelectedHierarchyPathId('');
        setPathValidationError(null);
        onGroupSelectionChange?.(null);
        onSelect(null);
        return;
      }

      setSelectedGroup({ id: group.id, data: group });
      setSelectedEvent(null);
      setPathWithEvents([]);
      setSelectedHierarchyPathId('');
      setPathValidationError(null);
      onGroupSelectionChange?.(group.id);
    },
    [onGroupSelectionChange, onSelect]
  );

  const handleSourceGroupSelection = useCallback(
    (item: TypeaheadItem | null) => {
      if (!item) {
        selectSourceGroup(null);
        return;
      }

      const nextSourceGroup = activeSourceGroups.find(group => group.id === item.id);
      if (!nextSourceGroup) {
        return;
      }

      selectSourceGroup(nextSourceGroup);
    },
    [activeSourceGroups, selectSourceGroup]
  );

  const handleGroupSelection = useCallback(
    (availableGroups: readonly AmendmentNetworkGroup[], item: TypeaheadItem | null) => {
      if (!item) {
        selectTargetGroup(null);
        return;
      }

      const group = availableGroups.find(currentGroup => currentGroup.id === item.id);
      if (!group) {
        return;
      }

      selectTargetGroup(group);
    },
    [selectTargetGroup]
  );

  const handleStartGraphGroupClick = useCallback(
    (groupId: string) => {
      const nextSourceGroup = activeSourceGroups.find(group => group.id === groupId);
      if (!nextSourceGroup) {
        return;
      }

      selectSourceGroup(nextSourceGroup);
    },
    [activeSourceGroups, selectSourceGroup]
  );

  const handleTargetGraphGroupClick = useCallback(
    (groupId: string) => {
      if (!selectedSourceGroup) {
        return;
      }

      if (allowSourceGroupAsTarget && groupId === selectedSourceGroup.id) {
        selectTargetGroup(selectedSourceGroup.data);
        return;
      }

      const nextTargetGroup = availableTargetGroups.find(group => group.id === groupId);
      if (!nextTargetGroup) {
        return;
      }

      selectTargetGroup(nextTargetGroup);
    },
    [allowSourceGroupAsTarget, availableTargetGroups, selectTargetGroup, selectedSourceGroup]
  );

  const targetEventItems = useMemo(
    () =>
      toTypeaheadItems(
        upcomingEvents,
        'event',
        event => event.title || 'Event',
        event => {
          const dateLabel =
            formatEventWindowLabel(event.start_date) ??
            translateText('generated.inline.0021_kein_datum_c1783680');
          return event.location_name ? `${dateLabel} - ${event.location_name}` : dateLabel;
        },
        undefined,
        event => `/event/${event.id}`
      ),
    [upcomingEvents]
  );

  return (
    <div className="space-y-4">
      {collaborators.length > 0 && (
        <div className="flex items-center gap-3">
          <User className="text-muted-foreground h-4 w-4" />
          <div className="flex-1">
            <TypeaheadSearch
              items={toTypeaheadItems(
                collaborators,
                'user',
                collaborator => collaborator.name || 'User',
                collaborator => collaborator.email,
                collaborator => collaborator.avatar,
                collaborator => `/user/${collaborator.id}`
              )}
              value={selectedUserId}
              onChange={(item: TypeaheadItem | null) => setSelectedUserId(item?.id ?? '')}
              placeholder={translateText(
                'generated.inline.0176_netzwerk_einer_person_auswaehlen_3ec337aa'
              )}
              label={translateText('generated.inline.0177_netzwerk_9b8cf3f3')}
              disablePortal={disablePortal}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <FormControlLabel>
          {translateText('generated.inline.0178_startgruppe_27591dc9')}
        </FormControlLabel>
        {activeSourceGroups.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {translateText(
              'generated.inline.0179_keine_aktive_mitgliedschaft_mit_moeglichem_am_3dc842fc'
            )}
          </p>
        ) : (
          <TypeaheadSearch
            items={toTypeaheadItems(
              activeSourceGroups,
              'group',
              group => group.name || 'Group',
              group =>
                typeof group.description === 'string'
                  ? group.description.substring(0, 60)
                  : undefined,
              undefined,
              group => `/group/${group.id}`
            )}
            value={selectedSourceGroup?.id || ''}
            onChange={handleSourceGroupSelection}
            placeholder={translateText('generated.inline.0180_startgruppe_auswaehlen_2ffb380f')}
            disablePortal={disablePortal}
          />
        )}
      </div>

      {allWorkflows.length > 0 ? (
        <Tabs
          value={pathMode}
          onValueChange={value => {
            const nextMode = value as 'hierarchy' | 'workflow';
            setPathMode(nextMode);
            onPathModeChange?.(nextMode);
            setSelectedGroup(null);
            setSelectedEvent(null);
            setPathWithEvents([]);
            setPathValidationError(null);
            if (nextMode === 'hierarchy') {
              setSelectedWorkflowIdState('');
              onWorkflowSelectionChange?.(null);
            }
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="hierarchy" className="flex-1">
              <GitBranch className="mr-2 h-4 w-4" />
              {translateText('generated.inline.0181_hierarchie_b73f9b95')}
            </TabsTrigger>
            <TabsTrigger value="workflow" className="flex-1">
              <Workflow className="mr-2 h-4 w-4" />
              {translateText('generated.inline.0182_workflow_d7a48414')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hierarchy" className="space-y-4">
            <div className="space-y-2">
              <FormControlLabel>
                {translateText('generated.inline.0183_zielgruppe_10f54053')}
              </FormControlLabel>
              {availableTargetGroups.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {translateText(
                    'generated.inline.0184_fuer_diese_startgruppe_gibt_es_keine_rekursiv_5eba3922'
                  )}
                </p>
              ) : (
                <TypeaheadSearch
                  items={toTypeaheadItems(
                    availableTargetGroups,
                    'group',
                    group => group.name || 'Group',
                    group =>
                      typeof group.description === 'string'
                        ? group.description.substring(0, 60)
                        : undefined,
                    undefined,
                    group => `/group/${group.id}`
                  )}
                  value={selectedGroup?.id || ''}
                  onChange={(item: TypeaheadItem | null) =>
                    handleGroupSelection(availableTargetGroups, item)
                  }
                  placeholder={translateText('generated.inline.0185_zielgruppe_suchen_aa7a77c8')}
                  disablePortal={disablePortal}
                />
              )}
            </div>

            {selectedSourceGroup && selectedGroup && availableHierarchyPaths.length > 1 ? (
              <div className="space-y-2">
                <FormControlLabel>
                  {translateText('generated.inline.0186_route_4999528e')}
                </FormControlLabel>
                <FormControlSelect
                  value={selectedHierarchyPathId}
                  onValueChange={value => {
                    setSelectedHierarchyPathId(value);
                    setSelectedEvent(null);
                    setPathWithEvents([]);
                    setPathValidationError(null);
                  }}
                >
                  <FormControlSelectTrigger>
                    <FormControlSelectValue
                      placeholder={translateText('generated.inline.0187_pfad_auswaehlen_42ca323f')}
                    />
                  </FormControlSelectTrigger>
                  <FormControlSelectContent>
                    {availableHierarchyPaths.map(pathOption => (
                      <FormControlSelectItem key={pathOption.id} value={pathOption.id}>
                        {formatPathOptionLabel(pathOption, networkGroups)}
                      </FormControlSelectItem>
                    ))}
                  </FormControlSelectContent>
                </FormControlSelect>
                <p className="text-muted-foreground text-xs">
                  {translateText(
                    'generated.inline.0188_mehrere_gueltige_amendment_pfade_gefunden_hie_635b9345'
                  )}
                </p>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="workflow" className="space-y-4">
            <div className="space-y-2">
              <FormControlLabel>
                {translateText('generated.inline.0189_ziel_workflow_f6a9c843')}
              </FormControlLabel>
              <TypeaheadSearch
                items={toTypeaheadItems(
                  reachableWorkflows,
                  'group',
                  workflow => workflow.name || 'Workflow',
                  workflow => (workflow.group?.name ? `Gruppe: ${workflow.group.name}` : undefined),
                  undefined,
                  workflow => (workflow.group_id ? `/group/${workflow.group_id}` : undefined)
                )}
                value={selectedWorkflowIdState}
                onChange={(item: TypeaheadItem | null) => {
                  const nextWorkflowId = item?.id ?? '';
                  setSelectedWorkflowIdState(nextWorkflowId);
                  onWorkflowSelectionChange?.(nextWorkflowId || null);
                  setSelectedGroup(null);
                  setSelectedEvent(null);
                  setPathWithEvents([]);
                  setSelectedHierarchyPathId('');
                  setPathValidationError(null);
                }}
                placeholder={translateText('generated.inline.0190_workflow_auswaehlen_633186d5')}
                disablePortal={disablePortal}
              />
            </div>

            {selectedWorkflowIdState && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FormControlLabel>
                    {translateText('generated.inline.0191_workflow_start_24e8baa4')}
                  </FormControlLabel>
                  <div className="bg-muted/40 rounded-md border px-3 py-2 text-sm font-medium">
                    {selectedWorkflowStartGroup?.name ??
                      translateText('generated.inline.0028_unbekannt_d0b00a9f')}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {translateText(
                      'generated.inline.0192_die_quellgruppe_erreicht_diesen_startpunkt_zu_0c954787'
                    )}
                  </p>
                </div>

                <div className="space-y-2">
                  <FormControlLabel>
                    {translateText('generated.inline.0193_abgeleitete_zielgruppe_28e1d067')}
                  </FormControlLabel>
                  <div className="bg-muted/40 rounded-md border px-3 py-2 text-sm font-medium">
                    {selectedWorkflowFinalGroup?.name ??
                      translateText('generated.inline.0028_unbekannt_d0b00a9f')}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {translateText(
                      'generated.inline.0194_im_workflow_modus_wird_die_finale_zielgruppe__420dcffc'
                    )}
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-2">
          <FormControlLabel>
            {translateText('generated.inline.0183_zielgruppe_10f54053')}
          </FormControlLabel>
          {availableTargetGroups.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {translateText(
                'generated.inline.0184_fuer_diese_startgruppe_gibt_es_keine_rekursiv_5eba3922'
              )}
            </p>
          ) : (
            <TypeaheadSearch
              items={toTypeaheadItems(
                availableTargetGroups,
                'group',
                group => group.name || 'Group',
                group =>
                  typeof group.description === 'string'
                    ? group.description.substring(0, 60)
                    : undefined,
                undefined,
                group => `/group/${group.id}`
              )}
              value={selectedGroup?.id || ''}
              onChange={(item: TypeaheadItem | null) =>
                handleGroupSelection(availableTargetGroups, item)
              }
              placeholder={translateText('generated.inline.0185_zielgruppe_suchen_aa7a77c8')}
              disablePortal={disablePortal}
            />
          )}
        </div>
      )}

      <div className="space-y-2">
        <FormControlLabel>
          {selectedSourceGroup
            ? translateText('generated.inline.0029_netzwerk_der_startgruppe_e8e9bbf1')
            : translateText('generated.inline.0030_startgruppen_netzwerk_83d1c873')}
        </FormControlLabel>
        <div className="h-[28rem] min-h-[28rem] overflow-hidden rounded-md border">
          {selectedSourceGroup ? (
            <GroupNetworkFlow
              groupId={selectedSourceGroup.id}
              filterRight="amendmentRight"
              title={translateText('generated.inline.0195_zielgruppen_netzwerk_d91c9750')}
              description={`Waehle eine erreichbare Zielgruppe ausgehend von ${selectedSourceGroup.data.name ?? 'der Startgruppe'}.`}
              onGroupClick={groupId => handleTargetGraphGroupClick(groupId)}
              showGroupDialogOnClick={false}
              showWorkflowView={false}
              layoutScopeKey={`amendment-selector:${layoutScope}:group:${selectedSourceGroup.id}`}
            />
          ) : (
            <UserNetworkFlow
              userId={selectedUserId}
              filterRight="amendmentRight"
              title={translateText('generated.inline.0196_startgruppen_netzwerk_83d1c873')}
              description={translateText(
                'generated.inline.0197_waehle_eine_deiner_aktiven_startgruppen_aus_d_058cc520'
              )}
              onGroupClick={groupId => handleStartGraphGroupClick(groupId)}
              showGroupDialogOnClick={false}
              layoutScopeKey={`amendment-selector:${layoutScope}:user:${selectedUserId}`}
            />
          )}
        </div>
      </div>

      {selectedGroup && (
        <div className="space-y-2">
          <FormControlLabel>
            {translateText('generated.inline.0198_ziel_event_8f4df57f')}
          </FormControlLabel>
          {upcomingEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {translateText(
                'generated.inline.0199_fuer_die_zielgruppe_gibt_es_noch_kein_passend_f6bd2a81'
              )}
            </p>
          ) : (
            <TypeaheadSearch
              items={targetEventItems}
              value={selectedEvent?.id || ''}
              onChange={(item: TypeaheadItem | null) =>
                targetPathSegment
                  ? updatePathSegmentEvent(targetPathSegment.segmentKey, item)
                  : undefined
              }
              placeholder={translateText('generated.inline.0200_event_suchen_389f187f')}
              disablePortal={disablePortal}
            />
          )}
        </div>
      )}

      {pathWithEvents.length > 0 && (
        <div className="border-border bg-muted/30 space-y-3 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Target className="text-muted-foreground h-4 w-4" />
            <FormControlLabel className="text-sm">
              {translateText('generated.inline.0201_prozesspfad_a9e34361')}
            </FormControlLabel>
          </div>

          <div className="space-y-3">
            {pathWithEvents.map((segment, index) => {
              const segmentEvents =
                segment.segmentKey === targetPathSegment?.segmentKey
                  ? upcomingEvents
                  : getUpcomingEventsForGroup(segment.groupId, segment);

              return (
                <div
                  key={segment.segmentKey}
                  className="border-border bg-background rounded-md border p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{segment.groupName}</p>
                      {segment.stepLabel ? (
                        <p className="text-muted-foreground text-xs">{segment.stepLabel}</p>
                      ) : null}
                      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                        {segment.requiredAfter ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            {translateText('generated.inline.0202_nicht_vor_96c35f3c')}
                            {formatEventWindowLabel(segment.requiredAfter)}
                          </span>
                        ) : null}
                        {segment.requiredBefore ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            {translateText('generated.inline.0203_nicht_nach_e88cbaab')}
                            {formatEventWindowLabel(segment.requiredBefore)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <BadgeControl
                      variant={segment.eventId ? 'secondary' : 'outline'}
                      className="text-xs"
                    >
                      {translateText('generated.inline.0204_schritt_cc71ba9d')}
                      {index + 1}
                    </BadgeControl>
                  </div>

                  {segmentEvents.length > 0 ? (
                    <TypeaheadSearch
                      items={toTypeaheadItems(
                        segmentEvents,
                        'event',
                        event => event.title || 'Event',
                        event => formatEventWindowLabel(event.start_date) ?? 'Kein Datum',
                        undefined,
                        event => `/event/${event.id}`
                      )}
                      value={segment.eventId ?? undefined}
                      onChange={(item: TypeaheadItem | null) =>
                        updatePathSegmentEvent(segment.segmentKey, item)
                      }
                      placeholder={translateText(
                        'generated.inline.0205_event_fuer_diesen_schritt_auswaehlen_d72eb838'
                      )}
                      disablePortal={disablePortal}
                    />
                  ) : (
                    <div className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
                      {translateText(
                        'generated.inline.0206_kein_passendes_event_gefunden_fuer_diesen_sch_36c2ce7b'
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {pathValidationError && <p className="text-destructive text-xs">{pathValidationError}</p>}
        </div>
      )}
    </div>
  );
}

interface DisplayGroupData {
  id: string;
  name?: string | null;
  description?: string | null;
  member_count?: number | null;
  event_count?: number | null;
  amendment_count?: number | null;
}

interface DisplayEventData {
  id: string;
  title?: string | null;
  start_date?: number | null;
  location_name?: string | null;
  description?: string | null;
  participant_count?: number | null;
}

interface TargetGroupEventDisplayProps {
  groupData: DisplayGroupData;
  eventData: DisplayEventData | null;
  pathWithEvents?: PathWithEventSegment[];
}

export function TargetGroupEventDisplay({
  groupData,
  eventData,
  pathWithEvents = [],
}: TargetGroupEventDisplayProps) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-muted-foreground mb-2 text-sm font-semibold uppercase">
          {translateText('generated.inline.0207_target_group_155fdbe3')}
        </h4>
        <GroupTimelineCard
          group={{
            id: groupData.id,
            name: groupData.name ?? '',
            description: groupData.description ?? undefined,
            memberCount: groupData.member_count ?? 0,
            eventCount: groupData.event_count ?? 0,
            amendmentCount: groupData.amendment_count ?? 0,
          }}
        />
      </div>

      <div>
        <h4 className="text-muted-foreground mb-2 text-sm font-semibold uppercase">
          {translateText('generated.inline.0208_target_event_cf4f7f67')}
        </h4>
        {eventData ? (
          <EventTimelineCard
            event={{
              id: eventData.id,
              title: eventData.title ?? '',
              description: eventData.description ?? undefined,
              startDate: eventData.start_date ? new Date(eventData.start_date) : new Date(),
              location: eventData.location_name ?? undefined,
              attendeeCount: eventData.participant_count ?? 0,
            }}
          />
        ) : (
          <div className="text-muted-foreground border-border bg-muted/40 rounded-md border border-dashed p-4 text-sm">
            {translateText('generated.inline.0209_noch_kein_ziel_event_ausgewaehlt_d8423180')}
          </div>
        )}
      </div>

      {pathWithEvents.length > 0 && (
        <div className="bg-muted text-muted-foreground rounded-md p-3 text-xs">
          <p className="font-semibold">
            {translateText('generated.inline.0210_amendment_path_e39aca13')}
            {pathWithEvents.length}
            {translateText('generated.inline.0211_groups_81b46c7e')}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {pathWithEvents.map((segment, index) => (
              <div key={segment.segmentKey} className="flex items-center gap-1">
                <BadgeControl
                  variant={segment.eventId ? 'secondary' : 'outline'}
                  className="text-xs"
                >
                  {segment.stepLabel
                    ? `${segment.groupName} (${segment.stepLabel})`
                    : segment.groupName}
                </BadgeControl>
                {index < pathWithEvents.length - 1 && (
                  <ChevronRight className="text-muted-foreground h-3 w-3" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
