import { defineMutator } from '@rocicorp/zero';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { zql } from '../schema';
import { can } from '../rbac/can';
import { isPermissionError } from '../rbac/errors';
import { fireNotification } from '../server-notify';
import { electionServerMutators } from '../elections/server-mutators';
import { groupServerMutators } from '../groups/server-mutators';
import { voteServerMutators } from '../votes/server-mutators';
import { snapshotVoteElectorate } from '../ballot-eligibility';
import { eventTitle, recomputeEventCounters, recomputeEventEndDate } from '../server-helpers';
import { resolveChangeRequestByVoteResult } from '../change-requests/server-resolution';
import { discardPendingEventSuggestions } from '../change-requests/event-suggestions';
import { transitionProcessBranchToEventMode } from '../amendments/event-mode-transition';
import {
  type CanonicalVotePurpose,
  VOTE_PURPOSE,
  VOTE_PHASE,
  normalizeVotePhase,
} from '../votes/vote-workflow';
import {
  buildMergeVoteTitle,
  getMergeVoteBranchLabel,
  getOrderedMergeVoteBranches,
  type MergeVoteBranchTitleSource,
} from '../amendments/merge-vote-title';
import {
  createAgendaItemSchema,
  createAgendaItemFullMutatorSchema,
  deleteAgendaItemSchema,
  reorderAgendaItemsSchema,
  updateAgendaItemSchema,
  createSpeakerListSchema,
  updateAgendaItemChangeRequestSchema,
  initializeChangeRequestVotingSchema,
  ensureEventSuggestionChangeRequestVotesSchema,
  processCRVoteResultSchema,
} from './schema';
import { AGENDA_VOTE_STEP_KIND } from './vote-step-kind';
import { normalizeChangeRequestVoteOrder } from '@/features/change-requests/logic/changeRequestVoteOrder';
import {
  orderChangeRequestsForVoting,
  reorderOpenChangeRequestVoteStepsForAgendaItem,
} from './change-request-vote-ordering';

type AgendaMutatorTx = Parameters<
  typeof mutators.agendas.updateAgendaItemChangeRequest.fn
>[0]['tx'];
type AgendaMutatorCtx = Parameters<
  typeof mutators.agendas.updateAgendaItemChangeRequest.fn
>[0]['ctx'];
const INTERNAL_VOTE_MATERIALIZATION = Symbol('internal-vote-materialization');

const DEFAULT_CHANGE_REQUEST_CHOICE_SPECS = (['yes', 'no', 'abstain'] as const).map(label => ({
  label,
  semanticKey: label,
  processBranchId: null as string | null,
}));

function buildMergeVoteChoiceSpecs<TBranch extends MergeVoteBranchTitleSource>(
  branches: readonly TBranch[]
) {
  return [
    ...getOrderedMergeVoteBranches(branches).map((branch, index) => ({
      label: getMergeVoteBranchLabel(branch, index),
      semanticKey: `branch:${branch.id}`,
      processBranchId: branch.id,
    })),
    {
      label: 'abstain',
      semanticKey: 'abstain',
      processBranchId: null,
    },
  ];
}

async function assertCurrentChangeRequestTimelineItem(
  tx: Parameters<typeof mutators.agendas.updateAgendaItemChangeRequest.fn>[0]['tx'],
  agendaItemChangeRequestId: string
) {
  const junction = await tx.run(
    zql.agenda_item_change_request.where('id', agendaItemChangeRequestId).one()
  );
  if (!junction || junction.is_closing_vote) {
    return junction;
  }

  const timeline = await tx.run(
    zql.agenda_item_change_request
      .where('agenda_item_id', junction.agenda_item_id)
      .orderBy('order_index', 'asc')
  );
  const firstIncomplete = timeline.find(
    item => !item.is_closing_vote && item.status !== 'completed'
  );

  if (firstIncomplete?.id && firstIncomplete.id !== junction.id) {
    throw new Error('Change requests must be voted in their configured order.');
  }

  return junction;
}

async function assertCanManageAgendaVoteFlow(
  tx: AgendaMutatorTx,
  ctx: { readonly userID: string; [INTERNAL_VOTE_MATERIALIZATION]?: true },
  agendaItemId: string
) {
  if (ctx[INTERNAL_VOTE_MATERIALIZATION]) return;

  const agendaItem = await tx.run(zql.agenda_item.where('id', agendaItemId).one());
  if (!agendaItem?.event_id) {
    throw new Error('Agenda item is not linked to an event.');
  }

  try {
    await can(tx, ctx, {
      action: 'manage_votes',
      resource: 'events',
      eventId: agendaItem.event_id,
    });
    return;
  } catch (eventPermissionError) {
    if (!isPermissionError(eventPermissionError)) throw eventPermissionError;

    if (agendaItem.amendment_id) {
      try {
        await can(tx, ctx, {
          action: 'manage',
          resource: 'amendments',
          amendmentId: agendaItem.amendment_id,
        });
        return;
      } catch (error) {
        if (!isPermissionError(error)) throw error;
      }
    }

    throw eventPermissionError;
  }
}

