import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useZero } from '@rocicorp/zero/react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { normalizeDelegateElectionMode } from '@/features/elections/logic/electionMode';
import { attachProcessTaskToEvent } from '@/features/amendments/logic/attachProcessTaskToEvent';
import {
  buildOpenAssignments,
  getRemainingSeatCount,
  type GroupOpenAssignment,
} from '@/features/groups/logic/openAssignments';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { queries } from '@/zero/queries';
import { useGroupEventsForCalendar } from '@/zero/events/useEventState';
import { useGroupById, useGroupRoles } from '@/zero/groups/useGroupState';
import { mutators } from '@/zero/mutators';

export type DelegateElectionMode = 'single' | 'list';

interface AvailableGroupEvent {
  id: string;
  title?: string | null;
  status?: string | null;
  start_date?: number | null;
  end_date?: number | null;
  group_id?: string | null;
}

interface ProcessTaskMetadataLike {
  amendmentTitle?: string;
  groupName?: string;
}

function asProcessTaskMetadata(metadata: unknown): ProcessTaskMetadataLike | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  return metadata as ProcessTaskMetadataLike;
}

function matchesGeneratedProcessTaskTitle(
  title: string,
  type: GroupOpenAssignment['processTaskType'],
  groupName: string,
  amendmentTitle: string
) {
  const normalizedTitle = title.trim();

  switch (type) {
    case 'implementation_evaluation':
      return [
        `Umsetzung evaluieren: ${amendmentTitle}`,
        `Review implementation: ${amendmentTitle}`,
      ].includes(normalizedTitle);
    case 'support_confirmation':
      return [
        `Unterstuetzung bestaetigen: ${amendmentTitle}`,
        `Confirm support: ${amendmentTitle}`,
      ].includes(normalizedTitle);
    default:
      return [
        `Event planen: ${amendmentTitle}`,
        `Schedule amendment vote for ${groupName}`,
      ].includes(normalizedTitle);
  }
}

function matchesGeneratedProcessTaskDescription(
  description: string,
  type: GroupOpenAssignment['processTaskType'],
  groupName: string,
  amendmentTitle: string
) {
  const normalizedDescription = description.trim();

  switch (type) {
    case 'implementation_evaluation':
      return [
        `Plane die Umsetzungspruefung fuer ${amendmentTitle} in ${groupName}.`,
        `Plan the implementation review for ${amendmentTitle} in ${groupName}.`,
      ].includes(normalizedDescription);
    case 'support_confirmation':
      return [
        `Diese Gruppe muss ihre Unterstuetzung fuer ${amendmentTitle} erneut bestaetigen.`,
        `This group needs to confirm its support for ${amendmentTitle} again.`,
      ].includes(normalizedDescription);
    default:
      return [
        `Fuer ${amendmentTitle} fehlt noch ein passendes Event in ${groupName}.`,
        `No eligible event is selected yet for ${groupName}.`,
      ].includes(normalizedDescription);
  }
}

function localizeOpenAssignment(
  assignment: GroupOpenAssignment,
  t: TFunction
): GroupOpenAssignment {
  if (assignment.kind !== 'process_task') {
    return assignment;
  }

  const metadata = asProcessTaskMetadata(assignment.processTaskMetadata);
  const amendmentTitle =
    assignment.amendment?.title ||
    metadata?.amendmentTitle ||
    t('features.groups.memberships.openAssignments.generated.amendmentFallback', 'Amendment');
  const groupName =
    metadata?.groupName || t('features.groups.memberships.openAssignments.thisGroup', 'this group');

  const shouldReplaceTitle =
    !assignment.title ||
    matchesGeneratedProcessTaskTitle(
      assignment.title,
      assignment.processTaskType,
      groupName,
      amendmentTitle
    );
  const shouldReplaceDescription =
    !assignment.description ||
    matchesGeneratedProcessTaskDescription(
      assignment.description,
      assignment.processTaskType,
      groupName,
      amendmentTitle
    );

  const localizedTitle = (() => {
    switch (assignment.processTaskType) {
      case 'implementation_evaluation':
        return t(
          'features.groups.memberships.openAssignments.generated.implementationEvaluationTitle',
          {
            amendmentTitle,
            defaultValue: 'Review implementation: {{amendmentTitle}}',
          }
        );
      case 'support_confirmation':
        return t('features.groups.memberships.openAssignments.generated.supportConfirmationTitle', {
          amendmentTitle,
          defaultValue: 'Confirm support: {{amendmentTitle}}',
        });
      default:
        return t(
          'features.groups.memberships.openAssignments.generated.scheduleAmendmentVoteTitle',
          {
            groupName,
            defaultValue: 'Schedule amendment vote for {{groupName}}',
          }
        );
    }
  })();

  const localizedDescription = (() => {
    switch (assignment.processTaskType) {
      case 'implementation_evaluation':
        return t(
          'features.groups.memberships.openAssignments.generated.implementationEvaluationDescription',
          {
            amendmentTitle,
            groupName,
            defaultValue: 'Plan the implementation review for {{amendmentTitle}} in {{groupName}}.',
          }
        );
      case 'support_confirmation':
        return t(
          'features.groups.memberships.openAssignments.generated.supportConfirmationDescription',
          {
            amendmentTitle,
            defaultValue: 'This group needs to confirm its support for {{amendmentTitle}} again.',
          }
        );
      default:
        return t(
          'features.groups.memberships.openAssignments.generated.scheduleAmendmentVoteDescription',
          {
            groupName,
            defaultValue: 'No eligible event is selected yet for {{groupName}}.',
          }
        );
    }
  })();

  return {
    ...assignment,
    title: shouldReplaceTitle ? localizedTitle : assignment.title,
    description: shouldReplaceDescription ? localizedDescription : assignment.description,
    dueAt:
      assignment.dueAt && Number.isFinite(assignment.dueAt)
        ? new Date(assignment.dueAt).valueOf()
        : assignment.dueAt,
  };
}

