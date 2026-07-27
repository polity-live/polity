'use client';

import { BadgeControl } from '@/features/shared/ui/status';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { ChevronRight } from 'lucide-react';
import { GroupTimelineCard } from '@/features/timeline/ui/cards/GroupTimelineCard';
import { EventTimelineCard } from '@/features/timeline/ui/cards/EventTimelineCard';
import {
  translate as translateText,
  useTranslation,
} from '@/features/shared/hooks/use-translation';
import { reportAppTutorialAction } from '@/features/app-tutorial/events';
import { TargetGroupEventSelectorView } from './TargetGroupEventSelectorView';
import { resolveAppTutorialFixtureText } from '@/features/app-tutorial/fixture-copy';

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
  excludedSourceGroupIds?: string[];
  fixedTargetGroupId?: string | null;
  fixedWorkflowId?: string | null;
  lockTargetSelection?: boolean;
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
  excludedSourceGroupIds = [],
  fixedTargetGroupId = null,
  fixedWorkflowId = null,
  lockTargetSelection = false,
  disablePortal = false,
  allowGroupWithoutEvent = false,
  allowSourceGroupAsTarget = false,
  layoutScope = 'default',
}: TargetGroupEventSelectorProps) {
  const { language, t } = useTranslation();
  const hasInitializedUserSelection = useRef(false);
  const sourcePrefillRef = useRef<string | null>(null);
  const targetPrefillRef = useRef<string | null>(null);
  const lastEmittedSelectionRef = useRef<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<string>(userId);
  const [pathMode, setPathMode] = useState<'hierarchy' | 'workflow'>(
    fixedWorkflowId ? 'workflow' : (selectedPathMode ?? 'hierarchy')
  );
  const [selectedWorkflowIdState, setSelectedWorkflowIdState] = useState<string>(
    fixedWorkflowId ?? selectedWorkflowId ?? ''
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
  const excludedSourceGroupIdSet = useMemo(
    () => new Set(excludedSourceGroupIds),
    [excludedSourceGroupIds]
  );

  const activeSourceGroups = useMemo(() => {
    const sourceGroupIds = getActiveUserGroupIds(networkMemberships, currentUserId);
    return dedupeGroupsById(
      networkGroups.filter(
        group => sourceGroupIds.includes(group.id) && !excludedSourceGroupIdSet.has(group.id)
      )
    );
  }, [currentUserId, excludedSourceGroupIdSet, networkGroups, networkMemberships]);

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

  const fixedTargetGroup = useMemo(
    () => networkGroups.find(group => group.id === fixedTargetGroupId) ?? null,
    [fixedTargetGroupId, networkGroups]
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

    if (lockTargetSelection && fixedTargetGroup) {
      if (pathMode === 'workflow') {
        return selectedWorkflowFinalGroup ? [selectedWorkflowFinalGroup] : [];
      }

      return [fixedTargetGroup];
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
    fixedTargetGroup,
    lockTargetSelection,
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
    if (fixedWorkflowId) {
      setPathMode('workflow');
      return;
    }

    if (selectedPathMode) {
      setPathMode(selectedPathMode);
    }
  }, [fixedWorkflowId, selectedPathMode]);

  useEffect(() => {
    if (fixedWorkflowId) {
      setSelectedWorkflowIdState(fixedWorkflowId);
      return;
    }

    if (selectedWorkflowId !== undefined) {
      setSelectedWorkflowIdState(selectedWorkflowId ?? '');
    }
  }, [fixedWorkflowId, selectedWorkflowId]);

  useEffect(() => {
    if (!lockTargetSelection || !fixedTargetGroup || pathMode === 'workflow') {
      return;
    }

    if (selectedGroup?.id === fixedTargetGroup.id) {
      return;
    }

    setSelectedGroup({ id: fixedTargetGroup.id, data: fixedTargetGroup });
    onGroupSelectionChange?.(fixedTargetGroup.id);
  }, [fixedTargetGroup, lockTargetSelection, onGroupSelectionChange, pathMode, selectedGroup?.id]);

  useEffect(() => {
    if (
      fixedWorkflowId ||
      !selectedWorkflowIdState ||
      !selectedSourceGroup?.id ||
      allWorkflows.length === 0
    ) {
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
    fixedWorkflowId,
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
    if (
      selectedSourceGroup &&
      activeSourceGroups.length > 0 &&
      !activeSourceGroups.some(group => group.id === selectedSourceGroup.id)
    ) {
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

    if (selectedSourceGroupId && selectedSourceGroupId !== sourcePrefillRef.current) {
      const nextSourceGroup = activeSourceGroups.find(group => group.id === selectedSourceGroupId);
      if (nextSourceGroup) {
        setSelectedSourceGroup({ id: nextSourceGroup.id, data: nextSourceGroup });
        sourcePrefillRef.current = selectedSourceGroupId;
      }
      return;
    }

    if (
      layoutScope !== 'amendment-process-start' &&
      !selectedSourceGroupId &&
      !selectedSourceGroup &&
      activeSourceGroups.length === 1
    ) {
      const defaultSourceGroup = activeSourceGroups[0];
      setSelectedSourceGroup({ id: defaultSourceGroup.id, data: defaultSourceGroup });
      onSourceGroupSelectionChange?.(defaultSourceGroup.id);
    }
  }, [
    activeSourceGroups,
    layoutScope,
    onSourceGroupSelectionChange,
    onGroupSelectionChange,
    onSelect,
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
        'Kein zulässiger Prozesspfad zwischen Start- und Zielgruppe gefunden.'
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

  const validatePathEventOrder = useCallback(
    (segments: PathWithEventSegment[]): string | null => {
      for (const current of segments) {
        const currentEventEnd = current.eventEndDate ?? current.eventStartDate;
        if (
          current.eventStartDate != null &&
          current.requiredAfter != null &&
          current.eventStartDate < current.requiredAfter
        ) {
          return t('features.amendments.process.eventBeforePreviousStep');
        }
        if (
          currentEventEnd != null &&
          current.requiredBefore != null &&
          currentEventEnd > current.requiredBefore
        ) {
          return t('features.amendments.process.eventAfterNextStep');
        }
      }

      return null;
    },
    [t]
  );

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
      if (layoutScope === 'amendment-process-start' && group.tutorial_run_id) {
        reportAppTutorialAction({
          type: 'entity-selection',
          entityId: group.id,
        });
      }
    },
    [layoutScope, onGroupSelectionChange, onSelect, onSourceGroupSelectionChange]
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
      if (layoutScope === 'amendment-process-start' && group.tutorial_run_id) {
        reportAppTutorialAction({
          type: 'entity-selection',
          entityId: group.id,
        });
      }
    },
    [layoutScope, onGroupSelectionChange, onSelect]
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
        event =>
          resolveAppTutorialFixtureText(event.title, {
            tutorialRunId: event.tutorial_run_id,
            language,
          }) || 'Event',
        event => {
          const dateLabel =
            formatEventWindowLabel(event.start_date) ??
            translateText('generated.inline.0021_kein_datum_c1783680');
          return event.location_name ? `${dateLabel} - ${event.location_name}` : dateLabel;
        },
        undefined,
        event => `/event/${event.id}`
      ),
    [language, upcomingEvents]
  );

  const handleSelectedUserChange = useCallback((item: TypeaheadItem | null) => {
    setSelectedUserId(item?.id ?? '');
  }, []);

  const handlePathModeValueChange = useCallback(
    (value: string) => {
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
    },
    [onPathModeChange, onWorkflowSelectionChange]
  );

  const handleHierarchyPathValueChange = useCallback((value: string) => {
    setSelectedHierarchyPathId(value);
    setSelectedEvent(null);
    setPathWithEvents([]);
    setPathValidationError(null);
  }, []);

  const handleWorkflowItemChange = useCallback(
    (item: TypeaheadItem | null) => {
      const nextWorkflowId = item?.id ?? '';
      setSelectedWorkflowIdState(nextWorkflowId);
      onWorkflowSelectionChange?.(nextWorkflowId || null);
      setSelectedGroup(null);
      setSelectedEvent(null);
      setPathWithEvents([]);
      setSelectedHierarchyPathId('');
      setPathValidationError(null);
    },
    [onWorkflowSelectionChange]
  );

  const handleTargetGroupChange = useCallback(
    (item: TypeaheadItem | null) => handleGroupSelection(availableTargetGroups, item),
    [availableTargetGroups, handleGroupSelection]
  );

  const handleTargetEventChange = useCallback(
    (item: TypeaheadItem | null) => {
      if (targetPathSegment) {
        updatePathSegmentEvent(targetPathSegment.segmentKey, item);
      }
    },
    [targetPathSegment, updatePathSegmentEvent]
  );

  const handlePathSegmentEventChange = useCallback(
    (segmentKey: string, item: TypeaheadItem | null) => {
      updatePathSegmentEvent(segmentKey, item);
    },
    [updatePathSegmentEvent]
  );

  return (
    <TargetGroupEventSelectorView
      activeSourceGroups={activeSourceGroups}
      allWorkflows={allWorkflows}
      availableHierarchyPaths={availableHierarchyPaths}
      availableTargetGroups={availableTargetGroups}
      collaborators={collaborators}
      disablePortal={disablePortal}
      getUpcomingEventsForGroup={getUpcomingEventsForGroup}
      handleSourceGroupSelection={handleSourceGroupSelection}
      handleStartGraphGroupClick={handleStartGraphGroupClick}
      handleTargetGraphGroupClick={handleTargetGraphGroupClick}
      layoutScope={layoutScope}
      lockTargetSelection={lockTargetSelection}
      networkGroups={networkGroups}
      onHierarchyPathValueChange={handleHierarchyPathValueChange}
      onPathModeValueChange={handlePathModeValueChange}
      onPathSegmentEventChange={handlePathSegmentEventChange}
      onSelectedUserChange={handleSelectedUserChange}
      onTargetEventChange={handleTargetEventChange}
      onTargetGroupChange={handleTargetGroupChange}
      onWorkflowItemChange={handleWorkflowItemChange}
      pathMode={pathMode}
      pathValidationError={pathValidationError}
      pathWithEvents={pathWithEvents}
      reachableWorkflows={reachableWorkflows}
      selectedGroup={selectedGroup}
      selectedHierarchyPathId={selectedHierarchyPathId}
      selectedEvent={selectedEvent}
      selectedSourceGroup={selectedSourceGroup}
      selectedUserId={selectedUserId}
      selectedWorkflowFinalGroup={selectedWorkflowFinalGroup}
      selectedWorkflow={selectedWorkflow}
      selectedWorkflowIdState={selectedWorkflowIdState}
      selectedWorkflowStartGroup={selectedWorkflowStartGroup}
      targetEventItems={targetEventItems}
      targetPathSegment={targetPathSegment}
      upcomingEvents={upcomingEvents}
    />
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
          className="entity-search-card-no-spotlight"
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
            className="entity-search-card-no-spotlight"
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
            {translateText('features.amendments.process.groupsCount', {
              count: pathWithEvents.length,
            })}
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
