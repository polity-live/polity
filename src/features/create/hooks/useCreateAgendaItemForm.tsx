import { useEffect, useMemo, useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import { useQuery, useZero } from '@rocicorp/zero/react';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useAuth } from '@/providers/auth-provider';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import type { CreateFormConfig, CreateSubmitContext } from '../types/create-form.types';
import { RoleSearchInput } from '../ui/inputs/RoleSearchInput';
import { CreateInlineNotice } from '../ui/CreateInlineNotice';
import { AgendaDelegateAssignmentNotice } from '../ui/inputs/AgendaDelegateAssignmentNotice';
import { AgendaTypeSelectorInput } from '../ui/inputs/AgendaTypeSelectorInput';
import { AgendaMajorityTypeInput } from '../ui/inputs/AgendaMajorityTypeInput';
import { AgendaDelegateSeatNotice } from '../ui/inputs/AgendaDelegateSeatNotice';
import { AgendaDelegateTargetNotice } from '../ui/inputs/AgendaDelegateTargetNotice';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import {
  useAllAmendments,
  useAllEvents,
  useEventAgenda,
  useUserEventParticipations,
  useRolesWithGroups,
} from '@/zero/events/useEventState';
import { useCurrentUserActiveGroupIds, useGroupById } from '@/zero/groups/useGroupState';
import { queries } from '@/zero/queries';
import {
  buildOpenAssignments,
  getRemainingSeatCount,
} from '@/features/groups/logic/openAssignments';
import { mutators } from '@/zero/mutators';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import {
  buildDelegateElectionAgendaItemDescription,
  buildDelegateElectionAgendaItemTitle,
  buildDelegateElectionRecordDescription,
  buildDelegateElectionRecordTitle,
  buildDelegateSeatRoleInput,
  collectExistingDelegateSeatRoleIds,
} from '@/features/elections/logic/delegateElectionScheduling';
import {
  createElectionFlowCorrelationId,
  logElectionFlowClient,
  logElectionFlowClientError,
} from '@/features/elections/logic/electionFlowLogging';
import {
  deriveElectionMaxVotes,
  getElectionModeLabel,
  getElectionModeSummaryLabel,
  normalizeDelegateElectionMode,
  normalizeElectionMode,
  resolveElectionSeatCount,
  type ElectionMode,
} from '@/features/elections/logic/electionMode';
import { ElectionModeInput } from '@/features/elections/ui/ElectionModeInput';
import { BallotVisibilityInput } from '@/features/agendas/ui/BallotVisibilityInput';
import {
  defaultElectionBallotVisibility,
  defaultVoteBallotVisibility,
  type BallotVisibility,
} from '@/zero/shared';
import {
  createBlockedSubmitOutcome,
  createRouteSubmitTarget,
  createSuccessSubmitOutcome,
} from '../logic/createSubmitTargets';
import { getCreateSelectableEventIds } from '../logic/createEligibility';

type AgendaItemType = 'election' | 'vote' | 'speech' | 'discussion' | 'accreditation';
type MajorityType = 'simple' | 'absolute' | 'two_thirds';

interface CreateAgendaItemSearch {
  eventId?: string;
  type?: AgendaItemType;
  sourceGroupId?: string;
  assignmentId?: string;
  targetEventId?: string;
  electionMode?: ElectionMode;
}

function parsePositiveInteger(value: string) {
  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return null;
  }

  return parsedValue;
}