async function assertCanEnsureEventSuggestionChangeRequestVotes(
  tx: AgendaMutatorTx,
  ctx: { readonly userID: string },
  args: { agenda_item_id: string; amendment_id: string }
) {
  const agendaItem = await tx.run(zql.agenda_item.where('id', args.agenda_item_id).one());
  if (!agendaItem?.event_id) {
    throw new Error('Agenda item is not linked to an event.');
  }
  if (agendaItem.amendment_id && agendaItem.amendment_id !== args.amendment_id) {
    throw new Error('Agenda item is linked to a different amendment.');
  }

  try {
    await can(tx, ctx, {
      action: 'active_voting',
      resource: 'events',
      eventId: agendaItem.event_id,
    });
    return agendaItem;
  } catch (activeVotingError) {
    if (!isPermissionError(activeVotingError)) throw activeVotingError;

    try {
      await can(tx, ctx, {
        action: 'manage_votes',
        resource: 'events',
        eventId: agendaItem.event_id,
      });
      return agendaItem;
    } catch (error) {
      if (!isPermissionError(error)) throw error;
    }

    if (agendaItem.amendment_id) {
      try {
        await can(tx, ctx, {
          action: 'manage',
          resource: 'amendments',
          amendmentId: agendaItem.amendment_id,
        });
        return agendaItem;
      } catch (error) {
        if (!isPermissionError(error)) throw error;
      }
    }

    throw activeVotingError;
  }
}

async function resolveFallbackProcessBranchId(
  tx: Parameters<typeof mutators.agendas.updateAgendaItemChangeRequest.fn>[0]['tx'],
  amendmentId: string
) {
  const amendment = await tx.run(zql.amendment.where('id', amendmentId).one());
  if (!amendment?.current_process_run_id) {
    return null;
  }

  const processRun = await tx.run(
    zql.amendment_process_run.where('id', amendment.current_process_run_id).one()
  );
  if (processRun?.active_branch_id) {
    return processRun.active_branch_id;
  }

  const branches = await tx.run(
    zql.amendment_process_branch
      .where('process_run_id', amendment.current_process_run_id)
      .orderBy('created_at', 'asc')
  );
  return branches[0]?.id ?? null;
}

async function syncBranchEditingMode(
  tx: Parameters<typeof mutators.agendas.updateAgendaItemChangeRequest.fn>[0]['tx'],
  ctx: { readonly userID: string },
  amendmentId: string | null | undefined,
  processBranchId: string | null | undefined,
  editingMode: 'suggest_event' | 'event_final_closing_vote'
) {
  if (!amendmentId) {
    return;
  }

  const branchId = processBranchId ?? (await resolveFallbackProcessBranchId(tx, amendmentId));
  if (!branchId) {
    return;
  }

  const branch = await tx.run(zql.amendment_process_branch.where('id', branchId).one());
  if (!branch || branch.editing_mode === 'passed' || branch.editing_mode === 'rejected') {
    return;
  }

  if (editingMode === 'event_final_closing_vote') {
    await discardPendingEventSuggestions({
      tx,
      ctx,
      amendmentId,
      processBranchId: branch.id,
      now: Date.now(),
    });
  }

  if (branch.editing_mode === editingMode) {
    return;
  }

  return transitionProcessBranchToEventMode({
    tx,
    ctx,
    amendmentId,
    processBranchId: branch.id,
    editingMode,
    branch,
    now: Date.now(),
  });
}

async function syncEventAmendmentsToSuggestEvent(
  tx: Parameters<typeof mutators.agendas.updateAgendaItemChangeRequest.fn>[0]['tx'],
  ctx: { readonly userID: string },
  eventId: string
) {
  const agendaItems = await tx.run(zql.agenda_item.where('event_id', eventId));
  const agendaItemIds = agendaItems.map((item: any) => item.id).filter(Boolean);
  const stepRuns =
    agendaItemIds.length > 0
      ? await tx.run(zql.amendment_process_step_run.where('agenda_item_id', 'IN', agendaItemIds))
      : [];
  const branchByAgendaItemId = new Map(
    stepRuns
      .filter((stepRun: any) => stepRun.agenda_item_id && stepRun.branch_id)
      .map((stepRun: any) => [stepRun.agenda_item_id, stepRun.branch_id])
  );

  for (const agendaItem of agendaItems) {
    if (!agendaItem.amendment_id) {
      continue;
    }
    await syncBranchEditingMode(
      tx,
      ctx,
      agendaItem.amendment_id,
      branchByAgendaItemId.get(agendaItem.id) ?? null,
      'suggest_event'
    );
  }
}

const TERMINAL_PROCESS_STEP_STATUSES = new Set([
  'approved',
  'rejected',
  'merged',
  'withdrawn',
  'completed',
]);

