import { BadgeControl } from '@/features/shared/ui/status';
import {
  FormControlLabel,
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery, useZero } from '@rocicorp/zero/react';
import { toast } from '@/features/shared/ui/ui/sonner';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { TypeSelector } from '@/features/shared/ui/form';
import { TooltipProvider } from '@/features/shared/ui/ui/tooltip';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import type { CreateFormConfig } from '../types/create-form.types';
import { RoleSearchInput } from '../ui/inputs/RoleSearchInput';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import {
  useAllAmendments,
  useAllEvents,
  useEventAgenda,
  useRolesWithGroups,
} from '@/zero/events/useEventState';
import { useGroupById } from '@/zero/groups/useGroupState';
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
  const navigate = useNavigate();
  const zero = useZero();
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
  const { group: sourceGroup } = useGroupById(sourceGroupId || undefined);

  const [sourceAllocations, sourceAllocationsResult] = useQuery(
    sourceGroupId
      ? queries.events.delegateAllocationsBySourceGroup({ groupId: sourceGroupId })
      : undefined
  );
  const [sourceGroupRoles, sourceGroupRolesResult] = useQuery(
    sourceGroupId ? queries.groups.rolesFull({ groupId: sourceGroupId }) : undefined
  );

  const delegateAssignments = useMemo(
    () =>
      sourceGroupId
        ? buildOpenAssignments({
            currentGroupId: sourceGroupId,
            allocations: sourceAllocations || [],
            roles: sourceGroupRoles || [],
          }).filter(assignment => assignment.kind === 'delegate_election')
        : [],
    [sourceAllocations, sourceGroupId, sourceGroupRoles]
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

  const isAssignmentLoading =
    Boolean(sourceGroupId && assignmentId) &&
    (sourceAllocationsResult.type === 'unknown' || sourceGroupRolesResult.type === 'unknown');
  const assignmentLookupFailed =
    Boolean(assignmentId) && !isAssignmentLoading && !delegateAssignment;

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

  const resolvedOrder = hasCustomOrder ? order : nextOrder;
  const selectedEvent = userEvents.find(event => event.id === eventId);
  const agendaTypeLabel = type.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  const isElectionType = type === 'election';
  const isVoteType = type === 'vote';
  const isDelegateAssignmentElection = isElectionType && Boolean(delegateAssignment);
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

  const handleSubmit = async () => {
    if (!eventId || !title.trim()) {
      return;
    }

    if (assignmentId && isAssignmentLoading) {
      toast.error(
        translateText(
          'generated.inline.0302_der_delegiertenauftrag_wird_noch_geladen_bitt_da98e584'
        )
      );
      return;
    }

    if (assignmentLookupFailed) {
      toast.error(
        translateText(
          'generated.inline.0303_der_delegiertenauftrag_konnte_nicht_gefunden__b1fb330a'
        )
      );
      return;
    }

    if (isElectionType && resolvedElectionMode === 'list' && resolvedSeatCount < 1) {
      toast.error(
        translateText(
          'generated.inline.0304_bitte_gib_mindestens_eine_zu_vergebende_posit_d79ad3b6'
        )
      );
      return;
    }

    setIsSubmitting(true);
    const correlationId = createElectionFlowCorrelationId(
      isDelegateAssignmentElection ? 'delegate-assignment-create' : 'agenda-item-create'
    );

    logElectionFlowClient(
      isDelegateAssignmentElection ? 'delegate-assignment-create' : 'agenda-item-create',
      'submit-started',
      {
        correlationId,
        eventId,
        agendaItemType: type,
        assignmentId: assignmentId ?? null,
        electionMode: isElectionType ? resolvedElectionMode : null,
        seatCount: isElectionType ? resolvedSeatCount : null,
      }
    );

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

          for (const [index, label] of ['Yes', 'No', 'Abstain'].entries()) {
            await serverConfirmed(
              zero.mutate(
                mutators.votes.createVoteChoice({
                  id: crypto.randomUUID(),
                  vote_id: voteId,
                  label,
                  order_index: index + 1,
                })
              )
            );
          }
        }
      }

      logElectionFlowClient(
        isDelegateAssignmentElection ? 'delegate-assignment-create' : 'agenda-item-create',
        'submit-confirmed',
        {
          correlationId,
          eventId,
          assignmentId: assignmentId ?? null,
          electionMode: isElectionType ? resolvedElectionMode : null,
          seatCount: isElectionType ? resolvedSeatCount : null,
        }
      );

      toast.success(t('pages.create.success.created'));
      navigate({ to: `/event/${eventId}/agenda` });
    } catch (error) {
      logElectionFlowClientError(
        isDelegateAssignmentElection ? 'delegate-assignment-create' : 'agenda-item-create',
        'submit-error',
        {
          correlationId,
          eventId,
          assignmentId: assignmentId ?? null,
          error,
        }
      );
      toast.error(t('pages.create.error.createFailed'));
      setIsSubmitting(false);
    }
  };

  const config = useMemo(
    (): CreateFormConfig => ({
      entityType: 'agenda_item',
      title: translateText('generated.inline.0046_pages_create_agendaitem_title_c019a31a'),
      isSubmitting,
      onSubmit: handleSubmit,
      steps: [
        {
          label: t('pages.create.agendaItem.basicInfo'),
          isValid: () => !!eventId && !!title.trim() && !assignmentLookupFailed,
          fields: [
            ...(delegateAssignment
              ? [
                  {
                    key: 'delegate-assignment',
                    kind: 'custom' as const,
                    node: (
                      <div className="bg-muted/30 rounded-2xl border p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <BadgeControl variant="outline">
                            {translateText('generated.inline.0305_delegiertenauftrag_5a165b38')}
                          </BadgeControl>
                          {assignmentModeLabel ? (
                            <BadgeControl variant="secondary">{assignmentModeLabel}</BadgeControl>
                          ) : null}
                          <BadgeControl variant="secondary">
                            {delegateSeatCount}{' '}
                            {delegateSeatCount === 1
                              ? translateText('generated.inline.0041_delegierte_109dfa4c')
                              : translateText('generated.inline.0041_delegierte_109dfa4c')}
                          </BadgeControl>
                        </div>
                        <p className="text-muted-foreground mt-3 text-sm">
                          {translateText(
                            'generated.inline.0306_dieses_election_agenda_item_meldet_delegierte_3d499eb7'
                          )}{' '}
                          <strong>
                            {delegateAssignment.targetEvent?.title ||
                              translateText('generated.inline.0042_das_ziel_event_97f4ce5e')}
                          </strong>
                          .
                        </p>
                      </div>
                    ),
                  },
                ]
              : []),
            ...(assignmentLookupFailed
              ? [
                  {
                    key: 'assignment-error',
                    kind: 'custom' as const,
                    node: (
                      <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-2xl border p-4 text-sm">
                        {translateText(
                          'generated.inline.0307_der_verlinkte_delegiertenauftrag_konnte_nicht_b7f62171'
                        )}
                      </div>
                    ),
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
                  userEvents,
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
                  kind: 'custom',
                  node: delegateAssignment ? (
                    <div className="bg-muted/30 rounded-2xl border p-4">
                      <p className="text-sm font-medium">
                        {translateText('generated.inline.0308_typ_edcaf9aa')}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {translateText(
                          'generated.inline.0309_dieser_auftrag_erstellt_immer_einen_tagesordn_3d58b481'
                        )}
                      </p>
                    </div>
                  ) : (
                    <TooltipProvider>
                      <TypeSelector value={type} onChange={setType} />
                    </TooltipProvider>
                  ),
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
                          kind: 'custom' as const,
                          node: (
                            <ElectionModeInput
                              value={resolvedElectionMode}
                              onChange={mode => setElectionMode(mode)}
                              label={translateText('generated.inline.0310_wahltyp_05ffc3a6')}
                              hint={
                                delegateAssignment
                                  ? 'Der Auftrag setzt die Zahl der zu vergebenden Sitze. Der Modus kann fuer diese Wahl noch angepasst werden.'
                                  : 'Waehle, ob Kandidierende einzeln oder als Listenwahl gewaehlt werden.'
                              }
                              descriptions={{
                                list: 'Eine Wahl mit mehreren Stimmen und mehreren zu vergebenden Positionen.',
                                single:
                                  'Eine Wahl pro Position mit genau einer Stimme pro Waehler.',
                              }}
                            />
                          ),
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
                            kind: 'custom' as const,
                            node: (
                              <div className="bg-muted/30 text-muted-foreground rounded-2xl border p-4 text-sm">
                                {translateText(
                                  'generated.inline.0312_es_werden_automatisch_1599e87a'
                                )}
                                {delegateSeatCount}{' '}
                                {delegateSeatCount === 1
                                  ? translateText('generated.inline.0043_einzelwahl_8c93376c')
                                  : translateText('generated.inline.0044_einzelwahlen_c5379380')}
                                {translateText(
                                  'generated.inline.0313_fuer_die_aus_dem_auftrag_berechneten_delegier_67926bfc'
                                )}
                              </div>
                            ),
                          },
                        ]
                      : []),
                  {
                    key: 'majority-type',
                    kind: 'custom' as const,
                    node: (
                      <div className="space-y-2">
                        <FormControlLabel>
                          {t('pages.create.agendaItem.majorityType')}
                        </FormControlLabel>
                        <FormControlSelect
                          value={majorityType}
                          onValueChange={(value: string) => setMajorityType(value as MajorityType)}
                        >
                          <FormControlSelectTrigger>
                            <FormControlSelectValue />
                          </FormControlSelectTrigger>
                          <FormControlSelectContent>
                            <FormControlSelectItem value="simple">
                              {t('pages.create.agendaItem.majoritySimple')}
                            </FormControlSelectItem>
                            <FormControlSelectItem value="absolute">
                              {t('pages.create.agendaItem.majorityAbsolute')}
                            </FormControlSelectItem>
                            <FormControlSelectItem value="two_thirds">
                              {t('pages.create.agendaItem.majorityTwoThirds')}
                            </FormControlSelectItem>
                          </FormControlSelectContent>
                        </FormControlSelect>
                      </div>
                    ),
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
                    kind: 'custom' as const,
                    node: (
                      <BallotVisibilityInput
                        value={ballotVisibility}
                        onChange={setBallotVisibility}
                        hint={
                          isElectionType
                            ? 'Delegierten- und Personenwahlen sind standardmaessig geheim.'
                            : 'Abstimmungen sind standardmaessig namentlich.'
                        }
                      />
                    ),
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
            ...(isElectionType && !delegateAssignment
              ? [
                  {
                    key: 'role',
                    kind: 'custom' as const,
                    node: (
                      <RoleSearchInput
                        value={roleId}
                        onChange={setRoleId}
                        label={t('pages.create.agendaItem.positionOptional')}
                        placeholder={t('pages.create.agendaItem.positionPlaceholder')}
                        groupIds={selectedEvent?.group_id ? [selectedEvent.group_id] : undefined}
                        eventId={eventId || undefined}
                      />
                    ),
                  },
                ]
              : []),
            ...(delegateAssignment
              ? [
                  {
                    key: 'delegate-target',
                    kind: 'custom' as const,
                    node: (
                      <div className="bg-muted/30 rounded-2xl border p-4">
                        <p className="text-sm font-medium">
                          {translateText('generated.inline.0314_ziel_der_delegiertenwahl_b8a85d6c')}
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {translateText(
                            'generated.inline.0315_gewaehlte_delegierte_werden_automatisch_in_04270bde'
                          )}{' '}
                          <strong>
                            {delegateAssignment.targetEvent?.title ||
                              translateText(
                                'generated.inline.0045_die_delegiertenversammlung_9744e078'
                              )}
                          </strong>{' '}
                          {translateText(
                            'generated.inline.0316_als_participants_eingetragen_3c697639'
                          )}
                        </p>
                        {sourceGroup?.name ? (
                          <p className="text-muted-foreground mt-2 text-sm">
                            {translateText('generated.inline.0317_herkunftsgruppe_18ef20d3')}
                            <strong>{sourceGroup.name}</strong>
                          </p>
                        ) : null}
                      </div>
                    ),
                  },
                ]
              : []),
            ...(!isVoteType && !isElectionType
              ? [
                  {
                    key: 'empty-state',
                    kind: 'custom' as const,
                    node: (
                      <div className="text-muted-foreground py-8 text-center">
                        {t('pages.create.agendaItem.noAdditionalConfig')}
                      </div>
                    ),
                  },
                ]
              : []),
          ],
        },
        {
          label: t('pages.create.common.review'),
          isValid: () =>
            !!eventId &&
            !!title.trim() &&
            !assignmentLookupFailed &&
            (!isElectionType || resolvedElectionMode !== 'list' || resolvedSeatCount >= 1),
          fields: [
            {
              key: 'review',
              kind: 'custom' as const,
              node: (
                <CreateSummaryStep
                  entityType="agenda_item"
                  badge={t('pages.create.agendaItem.reviewBadge')}
                  secondaryBadge={agendaTypeLabel}
                  title={title || t('pages.create.agendaItem.titlePlaceholder')}
                  subtitle={description || undefined}
                  sections={[
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
                                      label: translateText(
                                        'generated.inline.0048_wahltyp_05ffc3a6'
                                      ),
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
                                    ? '⅔ Majority'
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
                  ]}
                />
              ),
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
      isElectionType,
      isSubmitting,
      isVoteType,
      majorityType,
      order,
      resolvedElectionMode,
      resolvedOrder,
      resolvedSeatCount,
      roleId,
      seatCountInput,
      selectedEvent,
      sourceGroup?.name,
      t,
      timeLimit,
      title,
      type,
      userAmendments,
      userEvents,
      userRoles,
      electionMode,
      showSeatCountInput,
    ]
  );

  return config;
}
