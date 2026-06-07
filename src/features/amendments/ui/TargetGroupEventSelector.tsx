'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Label } from '@/features/shared/ui/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/features/shared/ui/ui/tabs';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import { useWorkflowState } from '@/zero/network/useWorkflowState';
import {
  type AmendmentNetworkEvent,
  type AmendmentNetworkGroup,
  type PathWithEventSegment,
  calculateProcessPathWithClosestEvents,
  calculateWorkflowPathWithClosestEvents,
  getActiveUserGroupIds,
  getReachableTargetGroupsFromSource,
} from '@/features/amendments/logic/amendmentPathHelpers';
import { CalendarClock, ChevronRight, GitBranch, Target, User, Workflow } from 'lucide-react';
import { GroupTimelineCard } from '@/features/timeline/ui/cards/GroupTimelineCard';
import { EventTimelineCard } from '@/features/timeline/ui/cards/EventTimelineCard';

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
  disablePortal = false,
  allowGroupWithoutEvent = false,
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
  const [pathValidationError, setPathValidationError] = useState<string | null>(null);

  const { allWorkflows } = useWorkflowState({});
  const {
    allGroups: groups,
    allGroupRelationships,
    allGroupMemberships,
    allEvents,
    eventsByGroup: groupEventsResult,
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

  const workflowTargetGroups = useMemo(() => {
    if (!selectedWorkflow) {
      return [];
    }

    const sortedSteps = [...(selectedWorkflow.steps ?? [])].sort(
      (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
    );
    const sourceIndex = selectedSourceGroup?.id
      ? sortedSteps.findIndex(step => step.group_id === selectedSourceGroup.id)
      : 0;
    const relevantSteps = sortedSteps.slice(sourceIndex >= 0 ? sourceIndex : 0);
    return dedupeGroupsById(
      relevantSteps
        .map(step => step.group)
        .filter((group): group is AmendmentNetworkGroup => Boolean(group?.id))
    );
  }, [selectedSourceGroup?.id, selectedWorkflow]);

  const connectedGroups = pathMode === 'workflow' ? workflowTargetGroups : reachableHierarchyGroups;

  const upcomingEvents = useMemo(
    () =>
      selectedGroup?.id
        ? [...(groupEventsResult ?? [])].sort((left, right) => {
            const now = Date.now();
            const leftFuture = (left.start_date ?? 0) > now;
            const rightFuture = (right.start_date ?? 0) > now;
            if (leftFuture && !rightFuture) return -1;
            if (!leftFuture && rightFuture) return 1;
            return (left.start_date ?? 0) - (right.start_date ?? 0);
          })
        : [],
    [groupEventsResult, selectedGroup?.id]
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
      connectedGroups.length === 0
    ) {
      return;
    }

    const nextTargetGroup = connectedGroups.find(group => group.id === selectedGroupId);
    if (!nextTargetGroup) {
      return;
    }

    setSelectedGroup({ id: nextTargetGroup.id, data: nextTargetGroup });
    targetPrefillRef.current = selectedGroupId;
  }, [connectedGroups, selectedGroupId]);

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
    setPathValidationError(null);
    onSourceGroupSelectionChange?.(null);
    onGroupSelectionChange?.(null);
    onSelect(null);
  }, [onGroupSelectionChange, onSelect, onSourceGroupSelectionChange, selectedUserId]);

  useEffect(() => {
    if (!selectedSourceGroup || !selectedGroup) {
      setPathWithEvents([]);
      setPathValidationError(null);
      lastEmittedSelectionRef.current = null;
      onSelect(null);
      return;
    }

    let calculatedPath: PathWithEventSegment[] | null = null;

    if (pathMode === 'workflow' && selectedWorkflowIdState) {
      calculatedPath = calculateWorkflowPathWithClosestEvents(
        selectedWorkflow?.steps ?? [],
        networkEvents,
        {
          sourceGroupId: selectedSourceGroup.id,
          targetGroupId: selectedGroup.id,
        }
      );
    } else {
      calculatedPath = calculateProcessPathWithClosestEvents({
        sourceGroupId: selectedSourceGroup.id,
        targetGroupId: selectedGroup.id,
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

    const seededPath = calculatedPath.map(segment =>
      segment.groupId === selectedGroup.id && selectedEvent
        ? {
            ...segment,
            eventId: selectedEvent.id,
            eventTitle: String(selectedEvent.data.title ?? ''),
            eventStartDate: selectedEvent.data.start_date ?? null,
            missingEvent: false,
          }
        : segment
    );

    setPathWithEvents(seededPath);
  }, [
    currentUserId,
    networkEvents,
    networkGroups,
    networkMemberships,
    networkRelationships,
    onSelect,
    pathMode,
    selectedEvent,
    selectedGroup,
    selectedSourceGroup,
    selectedWorkflow?.steps,
    selectedWorkflowIdState,
  ]);

  const validatePathEventOrder = useCallback((segments: PathWithEventSegment[]): string | null => {
    for (const current of segments) {
      if (
        current.eventStartDate != null &&
        current.requiredAfter != null &&
        current.eventStartDate < current.requiredAfter
      ) {
        return 'Ein Event liegt vor dem vorherigen Prozessschritt.';
      }
      if (
        current.eventStartDate != null &&
        current.requiredBefore != null &&
        current.eventStartDate > current.requiredBefore
      ) {
        return 'Ein Event liegt nach dem naechsten bereits geplanten Prozessschritt.';
      }
    }

    return null;
  }, []);

  const getUpcomingEventsForGroup = useCallback(
    (groupId: string) =>
      [...networkEvents]
        .filter(
          event =>
            (event.group?.id ?? event.group_id) === groupId && (event.start_date ?? 0) > Date.now()
        )
        .sort((left, right) => (left.start_date ?? 0) - (right.start_date ?? 0)),
    [networkEvents]
  );

  const updatePathSegmentEvent = useCallback(
    (groupId: string, item: TypeaheadItem | null) => {
      if (!item) {
        setPathWithEvents(previous =>
          previous.map(segment =>
            segment.groupId === groupId
              ? {
                  ...segment,
                  eventId: null,
                  eventTitle: 'Pending event',
                  eventStartDate: null,
                  missingEvent: true,
                }
              : segment
          )
        );

        if (selectedGroup?.id === groupId) {
          setSelectedEvent(null);
        }
        return;
      }

      const event =
        (groupId === selectedGroup?.id
          ? upcomingEvents.find(candidateEvent => candidateEvent.id === item.id)
          : undefined) ??
        getUpcomingEventsForGroup(groupId).find(candidateEvent => candidateEvent.id === item.id);

      if (!event) {
        return;
      }

      setPathWithEvents(previous =>
        previous.map(segment =>
          segment.groupId === groupId
            ? {
                ...segment,
                eventId: event.id,
                eventTitle: String(event.title ?? ''),
                eventStartDate: event.start_date ?? null,
                missingEvent: false,
              }
            : segment
        )
      );

      if (selectedGroup?.id === groupId) {
        setSelectedEvent({ id: event.id, data: event });
      }
    },
    [getUpcomingEventsForGroup, selectedGroup?.id, upcomingEvents]
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

    const targetEventId =
      pathWithEvents.find(segment => segment.groupId === selectedGroup.id)?.eventId ??
      selectedEvent?.id ??
      null;
    if (!targetEventId && !allowGroupWithoutEvent) {
      lastEmittedSelectionRef.current = null;
      onSelect(null);
      return;
    }

    const targetEvent = targetEventId
      ? (upcomingEvents.find(event => event.id === targetEventId) ?? selectedEvent?.data ?? null)
      : null;
    const missingEventSteps = pathWithEvents.filter(segment => !segment.eventId);
    const selectionSignature = JSON.stringify({
      sourceGroupId: selectedSourceGroup.id,
      groupId: selectedGroup.id,
      eventId: targetEventId,
      pathMode,
      workflowId: selectedWorkflowIdState || null,
      path: pathWithEvents.map(segment => ({
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
    onSelect,
    pathMode,
    pathWithEvents,
    selectedEvent?.data,
    selectedEvent?.id,
    selectedGroup,
    selectedSourceGroup,
    selectedUserId,
    selectedWorkflowIdState,
    upcomingEvents,
    validatePathEventOrder,
  ]);

  const handleSourceGroupSelection = useCallback(
    (item: TypeaheadItem | null) => {
      if (!item) {
        setSelectedSourceGroup(null);
        setSelectedGroup(null);
        setSelectedEvent(null);
        setPathWithEvents([]);
        setPathValidationError(null);
        onSourceGroupSelectionChange?.(null);
        onGroupSelectionChange?.(null);
        onSelect(null);
        return;
      }

      const nextSourceGroup = activeSourceGroups.find(group => group.id === item.id);
      if (!nextSourceGroup) {
        return;
      }

      setSelectedSourceGroup({ id: nextSourceGroup.id, data: nextSourceGroup });
      setSelectedGroup(null);
      setSelectedEvent(null);
      setPathWithEvents([]);
      setPathValidationError(null);
      onSourceGroupSelectionChange?.(nextSourceGroup.id);
      onGroupSelectionChange?.(null);
    },
    [activeSourceGroups, onGroupSelectionChange, onSelect, onSourceGroupSelectionChange]
  );

  const handleGroupSelection = useCallback(
    (availableGroups: readonly AmendmentNetworkGroup[], item: TypeaheadItem | null) => {
      if (!item) {
        setSelectedGroup(null);
        setSelectedEvent(null);
        setPathWithEvents([]);
        setPathValidationError(null);
        onGroupSelectionChange?.(null);
        onSelect(null);
        return;
      }

      const group = availableGroups.find(currentGroup => currentGroup.id === item.id);
      if (!group) {
        return;
      }

      setSelectedGroup({ id: group.id, data: group });
      setSelectedEvent(null);
      setPathWithEvents([]);
      setPathValidationError(null);
      onGroupSelectionChange?.(group.id);
    },
    [onGroupSelectionChange, onSelect]
  );

  const targetEventItems = useMemo(
    () =>
      toTypeaheadItems(
        upcomingEvents,
        'event',
        event => event.title || 'Event',
        event => {
          const dateLabel = formatEventWindowLabel(event.start_date) ?? 'Kein Datum';
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
              placeholder="Netzwerk einer Person auswaehlen..."
              label="Netzwerk:"
              disablePortal={disablePortal}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Startgruppe</Label>
        {activeSourceGroups.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Keine aktive Mitgliedschaft mit moeglichem Amendment-Start gefunden.
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
            placeholder="Startgruppe auswaehlen..."
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
              Hierarchie
            </TabsTrigger>
            <TabsTrigger value="workflow" className="flex-1">
              <Workflow className="mr-2 h-4 w-4" />
              Workflow
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hierarchy" className="space-y-4">
            <div className="space-y-2">
              <Label>Zielgruppe</Label>
              {connectedGroups.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Fuer diese Startgruppe gibt es keine rekursiv erreichbaren Zielgruppen.
                </p>
              ) : (
                <TypeaheadSearch
                  items={toTypeaheadItems(
                    connectedGroups,
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
                    handleGroupSelection(connectedGroups, item)
                  }
                  placeholder="Zielgruppe suchen..."
                  disablePortal={disablePortal}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="workflow" className="space-y-4">
            <div className="space-y-2">
              <Label>Ziel-Workflow</Label>
              <TypeaheadSearch
                items={toTypeaheadItems(
                  allWorkflows,
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
                  setPathValidationError(null);
                }}
                placeholder="Workflow auswaehlen..."
                disablePortal={disablePortal}
              />
            </div>

            {selectedWorkflowIdState && (
              <div className="space-y-2">
                <Label>Zielgruppe</Label>
                {connectedGroups.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Dieser Workflow bietet ab der gewaehlten Startgruppe keine Zielgruppen an.
                  </p>
                ) : (
                  <TypeaheadSearch
                    items={toTypeaheadItems(
                      connectedGroups,
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
                      handleGroupSelection(connectedGroups, item)
                    }
                    placeholder="Zielgruppe suchen..."
                    disablePortal={disablePortal}
                  />
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-2">
          <Label>Zielgruppe</Label>
          {connectedGroups.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Fuer diese Startgruppe gibt es keine rekursiv erreichbaren Zielgruppen.
            </p>
          ) : (
            <TypeaheadSearch
              items={toTypeaheadItems(
                connectedGroups,
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
              onChange={(item: TypeaheadItem | null) => handleGroupSelection(connectedGroups, item)}
              placeholder="Zielgruppe suchen..."
              disablePortal={disablePortal}
            />
          )}
        </div>
      )}

      {selectedGroup && (
        <div className="space-y-2">
          <Label>Ziel-Event</Label>
          {upcomingEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Fuer die Zielgruppe gibt es noch kein passendes Event. Der Schritt kann trotzdem als
              Event-Anfrage angelegt werden.
            </p>
          ) : (
            <TypeaheadSearch
              items={targetEventItems}
              value={selectedEvent?.id || ''}
              onChange={(item: TypeaheadItem | null) => {
                if (!item) {
                  setSelectedEvent(null);
                  return;
                }

                const nextEvent = upcomingEvents.find(event => event.id === item.id);
                if (nextEvent) {
                  setSelectedEvent({ id: nextEvent.id, data: nextEvent });
                }
              }}
              placeholder="Event suchen..."
              disablePortal={disablePortal}
            />
          )}
        </div>
      )}

      {pathWithEvents.length > 0 && (
        <div className="border-border bg-muted/30 space-y-3 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Target className="text-muted-foreground h-4 w-4" />
            <Label className="text-sm">Prozesspfad</Label>
          </div>

          <div className="space-y-3">
            {pathWithEvents.map((segment, index) => {
              const segmentEvents =
                segment.groupId === selectedGroup?.id
                  ? upcomingEvents
                  : getUpcomingEventsForGroup(segment.groupId);

              return (
                <div
                  key={`${segment.groupId}:${index}`}
                  className="border-border bg-background rounded-md border p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{segment.groupName}</p>
                      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                        {segment.requiredAfter ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            nicht vor {formatEventWindowLabel(segment.requiredAfter)}
                          </span>
                        ) : null}
                        {segment.requiredBefore ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            nicht nach {formatEventWindowLabel(segment.requiredBefore)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <Badge variant={segment.eventId ? 'secondary' : 'outline'} className="text-xs">
                      Schritt {index + 1}
                    </Badge>
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
                        updatePathSegmentEvent(segment.groupId, item)
                      }
                      placeholder="Event fuer diesen Schritt auswaehlen..."
                      disablePortal={disablePortal}
                    />
                  ) : (
                    <div className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
                      Kein passendes Event gefunden. Fuer diesen Schritt wird bei der Erstellung ein
                      `schedule_event`-Auftrag angelegt.
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
        <h4 className="text-muted-foreground mb-2 text-sm font-semibold uppercase">Target Group</h4>
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
        <h4 className="text-muted-foreground mb-2 text-sm font-semibold uppercase">Target Event</h4>
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
            Noch kein Ziel-Event ausgewaehlt.
          </div>
        )}
      </div>

      {pathWithEvents.length > 0 && (
        <div className="bg-muted text-muted-foreground rounded-md p-3 text-xs">
          <p className="font-semibold">Amendment Path ({pathWithEvents.length} groups):</p>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {pathWithEvents.map((segment, index) => (
              <div key={`${segment.groupId}:${index}`} className="flex items-center gap-1">
                <Badge variant={segment.eventId ? 'secondary' : 'outline'} className="text-xs">
                  {segment.groupName}
                </Badge>
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