/** Server-only mutators — override the shared mutators with additional server-side logic (e.g. notifications). */
export const agendaServerMutators = {
  createAgendaItem: defineMutator(createAgendaItemSchema, async ({ tx, ctx, args }) => {
    await mutators.agendas.createAgendaItem.fn({ tx, ctx, args });

    if (!args.event_id) {
      return;
    }

    await recomputeEventCounters(tx, args.event_id);
    await recomputeEventEndDate(tx, args.event_id);

    const eTitle = await eventTitle(tx, args.event_id);
    fireNotification('notifyAgendaItemCreated', {
      senderId: ctx.userID,
      eventId: args.event_id,
      eventTitle: eTitle,
      agendaItemTitle: args.title ?? 'Agenda Item',
    });
  }),

  createFull: defineMutator(createAgendaItemFullMutatorSchema, async ({ tx, ctx, args }) => {
    for (const role of args.roles ?? []) {
      await groupServerMutators.createRole.fn({ tx, ctx, args: role });
    }

    for (const agendaItem of args.agenda_items) {
      await agendaServerMutators.createAgendaItem.fn({ tx, ctx, args: agendaItem });
    }

    for (const election of args.elections ?? []) {
      await electionServerMutators.createElection.fn({ tx, ctx, args: election });
    }

    for (const voteWithChoices of args.votes ?? []) {
      await voteServerMutators.createVote.fn({ tx, ctx, args: voteWithChoices.vote });

      for (const choice of voteWithChoices.choices ?? []) {
        await mutators.votes.createVoteChoice.fn({ tx, ctx, args: choice });
      }
    }
  }),

  deleteAgendaItem: defineMutator(deleteAgendaItemSchema, async ({ tx, ctx, args }) => {
    const item = await tx.run(zql.agenda_item.where('id', args.id).one());

    await mutators.agendas.deleteAgendaItem.fn({ tx, ctx, args });

    if (item?.event_id) {
      await recomputeEventCounters(tx, item.event_id);
      await recomputeEventEndDate(tx, item.event_id);
      const eTitle = await eventTitle(tx, item.event_id);
      fireNotification('notifyAgendaItemDeleted', {
        senderId: ctx.userID,
        eventId: item.event_id,
        agendaItemId: args.id,
        agendaItemTitle: item.title,
        eventTitle: eTitle,
      });
    }
  }),

  updateAgendaItem: defineMutator(updateAgendaItemSchema, async ({ tx, ctx, args }) => {
    const oldItem = await tx.run(zql.agenda_item.where('id', args.id).one());

    await mutators.agendas.updateAgendaItem.fn({ tx, ctx, args });

    if (!oldItem) return;

    if (oldItem.event_id) {
      await recomputeEventCounters(tx, oldItem.event_id);
      await recomputeEventEndDate(tx, oldItem.event_id);
    }
    if (args.event_id && args.event_id !== oldItem.event_id) {
      await recomputeEventCounters(tx, args.event_id);
      await recomputeEventEndDate(tx, args.event_id);
    }

    const isActivatingAgendaItem =
      (args.status === 'in-progress' && oldItem.status !== 'in-progress') ||
      (args.status === 'active' && oldItem.status !== 'active');

    const activatedEventId = args.event_id ?? oldItem.event_id;

    if (isActivatingAgendaItem && activatedEventId) {
      await syncEventAmendmentsToSuggestEvent(tx, ctx, activatedEventId);

      if (oldItem.type === 'implementation_review') {
        const implementationTask = await tx.run(
          zql.process_task
            .where('agenda_item_id', args.id)
            .where('task_type', 'implementation_evaluation')
            .one()
        );

        if (implementationTask) {
          await tx.mutate.amendment_process_run.update({
            id: implementationTask.process_run_id,
            implementation_status: 'evaluation_in_vote',
            updated_at: Date.now(),
          });
        }
      }

      const eTitle = await eventTitle(tx, activatedEventId);
      fireNotification('notifyAgendaItemActivated', {
        senderId: ctx.userID,
        eventId: activatedEventId,
        eventTitle: eTitle,
        agendaItemId: args.id,
        agendaItemTitle: oldItem.title,
        agendaItemType: oldItem.type,
      });
    }

    if (args.event_id && args.event_id !== oldItem.event_id && oldItem.event_id) {
      const [sourceTitle, targetTitle] = await Promise.all([
        eventTitle(tx, oldItem.event_id),
        eventTitle(tx, args.event_id),
      ]);
      fireNotification('notifyAgendaItemTransferred', {
        senderId: ctx.userID,
        agendaItemId: args.id,
        agendaItemTitle: oldItem.title,
        sourceEventTitle: sourceTitle,
        targetEventId: args.event_id,
        targetEventTitle: targetTitle,
      });
    }
  }),

  reorderAgendaItems: defineMutator(reorderAgendaItemsSchema, async ({ tx, ctx, args }) => {
    if (args.items.length === 0) {
      return;
    }

    const existingItems = await tx.run(
      zql.agenda_item.where(
        'id',
        'IN',
        args.items.map(item => item.id)
      )
    );
    const existingById = new Map(existingItems.map(item => [item.id, item]));
    const changedEventIds = new Set<string>();

    for (const item of args.items) {
      const existing = existingById.get(item.id);
      if (existing?.event_id && existing.order_index !== item.order_index) {
        changedEventIds.add(existing.event_id);
      }
    }

    await mutators.agendas.reorderAgendaItems.fn({ tx, ctx, args });

    for (const eventId of changedEventIds) {
      await recomputeEventEndDate(tx, eventId);
      const eTitle = await eventTitle(tx, eventId);
      fireNotification('notifyScheduleChanged', {
        senderId: ctx.userID,
        eventId,
        eventTitle: eTitle,
      });
    }
  }),

  addSpeaker: defineMutator(createSpeakerListSchema, async ({ tx, ctx, args }) => {
    await mutators.agendas.addSpeaker.fn({ tx, ctx, args });

    if (args.agenda_item_id) {
      const ai = await tx.run(zql.agenda_item.where('id', args.agenda_item_id).one());
      if (ai?.event_id) {
        const eTitle = await eventTitle(tx, ai.event_id);
        fireNotification('notifySpeakerListJoined', {
          senderId: ctx.userID,
          eventId: ai.event_id,
          eventTitle: eTitle,
          agendaItemId: args.agenda_item_id,
        });
      }
    }
  }),

  updateAgendaItemChangeRequest: defineMutator(
    updateAgendaItemChangeRequestSchema,
    async ({ tx, ctx, args }) => {
      if (args.status === 'voting' || args.status === 'completed') {
        await assertCurrentChangeRequestTimelineItem(tx, args.id);
      }

      await mutators.agendas.updateAgendaItemChangeRequest.fn({ tx, ctx, args });
    }
  ),

  /**
   * Initialize all change-request votes + final amendment vote for an agenda item.
   * Called server-side when an amendment enters event voting sequencing.
   *
   * Creates:
   *  - One vote + 3 choices (yes/no/abstain) per open change request
   *  - One final "accept amendment as modified" vote + 3 choices
   *  - Junction records in `agenda_item_change_request` for each
   *  - Voter records from accredited participants
   */
  initializeChangeRequestVoting: defineMutator(
    initializeChangeRequestVotingSchema,
    async ({ tx, ctx, args }) => {
      const { amendment_id, agenda_item_id } = args;
      const now = Date.now();
      await assertCanManageAgendaVoteFlow(tx, ctx, agenda_item_id);

      // 1. Fetch agenda context and open change requests for this amendment/branch
      const agendaItem = await tx.run(zql.agenda_item.where('id', agenda_item_id).one());
      if (agendaItem?.amendment_id && agendaItem.amendment_id !== amendment_id) {
        throw new Error('Agenda item is linked to a different amendment.');
      }
      const agendaStepRunsResult = await tx.run(
        zql.amendment_process_step_run
          .where('agenda_item_id', agenda_item_id)
          .orderBy('branch_id', 'asc')
          .orderBy('order_index', 'asc')
      );
      const agendaStepRuns = Array.isArray(agendaStepRunsResult) ? agendaStepRunsResult : [];
      const processBranchId =
        agendaStepRuns.length === 1
          ? (agendaStepRuns[0]?.branch_id ?? null)
          : (agendaStepRuns.find(stepRun => stepRun.step_kind !== 'merge_vote')?.branch_id ?? null);
      const mergeStepRuns = agendaStepRuns.filter(
        stepRun =>
          stepRun.step_kind === 'merge_vote' &&
          !TERMINAL_PROCESS_STEP_STATUSES.has(stepRun.status ?? '')
      );
      const mergeBranchIds = [
        ...new Set(
          mergeStepRuns
            .map(stepRun => stepRun.branch_id)
            .filter((branchId): branchId is string => Boolean(branchId))
        ),
      ];
      const mergeBranchIdSet = new Set(mergeBranchIds);
      let eventForAgenda: Record<string, any> | null | undefined;
      const loadEventForAgenda = async () => {
        if (eventForAgenda !== undefined) {
          return eventForAgenda;
        }

        eventForAgenda = agendaItem?.event_id
          ? ((await tx.run(zql.event.where('id', agendaItem.event_id).one())) as
              Record<string, any> | null | undefined)
          : null;
        return eventForAgenda;
      };
      const loadScopedOpenChangeRequests = async () => {
        const result = await tx.run(
          zql.change_request
            .where('amendment_id', amendment_id)
            .where('status', 'open')
            .orderBy('changed_character_count', 'asc')
            .orderBy('created_at', 'asc')
        );
        const openChangeRequests = Array.isArray(result) ? result : [];
        return openChangeRequests.filter(changeRequest =>
          mergeBranchIdSet.size > 1
            ? mergeBranchIdSet.has(changeRequest.process_branch_id ?? '')
            : processBranchId
              ? changeRequest.process_branch_id === processBranchId
              : !changeRequest.process_branch_id
        );
      };

      let changeRequests = await loadScopedOpenChangeRequests();
      const orderScopedChangeRequests = async (requests: typeof changeRequests) =>
        requests.length > 1
          ? orderChangeRequestsForVoting(
              tx,
              amendment_id,
              requests,
              normalizeChangeRequestVoteOrder(
                (await loadEventForAgenda())?.change_request_vote_order
              )
            )
          : requests;
      let orderedChangeRequests = await orderScopedChangeRequests(changeRequests);
      const branchIdsForModeSync =
        mergeBranchIds.length > 1 ? mergeBranchIds : [processBranchId ?? null];
      let finalizedInternalChangeRequests = false;
      for (const branchId of branchIdsForModeSync) {
        const transition = await syncBranchEditingMode(
          tx,
          ctx,
          amendment_id,
          branchId,
          'suggest_event'
        );
        finalizedInternalChangeRequests ||= Boolean(transition?.finalizedInternalChangeRequests);
      }

      if (finalizedInternalChangeRequests) {
        changeRequests = await loadScopedOpenChangeRequests();
        orderedChangeRequests = await orderScopedChangeRequests(changeRequests);
      }

      const CHOICE_LABELS = ['yes', 'no', 'abstain'] as const;
      const DEFAULT_CHOICE_SPECS = CHOICE_LABELS.map(label => ({
        label,
        semanticKey: label,
        processBranchId: null as string | null,
      }));

      // Helper: create a vote with 3 choices and voters
      async function createVoteWithChoicesAndVoters(
        voteTitle: string,
        purpose: CanonicalVotePurpose,
        choiceSpecs: readonly {
          label: string;
          semanticKey?: string | null;
          processBranchId?: string | null;
        }[] = DEFAULT_CHOICE_SPECS
      ) {
        const voteId = crypto.randomUUID();
        await tx.mutate.vote.insert({
          id: voteId,
          agenda_item_id,
          amendment_id,
          title: voteTitle,
          description: null,
          status: VOTE_PHASE.indicative,
          purpose,
          majority_type: 'relative',
          closing_type: 'moderator',
          closing_duration_seconds: null,
          closing_end_time: null,
          visibility: 'public',
          ballot_visibility: 'named',
          created_at: now,
          updated_at: now,
        });

        // Create vote choices
        for (let i = 0; i < choiceSpecs.length; i++) {
          const choice = choiceSpecs[i];
          await tx.mutate.vote_choice.insert({
            id: crypto.randomUUID(),
            vote_id: voteId,
            label: choice.label,
            semantic_key: choice.semanticKey ?? null,
            process_branch_id: choice.processBranchId ?? null,
            order_index: i,
            created_at: now,
          });
        }

        return voteId;
      }

      const existingLinksResult = await tx.run(
        zql.agenda_item_change_request
          .where('agenda_item_id', agenda_item_id)
          .orderBy('order_index', 'asc')
      );
      let existingLinks = Array.isArray(existingLinksResult) ? existingLinksResult : [];
      const existingVotesResult = await tx.run(
        zql.vote.where('agenda_item_id', agenda_item_id).where('amendment_id', amendment_id)
      );
      const existingVotes = Array.isArray(existingVotesResult) ? existingVotesResult : [];
      const existingMergeVote = existingVotes.find(
        vote => vote.purpose === VOTE_PURPOSE.mergeVariant
      );
      let insertedMergeSequenceStep = false;

      if (mergeStepRuns.length > 1) {
        const branchesResult =
          mergeBranchIds.length > 0
            ? await tx.run(zql.amendment_process_branch.where('id', 'IN', mergeBranchIds))
            : [];
        const branches = Array.isArray(branchesResult) ? branchesResult : [];
        const branchById = new Map(branches.map(branch => [branch.id, branch]));
        const mergeBranchSources: MergeVoteBranchTitleSource[] = [];
        for (const [index, stepRun] of mergeStepRuns.entries()) {
          if (!stepRun.branch_id) continue;
          mergeBranchSources.push(
            branchById.get(stepRun.branch_id) ?? {
              id: stepRun.branch_id,
              title: null,
              created_at: stepRun.created_at ?? index,
            }
          );
        }
        const orderedMergeBranches = getOrderedMergeVoteBranches(mergeBranchSources);
        const amendment = await tx.run(zql.amendment.where('id', amendment_id).one());
        const mergeVoteTitle = buildMergeVoteTitle(
          amendment?.title ?? agendaItem?.title,
          orderedMergeBranches
        );
        const mergeChoiceSpecs = buildMergeVoteChoiceSpecs(orderedMergeBranches);
        await tx.mutate.agenda_item.update({
          id: agenda_item_id,
          title: mergeVoteTitle,
          updated_at: now,
        });

        let mergeVoteId =
          existingMergeVote?.id ?? mergeStepRuns.find(stepRun => stepRun.vote_id)?.vote_id ?? null;
        if (mergeVoteId) {
          await tx.mutate.vote.update({
            id: mergeVoteId,
            title: mergeVoteTitle,
            purpose: VOTE_PURPOSE.mergeVariant,
            updated_at: now,
          });
        } else {
          mergeVoteId = await createVoteWithChoicesAndVoters(
            mergeVoteTitle,
            VOTE_PURPOSE.mergeVariant,
            mergeChoiceSpecs
          );
        }

        for (const stepRun of mergeStepRuns) {
          if (stepRun.vote_id === mergeVoteId && stepRun.agenda_item_id === agenda_item_id) {
            continue;
          }

          await tx.mutate.amendment_process_step_run.update({
            id: stepRun.id,
            agenda_item_id,
            vote_id: mergeVoteId,
            updated_at: now,
          });
        }

        const existingMergeLink = existingLinks.find(
          link =>
            link.vote_id === mergeVoteId || link.step_kind === AGENDA_VOTE_STEP_KIND.mergeVariant
        );
        if (!existingMergeLink) {
          for (const link of existingLinks) {
            await tx.mutate.agenda_item_change_request.update({
              id: link.id,
              order_index: (link.order_index ?? 0) + 1,
              updated_at: now,
            });
          }

          await tx.mutate.agenda_item_change_request.insert({
            id: crypto.randomUUID(),
            agenda_item_id,
            change_request_id: null,
            vote_id: mergeVoteId,
            order_index: 0,
            step_kind: AGENDA_VOTE_STEP_KIND.mergeVariant,
            process_branch_id: null,
            is_closing_vote: false,
            status: 'pending',
            blocked_reason: null,
            result_status: null,
            obsolete_reason: null,
            created_at: now,
            updated_at: now,
          });
          insertedMergeSequenceStep = true;

          existingLinks = existingLinks.map(link => ({
            ...link,
            order_index: (link.order_index ?? 0) + 1,
          }));
        }
      }

      const existingChangeRequestIds = new Set(
        existingLinks.map(link => link.change_request_id).filter((id): id is string => Boolean(id))
      );
      const missingChangeRequestCount = orderedChangeRequests.filter(
        changeRequest => !existingChangeRequestIds.has(changeRequest.id)
      ).length;
      const closingBoundary = existingLinks.find(
        link => link.is_closing_vote || link.step_kind === AGENDA_VOTE_STEP_KIND.closing
      );
      let nextOrderIndex =
        closingBoundary?.order_index ??
        existingLinks.reduce((max, link) => Math.max(max, link.order_index ?? 0), -1) + 1;

      if (closingBoundary && missingChangeRequestCount > 0) {
        for (const link of existingLinks.filter(
          link => (link.order_index ?? 0) >= nextOrderIndex
        )) {
          await tx.mutate.agenda_item_change_request.update({
            id: link.id,
            order_index: (link.order_index ?? nextOrderIndex) + missingChangeRequestCount,
            updated_at: now,
          });
        }
      }
      if (insertedMergeSequenceStep && nextOrderIndex === 0) {
        nextOrderIndex = 1;
      }

      let hasChangeRequestVoteSteps =
        insertedMergeSequenceStep || existingLinks.some(link => !link.is_closing_vote);

      // 3. Create one vote per change request + junction records
      for (const cr of orderedChangeRequests) {
        if (existingChangeRequestIds.has(cr.id)) {
          continue;
        }

        hasChangeRequestVoteSteps = true;
        const voteId = await createVoteWithChoicesAndVoters(
          cr.title ??
            translateText('common.formats.numberedChangeRequest', {
              number: nextOrderIndex + 1,
            }),
          VOTE_PURPOSE.changeRequest
        );

        await tx.mutate.agenda_item_change_request.insert({
          id: crypto.randomUUID(),
          agenda_item_id,
          change_request_id: cr.id,
          vote_id: voteId,
          order_index: nextOrderIndex,
          step_kind: AGENDA_VOTE_STEP_KIND.changeRequest,
          process_branch_id: cr.process_branch_id ?? processBranchId ?? null,
          is_closing_vote: false,
          status: 'voting',
          blocked_reason: null,
          result_status: null,
          obsolete_reason: null,
          created_at: now,
          updated_at: now,
        });
        nextOrderIndex += 1;
      }

      const refreshedVotes =
        existingMergeVote && mergeStepRuns.length > 1
          ? await tx.run(
              zql.vote.where('agenda_item_id', agenda_item_id).where('amendment_id', amendment_id)
            )
          : existingVotes;
      const existingFinalVote = refreshedVotes.find(vote => vote.purpose === VOTE_PURPOSE.closing);

      const finalVoteId =
        existingFinalVote?.id ??
        (await createVoteWithChoicesAndVoters(
          'Accept amendment as modified',
          VOTE_PURPOSE.closing
        ));

      const existingFinalLink = existingLinks.find(
        link => link.is_closing_vote || link.step_kind === AGENDA_VOTE_STEP_KIND.closing
      );
      if (!existingFinalLink) {
        await tx.mutate.agenda_item_change_request.insert({
          id: crypto.randomUUID(),
          agenda_item_id,
          change_request_id: null,
          vote_id: finalVoteId,
          order_index: nextOrderIndex,
          step_kind: AGENDA_VOTE_STEP_KIND.closing,
          process_branch_id: processBranchId ?? null,
          is_closing_vote: true,
          status: 'pending',
          blocked_reason: null,
          result_status: null,
          obsolete_reason: null,
          created_at: now,
          updated_at: now,
        });
      }

      if (
        args.start_final_vote_if_no_change_requests &&
        !hasChangeRequestVoteSteps &&
        normalizeVotePhase(existingFinalVote?.status) !== VOTE_PHASE.closed
      ) {
        let closingDurationSeconds: number | null = null;
        if (agendaItem?.event_id) {
          const event = await loadEventForAgenda();
          closingDurationSeconds = event?.default_final_vote_duration_seconds ?? null;
        }

        await snapshotVoteElectorate(tx, finalVoteId);
        await tx.mutate.vote.update({
          id: finalVoteId,
          status: VOTE_PHASE.final,
          closing_duration_seconds: closingDurationSeconds,
          closing_end_time:
            closingDurationSeconds && closingDurationSeconds > 0
              ? now + closingDurationSeconds * 1000
              : null,
          updated_at: now,
        });
        for (const branchId of branchIdsForModeSync) {
          await syncBranchEditingMode(tx, ctx, amendment_id, branchId, 'event_final_closing_vote');
        }
      }
    }
  ),

  /**
   * Materialize missing vote-card rows for confirmed event-suggestion CRs.
   * This is intentionally narrower than initializeChangeRequestVoting: it never
   * creates a final closing vote and only appends unlinked open CRs.
   */
  ensureEventSuggestionChangeRequestVotes: defineMutator(
    ensureEventSuggestionChangeRequestVotesSchema,
    async ({ tx, ctx, args }) => {
      const { amendment_id, agenda_item_id } = args;
      const now = Date.now();
      const agendaItem = await assertCanEnsureEventSuggestionChangeRequestVotes(tx, ctx, args);

      let processBranchId = args.process_branch_id;
      if (processBranchId === undefined) {
        const agendaStepRunsResult = await tx.run(
          zql.amendment_process_step_run
            .where('agenda_item_id', agenda_item_id)
            .orderBy('branch_id', 'asc')
            .orderBy('order_index', 'asc')
        );
        const agendaStepRuns = Array.isArray(agendaStepRunsResult) ? agendaStepRunsResult : [];
        processBranchId =
          agendaStepRuns.length === 1
            ? (agendaStepRuns[0]?.branch_id ?? null)
            : (agendaStepRuns.find(stepRun => stepRun.step_kind !== 'merge_vote')?.branch_id ??
              null);
      }

      const openChangeRequestsResult = await tx.run(
        zql.change_request
          .where('amendment_id', amendment_id)
          .where('status', 'open')
          .orderBy('changed_character_count', 'asc')
          .orderBy('created_at', 'asc')
      );
      const openChangeRequests = Array.isArray(openChangeRequestsResult)
        ? openChangeRequestsResult
        : [];
      const existingLinksResult = await tx.run(
        zql.agenda_item_change_request
          .where('agenda_item_id', agenda_item_id)
          .orderBy('order_index', 'asc')
      );
      const existingLinks = Array.isArray(existingLinksResult) ? existingLinksResult : [];
      const existingChangeRequestIds = new Set(
        existingLinks.map(link => link.change_request_id).filter((id): id is string => Boolean(id))
      );
      const changeRequests = openChangeRequests.filter(changeRequest => {
        if (existingChangeRequestIds.has(changeRequest.id)) return false;
        if (changeRequest.status !== 'open') return false;
        if (changeRequest.voting_status === 'pending_submission') return false;
        if (changeRequest.obsolete_at || changeRequest.obsolete_reason) return false;
        if (processBranchId) return changeRequest.process_branch_id === processBranchId;
        return !changeRequest.process_branch_id;
      });

      if (changeRequests.length === 0) {
        return;
      }
      const hasExistingOpenChangeRequestVoteSteps = existingLinks.some(
        link =>
          Boolean(link.change_request_id) && !link.is_closing_vote && link.status !== 'completed'
      );
      const needsEventVoteOrder =
        changeRequests.length > 1 || hasExistingOpenChangeRequestVoteSteps;
      const eventForAgenda =
        agendaItem.event_id && needsEventVoteOrder
          ? await tx.run(zql.event.where('id', agendaItem.event_id).one())
          : null;
      const voteOrder = normalizeChangeRequestVoteOrder(
        (eventForAgenda as Record<string, any> | null | undefined)?.change_request_vote_order
      );
      const orderedChangeRequests =
        changeRequests.length > 1
          ? await orderChangeRequestsForVoting(tx, amendment_id, changeRequests, voteOrder)
          : changeRequests;

      const closingBoundary = existingLinks.find(
        link => link.is_closing_vote || link.step_kind === AGENDA_VOTE_STEP_KIND.closing
      );
      let nextOrderIndex =
        closingBoundary?.order_index ??
        existingLinks.reduce((max, link) => Math.max(max, link.order_index ?? 0), -1) + 1;

      if (closingBoundary) {
        for (const link of existingLinks.filter(
          link => (link.order_index ?? 0) >= nextOrderIndex
        )) {
          await tx.mutate.agenda_item_change_request.update({
            id: link.id,
            order_index: (link.order_index ?? nextOrderIndex) + changeRequests.length,
            updated_at: now,
          });
        }
      }

      for (const cr of orderedChangeRequests) {
        const voteId = crypto.randomUUID();
        await tx.mutate.vote.insert({
          id: voteId,
          agenda_item_id,
          amendment_id,
          title:
            cr.title ??
            translateText('common.formats.numberedChangeRequest', {
              number: nextOrderIndex + 1,
            }),
          description: null,
          status: VOTE_PHASE.indicative,
          purpose: VOTE_PURPOSE.changeRequest,
          majority_type: 'relative',
          closing_type: 'moderator',
          closing_duration_seconds: null,
          closing_end_time: null,
          visibility: 'public',
          ballot_visibility: 'named',
          created_at: now,
          updated_at: now,
        });

        for (let index = 0; index < DEFAULT_CHANGE_REQUEST_CHOICE_SPECS.length; index++) {
          const choice = DEFAULT_CHANGE_REQUEST_CHOICE_SPECS[index];
          await tx.mutate.vote_choice.insert({
            id: crypto.randomUUID(),
            vote_id: voteId,
            label: choice.label,
            semantic_key: choice.semanticKey,
            process_branch_id: choice.processBranchId,
            order_index: index,
            created_at: now,
          });
        }

        await tx.mutate.agenda_item_change_request.insert({
          id: crypto.randomUUID(),
          agenda_item_id,
          change_request_id: cr.id,
          vote_id: voteId,
          order_index: nextOrderIndex,
          step_kind: AGENDA_VOTE_STEP_KIND.changeRequest,
          process_branch_id: cr.process_branch_id ?? processBranchId ?? null,
          is_closing_vote: false,
          status: 'voting',
          blocked_reason: null,
          result_status: null,
          obsolete_reason: null,
          created_at: now,
          updated_at: now,
        });
        nextOrderIndex += 1;
      }

      await reorderOpenChangeRequestVoteStepsForAgendaItem(tx, agendaItem, voteOrder);
    }
  ),

  /**
   * Process the result of a CR vote: accept or reject the plate-js suggestion,
   * update the change request status, and advance the timeline.
   *
   * - If vote passed (simple majority yes > no, ignoring abstains):
   *   accept the plate-js suggestion in the document and set CR status to 'accepted'
   * - If vote rejected or tied:
   *   reject the plate-js suggestion in the document and set CR status to 'rejected'
   * - Always marks the agenda_item_change_request junction as 'completed'
   *
   * The link between a change_request and its plate-js suggestion lives in the
   * `amendment.discussions` JSON column: `TDiscussion.changeRequestEntityId` points
   * to the change_request row, and `TDiscussion.id` is the suggestion UUID used in
   * document content as `suggestion_<uuid>` marks.
   */
  processCRVoteResult: defineMutator(processCRVoteResultSchema, async ({ tx, ctx, args }) => {
    const { agenda_item_change_request_id, vote_result } = args;
    const now = Date.now();

    // 1. Fetch the junction record
    const junction = await tx.run(
      zql.agenda_item_change_request.where('id', agenda_item_change_request_id).one()
    );
    if (!junction) return;

    if (junction.status === 'completed' || junction.status === 'blocked_tie') {
      return;
    }

    await assertCurrentChangeRequestTimelineItem(tx, agenda_item_change_request_id);
    await assertCanManageAgendaVoteFlow(tx, ctx, junction.agenda_item_id);

    if (vote_result === 'tie') {
      await tx.mutate.agenda_item_change_request.update({
        id: agenda_item_change_request_id,
        status: 'blocked_tie',
        blocked_reason: 'tie',
        result_status: vote_result,
        updated_at: now,
      });
      return;
    }

    // 2. If this is a per-CR vote (not the final amendment vote), process the suggestion
    if (junction.change_request_id) {
      await resolveChangeRequestByVoteResult({
        tx,
        ctx,
        changeRequestId: junction.change_request_id,
        voteResult: vote_result,
        now,
      });
    }

    // 3. Mark the junction record as completed
    await tx.mutate.agenda_item_change_request.update({
      id: agenda_item_change_request_id,
      status: 'completed',
      result_status: vote_result,
      updated_at: now,
    });
  }),
};