function isFutureOrOngoingEvent(event: AvailableGroupEvent, referenceTime: number) {
  if (event.status === 'cancelled') {
    return false;
  }

  const endDate = event.end_date ?? event.start_date ?? 0;
  return endDate >= referenceTime;
}

export function useGroupOpenAssignments(groupId: string) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const zero = useZero();
  const { group } = useGroupById(groupId);
  const { roles, isLoading: rolesLoading } = useGroupRoles(groupId);
  const { events: groupEvents } = useGroupEventsForCalendar(groupId);
  const [allocations, allocationsResult] = useQuery(
    queries.events.delegateAllocationsBySourceGroup({ groupId })
  );
  const [processTasks, processTasksResult] = useQuery(
    queries.amendments.openProcessTasksByGroup({ group_id: groupId })
  );
  const [isScheduling, setIsScheduling] = useState(false);
  const { completeProcessTaskWithEvent } = useAmendmentActions();

  const openAssignments = useMemo(
    () =>
      buildOpenAssignments({
        currentGroupId: groupId,
        allocations: allocations || [],
        roles,
        processTasks: processTasks || [],
      }).map(assignment => localizeOpenAssignment(assignment, t)),
    [allocations, groupId, i18n.language, processTasks, roles, t]
  );

  const availableEvents = useMemo(() => {
    const now = Date.now();

    return (groupEvents || [])
      .filter(event => Boolean(event.id) && isFutureOrOngoingEvent(event, now))
      .map<AvailableGroupEvent>(event => ({
        id: event.id,
        title: event.title ?? null,
        status: event.status ?? null,
        start_date: event.start_date ?? null,
        end_date: event.end_date ?? null,
        group_id: event.group_id ?? null,
      }));
  }, [groupEvents]);

  useEffect(() => {
    console.info('Open assignments event query result', {
      flow: 'group-open-assignments-events',
      queryName: 'queries.events.byGroupForCalendar',
      queryArgs: {
        groupId,
        includeOngoing: true,
      },
      rawEventCount: groupEvents.length,
      rawEvents: groupEvents.map(event => ({
        id: event.id,
        title: event.title ?? null,
        status: event.status ?? null,
        start_date: event.start_date ?? null,
        end_date: event.end_date ?? null,
        group_id: event.group_id ?? null,
      })),
      availableEventCount: availableEvents.length,
      availableEvents: availableEvents.map(event => ({
        id: event.id,
        title: event.title ?? null,
        status: event.status ?? null,
        start_date: event.start_date ?? null,
        end_date: event.end_date ?? null,
        group_id: event.group_id ?? null,
      })),
      now: Date.now(),
    });
  }, [availableEvents, groupEvents, groupId]);

  const scheduleRoleRenewal = useCallback(
    async (assignment: GroupOpenAssignment, eventId: string) => {
      if (!assignment.roleId) {
        throw new Error('Die verknuepfte Rolle konnte nicht gefunden werden.');
      }

      const role = roles.find(candidateRole => candidateRole.id === assignment.roleId);
      const event = availableEvents.find(candidateEvent => candidateEvent.id === eventId);

      if (!role || !event) {
        throw new Error('Bitte zuerst eine gueltige Veranstaltung auswaehlen.');
      }

      const alreadyLinked = (role.elections || []).some(
        election => election.agenda_item?.event?.id === eventId
      );
      if (alreadyLinked) {
        toast.info('Diese Rolle ist bereits mit der gewaehlten Veranstaltung verknuepft.');
        return;
      }

      setIsScheduling(true);
      try {
        const agendaItemId = crypto.randomUUID();
        const electionId = crypto.randomUUID();
        const roleTitle = role.title || role.name || 'Rolle';
        const orderIndex = Date.now();

        await serverConfirmed(
          zero.mutate(
            mutators.agendas.createAgendaItem({
              id: agendaItemId,
              title: `Wahl: ${roleTitle}`,
              description: role.description ?? '',
              type: 'election',
              status: 'pending',
              forwarding_status: '',
              order_index: orderIndex,
              duration: 0,
              scheduled_time: '',
              start_time: 0,
              end_time: 0,
              activated_at: 0,
              completed_at: 0,
              event_id: event.id,
              amendment_id: null,
              majority_type: null,
              time_limit: null,
              voting_phase: null,
            })
          )
        );

        await serverConfirmed(
          zero.mutate(
            mutators.elections.createElection({
              id: electionId,
              agenda_item_id: agendaItemId,
              role_id: role.id,
              title: `Wahl fuer ${roleTitle}`,
              description: role.description ?? `Wahl fuer ${roleTitle}`,
              status: 'pending',
              majority_type: 'simple',
              closing_type: null,
              closing_duration_seconds: null,
              closing_end_time: null,
              visibility: 'public',
              max_votes: 1,
            })
          )
        );

        toast.success('Der Auftrag wurde an die Veranstaltung angehaengt.');
      } finally {
        setIsScheduling(false);
      }
    },
    [availableEvents, roles, zero]
  );

  const scheduleDelegateElection = useCallback(
    async (assignment: GroupOpenAssignment, eventId: string, mode?: DelegateElectionMode) => {
      const targetEvent = assignment.targetEvent;
      const event = availableEvents.find(candidateEvent => candidateEvent.id === eventId);
      const remainingSeatCount = getRemainingSeatCount(assignment);
      const resolvedMode =
        mode ?? normalizeDelegateElectionMode(assignment.targetEvent?.delegate_election_mode);

      if (!targetEvent?.id || !targetEvent.group?.id) {
        throw new Error('Das Ziel-Event fuer diesen Delegiertenauftrag fehlt.');
      }
      if (!event) {
        throw new Error('Bitte zuerst eine gueltige Veranstaltung auswaehlen.');
      }
      if (remainingSeatCount <= 0 || (assignment.seatCount ?? 0) <= 0) {
        toast.info('Fuer diesen Auftrag muessen gerade keine weiteren Sitze geplant werden.');
        return;
      }

      navigate({
        to: '/create/agenda-item',
        search: {
          type: 'election',
          eventId: event.id,
          sourceGroupId: groupId,
          assignmentId: assignment.id,
          targetEventId: targetEvent.id,
          electionMode: resolvedMode,
        },
      });
    },
    [availableEvents, groupId, navigate]
  );

  const scheduleProcessTask = useCallback(
    async (assignment: GroupOpenAssignment, eventId: string) => {
      if (!assignment.processTaskId) {
        throw new Error('Der Prozessauftrag konnte nicht gefunden werden.');
      }

      const task = (processTasks || []).find(
        candidateTask => candidateTask.id === assignment.processTaskId
      );
      const event = availableEvents.find(candidateEvent => candidateEvent.id === eventId);

      if (!task || !event) {
        throw new Error('Bitte zuerst eine gueltige Veranstaltung auswaehlen.');
      }

      const amendmentTitle =
        task.process_run?.amendment?.title ??
        task.support_confirmation?.amendment?.title ??
        assignment.title;

      setIsScheduling(true);
      try {
        await attachProcessTaskToEvent({
          task,
          event,
          description: assignment.description || `Event-Anfrage fuer ${amendmentTitle}`,
          completeProcessTaskWithEvent,
        });

        toast.success('Der Prozessauftrag wurde an die Veranstaltung angehaengt.');
      } finally {
        setIsScheduling(false);
      }
    },
    [availableEvents, completeProcessTaskWithEvent, processTasks]
  );

  return {
    group,
    availableEvents,
    openAssignments,
    isLoading:
      rolesLoading || allocationsResult.type === 'unknown' || processTasksResult.type === 'unknown',
    isScheduling,
    scheduleRoleRenewal,
    scheduleDelegateElection,
    scheduleProcessTask,
  };
}