export function useCreateAgendaItemForm(): CreateFormConfig {
  const { t } = useTranslation();
  const zero = useZero();
  const { user } = useAuth();
  const searchParams = useSearch({ strict: false }) as CreateAgendaItemSearch;

  const eventIdParam = searchParams.eventId;
  const typeParam = searchParams.type;
  const sourceGroupId = searchParams.sourceGroupId;
  const assignmentId = searchParams.assignmentId;
  const targetEventId = searchParams.targetEventId;
  const electionModeParam = searchParams.electionMode;

  const { events: userEvents } = useAllEvents();
  const { amendments: userAmendments } = useAllAmendments();
  const { roles: userRoles } = useRolesWithGroups();
  const { activeGroupIds } = useCurrentUserActiveGroupIds();
  const { participations: userEventParticipations } = useUserEventParticipations(user?.id);
  const { group: sourceGroup } = useGroupById(sourceGroupId || undefined);

  const [sourceAllocations, sourceAllocationsResult] = useQuery(
    sourceGroupId
      ? queries.events.delegateAllocationsBySourceGroup({ groupId: sourceGroupId })
      : undefined
  );
  const [sourceGroupRoles, sourceGroupRolesResult] = useQuery(
    sourceGroupId ? queries.groups.rolesFull({ groupId: sourceGroupId }) : undefined
  );

  const openAssignments = useMemo(
    () =>
      sourceGroupId
        ? buildOpenAssignments({
            currentGroupId: sourceGroupId,
            allocations: sourceAllocations || [],
            roles: sourceGroupRoles || [],
          })
        : [],
    [sourceAllocations, sourceGroupId, sourceGroupRoles]
  );
  const delegateAssignments = useMemo(
    () => openAssignments.filter(assignment => assignment.kind === 'delegate_election'),
    [openAssignments]
  );
  const roleRenewalAssignments = useMemo(
    () => openAssignments.filter(assignment => assignment.kind === 'role_renewal'),
    [openAssignments]
  );

  const delegateAssignment = useMemo(
    () =>
      assignmentId
        ? (delegateAssignments.find(
            assignment =>
              assignment.id === assignmentId &&
              (!targetEventId || assignment.targetEvent?.id === targetEventId)
          ) ?? null)
        : null,
    [assignmentId, delegateAssignments, targetEventId]
  );
  const roleRenewalAssignment = useMemo(
    () =>
      assignmentId
        ? (roleRenewalAssignments.find(assignment => assignment.id === assignmentId) ?? null)
        : null,
    [assignmentId, roleRenewalAssignments]
  );
  const roleRenewalRole = useMemo(
    () =>
      roleRenewalAssignment?.roleId
        ? ((sourceGroupRoles || []).find(role => role.id === roleRenewalAssignment.roleId) ?? null)
        : null,
    [roleRenewalAssignment?.roleId, sourceGroupRoles]
  );
  const linkedAssignment = delegateAssignment ?? roleRenewalAssignment;

  const isAssignmentLoading =
    Boolean(sourceGroupId && assignmentId) &&
    (sourceAllocationsResult.type === 'unknown' || sourceGroupRolesResult.type === 'unknown');
  const assignmentLookupFailed =
    Boolean(assignmentId) && !isAssignmentLoading && !delegateAssignment && !roleRenewalAssignment;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<AgendaItemType>(typeParam || 'discussion');
  const [order, setOrder] = useState(1);
  const [hasCustomOrder, setHasCustomOrder] = useState(false);
  const [duration, setDuration] = useState('');
  const [eventId, setEventId] = useState(eventIdParam || '');
  const [amendmentId, setAmendmentId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [majorityType, setMajorityType] = useState<MajorityType>('simple');
  const [timeLimit, setTimeLimit] = useState('');
  const [ballotVisibility, setBallotVisibility] = useState<BallotVisibility>(
    typeParam === 'election' ? defaultElectionBallotVisibility : defaultVoteBallotVisibility
  );
  const [electionMode, setElectionMode] = useState<ElectionMode>(
    normalizeElectionMode(electionModeParam, 'single')
  );
  const [seatCountInput, setSeatCountInput] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appliedAssignmentPrefillKey, setAppliedAssignmentPrefillKey] = useState<string | null>(
    null
  );

  const { agendaItems: eventAgendaItems } = useEventAgenda(eventId || undefined);

  const nextOrder = useMemo(
    () =>
      eventAgendaItems.reduce((highestOrder, agendaItem) => {
        return Math.max(highestOrder, agendaItem.order_index ?? 0);
      }, 0) + 1,
    [eventAgendaItems]
  );

  useEffect(() => {
    if (eventIdParam && eventIdParam !== eventId) {
      setEventId(eventIdParam);
    }
  }, [eventIdParam, eventId]);

  useEffect(() => {
    if (!assignmentId && typeParam && typeParam !== type) {
      setType(typeParam);
    }
  }, [assignmentId, type, typeParam]);

  useEffect(() => {
    if (assignmentId && type !== 'election') {
      setType('election');
    }
  }, [assignmentId, type]);

  useEffect(() => {
    if (type === 'election') {
      setBallotVisibility(defaultElectionBallotVisibility);
      return;
    }

    if (type === 'vote') {
      setBallotVisibility(defaultVoteBallotVisibility);
    }
  }, [type]);

  useEffect(() => {
    if (!assignmentId && electionModeParam) {
      setElectionMode(normalizeElectionMode(electionModeParam, 'single'));
    }
  }, [assignmentId, electionModeParam]);

  useEffect(() => {
    setHasCustomOrder(false);
  }, [eventId]);

  useEffect(() => {
    if (!hasCustomOrder) {
      setOrder(nextOrder);
    }
  }, [hasCustomOrder, nextOrder]);

  useEffect(() => {
    if (!delegateAssignment) {
      return;
    }

    const prefillKey = `${delegateAssignment.id}:${eventIdParam ?? ''}:${targetEventId ?? ''}`;
    if (appliedAssignmentPrefillKey === prefillKey) {
      return;
    }

    const remainingSeatCount = getRemainingSeatCount(delegateAssignment);
    const targetEventTitle = delegateAssignment.targetEvent?.title;
    const defaultMode = normalizeDelegateElectionMode(
      delegateAssignment.targetEvent?.delegate_election_mode ?? electionModeParam
    );

    setType('election');
    setElectionMode(defaultMode);
    setSeatCountInput(String(Math.max(1, remainingSeatCount)));
    setTitle(buildDelegateElectionAgendaItemTitle({ mode: defaultMode, targetEventTitle }));
    setDescription(
      buildDelegateElectionAgendaItemDescription({
        mode: defaultMode,
        seatCount: Math.max(1, remainingSeatCount),
        totalSeatCount: delegateAssignment.seatCount ?? Math.max(1, remainingSeatCount),
      })
    );

    if (eventIdParam) {
      setEventId(eventIdParam);
    }

    setAppliedAssignmentPrefillKey(prefillKey);
  }, [
    appliedAssignmentPrefillKey,
    delegateAssignment,
    electionModeParam,
    eventIdParam,
    targetEventId,
  ]);

  useEffect(() => {
    if (!roleRenewalAssignment?.roleId) {
      return;
    }

    const prefillKey = `${roleRenewalAssignment.id}:${eventIdParam ?? ''}`;
    if (appliedAssignmentPrefillKey === prefillKey) {
      return;
    }

    const roleTitle =
      roleRenewalRole?.title || roleRenewalRole?.name || roleRenewalAssignment.title;

    setType('election');
    setElectionMode('single');
    setSeatCountInput('1');
    setMajorityType('simple');
    setRoleId(roleRenewalAssignment.roleId);
    setTitle(
      translateText('generated.inline.0135_wahl_roletitle_81c91130', {
        roleTitle,
      })
    );
    setDescription(roleRenewalRole?.description || roleRenewalAssignment.description || '');

    if (eventIdParam) {
      setEventId(eventIdParam);
    }

    setAppliedAssignmentPrefillKey(prefillKey);
  }, [
    appliedAssignmentPrefillKey,
    eventIdParam,
    roleRenewalAssignment,
    roleRenewalRole?.description,
    roleRenewalRole?.name,
    roleRenewalRole?.title,
  ]);

  const resolvedOrder = hasCustomOrder ? order : nextOrder;
  const selectableEventIds = useMemo(
    () => getCreateSelectableEventIds(userEvents, activeGroupIds, userEventParticipations),
    [activeGroupIds, userEventParticipations, userEvents]
  );
  const selectableEvents = useMemo(
    () => userEvents.filter(event => event.id && selectableEventIds.has(event.id)),
    [selectableEventIds, userEvents]
  );
  const selectedEvent = selectableEvents.find(event => event.id === eventId);
  const hasSelectableEvent = Boolean(eventId && selectableEventIds.has(eventId));
  const agendaTypeLabel = type.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  const isElectionType = type === 'election';
  const isVoteType = type === 'vote';
  const isDelegateAssignmentElection = isElectionType && Boolean(delegateAssignment);
  const isRoleRenewalAssignmentElection = isElectionType && Boolean(roleRenewalAssignment);
  const delegateSeatCount = delegateAssignment
    ? Math.max(1, getRemainingSeatCount(delegateAssignment))
    : 1;
  const resolvedSeatCount = isElectionType
    ? isDelegateAssignmentElection
      ? delegateSeatCount
      : resolveElectionSeatCount({
          electionMode,
          seatCount: parsePositiveInteger(seatCountInput),
        })
    : 1;
  const resolvedElectionMode = isElectionType
    ? isDelegateAssignmentElection
      ? electionMode
      : normalizeElectionMode(electionMode, 'single')
    : 'single';
  const showSeatCountInput = isElectionType && resolvedElectionMode === 'list';
  const assignmentModeLabel = delegateAssignment?.targetEvent?.delegate_election_mode
    ? getElectionModeLabel(
        normalizeDelegateElectionMode(delegateAssignment.targetEvent.delegate_election_mode)
      )
    : null;
  const roleRenewalRoleTitle =
    roleRenewalRole?.title ||
    roleRenewalRole?.name ||
    roleRenewalAssignment?.title ||
    roleRenewalAssignment?.roleId ||
    '';

  const createAgendaItemRecord = async (args: {
    agendaItemId: string;
    title: string;
    description: string;
    orderIndex: number;
    eventId: string;
    isVotable: boolean;
  }) => {
    await serverConfirmed(
      zero.mutate(
        mutators.agendas.createAgendaItem({
          id: args.agendaItemId,
          title: args.title,
          description: args.description,
          type,
          order_index: args.orderIndex,
          duration: duration ? parseInt(duration, 10) : 0,
          status: 'pending',
          forwarding_status: '',
          scheduled_time: '',
          start_time: 0,
          end_time: 0,
          activated_at: 0,
          completed_at: 0,
          event_id: args.eventId,
          amendment_id: amendmentId || null,
          voting_phase: args.isVotable ? 'indication' : null,
          majority_type: args.isVotable ? majorityType : null,
          time_limit: args.isVotable && timeLimit ? parseInt(timeLimit, 10) * 60 : null,
        })
      )
    );
  };

  const createStandardElection = async (agendaItemId: string, correlationId: string) => {
    const electionId = crypto.randomUUID();

    logElectionFlowClient('agenda-election-create', 'create-election-mutation-started', {
      correlationId,
      agendaItemId,
      electionId,
      electionMode: resolvedElectionMode,
      seatCount: resolvedSeatCount,
    });

    const createElectionResult = zero.mutate(
      mutators.elections.createElection({
        id: electionId,
        title: title.trim(),
        description: description.trim() || null,
        status: 'indicative',
        majority_type: majorityType,
        closing_type: null,
        closing_duration_seconds: null,
        closing_end_time: null,
        visibility: 'public',
        ballot_visibility: ballotVisibility,
        agenda_item_id: agendaItemId,
        role_id: roleId || null,
        election_mode: resolvedElectionMode,
        seat_count: resolvedSeatCount,
        max_votes: deriveElectionMaxVotes(resolvedElectionMode, resolvedSeatCount),
        debug_correlation_id: correlationId,
      })
    );
    await serverConfirmed(createElectionResult);

    logElectionFlowClient('agenda-election-create', 'create-election-mutation-confirmed', {
      correlationId,
      agendaItemId,
      electionId,
      electionMode: resolvedElectionMode,
      seatCount: resolvedSeatCount,
    });
  };

  const createDelegateAssignmentElection = async (correlationId: string) => {
    if (
      !delegateAssignment?.targetEvent?.id ||
      !delegateAssignment.targetEvent.group?.id ||
      !sourceGroupId
    ) {
      throw new Error('Der Delegiertenauftrag konnte nicht eindeutig aufgeloest werden.');
    }

    const totalSeatCount = delegateAssignment.seatCount ?? delegateSeatCount;
    const existingSeatRoleIds = collectExistingDelegateSeatRoleIds(
      sourceGroupRoles || [],
      sourceGroupId,
      delegateAssignment.targetEvent.id
    );
    const seatRoleIds = Array.from({ length: delegateSeatCount }, () => crypto.randomUUID());
    const allSeatRoleIds = [...existingSeatRoleIds, ...seatRoleIds];
    const existingSeatCount = Math.max(
      delegateAssignment.completedSeatCount ?? 0,
      existingSeatRoleIds.length
    );
    const baseSortOrder = (sourceGroupRoles || []).length;

    logElectionFlowClient('delegate-assignment-create', 'seat-role-fanout-started', {
      correlationId,
      sourceGroupId,
      targetEventId: delegateAssignment.targetEvent.id,
      targetEventTitle: delegateAssignment.targetEvent.title ?? null,
      seatCount: delegateSeatCount,
      mode: resolvedElectionMode,
    });

    for (let index = 0; index < seatRoleIds.length; index++) {
      const seatRoleId = seatRoleIds[index];
      const seatNumber = existingSeatCount + index + 1;
      const seatRoleInput = buildDelegateSeatRoleInput({
        sourceGroupName: sourceGroup?.name,
        targetGroupName: delegateAssignment.targetEvent.group?.name,
        targetEventTitle: delegateAssignment.targetEvent.title,
        seatNumber,
        totalSeats: totalSeatCount,
      });

      await serverConfirmed(
        zero.mutate(
          mutators.groups.createRole({
            id: seatRoleId,
            name: seatRoleInput.name,
            description: seatRoleInput.description,
            scope: 'group',
            group_id: sourceGroupId,
            event_id: null,
            amendment_id: null,
            blog_id: null,
            assignment_mode: 'elected',
            visibility: 'public',
            term_start_date: null,
            is_recurring: false,
            recurrence_pattern: null,
            recurrence_rule: null,
            recurrence_interval: null,
            recurrence_days: null,
            recurrence_end_date: null,
            scheduled_revote_date: null,
            default_request_role: false,
            default_invite_role: false,
            assignee_kind: 'member',
            sort_order: baseSortOrder + index,
          })
        )
      );
    }

    logElectionFlowClient('delegate-assignment-create', 'seat-role-fanout-confirmed', {
      correlationId,
      createdSeatRoleIds: seatRoleIds,
      allSeatRoleIds,
    });

    if (resolvedElectionMode === 'list') {
      const agendaItemId = crypto.randomUUID();
      const electionId = crypto.randomUUID();

      await createAgendaItemRecord({
        agendaItemId,
        title:
          title.trim() ||
          buildDelegateElectionAgendaItemTitle({
            mode: 'list',
            targetEventTitle: delegateAssignment.targetEvent.title,
          }),
        description:
          description.trim() ||
          buildDelegateElectionAgendaItemDescription({
            mode: 'list',
            seatCount: delegateSeatCount,
            totalSeatCount,
          }),
        orderIndex: resolvedOrder,
        eventId,
        isVotable: true,
      });

      const createElectionResult = zero.mutate(
        mutators.elections.createElection({
          id: electionId,
          agenda_item_id: agendaItemId,
          role_id: seatRoleIds[0] ?? null,
          title:
            title.trim() ||
            buildDelegateElectionRecordTitle({
              mode: 'list',
              targetEventTitle: delegateAssignment.targetEvent.title,
            }),
          description: buildDelegateElectionRecordDescription({
            sourceGroupId,
            sourceGroupName: sourceGroup?.name,
            targetGroupId: delegateAssignment.targetEvent.group.id,
            targetEventId: delegateAssignment.targetEvent.id,
            targetEventTitle: delegateAssignment.targetEvent.title,
            seatRoleIds,
            allSeatRoleIds,
            mode: 'list',
          }),
          status: 'indicative',
          majority_type: majorityType,
          closing_type: null,
          closing_duration_seconds: null,
          closing_end_time: null,
          visibility: 'public',
          ballot_visibility: ballotVisibility,
          election_mode: 'list',
          seat_count: delegateSeatCount,
          max_votes: deriveElectionMaxVotes('list', delegateSeatCount),
          debug_correlation_id: correlationId,
        })
      );
      await serverConfirmed(createElectionResult);
    } else {
      for (let index = 0; index < seatRoleIds.length; index++) {
        const seatRoleId = seatRoleIds[index];
        const seatNumber = existingSeatCount + index + 1;
        const agendaItemId = crypto.randomUUID();
        const electionId = crypto.randomUUID();

        await createAgendaItemRecord({
          agendaItemId,
          title: buildDelegateElectionAgendaItemTitle({
            mode: 'single',
            targetEventTitle: delegateAssignment.targetEvent.title,
            seatNumber,
          }),
          description: buildDelegateElectionAgendaItemDescription({
            mode: 'single',
            seatCount: 1,
            totalSeatCount,
            seatNumber,
          }),
          orderIndex: resolvedOrder + index,
          eventId,
          isVotable: true,
        });

        const createElectionResult = zero.mutate(
          mutators.elections.createElection({
            id: electionId,
            agenda_item_id: agendaItemId,
            role_id: seatRoleId,
            title: buildDelegateElectionRecordTitle({
              mode: 'single',
              targetEventTitle: delegateAssignment.targetEvent.title,
              seatNumber,
            }),
            description: buildDelegateElectionRecordDescription({
              sourceGroupId,
              sourceGroupName: sourceGroup?.name,
              targetGroupId: delegateAssignment.targetEvent.group.id,
              targetEventId: delegateAssignment.targetEvent.id,
              targetEventTitle: delegateAssignment.targetEvent.title,
              seatRoleIds: [seatRoleId],
              allSeatRoleIds,
              mode: 'single',
            }),
            status: 'indicative',
            majority_type: majorityType,
            closing_type: null,
            closing_duration_seconds: null,
            closing_end_time: null,
            visibility: 'public',
            ballot_visibility: ballotVisibility,
            election_mode: 'single',
            seat_count: 1,
            max_votes: 1,
            debug_correlation_id: correlationId,
          })
        );
        await serverConfirmed(createElectionResult);
      }
    }

    logElectionFlowClient('delegate-assignment-create', 'delegate-election-fanout-confirmed', {
      correlationId,
      createdSeatRoleIds: seatRoleIds,
      mode: resolvedElectionMode,
      createdAgendaItems: resolvedElectionMode === 'list' ? 1 : seatRoleIds.length,
    });
  };

  const handleSubmit = async (context?: CreateSubmitContext) => {
    if (!hasSelectableEvent || !title.trim()) {
      return createBlockedSubmitOutcome();
    }

    if (assignmentId && isAssignmentLoading) {
      toast.error(t('pages.create.agendaItem.assignmentLoading'));
      return createBlockedSubmitOutcome();
    }

    if (assignmentLookupFailed) {
      toast.error(t('pages.create.agendaItem.assignmentNotFound'));
      return createBlockedSubmitOutcome();
    }

    if (isElectionType && resolvedElectionMode === 'list' && resolvedSeatCount < 1) {
      toast.error(
        translateText(
          'generated.inline.0304_bitte_gib_mindestens_eine_zu_vergebende_posit_d79ad3b6'
        )
      );
      return createBlockedSubmitOutcome();
    }

    setIsSubmitting(true);
    context?.reportProgress({ key: 'create', status: 'active' });
    const creationFlow = isDelegateAssignmentElection
      ? 'delegate-assignment-create'
      : isRoleRenewalAssignmentElection
        ? 'role-renewal-assignment-create'
        : 'agenda-item-create';
    const correlationId = createElectionFlowCorrelationId(creationFlow);

    logElectionFlowClient(creationFlow, 'submit-started', {
      correlationId,
      eventId,
      agendaItemType: type,
      assignmentId: assignmentId ?? null,
      electionMode: isElectionType ? resolvedElectionMode : null,
      seatCount: isElectionType ? resolvedSeatCount : null,
    });

    try {
      if (isElectionType) {
        if (isDelegateAssignmentElection) {
          await createDelegateAssignmentElection(correlationId);
        } else {
          const agendaItemId = crypto.randomUUID();

          await createAgendaItemRecord({
            agendaItemId,
            title: title.trim(),
            description: description.trim() || '',
            orderIndex: resolvedOrder,
            eventId,
            isVotable: true,
          });
          await createStandardElection(agendaItemId, correlationId);
        }
      } else {
        const agendaItemId = crypto.randomUUID();

        await createAgendaItemRecord({
          agendaItemId,
          title: title.trim(),
          description: description.trim() || '',
          orderIndex: resolvedOrder,
          eventId,
          isVotable: isVoteType,
        });

        if (isVoteType) {
          const voteId = crypto.randomUUID();
          await serverConfirmed(
            zero.mutate(
              mutators.votes.createVote({
                id: voteId,
                title: title.trim(),
                description: description.trim() || null,
                status: 'indicative',
                majority_type: majorityType,
                closing_type: 'moderator',
                closing_duration_seconds: null,
                closing_end_time: null,
                visibility: 'public',
                ballot_visibility: ballotVisibility,
                agenda_item_id: agendaItemId,
                amendment_id: amendmentId || null,
              })
            )
          );

          await Promise.all(
            ['Yes', 'No', 'Abstain'].map((label, index) =>
              serverConfirmed(
                zero.mutate(
                  mutators.votes.createVoteChoice({
                    id: crypto.randomUUID(),
                    vote_id: voteId,
                    label,
                    order_index: index + 1,
                  })
                )
              )
            )
          );
        }
      }

      logElectionFlowClient(creationFlow, 'submit-confirmed', {
        correlationId,
        eventId,
        assignmentId: assignmentId ?? null,
        electionMode: isElectionType ? resolvedElectionMode : null,
        seatCount: isElectionType ? resolvedSeatCount : null,
      });

      toast.success(t('pages.create.success.created'));
      context?.reportProgress({ key: 'create', status: 'complete' });
      context?.reportProgress({ key: 'sync', status: 'complete' });
      context?.reportProgress({ key: 'ready', status: 'active' });
      setIsSubmitting(false);
      return createSuccessSubmitOutcome(
        createRouteSubmitTarget('agenda_item', {
          to: '/event/$id/agenda',
          params: { id: eventId },
        })
      );
    } catch (error) {
      logElectionFlowClientError(creationFlow, 'submit-error', {
        correlationId,
        eventId,
        assignmentId: assignmentId ?? null,
        error,
      });
      toast.error(t('pages.create.error.createFailed'));
      setIsSubmitting(false);
      throw error;
    }
  };

  const config = useMemo(
    (): CreateFormConfig => ({
      entityType: 'agenda_item',
      title: translateText('generated.inline.0046_pages_create_agendaitem_title_c019a31a'),
      isSubmitting,
      onSubmit: handleSubmit,
      submissionSteps: [
        { key: 'create', label: 'Erstellt Agendapunkt' },
        { key: 'sync', label: 'Synchronisiert Abstimmung und Rollen' },
        { key: 'ready', label: 'Bereitet Agenda vor' },
      ],
      steps: [
        {
          label: t('pages.create.agendaItem.basicInfo'),
          isValid: () => hasSelectableEvent && !!title.trim() && !assignmentLookupFailed,
          fields: [
            {
              key: 'title',
              kind: 'text',
              label: t('pages.create.agendaItem.titleLabel'),
              required: true,
              value: title,
              onValueChange: setTitle,
              placeholder: t('pages.create.agendaItem.titlePlaceholder'),
            },
            {
              key: 'description',
              kind: 'text',
              multiline: true,
              label: t('pages.create.agendaItem.descriptionLabel'),
              value: description,
              onValueChange: setDescription,
              placeholder: t('pages.create.agendaItem.descriptionPlaceholder'),
              rows: 3,
            },
            ...(delegateAssignment
              ? [
                  {
                    key: 'delegate-assignment',
                    kind: 'customComponent' as const,
                    component: AgendaDelegateAssignmentNotice,
                    props: {
                      assignmentLabel: translateText(
                        'generated.inline.0305_delegiertenauftrag_5a165b38'
                      ),
                      assignmentModeLabel,
                      seatCount: delegateSeatCount,
                      seatLabel: translateText('generated.inline.0041_delegierte_109dfa4c'),
                      description: translateText(
                        'generated.inline.0306_dieses_election_agenda_item_meldet_delegierte_3d499eb7'
                      ),
                      targetTitle:
                        delegateAssignment.targetEvent?.title ||
                        translateText('generated.inline.0042_das_ziel_event_97f4ce5e'),
                    },
                  },
                ]
              : []),
            ...(roleRenewalAssignment
              ? [
                  {
                    key: 'role-renewal-assignment',
                    kind: 'customComponent' as const,
                    component: CreateInlineNotice,
                    props: {
                      text: t('pages.create.agendaItem.roleRenewalAssignmentNotice', {
                        roleTitle: roleRenewalRoleTitle || roleRenewalAssignment.title,
                      }),
                    },
                  },
                ]
              : []),
            ...(assignmentLookupFailed
              ? [
                  {
                    key: 'assignment-error',
                    kind: 'customComponent' as const,
                    component: CreateInlineNotice,
                    props: {
                      text: t('pages.create.agendaItem.assignmentLookupFailed'),
                      className:
                        'border-destructive/40 bg-destructive/5 text-destructive rounded-2xl p-4',
                    },
                  },
                ]
              : []),
            {
              key: 'event',
              kind: 'typeahead',
              label: t('pages.create.agendaItem.eventLabel'),
              required: true,
              props: {
                items: toTypeaheadItems(
                  selectableEvents,
                  'event',
                  event => event.title || 'Event',
                  event => {
                    const text = richTextToPlainText(event.description);
                    return text ? text.substring(0, 60) : undefined;
                  },
                  undefined,
                  event => `/event/${event.id}`
                ),
                value: eventId || undefined,
                onChange: item => setEventId(item?.id ?? ''),
                placeholder: t('pages.create.agendaItem.eventPlaceholder'),
              },
            },
          ],
        },
        {
          label: t('pages.create.agendaItem.typeAndSettings'),
          isValid: () => true,
          sections: [
            {
              key: 'type',
              fields: [
                {
                  key: 'type-selector',
                  kind: 'customComponent',
                  component: AgendaTypeSelectorInput,
                  props: {
                    delegateAssignment: Boolean(linkedAssignment),
                    type,
                    lockedTitle: translateText('generated.inline.0308_typ_edcaf9aa'),
                    lockedDescription: translateText(
                      'generated.inline.0309_dieser_auftrag_erstellt_immer_einen_tagesordn_3d58b481'
                    ),
                    onTypeChange: setType,
                  },
                },
              ],
            },
            {
              key: 'order-duration',
              layout: 'grid',
              fields: [
                {
                  key: 'order',
                  kind: 'text',
                  label: t('pages.create.agendaItem.orderLabel'),
                  type: 'number',
                  min: '1',
                  value: order,
                  onValueChange: value => {
                    setHasCustomOrder(true);
                    setOrder(parseInt(value, 10) || 1);
                  },
                },
                {
                  key: 'duration',
                  kind: 'text',
                  label: t('pages.create.agendaItem.durationLabel'),
                  type: 'number',
                  min: '1',
                  placeholder: t('pages.create.agendaItem.durationPlaceholder'),
                  value: duration,
                  onValueChange: setDuration,
                },
              ],
            },
          ],
        },
        ...(isElectionType || isVoteType
          ? [
              {
                label: t('pages.create.agendaItem.votingSettings'),
                isValid: () =>
                  !assignmentLookupFailed &&
                  (!isElectionType || resolvedElectionMode !== 'list' || resolvedSeatCount >= 1),
                fields: [
                  ...(isElectionType
                    ? [
                        {
                          key: 'election-mode',
                          kind: 'customComponent' as const,
                          component: ElectionModeInput,
                          props: {
                            value: resolvedElectionMode,
                            onChange: (mode: ElectionMode) => setElectionMode(mode),
                            label: translateText('generated.inline.0310_wahltyp_05ffc3a6'),
                            hint: delegateAssignment
                              ? 'Der Auftrag setzt die Zahl der zu vergebenden Sitze. Der Modus kann fuer diese Wahl noch angepasst werden.'
                              : 'Waehle, ob Kandidierende einzeln oder als Listenwahl gewaehlt werden.',
                            descriptions: {
                              list: 'Eine Wahl mit mehreren Stimmen und mehreren zu vergebenden Positionen.',
                              single: 'Eine Wahl pro Position mit genau einer Stimme pro Waehler.',
                            },
                          },
                        },
                      ]
                    : []),
                  ...(showSeatCountInput
                    ? [
                        {
                          key: 'seat-count',
                          kind: 'text' as const,
                          label: translateText('generated.inline.0311_anzahl_positionen_479e7595'),
                          required: true,
                          type: 'number' as const,
                          min: '1',
                          value: seatCountInput,
                          onValueChange: setSeatCountInput,
                          disabled: Boolean(delegateAssignment),
                          hint: delegateAssignment
                            ? 'Die Anzahl kommt direkt aus dem Delegiertenauftrag.'
                            : 'So viele Positionen koennen in dieser Listenwahl vergeben werden.',
                        },
                      ]
                    : delegateAssignment
                      ? [
                          {
                            key: 'delegate-seat-count',
                            kind: 'customComponent' as const,
                            component: AgendaDelegateSeatNotice,
                            props: {
                              prefix: translateText(
                                'generated.inline.0312_es_werden_automatisch_1599e87a'
                              ),
                              seatCount: delegateSeatCount,
                              seatLabel:
                                delegateSeatCount === 1
                                  ? translateText('generated.inline.0043_einzelwahl_8c93376c')
                                  : translateText('generated.inline.0044_einzelwahlen_c5379380'),
                              suffix: translateText(
                                'generated.inline.0313_fuer_die_aus_dem_auftrag_berechneten_delegier_67926bfc'
                              ),
                            },
                          },
                        ]
                      : []),
                  {
                    key: 'majority-type',
                    kind: 'customComponent' as const,
                    component: AgendaMajorityTypeInput,
                    props: {
                      value: majorityType,
                      label: t('pages.create.agendaItem.majorityType'),
                      options: {
                        simple: t('pages.create.agendaItem.majoritySimple'),
                        absolute: t('pages.create.agendaItem.majorityAbsolute'),
                        twoThirds: t('pages.create.agendaItem.majorityTwoThirds'),
                      },
                      onChange: setMajorityType,
                    },
                  },
                  {
                    key: 'time-limit',
                    kind: 'text' as const,
                    label: t('pages.create.agendaItem.timeLimit'),
                    type: 'number' as const,
                    min: '1',
                    placeholder: t('pages.create.agendaItem.timeLimitPlaceholder'),
                    value: timeLimit,
                    onValueChange: setTimeLimit,
                  },
                  {
                    key: 'ballot-visibility',
                    kind: 'customComponent' as const,
                    component: BallotVisibilityInput,
                    props: {
                      value: ballotVisibility,
                      onChange: setBallotVisibility,
                      hint: isElectionType
                        ? 'Delegierten- und Personenwahlen sind standardmaessig geheim.'
                        : 'Abstimmungen sind standardmaessig namentlich.',
                    },
                  },
                ],
              },
            ]
          : []),
        {
          label: t('pages.create.agendaItem.additionalLinks'),
          isValid: () => true,
          optional: true,
          fields: [
            ...(isVoteType
              ? [
                  {
                    key: 'amendment',
                    kind: 'typeahead' as const,
                    label: t('pages.create.agendaItem.amendmentOptional'),
                    props: {
                      items: toTypeaheadItems(
                        userAmendments,
                        'amendment',
                        amendment => amendment.title || 'Amendment',
                        undefined,
                        undefined,
                        amendment => `/amendment/${amendment.id}`
                      ),
                      value: amendmentId || undefined,
                      onChange: (item: { id: string } | null) => setAmendmentId(item?.id ?? ''),
                      placeholder: t('pages.create.agendaItem.amendmentPlaceholder'),
                    },
                  },
                ]
              : []),
            ...(isElectionType && !linkedAssignment
              ? [
                  {
                    key: 'role',
                    kind: 'customComponent' as const,
                    component: RoleSearchInput,
                    props: {
                      value: roleId,
                      onChange: setRoleId,
                      label: t('pages.create.agendaItem.positionOptional'),
                      placeholder: t('pages.create.agendaItem.positionPlaceholder'),
                      groupIds: selectedEvent?.group_id ? [selectedEvent.group_id] : undefined,
                      eventId: eventId || undefined,
                    },
                  },
                ]
              : []),
            ...(roleRenewalAssignment
              ? [
                  {
                    key: 'role-renewal-role',
                    kind: 'customComponent' as const,
                    component: CreateInlineNotice,
                    props: {
                      text: t('pages.create.agendaItem.roleRenewalRoleNotice', {
                        roleTitle: roleRenewalRoleTitle || roleRenewalAssignment.title,
                      }),
                    },
                  },
                ]
              : []),
            ...(delegateAssignment
              ? [
                  {
                    key: 'delegate-target',
                    kind: 'customComponent' as const,
                    component: AgendaDelegateTargetNotice,
                    props: {
                      title: translateText(
                        'generated.inline.0314_ziel_der_delegiertenwahl_b8a85d6c'
                      ),
                      descriptionPrefix: translateText(
                        'generated.inline.0315_gewaehlte_delegierte_werden_automatisch_in_04270bde'
                      ),
                      targetTitle:
                        delegateAssignment.targetEvent?.title ||
                        translateText('generated.inline.0045_die_delegiertenversammlung_9744e078'),
                      descriptionSuffix: translateText(
                        'generated.inline.0316_als_participants_eingetragen_3c697639'
                      ),
                      sourceGroupLabel: translateText(
                        'generated.inline.0317_herkunftsgruppe_18ef20d3'
                      ),
                      sourceGroupName: sourceGroup?.name,
                    },
                  },
                ]
              : []),
            ...(!isVoteType && !isElectionType
              ? [
                  {
                    key: 'empty-state',
                    kind: 'customComponent' as const,
                    component: CreateInlineNotice,
                    props: {
                      text: t('pages.create.agendaItem.noAdditionalConfig'),
                      className: 'border-0 bg-transparent py-8 text-center',
                    },
                  },
                ]
              : []),
          ],
        },
        {
          label: t('pages.create.common.review'),
          isValid: () =>
            hasSelectableEvent &&
            !!title.trim() &&
            !assignmentLookupFailed &&
            (!isElectionType || resolvedElectionMode !== 'list' || resolvedSeatCount >= 1),
          fields: [
            {
              key: 'review',
              kind: 'customComponent' as const,
              component: CreateSummaryStep,
              props: {
                entityType: 'agenda_item',
                badge: t('pages.create.agendaItem.reviewBadge'),
                secondaryBadge: agendaTypeLabel,
                title: title || t('pages.create.agendaItem.titlePlaceholder'),
                subtitle: description || undefined,
                sections: [
                  {
                    title: t('pages.create.agendaItem.basicInfo'),
                    fields: [
                      {
                        label: t('pages.create.agendaItem.eventLabel'),
                        value: selectedEvent?.title || t('pages.create.common.notSelected'),
                      },
                      { label: t('pages.create.agendaItem.typeLabel'), value: agendaTypeLabel },
                      {
                        label: t('pages.create.agendaItem.orderLabel'),
                        value: `#${resolvedOrder}`,
                      },
                      ...(duration
                        ? [
                            {
                              label: t('pages.create.agendaItem.durationLabel'),
                              value: `${duration} ${t('pages.create.agendaItem.minutes')}`,
                            },
                          ]
                        : []),
                    ],
                  },
                  {
                    title: t('pages.create.agendaItem.additionalLinks'),
                    fields: [
                      ...(amendmentId
                        ? [
                            {
                              label: t('pages.create.agendaItem.amendmentLabel'),
                              value:
                                userAmendments.find(amendment => amendment.id === amendmentId)
                                  ?.title || amendmentId,
                            },
                          ]
                        : []),
                      ...(roleId
                        ? [
                            {
                              label: t('pages.create.agendaItem.positionLabel'),
                              value: userRoles.find(role => role.id === roleId)?.title || roleId,
                            },
                          ]
                        : []),
                      ...(delegateAssignment
                        ? [
                            {
                              label: translateText(
                                'generated.inline.0047_delegiertenauftrag_5a165b38'
                              ),
                              value:
                                delegateAssignment.targetEvent?.title || delegateAssignment.title,
                            },
                          ]
                        : []),
                      ...(roleRenewalAssignment
                        ? [
                            {
                              label: t('pages.create.agendaItem.assignmentLabel'),
                              value: roleRenewalAssignment.title,
                            },
                          ]
                        : []),
                    ],
                  },
                  ...(isElectionType || isVoteType
                    ? [
                        {
                          title: t('pages.create.agendaItem.votingSettings'),
                          fields: [
                            ...(isElectionType
                              ? [
                                  {
                                    label: translateText('generated.inline.0048_wahltyp_05ffc3a6'),
                                    value: getElectionModeSummaryLabel(
                                      resolvedElectionMode,
                                      resolvedSeatCount
                                    ),
                                  },
                                ]
                              : []),
                            {
                              label: t('pages.create.agendaItem.majorityType'),
                              value:
                                majorityType === 'two_thirds'
                                  ? '2/3 Majority'
                                  : majorityType === 'absolute'
                                    ? 'Absolute'
                                    : 'Simple',
                            },
                            ...(timeLimit
                              ? [
                                  {
                                    label: t('pages.create.agendaItem.timeLimit'),
                                    value: `${timeLimit} min`,
                                  },
                                ]
                              : []),
                            {
                              label: translateText('generated.inline.0049_stimmabgabe_65b7d215'),
                              value: ballotVisibility === 'secret' ? 'Geheim' : 'Namentlich',
                            },
                          ],
                        },
                      ]
                    : []),
                ],
              },
            },
          ],
        },
      ],
    }),
    [
      agendaTypeLabel,
      amendmentId,
      assignmentLookupFailed,
      ballotVisibility,
      assignmentModeLabel,
      delegateAssignment,
      delegateSeatCount,
      description,
      duration,
      eventId,
      eventIdParam,
      handleSubmit,
      hasSelectableEvent,
      isElectionType,
      isSubmitting,
      isVoteType,
      linkedAssignment,
      majorityType,
      order,
      resolvedElectionMode,
      resolvedOrder,
      resolvedSeatCount,
      roleId,
      roleRenewalAssignment,
      roleRenewalRoleTitle,
      seatCountInput,
      selectedEvent,
      selectableEvents,
      sourceGroup?.name,
      t,
      timeLimit,
      title,
      type,
      userAmendments,
      userRoles,
      electionMode,
      showSeatCountInput,
    ]
  );

  return config;
}