async function materializeChangeRequestVotingInternal({
  tx,
  ctx,
  args,
}: {
  tx: AgendaMutatorTx;
  ctx: AgendaMutatorCtx;
  args: {
    amendment_id: string;
    agenda_item_id: string;
    start_final_vote_if_no_change_requests?: boolean;
  };
}) {
  const internalCtx: AgendaMutatorCtx & {
    [INTERNAL_VOTE_MATERIALIZATION]: true;
  } = {
    ...ctx,
    [INTERNAL_VOTE_MATERIALIZATION]: true,
  };
  await agendaServerMutators.initializeChangeRequestVoting.fn({
    tx,
    ctx: internalCtx,
    args,
  });
}

export async function materializeCurrentForwardConfirmedEventVoting(
  tx: AgendaMutatorTx,
  ctx: AgendaMutatorCtx,
  branchId: string | null | undefined
) {
  if (!branchId) return;

  const stepRuns = await tx.run(
    zql.amendment_process_step_run.where('branch_id', branchId).orderBy('order_index', 'asc')
  );
  const activeStepRun = stepRuns.find(
    stepRun => !TERMINAL_PROCESS_STEP_STATUSES.has(stepRun.status ?? '')
  );

  if (
    !activeStepRun?.agenda_item_id ||
    !activeStepRun.event_id ||
    activeStepRun.step_kind === 'merge_vote' ||
    activeStepRun.decision_status !== 'forward_confirmed'
  ) {
    return;
  }

  const agendaItem = await tx.run(zql.agenda_item.where('id', activeStepRun.agenda_item_id).one());
  if (!agendaItem?.amendment_id) return;

  await materializeChangeRequestVotingInternal({
    tx,
    ctx,
    args: {
      amendment_id: agendaItem.amendment_id,
      agenda_item_id: agendaItem.id,
      start_final_vote_if_no_change_requests: false,
    },
  });
}
