import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useZero } from '@rocicorp/zero/react';
import { toast } from 'sonner';
import { normalizeDelegateElectionMode } from '@/features/elections/logic/electionMode';
import {
  buildOpenAssignments,
  getRemainingSeatCount,
  type GroupOpenAssignment,
} from '@/features/groups/logic/openAssignments';
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

function isFutureOrOngoingEvent(event: AvailableGroupEvent, referenceTime: number) {
  if (event.status === 'cancelled') {
    return false;
  }

  const endDate = event.end_date ?? event.start_date ?? 0;
  return endDate >= referenceTime;
}

export function useGroupOpenAssignments(groupId: string) {
  const navigate = useNavigate();
  const zero = useZero();
  const { group } = useGroupById(groupId);
  const { roles, isLoading: rolesLoading } = useGroupRoles(groupId);
  const { events: groupEvents } = useGroupEventsForCalendar(groupId);
  const [allocations, allocationsResult] = useQuery(
    queries.events.delegateAllocationsBySourceGroup({ groupId })
  );
  const [isScheduling, setIsScheduling] = useState(false);

  const openAssignments = useMemo(
    () =>
      buildOpenAssignments({
        currentGroupId: groupId,
        allocations: allocations || [],
        roles,
      }),
    [allocations, groupId, roles]
  );

  const availableEvents = useMemo(() => {
    const now = Date.now();

    return (groupEvents || []).filter(
      (event): event is AvailableGroupEvent =>
        Boolean(event.id) && isFutureOrOngoingEvent(event, now)
    );
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

  return {
    group,
    availableEvents,
    openAssignments,
    isLoading: rolesLoading || allocationsResult.type === 'unknown',
    isScheduling,
    scheduleRoleRenewal,
    scheduleDelegateElection,
  };
}
