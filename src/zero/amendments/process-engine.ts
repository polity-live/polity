import { type Transaction } from '@rocicorp/zero';
import { computeVoteResult, type MajorityType } from '@/features/votes/logic/computeVoteResult';
import type { Schema } from '../schema';
import { zql } from '../schema';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { fireNotification } from '../server-notify';
import { finalizeInternalChangeRequestsForEventPhaseTransition } from '../change-requests/internal-voting';
import { isAmendmentTargetEventOpen } from '@/features/amendments/logic/amendmentTargetEventEligibility';
import { type CanonicalVotePurpose, VOTE_PURPOSE, VOTE_PHASE } from '../votes/vote-workflow';
import {
  buildMergeVoteTitle,
  getMergeVoteBranchLabel,
  getOrderedMergeVoteBranches,
  type MergeVoteBranchTitleSource,
} from './merge-vote-title';
import { normalizeEditingMode } from './editing-mode-policy';

type ZeroTransaction = Transaction<Schema>;

type ProcessStatus =
  | 'pending_event'
  | 'scheduled'
  | 'in_vote'
  | 'approved'
  | 'rejected'
  | 'merged'
  | 'withdrawn'
  | 'completed';

type GroupDecisionStatus = 'supported' | 'accepted' | 'rejected' | 'withdrawn';
type VoteResult = 'passed' | 'rejected' | 'tie';
type StepKind = 'group_vote' | 'merge_vote' | 'workflow_handoff';
type SelectionMode = 'default_target_workflow' | 'explicit_workflow' | null;
type MergeStrategy = 'winner_continues' | null;
type AgendaType = 'amendment' | 'implementation_review' | 'support_confirmation';
type ProcessTaskNotificationType =
  | 'schedule_event'
  | 'implementation_evaluation'
  | 'support_confirmation';

interface EnrichedPathSegmentInput {
  groupId: string;
  groupName: string;
  eventId: string | null;
  eventTitle: string;
  eventStartDate: number | null;
  eventEndDate?: number | null;
  workflowStepId?: string | null;
  stepKind?: StepKind;
  selectionMode?: SelectionMode;
  mergeStrategy?: MergeStrategy;
  eventRule?: string | null;
  autoTaskOnMissingEvent?: boolean;
  targetWorkflowId?: string | null;
  requiredAfter?: number | null;
  requiredBefore?: number | null;
  missingEvent?: boolean;
  agendaItemId: string | null;
  amendmentVoteId: string | null;
  forwardingStatus: string;
}

interface InitializeAmendmentProcessPathArgs {
  amendment_id: string;
  amendment_title: string;
  amendment_reason: string | null;
  enriched_path: EnrichedPathSegmentInput[];
  source_group_id?: string | null;
  workflow_id?: string | null;
  path_mode?: 'hierarchy' | 'workflow';
  evaluation_mode?: 'none' | 'fixed_date' | 'relative_to_vote';
  evaluation_date?: number | null;
  evaluation_offset_months?: number | null;
  evaluation_offset_years?: number | null;
}

interface ResolveAmendmentProcessVoteArgs {
  agenda_item_id: string;
}

interface CompleteProcessTaskWithEventArgs {
  process_task_id: string;
  event_id: string;
  description?: string | null;
}

interface ReplanProcessBranchEventsArgs {
  branch_id: string;
  event_updates: {
    step_run_id: string;
    event_id: string | null;
  }[];
}

interface ProcessEventScheduleRow {
  id: string;
  title?: string | null;
  group_id?: string | null;
  start_date?: number | null;
  end_date?: number | null;
  amendment_deadline?: number | null;
}

interface ChoiceLabelSpec {
  label: string;
  processBranchId?: string | null;
  semanticKey?: string | null;
}

interface VoteOutcome {
  result: VoteResult;
  totalEligible: number;
  tallyByChoiceId: Map<string, number>;
}

function getProcessTaskNotificationTitle(
  taskType: string | null | undefined,
  title?: string | null
) {
  const trimmedTitle = title?.trim();
  if (trimmedTitle) {
    return trimmedTitle;
  }

  switch (taskType) {
    case 'implementation_evaluation':
      return 'Umsetzung evaluieren';
    case 'support_confirmation':
      return 'Unterstützung bestätigen';
    default:
      return 'Event planen';
  }
}

function fireProcessTaskCreatedNotification(args: {
  senderId?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  taskTitle?: string | null;
  taskType: ProcessTaskNotificationType;
}) {
  if (!args.senderId || !args.groupId) {
    return;
  }

  fireNotification('notifyProcessTaskCreated', {
    senderId: args.senderId,
    groupId: args.groupId,
    groupName: args.groupName || 'die zuständige Gruppe',
    taskTitle: getProcessTaskNotificationTitle(args.taskType, args.taskTitle),
  });
}

interface MergeRoundOneOutcome {
  result: 'tie' | 'winner';
  winnerBranchId: string | null;
  winnerChoiceId: string | null;
  loserBranchIds: string[];
}

interface WorkflowRuntimeStepTemplate {
  workflowId: string | null;
  workflowStepId: string | null;
  stepKind: StepKind;
  selectionMode: SelectionMode;
  mergeStrategy: MergeStrategy;
  sourceGroupId: string | null;
  targetGroupId: string;
  eventId: string | null;
  eventStartDate: number | null;
  eventEndDate: number | null;
  eventRule: string | null;
  autoTaskOnMissingEvent: boolean;
  targetWorkflowId: string | null;
  groupName: string;
}

const TERMINAL_STEP_STATUSES = new Set<ProcessStatus>([
  'approved',
  'rejected',
  'merged',
  'withdrawn',
  'completed',
]);
const TERMINAL_BRANCH_STATUSES = new Set(['completed', 'rejected', 'withdrawn', 'merged']);

function isTerminalStepStatus(status: string | null | undefined): status is ProcessStatus {
  return TERMINAL_STEP_STATUSES.has((status ?? 'scheduled') as ProcessStatus);
}

function isTerminalBranchStatus(status: string | null | undefined) {
  return TERMINAL_BRANCH_STATUSES.has(status ?? '');
}

function normalizeMajorityType(value?: string | null): MajorityType {
  if (value === 'absolute' || value === 'two_thirds') {
    return value;
  }

  return 'simple';
}

function normalizeDecisionChoiceLabel(label?: string | null) {
  return label?.trim().toLowerCase() ?? null;
}

function isAcceptDecisionChoice(label?: string | null) {
  const normalized = normalizeDecisionChoiceLabel(label);
  return normalized === 'accept' || normalized === 'yes';
}

function isRejectDecisionChoice(label?: string | null) {
  const normalized = normalizeDecisionChoiceLabel(label);
  return normalized === 'reject' || normalized === 'no';
}

function getEventOrderingAnchor(args: {
  eventStartDate?: number | null;
  eventEndDate?: number | null;
}) {
  return args.eventEndDate ?? args.eventStartDate ?? null;
}

function getStepRunFingerprint(stepRun: {
  process_run_id: string;
  workflow_step_id?: string | null;
  target_group_id?: string | null;
  event_id?: string | null;
  order_index: number;
  step_kind: string;
}) {
  if (stepRun.workflow_step_id) {
    return `workflow:${stepRun.workflow_step_id}`;
  }

  if (stepRun.step_kind === 'merge_vote' && stepRun.event_id && stepRun.target_group_id) {
    return `auto-merge:${stepRun.process_run_id}:${stepRun.target_group_id}:${stepRun.event_id}`;
  }

  return `runtime:${stepRun.process_run_id}:${stepRun.target_group_id ?? 'none'}:${stepRun.order_index}:${stepRun.step_kind}`;
}

function compareStepRunsByProcessOrder(
  left: { id: string; order_index: number },
  right: { id: string; order_index: number }
) {
  const byOrderIndex = left.order_index - right.order_index;
  return byOrderIndex !== 0 ? byOrderIndex : left.id.localeCompare(right.id);
}

function buildChoiceLabel(label: string) {
  return { label } satisfies ChoiceLabelSpec;
}

function getDefaultDecisionChoices() {
  return [buildChoiceLabel('accept'), buildChoiceLabel('reject'), buildChoiceLabel('abstain')];
}

function buildMergeVoteChoiceLabels<TBranch extends MergeVoteBranchTitleSource>(
  branches: readonly TBranch[]
): ChoiceLabelSpec[] {
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

function addCalendarOffset(args: {
  timestamp: number;
  months?: number | null;
  years?: number | null;
}) {
  const baseDate = new Date(args.timestamp);
  const originalDay = baseDate.getDate();
  const result = new Date(args.timestamp);
  result.setDate(1);
  result.setFullYear(result.getFullYear() + (args.years ?? 0));
  result.setMonth(result.getMonth() + (args.months ?? 0));
  const lastDayOfTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  return result.getTime();
}

function resolveConcreteEvaluationDate(args: {
  evaluationMode?: 'fixed_date' | 'relative_to_vote' | null;
  evaluationDate?: number | null;
  evaluationOffsetMonths?: number | null;
  evaluationOffsetYears?: number | null;
  decisionTimestamp: number;
}) {
  if (args.evaluationMode === 'fixed_date') {
    return args.evaluationDate ?? null;
  }

  if (args.evaluationMode === 'relative_to_vote') {
    return addCalendarOffset({
      timestamp: args.decisionTimestamp,
      months: args.evaluationOffsetMonths ?? 0,
      years: args.evaluationOffsetYears ?? 0,
    });
  }

  return null;
}

async function createVoteChoices(
  tx: ZeroTransaction,
  voteId: string,
  choices: readonly ChoiceLabelSpec[]
) {
  const now = Date.now();

  for (const [index, choice] of choices.entries()) {
    await tx.mutate.vote_choice.insert({
      id: crypto.randomUUID(),
      vote_id: voteId,
      label: choice.label,
      semantic_key: choice.semanticKey ?? null,
      process_branch_id: choice.processBranchId ?? null,
      order_index: index + 1,
      created_at: now,
    });
  }
}

async function replaceVoteChoices(
  tx: ZeroTransaction,
  voteId: string,
  choices: readonly ChoiceLabelSpec[]
) {
  const existingChoices = await tx.run(zql.vote_choice.where('vote_id', voteId));
  for (const choice of existingChoices) {
    await tx.mutate.vote_choice.delete({ id: choice.id });
  }

  await createVoteChoices(tx, voteId, choices);
}

async function upsertGroupDecision(
  tx: ZeroTransaction,
  args: {
    amendmentId: string;
    groupId: string;
    processRunId?: string | null;
    processBranchId?: string | null;
    processStepRunId?: string | null;
    status: GroupDecisionStatus;
  }
) {
  const now = Date.now();
  const existing = await tx.run(
    zql.amendment_group_decision
      .where('amendment_id', args.amendmentId)
      .where('group_id', args.groupId)
      .one()
  );

  if (existing) {
    await tx.mutate.amendment_group_decision.update({
      id: existing.id,
      process_run_id: args.processRunId ?? null,
      process_branch_id: args.processBranchId ?? null,
      process_step_run_id: args.processStepRunId ?? null,
      status: args.status,
      decided_at: now,
      updated_at: now,
    });
    return existing.id;
  }

  const id = crypto.randomUUID();
  await tx.mutate.amendment_group_decision.insert({
    id,
    amendment_id: args.amendmentId,
    group_id: args.groupId,
    process_run_id: args.processRunId ?? null,
    process_branch_id: args.processBranchId ?? null,
    process_step_run_id: args.processStepRunId ?? null,
    status: args.status,
    decided_at: now,
    created_at: now,
    updated_at: now,
  });
  return id;
}

async function updatePathSegmentStatus(tx: ZeroTransaction, stepRunId: string, status: string) {
  const segments = await tx.run(zql.amendment_path_segment.where('process_step_run_id', stepRunId));
  const segmentRows = Array.isArray(segments) ? segments.filter(Boolean) : [];
  for (const segment of segmentRows) {
    await tx.mutate.amendment_path_segment.update({
      id: segment.id,
      status,
    });
  }
}

async function updatePathSegmentsForStepRun(
  tx: ZeroTransaction,
  args: {
    stepRunId: string;
    eventId: string | null;
    status: string;
  }
) {
  const segments = await tx.run(
    zql.amendment_path_segment.where('process_step_run_id', args.stepRunId)
  );
  const segmentRows = Array.isArray(segments) ? segments.filter(Boolean) : [];
  for (const segment of segmentRows) {
    await tx.mutate.amendment_path_segment.update({
      id: segment.id,
      event_id: args.eventId,
      status: args.status,
    });
  }
}

async function getProcessPathId(tx: ZeroTransaction, processRunId: string) {
  const path = await tx.run(
    zql.amendment_path.where('process_run_id', processRunId).orderBy('created_at', 'asc').one()
  );
  return path?.id ?? null;
}

async function insertPathSegmentForStepRun(
  tx: ZeroTransaction,
  args: {
    pathId: string | null;
    branchId: string;
    stepRunId: string;
    groupId: string;
    eventId: string | null;
    orderIndex: number;
    status: string;
  }
) {
  if (!args.pathId) {
    return;
  }

  await tx.mutate.amendment_path_segment.insert({
    id: crypto.randomUUID(),
    path_id: args.pathId,
    process_branch_id: args.branchId,
    process_step_run_id: args.stepRunId,
    group_id: args.groupId,
    event_id: args.eventId,
    order_index: args.orderIndex,
    status: args.status,
    created_at: Date.now(),
  });
}

function getBranchStartGroupIdFromStepRuns(
  stepRuns: readonly {
    order_index: number;
    target_group_id?: string | null;
    source_group_id?: string | null;
  }[]
) {
  const firstStepRun = [...stepRuns].sort((left, right) => left.order_index - right.order_index)[0];
  return firstStepRun?.target_group_id ?? firstStepRun?.source_group_id ?? null;
}

async function getExistingBranchStartGroupIds(tx: ZeroTransaction, processRunId: string) {
  const stepRuns = await tx.run(
    zql.amendment_process_step_run
      .where('process_run_id', processRunId)
      .orderBy('branch_id', 'asc')
      .orderBy('order_index', 'asc')
  );
  const stepRunsByBranchId = new Map<string, typeof stepRuns>();

  for (const stepRun of stepRuns) {
    const branchStepRuns = stepRunsByBranchId.get(stepRun.branch_id) ?? [];
    branchStepRuns.push(stepRun);
    stepRunsByBranchId.set(stepRun.branch_id, branchStepRuns);
  }

  const startGroupIds = new Set<string>();
  for (const branchStepRuns of stepRunsByBranchId.values()) {
    const startGroupId = getBranchStartGroupIdFromStepRuns(branchStepRuns);
    if (startGroupId) {
      startGroupIds.add(startGroupId);
    }
  }

  return startGroupIds;
}

async function createAgendaItemAndVote(
  tx: ZeroTransaction,
  args: {
    agendaItemId: string;
    voteId: string;
    eventId: string;
    amendmentId: string | null;
    amendmentTitle: string;
    amendmentReason: string | null;
    forwardingStatus: string;
    creatorId: string;
    agendaTitle?: string;
    agendaDescription?: string | null;
    agendaType?: AgendaType;
    voteTitle?: string | null;
    voteDescription?: string | null;
    choiceLabels?: readonly ChoiceLabelSpec[];
    majorityType?: string | null;
    votePurpose: CanonicalVotePurpose;
  }
) {
  const now = Date.now();
  const agendaTitle = args.agendaTitle ?? `Amendment: ${args.amendmentTitle}`;
  const agendaDescription = args.agendaDescription ?? args.amendmentReason ?? '';
  const voteTitle = args.voteTitle ?? agendaTitle;
  const voteDescription = args.voteDescription ?? args.amendmentReason ?? null;
  const orderIndex =
    args.forwardingStatus === 'previous_decision_outstanding'
      ? 999
      : (await getConfirmedAgendaTailOrderIndex(tx, args.eventId)) + 1;

  await tx.mutate.agenda_item.insert({
    id: args.agendaItemId,
    event_id: args.eventId,
    amendment_id: args.amendmentId,
    creator_id: args.creatorId,
    title: agendaTitle,
    description: agendaDescription,
    type: args.agendaType ?? 'amendment',
    status: 'pending',
    forwarding_status: args.forwardingStatus,
    order_index: orderIndex,
    duration: 0,
    scheduled_time: '',
    start_time: 0,
    end_time: 0,
    activated_at: 0,
    completed_at: 0,
    majority_type: null,
    time_limit: null,
    voting_phase: null,
    created_at: now,
    updated_at: now,
  });

  await tx.mutate.vote.insert({
    id: args.voteId,
    agenda_item_id: args.agendaItemId,
    amendment_id: args.amendmentId,
    title: voteTitle,
    description: voteDescription,
    status: VOTE_PHASE.indicative,
    purpose: args.votePurpose,
    majority_type: args.majorityType ?? 'relative',
    closing_type: 'moderator',
    closing_duration_seconds: null,
    closing_end_time: null,
    visibility: 'public',
    ballot_visibility: 'named',
    created_at: now,
    updated_at: now,
  });

  await createVoteChoices(tx, args.voteId, args.choiceLabels ?? getDefaultDecisionChoices());
}

async function createScheduleEventTask(
  tx: ZeroTransaction,
  args: {
    processRunId: string;
    branchId: string;
    stepRunId: string;
    taskTitle: string;
    taskDescription: string;
    groupId: string;
    targetGroupId: string | null;
    metadata: Record<string, unknown>;
    senderId?: string | null;
    groupName?: string | null;
  }
) {
  const now = Date.now();
  const existingTask = await tx.run(
    zql.process_task.where('step_run_id', args.stepRunId).where('task_type', 'schedule_event').one()
  );
  const reusableTask = Array.isArray(existingTask) ? null : existingTask;

  if (reusableTask && reusableTask.status !== 'completed' && reusableTask.status !== 'cancelled') {
    return reusableTask.id;
  }

  const id = crypto.randomUUID();
  await tx.mutate.process_task.insert({
    id,
    process_run_id: args.processRunId,
    branch_id: args.branchId,
    step_run_id: args.stepRunId,
    task_type: 'schedule_event',
    status: 'open',
    title: args.taskTitle,
    description: args.taskDescription,
    group_id: args.groupId,
    target_group_id: args.targetGroupId,
    event_id: null,
    agenda_item_id: null,
    support_confirmation_id: null,
    due_at: null,
    resolved_at: null,
    metadata: args.metadata as never,
    created_at: now,
    updated_at: now,
  });
  fireProcessTaskCreatedNotification({
    senderId: args.senderId,
    groupId: args.groupId,
    groupName: args.groupName,
    taskTitle: args.taskTitle,
    taskType: 'schedule_event',
  });
  return id;
}

async function createImplementationEvaluationTask(
  tx: ZeroTransaction,
  args: {
    processRunId: string;
    amendmentId: string;
    amendmentTitle: string;
    targetGroupId: string;
    targetGroupName: string;
    dueAt: number;
    requiredAfter: number;
    evaluationMode: 'fixed_date' | 'relative_to_vote';
    senderId?: string | null;
  }
) {
  const existingTasks = await tx.run(
    zql.process_task
      .where('process_run_id', args.processRunId)
      .where('task_type', 'implementation_evaluation')
      .orderBy('created_at', 'asc')
  );

  const reusableTask =
    existingTasks.find(task => task.status !== 'cancelled') ??
    existingTasks.find(task => task.status === 'cancelled') ??
    null;

  if (reusableTask) {
    if (reusableTask.status !== 'cancelled') {
      return reusableTask.id;
    }

    const taskTitle = translateText(
      'generated.inline.0682_umsetzung_evaluieren_amendmenttitle_7226ff50',
      {
        amendmentTitle: args.amendmentTitle,
      }
    );
    const taskDescription = translateText(
      'generated.inline.0683_plane_die_umsetzungspruefung_fuer_amendmentti_14e50868',
      { amendmentTitle: args.amendmentTitle, targetGroupName: args.targetGroupName }
    );

    await tx.mutate.process_task.update({
      id: reusableTask.id,
      status: 'open',
      title: taskTitle,
      description: taskDescription,
      group_id: args.targetGroupId,
      target_group_id: args.targetGroupId,
      event_id: null,
      agenda_item_id: null,
      support_confirmation_id: null,
      due_at: args.dueAt,
      resolved_at: null,
      metadata: {
        amendmentId: args.amendmentId,
        amendmentTitle: args.amendmentTitle,
        groupName: args.targetGroupName,
        requiredAfter: args.requiredAfter,
        requiredBefore: args.dueAt,
        targetGroupId: args.targetGroupId,
        evaluationMode: args.evaluationMode,
        evaluationDueAt: args.dueAt,
      } as never,
      updated_at: Date.now(),
    });
    fireProcessTaskCreatedNotification({
      senderId: args.senderId,
      groupId: args.targetGroupId,
      groupName: args.targetGroupName,
      taskTitle,
      taskType: 'implementation_evaluation',
    });

    return reusableTask.id;
  }

  const now = Date.now();
  const taskId = crypto.randomUUID();
  const taskTitle = translateText(
    'generated.inline.0682_umsetzung_evaluieren_amendmenttitle_7226ff50',
    {
      amendmentTitle: args.amendmentTitle,
    }
  );
  const taskDescription = translateText(
    'generated.inline.0683_plane_die_umsetzungspruefung_fuer_amendmentti_14e50868',
    { amendmentTitle: args.amendmentTitle, targetGroupName: args.targetGroupName }
  );
  await tx.mutate.process_task.insert({
    id: taskId,
    process_run_id: args.processRunId,
    branch_id: null,
    step_run_id: null,
    task_type: 'implementation_evaluation',
    status: 'open',
    title: taskTitle,
    description: taskDescription,
    group_id: args.targetGroupId,
    target_group_id: args.targetGroupId,
    event_id: null,
    agenda_item_id: null,
    support_confirmation_id: null,
    due_at: args.dueAt,
    resolved_at: null,
    metadata: {
      amendmentId: args.amendmentId,
      amendmentTitle: args.amendmentTitle,
      groupName: args.targetGroupName,
      requiredAfter: args.requiredAfter,
      requiredBefore: args.dueAt,
      targetGroupId: args.targetGroupId,
      evaluationMode: args.evaluationMode,
      evaluationDueAt: args.dueAt,
    } as never,
    created_at: now,
    updated_at: now,
  });
  fireProcessTaskCreatedNotification({
    senderId: args.senderId,
    groupId: args.targetGroupId,
    groupName: args.targetGroupName,
    taskTitle,
    taskType: 'implementation_evaluation',
  });

  return taskId;
}

async function loadCanonicalAmendmentDocument(
  tx: ZeroTransaction,
  args: {
    amendmentId: string;
  }
) {
  const amendmentResult = await tx.run(zql.amendment.where('id', args.amendmentId).one());
  const amendment = Array.isArray(amendmentResult) ? null : amendmentResult;
  if (!amendment?.document_id) {
    return null;
  }

  const document = await tx.run(zql.document.where('id', amendment.document_id).one());
  if (!document?.content) {
    return null;
  }

  return { amendment, document };
}

async function findProcessRunBaseSnapshot(tx: ZeroTransaction, processRunId: string) {
  const branches = await tx.run(
    zql.amendment_process_branch.where('process_run_id', processRunId).orderBy('created_at', 'asc')
  );

  for (const branch of branches) {
    if (!branch.document_version_id) {
      continue;
    }

    const version = await tx.run(
      zql.document_version.where('id', branch.document_version_id).one()
    );
    if (version?.content) {
      return {
        versionId: version.id,
        content: version.content,
      };
    }
  }

  return null;
}

async function createBranchDocumentArtifacts(
  tx: ZeroTransaction,
  args: {
    amendmentId: string;
    processRunId?: string | null;
    authorId: string;
    changeSummary: string;
  }
) {
  const existingBase = args.processRunId
    ? await findProcessRunBaseSnapshot(tx, args.processRunId)
    : null;
  let documentVersionId = existingBase?.versionId ?? null;
  let branchContent = existingBase?.content ?? null;
  let editingMode: string | null = null;

  if (!branchContent) {
    const canonical = await loadCanonicalAmendmentDocument(tx, { amendmentId: args.amendmentId });
    if (!canonical?.document?.content) {
      return { documentVersionId: null, documentId: null, editingMode: null };
    }

    const { document } = canonical;
    branchContent = document.content as typeof branchContent;
    editingMode = document.editing_mode ?? null;

    const latestVersion = await tx.run(
      zql.document_version
        .where('document_id', document.id)
        .orderBy('version_number', 'desc')
        .limit(1)
        .one()
    );
    documentVersionId = crypto.randomUUID();

    await tx.mutate.document_version.insert({
      id: documentVersionId,
      document_id: document.id,
      amendment_id: args.amendmentId,
      blog_id: null,
      content: branchContent,
      version_number: (latestVersion?.version_number ?? 0) + 1,
      change_summary: args.changeSummary,
      author_id: args.authorId,
      created_at: Date.now(),
    });
  }

  const branchDocumentId = crypto.randomUUID();
  const now = Date.now();
  await tx.mutate.document.insert({
    id: branchDocumentId,
    amendment_id: args.amendmentId,
    content: branchContent,
    editing_mode: normalizeEditingMode(editingMode),
    created_at: now,
    updated_at: now,
  });

  return { documentVersionId, documentId: branchDocumentId, editingMode };
}

async function closeOpenScheduleTasksForStepRun(tx: ZeroTransaction, stepRunId: string) {
  const tasks = await tx.run(
    zql.process_task.where('step_run_id', stepRunId).where('task_type', 'schedule_event')
  );

  for (const task of tasks) {
    if (task.status === 'completed' || task.status === 'cancelled') {
      continue;
    }

    await tx.mutate.process_task.update({
      id: task.id,
      status: 'completed',
      resolved_at: Date.now(),
      updated_at: Date.now(),
    });
  }
}

async function cancelOpenTasksForStepRun(tx: ZeroTransaction, stepRunId: string) {
  const tasks = await tx.run(zql.process_task.where('step_run_id', stepRunId));
  const now = Date.now();

  for (const task of tasks) {
    if (task.status === 'completed' || task.status === 'cancelled') {
      continue;
    }

    await tx.mutate.process_task.update({
      id: task.id,
      status: 'cancelled',
      resolved_at: now,
      updated_at: now,
    });
  }
}

async function getConfirmedAgendaTailOrderIndex(
  tx: ZeroTransaction,
  eventId: string,
  excludeAgendaItemId?: string | null
) {
  const agendaItems = await tx.run(zql.agenda_item.where('event_id', eventId));

  return agendaItems.reduce((maxOrderIndex, agendaItem) => {
    if (excludeAgendaItemId && agendaItem.id === excludeAgendaItemId) {
      return maxOrderIndex;
    }

    if (agendaItem.forwarding_status === 'previous_decision_outstanding') {
      return maxOrderIndex;
    }

    return Math.max(maxOrderIndex, agendaItem.order_index ?? 0);
  }, 0);
}

async function appendAgendaItemToConfirmedAgenda(
  tx: ZeroTransaction,
  args: { agendaItemId: string; eventId: string }
) {
  const nextOrderIndex =
    (await getConfirmedAgendaTailOrderIndex(tx, args.eventId, args.agendaItemId)) + 1;

  await tx.mutate.agenda_item.update({
    id: args.agendaItemId,
    order_index: nextOrderIndex,
    updated_at: Date.now(),
  });
}

async function syncBranchEditingMode(
  tx: ZeroTransaction,
  branchId: string | null | undefined,
  amendmentId: string | null | undefined,
  editingMode: 'view' | 'suggest_event' | 'passed' | 'rejected',
  actorUserId?: string | null
) {
  if (!branchId || !amendmentId) {
    return;
  }

  const branch = await tx.run(zql.amendment_process_branch.where('id', branchId).one());
  if (!branch || branch.editing_mode === editingMode) {
    return;
  }

  if (editingMode === 'suggest_event' && actorUserId) {
    await finalizeInternalChangeRequestsForEventPhaseTransition({
      tx,
      ctx: { userID: actorUserId },
      amendmentId,
      processBranchId: branch.id,
      now: Date.now(),
    });
  }

  await tx.mutate.amendment_process_branch.update({
    id: branch.id,
    editing_mode: editingMode,
    updated_at: Date.now(),
  });
}

async function getForwardedEventEditingMode(
  tx: ZeroTransaction,
  eventId: string | null | undefined,
  now: number
) {
  if (!eventId) {
    return 'view' as const;
  }

  void now;
  return 'suggest_event' as const;
}

async function deleteVoteRuntime(tx: ZeroTransaction, voteId: string | null | undefined) {
  if (!voteId) {
    return;
  }

  const [
    agendaItemChangeRequests,
    choices,
    voters,
    indicativeParticipations,
    indicativeDecisions,
    finalParticipations,
    finalDecisions,
    offlineTallies,
  ] = await Promise.all([
    tx.run(zql.agenda_item_change_request.where('vote_id', voteId)),
    tx.run(zql.vote_choice.where('vote_id', voteId)),
    tx.run(zql.voter.where('vote_id', voteId)),
    tx.run(zql.indicative_voter_participation.where('vote_id', voteId)),
    tx.run(zql.indicative_choice_decision.where('vote_id', voteId)),
    tx.run(zql.final_voter_participation.where('vote_id', voteId)),
    tx.run(zql.final_choice_decision.where('vote_id', voteId)),
    tx.run(zql.vote_offline_tally.where('vote_id', voteId)),
  ]);

  for (const row of agendaItemChangeRequests) {
    await tx.mutate.agenda_item_change_request.delete({ id: row.id });
  }
  for (const row of indicativeDecisions) {
    await tx.mutate.indicative_choice_decision.delete({ id: row.id });
  }
  for (const row of finalDecisions) {
    await tx.mutate.final_choice_decision.delete({ id: row.id });
  }
  for (const row of indicativeParticipations) {
    await tx.mutate.indicative_voter_participation.delete({ id: row.id });
  }
  for (const row of finalParticipations) {
    await tx.mutate.final_voter_participation.delete({ id: row.id });
  }
  for (const row of offlineTallies) {
    await tx.mutate.vote_offline_tally.delete({ id: row.id });
  }
  for (const row of voters) {
    await tx.mutate.voter.delete({ id: row.id });
  }
  for (const row of choices) {
    await tx.mutate.vote_choice.delete({ id: row.id });
  }

  await tx.mutate.vote.delete({ id: voteId });
}

async function deleteScheduledAgendaItemForFutureStep(
  tx: ZeroTransaction,
  stepRun: {
    id: string;
    agenda_item_id?: string | null;
    vote_id?: string | null;
  }
) {
  if (stepRun.agenda_item_id) {
    const [speakerRows, accreditations] = await Promise.all([
      tx.run(zql.speaker_list.where('agenda_item_id', stepRun.agenda_item_id)),
      tx.run(zql.accreditation.where('agenda_item_id', stepRun.agenda_item_id)),
    ]);

    for (const row of speakerRows) {
      await tx.mutate.speaker_list.delete({ id: row.id });
    }
    for (const row of accreditations) {
      await tx.mutate.accreditation.delete({ id: row.id });
    }
  }

  await deleteVoteRuntime(tx, stepRun.vote_id ?? null);

  if (stepRun.agenda_item_id) {
    await tx.mutate.agenda_item.delete({ id: stepRun.agenda_item_id });
  }
}

async function rejectFutureStepsOnBranch(
  tx: ZeroTransaction,
  args: {
    branchId: string;
    fromOrderIndex: number;
    now: number;
  }
) {
  const futureSteps = await tx.run(
    zql.amendment_process_step_run
      .where('branch_id', args.branchId)
      .where('order_index', '>', args.fromOrderIndex)
      .orderBy('order_index', 'asc')
  );

  for (const futureStep of futureSteps) {
    if (futureStep.decision_status === 'previous_decision_outstanding') {
      await deleteScheduledAgendaItemForFutureStep(tx, futureStep);
    }

    await cancelOpenTasksForStepRun(tx, futureStep.id);
    await tx.mutate.amendment_process_step_run.update({
      id: futureStep.id,
      agenda_item_id:
        futureStep.decision_status === 'previous_decision_outstanding'
          ? null
          : futureStep.agenda_item_id,
      vote_id:
        futureStep.decision_status === 'previous_decision_outstanding' ? null : futureStep.vote_id,
      status: 'rejected',
      decision_status: 'rejected',
      ends_at: args.now,
      updated_at: args.now,
    });
    await updatePathSegmentStatus(tx, futureStep.id, 'rejected');
  }
}

async function fetchVoteWithDetails(tx: ZeroTransaction, voteId: string) {
  return tx.run(
    zql.vote
      .where('id', voteId)
      .related('choices', q => q.orderBy('order_index', 'asc'))
      .related('offline_tallies')
      .related('voters')
      .related('final_participations')
      .related('final_decisions')
      .one()
  );
}

function buildTallyByChoiceId(vote: NonNullable<Awaited<ReturnType<typeof fetchVoteWithDetails>>>) {
  const tallyByChoiceId = new Map<string, number>();

  for (const choice of vote.choices ?? []) {
    tallyByChoiceId.set(choice.id, 0);
  }

  for (const decision of vote.final_decisions ?? []) {
    tallyByChoiceId.set(decision.choice_id, (tallyByChoiceId.get(decision.choice_id) ?? 0) + 1);
  }

  for (const tally of vote.offline_tallies ?? []) {
    if (tally.phase !== 'final') {
      continue;
    }

    tallyByChoiceId.set(tally.choice_id, (tallyByChoiceId.get(tally.choice_id) ?? 0) + tally.count);
  }

  return tallyByChoiceId;
}

function resolveDecisionVoteOutcome(
  vote: NonNullable<Awaited<ReturnType<typeof fetchVoteWithDetails>>>
): VoteOutcome {
  const sortedChoices = [...(vote.choices ?? [])].sort(
    (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
  );
  const acceptChoice =
    sortedChoices.find(choice => isAcceptDecisionChoice(choice.label)) ?? sortedChoices[0] ?? null;
  const rejectChoice =
    sortedChoices.find(choice => isRejectDecisionChoice(choice.label)) ?? sortedChoices[1] ?? null;
  const tallyByChoiceId = buildTallyByChoiceId(vote);
  const acceptCount = acceptChoice ? (tallyByChoiceId.get(acceptChoice.id) ?? 0) : 0;
  const rejectCount = rejectChoice ? (tallyByChoiceId.get(rejectChoice.id) ?? 0) : 0;
  const totalEligible = Math.max(
    vote.voters?.length ?? 0,
    (vote.final_participations?.length ?? 0) +
      (vote.offline_tallies ?? [])
        .filter(tally => tally.phase === 'final')
        .reduce((sum, tally) => sum + tally.count, 0)
  );

  return {
    result: computeVoteResult(
      acceptCount,
      rejectCount,
      totalEligible,
      normalizeMajorityType(vote.majority_type)
    ),
    totalEligible,
    tallyByChoiceId,
  };
}

export function resolveMergeRoundOneOutcome(args: {
  vote: NonNullable<Awaited<ReturnType<typeof fetchVoteWithDetails>>>;
  candidateStepRuns: readonly {
    branch_id: string;
    created_at: number;
  }[];
}): MergeRoundOneOutcome {
  const sortedChoices = [...(args.vote.choices ?? [])].sort(
    (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
  );
  const sortedCandidates = [...args.candidateStepRuns].sort(
    (left, right) => left.created_at - right.created_at
  );
  const tallyByChoiceId = buildTallyByChoiceId(args.vote);
  const ranked = sortedChoices.map((choice, index) => ({
    choiceId: choice.id,
    branchId: choice.process_branch_id ?? sortedCandidates[index]?.branch_id ?? null,
    count: tallyByChoiceId.get(choice.id) ?? 0,
  }));
  const sortedRanked = [...ranked].sort((left, right) => right.count - left.count);
  const best = sortedRanked[0] ?? null;
  const secondBest = sortedRanked[1] ?? null;

  if (!best || !best.branchId) {
    return {
      result: 'tie',
      winnerBranchId: null,
      winnerChoiceId: null,
      loserBranchIds: [],
    };
  }

  if (secondBest && secondBest.count === best.count) {
    return {
      result: 'tie',
      winnerBranchId: null,
      winnerChoiceId: null,
      loserBranchIds: [],
    };
  }

  return {
    result: 'winner',
    winnerBranchId: best.branchId,
    winnerChoiceId: best.choiceId,
    loserBranchIds: ranked
      .filter(entry => entry.branchId && entry.branchId !== best.branchId)
      .map(entry => entry.branchId as string),
  };
}

async function getAmendmentContextForTask(
  tx: ZeroTransaction,
  task: {
    id: string;
    process_run_id: string;
    support_confirmation_id?: string | null;
  }
) {
  const processRun = await tx.run(zql.amendment_process_run.where('id', task.process_run_id).one());
  const amendment = processRun?.amendment_id
    ? await tx.run(zql.amendment.where('id', processRun.amendment_id).one())
    : null;
  const supportConfirmation = task.support_confirmation_id
    ? await tx.run(zql.support_confirmation.where('id', task.support_confirmation_id).one())
    : null;
  const supportAmendment =
    supportConfirmation?.amendment_id && supportConfirmation.amendment_id !== amendment?.id
      ? await tx.run(zql.amendment.where('id', supportConfirmation.amendment_id).one())
      : null;

  return {
    processRun,
    supportConfirmation,
    amendment: amendment ?? supportAmendment ?? null,
  };
}

async function getDerivedBranchStatus(
  tx: ZeroTransaction,
  stepRuns: readonly {
    id: string;
    status: string | null;
    event_id?: string | null;
    vote_id?: string | null;
  }[]
): Promise<ProcessStatus> {
  const unresolvedStep = stepRuns.find(step => !isTerminalStepStatus(step.status));
  if (!unresolvedStep) {
    return 'completed';
  }

  if (unresolvedStep.vote_id) {
    const vote = await tx.run(zql.vote.where('id', unresolvedStep.vote_id).one());
    if (vote?.status === 'open') {
      return 'in_vote';
    }
  }

  if (unresolvedStep.event_id) {
    return 'scheduled';
  }

  return 'pending_event';
}

async function syncBranchSchedulingState(tx: ZeroTransaction, branchId: string) {
  const stepRunResult = await tx.run(
    zql.amendment_process_step_run.where('branch_id', branchId).orderBy('order_index', 'asc')
  );
  const stepRuns = Array.isArray(stepRunResult) ? stepRunResult.filter(Boolean) : [];
  const firstUnresolvedStep = stepRuns.find(step => !isTerminalStepStatus(step.status));

  for (const stepRun of stepRuns) {
    const decisionStatus =
      stepRun.status === 'approved' || stepRun.status === 'completed'
        ? 'approved'
        : stepRun.status === 'rejected'
          ? 'rejected'
          : stepRun.status === 'merged'
            ? 'merged'
            : stepRun.status === 'withdrawn'
              ? 'withdrawn'
              : stepRun.decision_status === 'tie'
                ? 'tie'
                : firstUnresolvedStep?.id === stepRun.id
                  ? 'forward_confirmed'
                  : 'previous_decision_outstanding';

    if (stepRun.decision_status !== decisionStatus) {
      await tx.mutate.amendment_process_step_run.update({
        id: stepRun.id,
        decision_status: decisionStatus,
        updated_at: Date.now(),
      });
    }

    if (stepRun.agenda_item_id) {
      const agendaItem = await tx.run(zql.agenda_item.where('id', stepRun.agenda_item_id).one());
      if (agendaItem && agendaItem.forwarding_status !== decisionStatus) {
        await tx.mutate.agenda_item.update({
          id: agendaItem.id,
          forwarding_status: decisionStatus,
          updated_at: Date.now(),
        });
      }
    }

    await updatePathSegmentStatus(tx, stepRun.id, decisionStatus);
  }

  const branchStatus = await getDerivedBranchStatus(tx, stepRuns);
  await tx.mutate.amendment_process_branch.update({
    id: branchId,
    status: branchStatus,
    updated_at: Date.now(),
  });

  return {
    branchStatus,
    firstUnresolvedStepId: firstUnresolvedStep?.id ?? null,
    stepRuns,
  };
}

async function recomputeProcessRunState(tx: ZeroTransaction, processRunId: string) {
  const branchResult = await tx.run(
    zql.amendment_process_branch.where('process_run_id', processRunId).orderBy('created_at', 'asc')
  );
  const branches = Array.isArray(branchResult) ? branchResult.filter(Boolean) : [];

  const nonTerminalBranches = branches.filter(branch => !isTerminalBranchStatus(branch.status));

  let status: ProcessStatus = 'completed';
  if (nonTerminalBranches.some(branch => branch.status === 'in_vote')) {
    status = 'in_vote';
  } else if (nonTerminalBranches.some(branch => branch.status === 'scheduled')) {
    status = 'scheduled';
  } else if (nonTerminalBranches.some(branch => branch.status === 'pending_event')) {
    status = 'pending_event';
  } else if (branches.some(branch => branch.status === 'rejected')) {
    status = 'rejected';
  }

  const activeBranchId = nonTerminalBranches[0]?.id ?? null;
  await tx.mutate.amendment_process_run.update({
    id: processRunId,
    status,
    active_branch_id: activeBranchId,
    updated_at: Date.now(),
  });

  return { status, activeBranchId };
}

async function findActiveRunsForOrigin(tx: ZeroTransaction, originAmendmentId: string) {
  const runs = await tx.run(zql.amendment_process_run.where('amendment_id', originAmendmentId));
  const runRows = Array.isArray(runs) ? runs.filter(Boolean) : [];
  return runRows.filter(run => !['completed', 'rejected', 'withdrawn'].includes(run.status));
}

async function getAmendmentOriginId(tx: ZeroTransaction, amendmentId: string) {
  const amendmentResult = await tx.run(zql.amendment.where('id', amendmentId).one());
  const amendment = Array.isArray(amendmentResult) ? null : amendmentResult;
  const originAmendmentId =
    amendment?.origin_amendment_id ?? amendment?.clone_source_id ?? amendmentId;

  if (amendment && amendment.origin_amendment_id !== originAmendmentId) {
    await tx.mutate.amendment.update({
      id: amendmentId,
      origin_amendment_id: originAmendmentId,
      updated_at: Date.now(),
    });
  }

  return originAmendmentId;
}

async function getBranchAmendmentId(
  tx: ZeroTransaction,
  branchId: string,
  fallbackAmendmentId: string
) {
  const segments = await tx.run(
    zql.amendment_path_segment.where('process_branch_id', branchId).orderBy('order_index', 'asc')
  );

  for (const segment of segments) {
    const path = await tx.run(zql.amendment_path.where('id', segment.path_id).one());
    if (path?.amendment_id) {
      return path.amendment_id;
    }
  }

  return fallbackAmendmentId;
}

async function findFirstUnresolvedStepRunForBranch(tx: ZeroTransaction, branchId: string) {
  const stepRuns = await tx.run(
    zql.amendment_process_step_run.where('branch_id', branchId).orderBy('order_index', 'asc')
  );
  return stepRuns.find(step => !isTerminalStepStatus(step.status)) ?? null;
}

async function findBranchesParticipatingInMergeStep(
  tx: ZeroTransaction,
  processRunId: string,
  fingerprint: string
) {
  const branches = await tx.run(
    zql.amendment_process_branch.where('process_run_id', processRunId).orderBy('created_at', 'asc')
  );
  const branchStepRuns = await tx.run(
    zql.amendment_process_step_run
      .where('process_run_id', processRunId)
      .orderBy('branch_id', 'asc')
      .orderBy('order_index', 'asc')
  );

  const stepRunsByBranchId = new Map<string, typeof branchStepRuns>();
  for (const stepRun of branchStepRuns) {
    const stepRuns = stepRunsByBranchId.get(stepRun.branch_id) ?? [];
    stepRuns.push(stepRun);
    stepRunsByBranchId.set(stepRun.branch_id, stepRuns);
  }

  const candidateBranches: {
    branch: (typeof branches)[number];
    firstUnresolvedStep: (typeof branchStepRuns)[number];
  }[] = [];

  for (const branch of branches) {
    if (isTerminalBranchStatus(branch.status)) {
      continue;
    }

    const stepRuns = stepRunsByBranchId.get(branch.id) ?? [];
    const unresolvedStepRuns = stepRuns.filter(step => !isTerminalStepStatus(step.status));
    const firstUnresolvedStep = unresolvedStepRuns[0] ?? null;
    const hasMatchingFutureStep = unresolvedStepRuns.some(
      step => getStepRunFingerprint(step) === fingerprint
    );

    if (firstUnresolvedStep && hasMatchingFutureStep) {
      candidateBranches.push({ branch, firstUnresolvedStep });
    }
  }

  return candidateBranches;
}

async function materializeMergeVoteFromCandidates<
  TBranch extends MergeVoteBranchTitleSource & { id: string },
  TStepRun extends {
    id: string;
    event_id?: string | null;
    agenda_item_id?: string | null;
    vote_id?: string | null;
    decision_status?: string | null;
  },
>(
  tx: ZeroTransaction,
  args: {
    amendmentId: string;
    amendmentTitle: string;
    amendmentReason: string | null;
    creatorId: string;
    candidateBranches: readonly {
      branch: TBranch;
      stepRun: TStepRun;
    }[];
  }
) {
  if (args.candidateBranches.length === 0) {
    return { scheduled: false as const };
  }

  const candidateByBranchId = new Map(
    args.candidateBranches.map(candidate => [candidate.branch.id, candidate])
  );
  const orderedBranches = getOrderedMergeVoteBranches(
    args.candidateBranches.map(candidate => candidate.branch)
  );
  const orderedCandidates = orderedBranches
    .map(branch => candidateByBranchId.get(branch.id))
    .filter((candidate): candidate is (typeof args.candidateBranches)[number] =>
      Boolean(candidate)
    );
  const candidateStepRuns = orderedCandidates.map(candidate => candidate.stepRun);
  const commonEventId = candidateStepRuns[0]?.event_id ?? null;

  if (!commonEventId || candidateStepRuns.some(step => step.event_id !== commonEventId)) {
    return { scheduled: false as const };
  }

  const mergeVoteTitle = buildMergeVoteTitle(args.amendmentTitle, orderedBranches);
  const candidateLabels = buildMergeVoteChoiceLabels(orderedBranches);
  const carrierStepRun =
    candidateStepRuns.find(step => step.agenda_item_id && step.vote_id) ?? null;
  const existingAgendaItemId = carrierStepRun?.agenda_item_id ?? crypto.randomUUID();
  const existingVoteId = carrierStepRun?.vote_id ?? crypto.randomUUID();
  const existingCarrier =
    carrierStepRun && existingAgendaItemId && existingVoteId
      ? {
          agendaItem: await tx.run(zql.agenda_item.where('id', existingAgendaItemId).one()),
          vote: await tx.run(zql.vote.where('id', existingVoteId).one()),
        }
      : null;

  if (existingCarrier?.agendaItem && existingCarrier.vote) {
    await tx.mutate.agenda_item.update({
      id: existingAgendaItemId,
      title: mergeVoteTitle,
      forwarding_status: 'forward_confirmed',
      updated_at: Date.now(),
    });

    await tx.mutate.vote.update({
      id: existingVoteId,
      agenda_item_id: existingAgendaItemId,
      amendment_id: args.amendmentId,
      title: mergeVoteTitle,
      description: args.amendmentReason,
      purpose: VOTE_PURPOSE.mergeVariant,
      majority_type: 'relative',
      updated_at: Date.now(),
    });

    await replaceVoteChoices(tx, existingVoteId, candidateLabels);
  } else {
    await createAgendaItemAndVote(tx, {
      agendaItemId: existingAgendaItemId,
      voteId: existingVoteId,
      eventId: commonEventId,
      amendmentId: args.amendmentId,
      amendmentTitle: args.amendmentTitle,
      amendmentReason: args.amendmentReason,
      forwardingStatus: 'forward_confirmed',
      creatorId: args.creatorId,
      agendaTitle: mergeVoteTitle,
      voteTitle: mergeVoteTitle,
      voteDescription: args.amendmentReason,
      choiceLabels: candidateLabels,
      majorityType: 'relative',
      votePurpose: VOTE_PURPOSE.mergeVariant,
    });
  }

  for (const candidateStepRun of candidateStepRuns) {
    await tx.mutate.amendment_process_step_run.update({
      id: candidateStepRun.id,
      agenda_item_id: existingAgendaItemId,
      vote_id: existingVoteId,
      status: 'scheduled',
      decision_status: candidateStepRun.decision_status === 'tie' ? 'tie' : 'forward_confirmed',
      updated_at: Date.now(),
    });
    await closeOpenScheduleTasksForStepRun(tx, candidateStepRun.id);
  }

  await appendAgendaItemToConfirmedAgenda(tx, {
    agendaItemId: existingAgendaItemId,
    eventId: commonEventId,
  });

  return {
    scheduled: true as const,
    agendaItemId: existingAgendaItemId,
    voteId: existingVoteId,
    candidateStepRunIds: candidateStepRuns.map(step => step.id),
  };
}

async function maybeScheduleMergeRoundOne(
  tx: ZeroTransaction,
  args: {
    processRunId: string;
    stepRunId: string;
    amendmentId: string;
    amendmentTitle: string;
    amendmentReason: string | null;
    creatorId: string;
  }
) {
  const anchorStepRun = await tx.run(
    zql.amendment_process_step_run.where('id', args.stepRunId).one()
  );
  if (!anchorStepRun || anchorStepRun.step_kind !== 'merge_vote') {
    return { scheduled: false as const };
  }

  const fingerprint = getStepRunFingerprint(anchorStepRun);
  const candidateBranches = await findBranchesParticipatingInMergeStep(
    tx,
    args.processRunId,
    fingerprint
  );

  if (candidateBranches.length === 0) {
    return { scheduled: false as const };
  }

  if (
    candidateBranches.some(
      candidate => getStepRunFingerprint(candidate.firstUnresolvedStep) !== fingerprint
    )
  ) {
    return { scheduled: false as const };
  }

  return materializeMergeVoteFromCandidates(tx, {
    amendmentId: args.amendmentId,
    amendmentTitle: args.amendmentTitle,
    amendmentReason: args.amendmentReason,
    creatorId: args.creatorId,
    candidateBranches: candidateBranches.map(candidate => ({
      branch: candidate.branch,
      stepRun: candidate.firstUnresolvedStep,
    })),
  });
}

async function maybeScheduleAutomaticMergeAtCrossing(
  tx: ZeroTransaction,
  args: {
    processRunId: string;
    amendmentId: string;
    amendmentTitle: string;
    amendmentReason: string | null;
    creatorId: string;
  }
) {
  const branches = await tx.run(
    zql.amendment_process_branch
      .where('process_run_id', args.processRunId)
      .orderBy('created_at', 'asc')
  );
  const stepRuns = await tx.run(
    zql.amendment_process_step_run
      .where('process_run_id', args.processRunId)
      .orderBy('branch_id', 'asc')
      .orderBy('order_index', 'asc')
  );
  const branchRows = Array.isArray(branches) ? branches.filter(Boolean) : [];
  const stepRunRows = Array.isArray(stepRuns) ? stepRuns.filter(Boolean) : [];

  type BranchRow = (typeof branchRows)[number];
  type StepRunRow = (typeof stepRunRows)[number];
  interface CrossingCandidate {
    branch: BranchRow;
    stepRun: StepRunRow;
  }

  const branchById = new Map(
    branchRows
      .filter(branch => !isTerminalBranchStatus(branch.status))
      .map(branch => [branch.id, branch])
  );
  const candidatesByCrossing = new Map<string, Map<string, CrossingCandidate>>();

  for (const stepRun of stepRunRows) {
    if (
      isTerminalStepStatus(stepRun.status) ||
      !stepRun.event_id ||
      !stepRun.target_group_id ||
      (stepRun.step_kind !== 'group_vote' && stepRun.step_kind !== 'merge_vote')
    ) {
      continue;
    }

    const branch = branchById.get(stepRun.branch_id);
    if (!branch) {
      continue;
    }

    const key = `${stepRun.target_group_id}:${stepRun.event_id}`;
    const branchCandidates = candidatesByCrossing.get(key) ?? new Map<string, CrossingCandidate>();
    const existing = branchCandidates.get(stepRun.branch_id);
    if (!existing || compareStepRunsByProcessOrder(stepRun, existing.stepRun) < 0) {
      branchCandidates.set(stepRun.branch_id, { branch, stepRun });
    }
    candidatesByCrossing.set(key, branchCandidates);
  }

  let scheduled = false;

  for (const branchCandidates of candidatesByCrossing.values()) {
    if (branchCandidates.size < 2) {
      continue;
    }

    const candidateBranches = getOrderedMergeVoteBranches(
      Array.from(branchCandidates.values()).map(candidate => candidate.branch)
    )
      .map(branch => branchCandidates.get(branch.id))
      .filter((candidate): candidate is CrossingCandidate => Boolean(candidate));
    const candidateStepRuns = candidateBranches.map(candidate => candidate.stepRun);
    const carrierStepRun =
      candidateStepRuns.find(stepRun => stepRun.agenda_item_id && stepRun.vote_id) ?? null;
    const carrierPairKey = carrierStepRun
      ? `${carrierStepRun.agenda_item_id}:${carrierStepRun.vote_id}`
      : null;
    const agendaVotePairsToDelete = new Set<string>();

    const materializeCandidates: {
      branch: BranchRow;
      stepRun: {
        id: string;
        event_id?: string | null;
        agenda_item_id?: string | null;
        vote_id?: string | null;
        decision_status?: string | null;
      };
    }[] = [];

    for (const candidate of candidateBranches) {
      const { stepRun } = candidate;
      const pairKey = `${stepRun.agenda_item_id ?? 'none'}:${stepRun.vote_id ?? 'none'}`;
      const keepPair = Boolean(carrierPairKey && pairKey === carrierPairKey);

      if (
        (stepRun.agenda_item_id || stepRun.vote_id) &&
        !keepPair &&
        !agendaVotePairsToDelete.has(pairKey)
      ) {
        agendaVotePairsToDelete.add(pairKey);
        await deleteScheduledAgendaItemForFutureStep(tx, stepRun);
      }

      const nextStepRun = {
        ...stepRun,
        step_kind: 'merge_vote',
        merge_strategy: 'winner_continues',
        agenda_item_id: keepPair ? (stepRun.agenda_item_id ?? null) : null,
        vote_id: keepPair ? (stepRun.vote_id ?? null) : null,
        status: 'pending_event',
        decision_status: stepRun.decision_status === 'tie' ? 'tie' : 'forward_confirmed',
      };

      await tx.mutate.amendment_process_step_run.update({
        id: stepRun.id,
        step_kind: nextStepRun.step_kind,
        merge_strategy: nextStepRun.merge_strategy,
        agenda_item_id: nextStepRun.agenda_item_id,
        vote_id: nextStepRun.vote_id,
        status: nextStepRun.status,
        decision_status: nextStepRun.decision_status,
        updated_at: Date.now(),
      });

      materializeCandidates.push({
        branch: candidate.branch,
        stepRun: nextStepRun,
      });
    }

    const mergeSchedule = await materializeMergeVoteFromCandidates(tx, {
      amendmentId: args.amendmentId,
      amendmentTitle: args.amendmentTitle,
      amendmentReason: args.amendmentReason,
      creatorId: args.creatorId,
      candidateBranches: materializeCandidates,
    });

    if (mergeSchedule.scheduled) {
      scheduled = true;
    }
  }

  return { scheduled };
}

async function shiftLaterStepRunOrderIndexes(
  tx: ZeroTransaction,
  args: {
    branchId: string;
    afterOrderIndex: number;
    delta: number;
  }
) {
  if (args.delta === 0) {
    return;
  }

  const laterStepRuns = await tx.run(
    zql.amendment_process_step_run
      .where('branch_id', args.branchId)
      .where('order_index', '>', args.afterOrderIndex)
      .orderBy('order_index', 'desc')
  );

  for (const stepRun of laterStepRuns) {
    await tx.mutate.amendment_process_step_run.update({
      id: stepRun.id,
      order_index: stepRun.order_index + args.delta,
      updated_at: Date.now(),
    });
  }

  const laterSegments = await tx.run(
    zql.amendment_path_segment
      .where('process_branch_id', args.branchId)
      .where('order_index', '>', args.afterOrderIndex)
      .orderBy('order_index', 'desc')
  );

  for (const segment of laterSegments) {
    await tx.mutate.amendment_path_segment.update({
      id: segment.id,
      order_index: (segment.order_index ?? 0) + args.delta,
    });
  }
}

async function createRoundTwoMergeApprovalStep(
  tx: ZeroTransaction,
  args: {
    winnerStepRunId: string;
    amendmentId: string;
    amendmentTitle: string;
    amendmentReason: string | null;
    creatorId: string;
  }
) {
  const winnerStepRun = await tx.run(
    zql.amendment_process_step_run.where('id', args.winnerStepRunId).one()
  );
  if (!winnerStepRun) {
    return null;
  }

  await shiftLaterStepRunOrderIndexes(tx, {
    branchId: winnerStepRun.branch_id,
    afterOrderIndex: winnerStepRun.order_index,
    delta: 1,
  });

  const stepRunId = crypto.randomUUID();
  const agendaItemId = winnerStepRun.event_id ? crypto.randomUUID() : null;
  const voteId = winnerStepRun.event_id ? crypto.randomUUID() : null;
  const now = Date.now();

  if (winnerStepRun.event_id && agendaItemId && voteId) {
    await createAgendaItemAndVote(tx, {
      agendaItemId,
      voteId,
      eventId: winnerStepRun.event_id,
      amendmentId: args.amendmentId,
      amendmentTitle: args.amendmentTitle,
      amendmentReason: args.amendmentReason,
      forwardingStatus: 'forward_confirmed',
      creatorId: args.creatorId,
      agendaTitle: `Merge confirmation: ${args.amendmentTitle}`,
      voteTitle: `Merge round 2: ${args.amendmentTitle}`,
      votePurpose: VOTE_PURPOSE.closing,
    });
  }

  await tx.mutate.amendment_process_step_run.insert({
    id: stepRunId,
    process_run_id: winnerStepRun.process_run_id,
    branch_id: winnerStepRun.branch_id,
    workflow_id: winnerStepRun.workflow_id ?? null,
    workflow_step_id: null,
    step_kind: 'group_vote',
    selection_mode: winnerStepRun.selection_mode ?? null,
    merge_strategy: winnerStepRun.merge_strategy ?? null,
    status: winnerStepRun.event_id ? 'scheduled' : 'pending_event',
    source_group_id: winnerStepRun.source_group_id ?? null,
    target_group_id: winnerStepRun.target_group_id ?? null,
    event_id: winnerStepRun.event_id ?? null,
    agenda_item_id: agendaItemId,
    vote_id: voteId,
    support_confirmation_id: null,
    decision_status: winnerStepRun.event_id ? 'forward_confirmed' : 'previous_decision_outstanding',
    order_index: winnerStepRun.order_index + 1,
    starts_at: winnerStepRun.starts_at ?? null,
    ends_at: null,
    created_at: now,
    updated_at: now,
  });

  const pathId = await getProcessPathId(tx, winnerStepRun.process_run_id);
  await insertPathSegmentForStepRun(tx, {
    pathId,
    branchId: winnerStepRun.branch_id,
    stepRunId,
    groupId: winnerStepRun.target_group_id ?? winnerStepRun.source_group_id ?? '',
    eventId: winnerStepRun.event_id ?? null,
    orderIndex: winnerStepRun.order_index + 1,
    status: winnerStepRun.event_id ? 'forward_confirmed' : 'previous_decision_outstanding',
  });

  if (!winnerStepRun.event_id) {
    await createScheduleEventTask(tx, {
      processRunId: winnerStepRun.process_run_id,
      branchId: winnerStepRun.branch_id,
      stepRunId,
      taskTitle: `Schedule merge confirmation for ${args.amendmentTitle}`,
      taskDescription: 'A follow-up yes/no merge confirmation event is still missing.',
      groupId: winnerStepRun.target_group_id ?? winnerStepRun.source_group_id ?? '',
      targetGroupId: winnerStepRun.target_group_id ?? null,
      senderId: args.creatorId,
      metadata: {
        amendmentId: args.amendmentId,
        stepKind: 'group_vote',
        mergeRound: 2,
      },
    });
  }

  return stepRunId;
}

async function resolveWorkflowHandoffTarget(
  tx: ZeroTransaction,
  stepRun: {
    workflow_step_id?: string | null;
    selection_mode?: string | null;
    target_group_id?: string | null;
  }
) {
  const workflowStep = stepRun.workflow_step_id
    ? await tx.run(zql.group_workflow_step.where('id', stepRun.workflow_step_id).one())
    : null;

  if (stepRun.selection_mode === 'explicit_workflow' && workflowStep?.target_workflow_id) {
    return workflowStep.target_workflow_id;
  }

  if (!stepRun.target_group_id) {
    return null;
  }

  const defaultWorkflows = await tx.run(
    zql.group_workflow
      .where('group_id', stepRun.target_group_id)
      .where('is_default_entry', true)
      .orderBy('created_at', 'asc')
  );

  return defaultWorkflows[0]?.id ?? null;
}

async function buildWorkflowRuntimeStepTemplates(
  tx: ZeroTransaction,
  args: {
    workflowId: string;
    requiredAfter: number | null;
  }
): Promise<WorkflowRuntimeStepTemplate[]> {
  const workflowSteps = await tx.run(
    zql.group_workflow_step
      .where('workflow_id', args.workflowId)
      .related('group')
      .orderBy('order_index', 'asc')
  );

  if (workflowSteps.length === 0) {
    return [];
  }

  const groupIds = [...new Set(workflowSteps.map(step => step.group_id))];
  const events = await tx.run(zql.event.where('group_id', 'IN', groupIds).related('group'));
  const eventsByGroupId = new Map<string, typeof events>();

  for (const event of events) {
    const groupId = event.group?.id ?? event.group_id ?? null;
    if (!groupId || (event.start_date ?? 0) <= Date.now()) {
      continue;
    }

    const groupEvents = eventsByGroupId.get(groupId) ?? [];
    groupEvents.push(event);
    eventsByGroupId.set(groupId, groupEvents);
  }

  for (const [groupId, groupEvents] of eventsByGroupId.entries()) {
    eventsByGroupId.set(
      groupId,
      [...groupEvents].sort((left, right) => (left.start_date ?? 0) - (right.start_date ?? 0))
    );
  }

  const templates: WorkflowRuntimeStepTemplate[] = [];
  let lowerBound = args.requiredAfter;

  for (const step of workflowSteps) {
    const event =
      (eventsByGroupId.get(step.group_id) ?? []).find(candidate => {
        const startDate = candidate.start_date ?? null;
        if (startDate == null) {
          return false;
        }

        return lowerBound == null || startDate >= lowerBound;
      }) ?? null;

    const stepKind: StepKind =
      step.step_kind === 'merge_vote' || step.step_kind === 'workflow_handoff'
        ? step.step_kind
        : 'group_vote';
    const selectionMode: SelectionMode =
      step.selection_mode === 'default_target_workflow' ||
      step.selection_mode === 'explicit_workflow'
        ? step.selection_mode
        : 'explicit_workflow';
    const mergeStrategy: MergeStrategy =
      step.merge_strategy === 'winner_continues' ? step.merge_strategy : null;
    const eventEndDate = event?.end_date ?? event?.start_date ?? null;

    templates.push({
      workflowId: args.workflowId,
      workflowStepId: step.id,
      stepKind,
      selectionMode,
      mergeStrategy,
      sourceGroupId: templates[templates.length - 1]?.targetGroupId ?? null,
      targetGroupId: step.group_id,
      eventId: event?.id ?? null,
      eventStartDate: event?.start_date ?? null,
      eventEndDate,
      eventRule: step.event_rule ?? null,
      autoTaskOnMissingEvent: step.auto_task_on_missing_event ?? true,
      targetWorkflowId: step.target_workflow_id ?? null,
      groupName: step.group?.name ?? 'Unknown',
    });

    if (eventEndDate != null) {
      lowerBound = eventEndDate;
    }
  }

  return templates;
}

async function insertWorkflowRuntimeStep(
  tx: ZeroTransaction,
  args: {
    template: WorkflowRuntimeStepTemplate;
    processRunId: string;
    branchId: string;
    orderIndex: number;
    amendmentId: string;
    amendmentTitle: string;
    amendmentReason: string | null;
    creatorId: string;
    pathId: string | null;
    terminalTargetGroupId: string | null;
  }
) {
  const stepRunId = crypto.randomUUID();
  const shouldCreateImmediateVote =
    args.template.stepKind !== 'merge_vote' && Boolean(args.template.eventId);
  const agendaItemId = shouldCreateImmediateVote ? crypto.randomUUID() : null;
  const voteId = shouldCreateImmediateVote ? crypto.randomUUID() : null;
  const status: ProcessStatus = args.template.eventId ? 'scheduled' : 'pending_event';
  const now = Date.now();

  if (args.template.eventId && agendaItemId && voteId) {
    await createAgendaItemAndVote(tx, {
      agendaItemId,
      voteId,
      eventId: args.template.eventId,
      amendmentId: args.amendmentId,
      amendmentTitle: args.amendmentTitle,
      amendmentReason: args.amendmentReason,
      forwardingStatus: 'forward_confirmed',
      creatorId: args.creatorId,
      votePurpose: VOTE_PURPOSE.closing,
    });
  }

  await tx.mutate.amendment_process_step_run.insert({
    id: stepRunId,
    process_run_id: args.processRunId,
    branch_id: args.branchId,
    workflow_id: args.template.workflowId,
    workflow_step_id: args.template.workflowStepId,
    step_kind: args.template.stepKind,
    selection_mode: args.template.selectionMode,
    merge_strategy: args.template.mergeStrategy,
    status,
    source_group_id: args.template.sourceGroupId,
    target_group_id: args.template.targetGroupId,
    event_id: args.template.eventId,
    agenda_item_id: agendaItemId,
    vote_id: voteId,
    support_confirmation_id: null,
    decision_status: args.template.eventId ? 'forward_confirmed' : 'previous_decision_outstanding',
    order_index: args.orderIndex,
    starts_at: args.template.eventStartDate,
    ends_at: null,
    created_at: now,
    updated_at: now,
  });

  await insertPathSegmentForStepRun(tx, {
    pathId: args.pathId,
    branchId: args.branchId,
    stepRunId,
    groupId: args.template.targetGroupId,
    eventId: args.template.eventId,
    orderIndex: args.orderIndex,
    status: args.template.eventId ? 'forward_confirmed' : 'previous_decision_outstanding',
  });

  if (!args.template.eventId && args.template.autoTaskOnMissingEvent) {
    await createScheduleEventTask(tx, {
      processRunId: args.processRunId,
      branchId: args.branchId,
      stepRunId,
      taskTitle: `Schedule amendment vote for ${args.template.groupName}`,
      taskDescription: `No eligible event is selected yet for ${args.template.groupName}.`,
      groupId: args.template.targetGroupId,
      targetGroupId: args.terminalTargetGroupId,
      senderId: args.creatorId,
      groupName: args.template.groupName,
      metadata: {
        amendmentId: args.amendmentId,
        amendmentTitle: args.amendmentTitle,
        groupName: args.template.groupName,
        orderIndex: args.orderIndex,
        workflowId: args.template.workflowId,
        workflowStepId: args.template.workflowStepId,
        stepKind: args.template.stepKind,
        selectionMode: args.template.selectionMode,
        mergeStrategy: args.template.mergeStrategy,
        eventRule: args.template.eventRule,
        targetWorkflowId: args.template.targetWorkflowId,
      },
    });
  }

  return stepRunId;
}

async function materializeWorkflowHandoff(
  tx: ZeroTransaction,
  args: {
    stepRunId: string;
    amendmentId: string;
    amendmentTitle: string;
    amendmentReason: string | null;
    creatorId: string;
  }
) {
  const handoffStepRun = await tx.run(
    zql.amendment_process_step_run.where('id', args.stepRunId).one()
  );
  if (!handoffStepRun || handoffStepRun.step_kind !== 'workflow_handoff') {
    return [];
  }

  const workflowId = await resolveWorkflowHandoffTarget(tx, handoffStepRun);
  if (!workflowId) {
    return [];
  }

  const handoffEvent = handoffStepRun.event_id
    ? await tx.run(zql.event.where('id', handoffStepRun.event_id).one())
    : null;

  const templates = await buildWorkflowRuntimeStepTemplates(tx, {
    workflowId,
    requiredAfter: getEventOrderingAnchor({
      eventStartDate: handoffEvent?.start_date ?? handoffStepRun.starts_at ?? null,
      eventEndDate:
        handoffEvent?.end_date ?? handoffEvent?.start_date ?? handoffStepRun.starts_at ?? null,
    }),
  });

  if (templates.length === 0) {
    return [];
  }

  await shiftLaterStepRunOrderIndexes(tx, {
    branchId: handoffStepRun.branch_id,
    afterOrderIndex: handoffStepRun.order_index,
    delta: templates.length,
  });

  const pathId = await getProcessPathId(tx, handoffStepRun.process_run_id);
  const insertedStepRunIds: string[] = [];

  for (const [index, template] of templates.entries()) {
    const insertedStepRunId = await insertWorkflowRuntimeStep(tx, {
      template,
      processRunId: handoffStepRun.process_run_id,
      branchId: handoffStepRun.branch_id,
      orderIndex: handoffStepRun.order_index + index + 1,
      amendmentId: args.amendmentId,
      amendmentTitle: args.amendmentTitle,
      amendmentReason: args.amendmentReason,
      creatorId: args.creatorId,
      pathId,
      terminalTargetGroupId: handoffStepRun.target_group_id ?? null,
    });
    insertedStepRunIds.push(insertedStepRunId);
  }

  return insertedStepRunIds;
}

async function createInitialStepRunFromPathSegment(
  tx: ZeroTransaction,
  args: {
    processRunId: string;
    branchId: string;
    pathId: string;
    sourceGroupId: string | null;
    segment: EnrichedPathSegmentInput;
    orderIndex: number;
    amendmentId: string;
    amendmentTitle: string;
    amendmentReason: string | null;
    creatorId: string;
    targetGroupId: string | null;
    workflowId: string | null;
    pathMode: 'hierarchy' | 'workflow';
    evaluationMode: 'none' | 'fixed_date' | 'relative_to_vote' | undefined;
    evaluationDate: number | null | undefined;
  }
) {
  const stepRunId = crypto.randomUUID();
  const shouldCreateImmediateVote =
    args.segment.stepKind !== 'merge_vote' && Boolean(args.segment.eventId);
  const agendaItemId = shouldCreateImmediateVote
    ? (args.segment.agendaItemId ?? crypto.randomUUID())
    : null;
  const voteId = shouldCreateImmediateVote
    ? (args.segment.amendmentVoteId ?? crypto.randomUUID())
    : null;

  if (args.segment.eventId && agendaItemId && voteId) {
    await createAgendaItemAndVote(tx, {
      agendaItemId,
      voteId,
      eventId: args.segment.eventId,
      amendmentId: args.amendmentId,
      amendmentTitle: args.amendmentTitle,
      amendmentReason: args.amendmentReason,
      forwardingStatus: args.segment.forwardingStatus,
      creatorId: args.creatorId,
      votePurpose: VOTE_PURPOSE.closing,
    });
  }

  await tx.mutate.amendment_process_step_run.insert({
    id: stepRunId,
    process_run_id: args.processRunId,
    branch_id: args.branchId,
    workflow_id: args.workflowId,
    workflow_step_id: args.segment.workflowStepId ?? null,
    step_kind: args.segment.stepKind ?? 'group_vote',
    selection_mode:
      args.segment.selectionMode ??
      (args.workflowId ? 'explicit_workflow' : 'default_target_workflow'),
    merge_strategy: args.segment.mergeStrategy ?? null,
    status: args.segment.eventId ? 'scheduled' : 'pending_event',
    source_group_id: args.sourceGroupId,
    target_group_id: args.segment.groupId,
    event_id: args.segment.eventId ?? null,
    agenda_item_id: agendaItemId,
    vote_id: voteId,
    support_confirmation_id: null,
    decision_status: args.segment.forwardingStatus,
    order_index: args.orderIndex,
    starts_at: args.segment.eventStartDate ?? null,
    ends_at: null,
    created_at: Date.now(),
    updated_at: Date.now(),
  });

  await tx.mutate.amendment_path_segment.insert({
    id: crypto.randomUUID(),
    path_id: args.pathId,
    process_branch_id: args.branchId,
    process_step_run_id: stepRunId,
    group_id: args.segment.groupId,
    event_id: args.segment.eventId ?? null,
    order_index: args.orderIndex,
    status: args.segment.forwardingStatus,
    created_at: Date.now(),
  });

  if (!args.segment.eventId && args.segment.autoTaskOnMissingEvent !== false) {
    await createScheduleEventTask(tx, {
      processRunId: args.processRunId,
      branchId: args.branchId,
      stepRunId,
      taskTitle: `Schedule amendment vote for ${args.segment.groupName}`,
      taskDescription: `No eligible event is selected yet for ${args.segment.groupName}.`,
      groupId: args.segment.groupId,
      targetGroupId: args.targetGroupId,
      senderId: args.creatorId,
      groupName: args.segment.groupName,
      metadata: {
        amendmentId: args.amendmentId,
        amendmentTitle: args.amendmentTitle,
        groupName: args.segment.groupName,
        orderIndex: args.orderIndex,
        requiredAfter: args.segment.requiredAfter ?? null,
        requiredBefore: args.segment.requiredBefore ?? null,
        sourceGroupId: args.sourceGroupId,
        targetGroupId: args.targetGroupId,
        pathMode: args.pathMode,
        workflowId: args.workflowId,
        workflowStepId: args.segment.workflowStepId ?? null,
        stepKind: args.segment.stepKind ?? 'group_vote',
        selectionMode:
          args.segment.selectionMode ??
          (args.workflowId ? 'explicit_workflow' : 'default_target_workflow'),
        mergeStrategy: args.segment.mergeStrategy ?? null,
        eventRule: args.segment.eventRule ?? null,
        autoTaskOnMissingEvent: args.segment.autoTaskOnMissingEvent ?? true,
        targetWorkflowId: args.segment.targetWorkflowId ?? null,
        evaluationMode:
          args.evaluationMode && args.evaluationMode !== 'none' ? args.evaluationMode : null,
        evaluationDueAt: args.evaluationDate ?? null,
        forwardingStatus: args.segment.forwardingStatus,
      },
    });
  }

  return stepRunId;
}

export async function initializeAmendmentProcessPath(
  tx: ZeroTransaction,
  userId: string,
  args: InitializeAmendmentProcessPathArgs
) {
  if (args.enriched_path.length === 0) {
    return { handled: false };
  }

  const targetGroupId = args.enriched_path[args.enriched_path.length - 1]?.groupId ?? null;
  const workflowId = args.workflow_id ?? null;
  const originAmendmentId = await getAmendmentOriginId(tx, args.amendment_id);
  const activeRuns = await findActiveRunsForOrigin(tx, originAmendmentId);
  const existingRun =
    activeRuns.find(
      run =>
        (run.selected_target_group_id ?? null) === targetGroupId &&
        (run.selected_target_workflow_id ?? null) === workflowId
    ) ?? null;
  const requestedStartGroupId = args.source_group_id ?? args.enriched_path[0]?.groupId ?? null;

  if (!existingRun && activeRuns.length > 0) {
    throw new Error('Additional process branches must use the active process target.');
  }

  if (existingRun && requestedStartGroupId) {
    const existingStartGroupIds = await getExistingBranchStartGroupIds(tx, existingRun.id);
    if (existingStartGroupIds.has(requestedStartGroupId)) {
      throw new Error('A process branch for this start group already exists.');
    }
  }

  const processRunId = existingRun?.id ?? crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const pathId = crypto.randomUUID();
  const now = Date.now();
  const branchDocumentArtifacts = await createBranchDocumentArtifacts(tx, {
    amendmentId: args.amendment_id,
    processRunId: existingRun?.id ?? null,
    authorId: userId,
    changeSummary: `Process branch created: ${args.amendment_title}`,
  });
  const initialBranchEditingMode = normalizeEditingMode(branchDocumentArtifacts.editingMode);

  if (!existingRun) {
    await tx.mutate.amendment_process_run.insert({
      id: processRunId,
      amendment_id: originAmendmentId,
      root_workflow_id: workflowId,
      selected_source_group_id: requestedStartGroupId,
      selected_target_group_id: targetGroupId,
      selected_target_workflow_id: workflowId,
      active_branch_id: null,
      terminal_step_run_id: null,
      status: 'pending_event',
      evaluation_mode:
        args.evaluation_mode && args.evaluation_mode !== 'none' ? args.evaluation_mode : null,
      evaluation_date: args.evaluation_date ?? null,
      evaluation_offset_months: args.evaluation_offset_months ?? null,
      evaluation_offset_years: args.evaluation_offset_years ?? null,
      implementation_status: null,
      created_by_id: userId,
      created_at: now,
      updated_at: now,
    });
  }

  await tx.mutate.amendment_process_branch.insert({
    id: branchId,
    process_run_id: processRunId,
    parent_branch_id: null,
    merged_into_branch_id: null,
    source_step_run_id: null,
    document_version_id: branchDocumentArtifacts.documentVersionId,
    document_id: branchDocumentArtifacts.documentId,
    discussions: [],
    title: args.amendment_title,
    status: 'pending_event',
    editing_mode: initialBranchEditingMode,
    resolution: null,
    created_at: now,
    updated_at: now,
  });

  if (!existingRun) {
    await tx.mutate.amendment_process_run.update({
      id: processRunId,
      active_branch_id: branchId,
      updated_at: now,
    });
  }

  await tx.mutate.amendment_path.insert({
    id: pathId,
    amendment_id: args.amendment_id,
    process_run_id: processRunId,
    title: args.path_mode === 'workflow' ? 'Workflow path' : 'Hierarchy path',
    workflow_id: workflowId,
    created_at: now,
  });

  let previousGroupId = requestedStartGroupId;
  for (const [index, segment] of args.enriched_path.entries()) {
    await createInitialStepRunFromPathSegment(tx, {
      processRunId,
      branchId,
      pathId,
      sourceGroupId:
        index === 0 ? previousGroupId : (args.enriched_path[index - 1]?.groupId ?? null),
      segment,
      orderIndex: index,
      amendmentId: args.amendment_id,
      amendmentTitle: args.amendment_title,
      amendmentReason: args.amendment_reason,
      creatorId: userId,
      targetGroupId,
      workflowId,
      pathMode: args.path_mode ?? 'hierarchy',
      evaluationMode: args.evaluation_mode,
      evaluationDate: args.evaluation_date,
    });
    previousGroupId = segment.groupId;
  }

  const branchSync = await syncBranchSchedulingState(tx, branchId);
  const firstUnresolvedStep = await findFirstUnresolvedStepRunForBranch(tx, branchId);
  if (firstUnresolvedStep?.step_kind === 'merge_vote') {
    await maybeScheduleMergeRoundOne(tx, {
      processRunId,
      stepRunId: firstUnresolvedStep.id,
      amendmentId: args.amendment_id,
      amendmentTitle: args.amendment_title,
      amendmentReason: args.amendment_reason,
      creatorId: userId,
    });
  }
  await maybeScheduleAutomaticMergeAtCrossing(tx, {
    processRunId,
    amendmentId: originAmendmentId,
    amendmentTitle: args.amendment_title,
    amendmentReason: args.amendment_reason,
    creatorId: userId,
  });
  const runSync = await recomputeProcessRunState(tx, processRunId);

  await tx.mutate.amendment.update({
    id: args.amendment_id,
    current_process_run_id: processRunId,
    updated_at: Date.now(),
  });

  return {
    handled: true,
    processRunId,
    branchId,
    pathId,
    branchStatus: branchSync.branchStatus,
    runStatus: runSync.status,
  };
}

export async function replanProcessBranchEvents(
  tx: ZeroTransaction,
  userId: string,
  args: ReplanProcessBranchEventsArgs
) {
  const branch = await tx.run(zql.amendment_process_branch.where('id', args.branch_id).one());
  if (!branch) {
    throw new Error('Process branch not found.');
  }

  if (isTerminalBranchStatus(branch.status)) {
    throw new Error('Completed process branches cannot be replanned.');
  }

  const processRun = await tx.run(
    zql.amendment_process_run.where('id', branch.process_run_id).one()
  );
  if (!processRun) {
    throw new Error('Process run not found.');
  }

  const amendment = await tx.run(zql.amendment.where('id', processRun.amendment_id).one());
  if (!amendment) {
    throw new Error('Amendment not found.');
  }

  const stepRuns = await tx.run(
    zql.amendment_process_step_run.where('branch_id', branch.id).orderBy('order_index', 'asc')
  );
  const stepRunRows = Array.isArray(stepRuns) ? stepRuns.filter(Boolean) : [];
  if (stepRunRows.length === 0) {
    return { handled: false as const };
  }

  const updatesByStepRunId = new Map<string, string | null>();
  for (const update of args.event_updates) {
    updatesByStepRunId.set(update.step_run_id, update.event_id ?? null);
  }

  if (updatesByStepRunId.size === 0) {
    return {
      handled: true as const,
      processRunId: processRun.id,
      branchId: branch.id,
      changedStepRunIds: [],
    };
  }

  const lastDecidedOrderIndex = stepRunRows.reduce(
    (latest, stepRun) =>
      isTerminalStepStatus(stepRun.status) ? Math.max(latest, stepRun.order_index) : latest,
    -1
  );
  const firstUnresolvedStep = stepRunRows.find(stepRun => !isTerminalStepStatus(stepRun.status));
  const stepRunsById = new Map(stepRunRows.map(stepRun => [stepRun.id, stepRun]));
  const now = Date.now();
  const eventIdsToLoad = new Set<string>();

  for (const stepRun of stepRunRows) {
    if (stepRun.event_id) {
      eventIdsToLoad.add(stepRun.event_id);
    }
  }
  for (const eventId of updatesByStepRunId.values()) {
    if (eventId) {
      eventIdsToLoad.add(eventId);
    }
  }

  const eventsById = new Map<string, ProcessEventScheduleRow>();
  for (const eventId of eventIdsToLoad) {
    const event = await tx.run(zql.event.where('id', eventId).one());
    if (event) {
      eventsById.set(eventId, event);
    }
  }

  for (const [stepRunId, eventId] of updatesByStepRunId.entries()) {
    const stepRun = stepRunsById.get(stepRunId);
    if (!stepRun) {
      throw new Error('Step run does not belong to this branch.');
    }

    if (stepRun.order_index <= lastDecidedOrderIndex || isTerminalStepStatus(stepRun.status)) {
      throw new Error('Decided process steps cannot be replanned.');
    }

    if (!eventId) {
      continue;
    }

    const event = eventsById.get(eventId);
    const requiredGroupId = stepRun.target_group_id ?? stepRun.source_group_id ?? null;
    if (!event) {
      throw new Error('Selected event not found.');
    }
    if (!requiredGroupId || event.group_id !== requiredGroupId) {
      throw new Error('Selected event does not belong to the step group.');
    }
    if (
      event.start_date == null ||
      event.start_date <= now ||
      !isAmendmentTargetEventOpen(event, now)
    ) {
      throw new Error('Selected event is not eligible for amendment scheduling.');
    }
  }

  const candidateSteps = stepRunRows.map(stepRun => {
    const nextEventId = updatesByStepRunId.has(stepRun.id)
      ? (updatesByStepRunId.get(stepRun.id) ?? null)
      : (stepRun.event_id ?? null);
    const event = nextEventId ? (eventsById.get(nextEventId) ?? null) : null;

    return {
      stepRun,
      eventId: nextEventId,
      eventStartDate:
        event?.start_date ?? (nextEventId === stepRun.event_id ? stepRun.starts_at : null),
      eventEndDate:
        event?.end_date ??
        event?.start_date ??
        (nextEventId === stepRun.event_id ? stepRun.starts_at : null),
    };
  });

  let previousEventEnd: number | null = null;
  for (const candidate of candidateSteps) {
    if (candidate.eventStartDate == null) {
      continue;
    }

    if (previousEventEnd != null && candidate.eventStartDate < previousEventEnd) {
      throw new Error('Process step events must stay in chronological order.');
    }

    previousEventEnd = candidate.eventEndDate ?? candidate.eventStartDate;
  }

  const changedStepRunIds: string[] = [];
  for (const [stepRunId, eventId] of updatesByStepRunId.entries()) {
    const stepRun = stepRunsById.get(stepRunId);
    if (!stepRun) {
      continue;
    }

    const event = eventId ? (eventsById.get(eventId) ?? null) : null;
    const existingEventId = stepRun.event_id ?? null;
    const eventChanged = existingEventId !== eventId;
    const shouldCreateImmediateVote =
      stepRun.step_kind !== 'merge_vote' && Boolean(eventId) && event != null;
    const forwardingStatus =
      firstUnresolvedStep?.id === stepRun.id
        ? 'forward_confirmed'
        : 'previous_decision_outstanding';
    let agendaItemId: string | null = stepRun.agenda_item_id ?? null;
    let voteId: string | null = stepRun.vote_id ?? null;

    if (eventChanged || !eventId || (shouldCreateImmediateVote && (!agendaItemId || !voteId))) {
      await deleteScheduledAgendaItemForFutureStep(tx, stepRun);
      agendaItemId = null;
      voteId = null;
    }

    if (event && shouldCreateImmediateVote && (!agendaItemId || !voteId)) {
      agendaItemId = crypto.randomUUID();
      voteId = crypto.randomUUID();
      await createAgendaItemAndVote(tx, {
        agendaItemId,
        voteId,
        eventId: event.id,
        amendmentId: amendment.id,
        amendmentTitle: amendment.title ?? 'Amendment',
        amendmentReason: amendment.reason ?? null,
        forwardingStatus,
        creatorId: processRun.created_by_id,
        votePurpose: VOTE_PURPOSE.closing,
      });
    }

    await tx.mutate.amendment_process_step_run.update({
      id: stepRun.id,
      event_id: event?.id ?? null,
      agenda_item_id: agendaItemId,
      vote_id: voteId,
      starts_at: event?.start_date ?? null,
      status: event ? 'scheduled' : 'pending_event',
      decision_status: event ? forwardingStatus : 'previous_decision_outstanding',
      updated_at: Date.now(),
    });

    await updatePathSegmentsForStepRun(tx, {
      stepRunId: stepRun.id,
      eventId: event?.id ?? null,
      status: event ? forwardingStatus : 'previous_decision_outstanding',
    });

    if (event) {
      await closeOpenScheduleTasksForStepRun(tx, stepRun.id);
    } else {
      const targetGroupId = stepRun.target_group_id ?? stepRun.source_group_id ?? null;
      const targetGroup = targetGroupId
        ? await tx.run(zql.group.where('id', targetGroupId).one())
        : null;
      await createScheduleEventTask(tx, {
        processRunId: processRun.id,
        branchId: branch.id,
        stepRunId: stepRun.id,
        taskTitle: `Schedule amendment vote for ${targetGroup?.name ?? 'this group'}`,
        taskDescription: `No eligible event is selected yet for ${targetGroup?.name ?? 'this group'}.`,
        groupId: targetGroupId ?? '',
        targetGroupId: processRun.selected_target_group_id ?? null,
        senderId: userId,
        groupName: targetGroup?.name ?? null,
        metadata: {
          amendmentId: amendment.id,
          amendmentTitle: amendment.title ?? 'Amendment',
          groupName: targetGroup?.name ?? null,
          orderIndex: stepRun.order_index,
          workflowId: stepRun.workflow_id ?? null,
          workflowStepId: stepRun.workflow_step_id ?? null,
          stepKind: stepRun.step_kind,
          selectionMode: stepRun.selection_mode ?? null,
          mergeStrategy: stepRun.merge_strategy ?? null,
          forwardingStatus: 'previous_decision_outstanding',
        },
      });
    }

    changedStepRunIds.push(stepRun.id);
  }

  const branchSync = await syncBranchSchedulingState(tx, branch.id);
  const firstUnresolvedAfterReplan =
    branchSync.stepRuns.find(stepRun => !isTerminalStepStatus(stepRun.status)) ?? null;

  if (firstUnresolvedAfterReplan?.step_kind === 'merge_vote') {
    await maybeScheduleMergeRoundOne(tx, {
      processRunId: processRun.id,
      stepRunId: firstUnresolvedAfterReplan.id,
      amendmentId: amendment.id,
      amendmentTitle: amendment.title ?? 'Amendment',
      amendmentReason: amendment.reason ?? null,
      creatorId: processRun.created_by_id,
    });
  }

  await maybeScheduleAutomaticMergeAtCrossing(tx, {
    processRunId: processRun.id,
    amendmentId: amendment.id,
    amendmentTitle: amendment.title ?? 'Amendment',
    amendmentReason: amendment.reason ?? null,
    creatorId: processRun.created_by_id,
  });
  const runSync = await recomputeProcessRunState(tx, processRun.id);

  return {
    handled: true as const,
    processRunId: processRun.id,
    branchId: branch.id,
    changedStepRunIds,
    branchStatus: branchSync.branchStatus,
    runStatus: runSync.status,
  };
}

export async function completeProcessTaskWithEvent(
  tx: ZeroTransaction,
  userId: string,
  args: CompleteProcessTaskWithEventArgs
) {
  const task = await tx.run(zql.process_task.where('id', args.process_task_id).one());
  if (!task) {
    return { handled: false as const };
  }

  const event = await tx.run(zql.event.where('id', args.event_id).one());
  if (!event) {
    return { handled: false as const };
  }

  const { processRun, supportConfirmation, amendment } = await getAmendmentContextForTask(tx, task);
  if (!processRun) {
    return { handled: false as const };
  }

  const stepRun = task.step_run_id
    ? await tx.run(zql.amendment_process_step_run.where('id', task.step_run_id).one())
    : null;
  const now = Date.now();
  const agendaItemId =
    stepRun?.step_kind === 'merge_vote' || task.task_type === 'support_confirmation'
      ? null
      : crypto.randomUUID();
  const voteId =
    stepRun?.step_kind === 'merge_vote' || task.task_type === 'support_confirmation'
      ? null
      : crypto.randomUUID();
  const amendmentId = amendment?.id ?? supportConfirmation?.amendment_id ?? null;
  const amendmentTitle = amendment?.title ?? 'Amendment';
  const amendmentReason = amendment?.reason ?? null;
  const agendaTitle =
    task.task_type === 'implementation_evaluation'
      ? translateText('generated.inline.0191_implementation_review_amendmenttitle_ada8abc2', {
          amendmentTitle: amendmentTitle,
        })
      : task.task_type === 'support_confirmation'
        ? translateText('generated.inline.0192_support_confirmation_amendmenttitle_a9aff0ac', {
            amendmentTitle: amendmentTitle,
          })
        : `Amendment: ${amendmentTitle}`;
  const agendaType: AgendaType =
    task.task_type === 'implementation_evaluation'
      ? 'implementation_review'
      : task.task_type === 'support_confirmation'
        ? 'support_confirmation'
        : 'amendment';

  if (agendaItemId && voteId && amendmentId) {
    await createAgendaItemAndVote(tx, {
      agendaItemId,
      voteId,
      eventId: args.event_id,
      amendmentId,
      amendmentTitle,
      amendmentReason,
      forwardingStatus: task.step_run_id ? 'forward_confirmed' : '',
      creatorId: userId,
      agendaTitle,
      agendaDescription:
        args.description?.trim() ||
        task.description ||
        `Automatically linked to ${event.title ?? 'event'}.`,
      agendaType,
      voteTitle: agendaTitle,
      voteDescription: amendmentReason,
      choiceLabels:
        task.task_type === 'implementation_evaluation'
          ? [buildChoiceLabel('yes'), buildChoiceLabel('no')]
          : undefined,
      majorityType: task.task_type === 'implementation_evaluation' ? 'simple' : undefined,
      votePurpose: VOTE_PURPOSE.closing,
    });
  }

  await tx.mutate.process_task.update({
    id: task.id,
    status: 'completed',
    event_id: args.event_id,
    agenda_item_id: agendaItemId,
    resolved_at: now,
    updated_at: now,
  });

  if (task.step_run_id && stepRun) {
    await tx.mutate.amendment_process_step_run.update({
      id: task.step_run_id,
      event_id: args.event_id,
      agenda_item_id: agendaItemId,
      vote_id: voteId,
      starts_at: event.start_date ?? null,
      status: 'scheduled',
      decision_status: stepRun.decision_status === 'tie' ? 'tie' : 'forward_confirmed',
      updated_at: now,
    });
    await updatePathSegmentStatus(tx, task.step_run_id, 'forward_confirmed');
  }

  if (task.task_type === 'implementation_evaluation') {
    await tx.mutate.amendment_process_run.update({
      id: task.process_run_id,
      implementation_status: 'evaluation_scheduled',
      updated_at: now,
    });
  }

  if (supportConfirmation) {
    await tx.mutate.support_confirmation.update({
      id: supportConfirmation.id,
      event_id: args.event_id,
      process_task_id: task.id,
    });
  }

  if (task.branch_id) {
    await syncBranchSchedulingState(tx, task.branch_id);
  }

  if (amendmentId) {
    await maybeScheduleAutomaticMergeAtCrossing(tx, {
      processRunId: task.process_run_id,
      amendmentId: processRun.amendment_id,
      amendmentTitle,
      amendmentReason,
      creatorId: processRun.created_by_id,
    });
  }

  if (stepRun?.step_kind === 'merge_vote' && amendmentId) {
    await maybeScheduleMergeRoundOne(tx, {
      processRunId: task.process_run_id,
      stepRunId: stepRun.id,
      amendmentId,
      amendmentTitle,
      amendmentReason,
      creatorId: processRun.created_by_id,
    });
  }

  const runSync = await recomputeProcessRunState(tx, task.process_run_id);

  return {
    handled: true as const,
    processRunId: task.process_run_id,
    branchId: task.branch_id ?? null,
    stepRunId: task.step_run_id ?? null,
    agendaItemId,
    voteId,
    runStatus: runSync.status,
  };
}

export async function resolveAmendmentProcessVote(
  tx: ZeroTransaction,
  args: ResolveAmendmentProcessVoteArgs,
  actorUserId?: string | null
) {
  const stepRuns = await tx.run(
    zql.amendment_process_step_run
      .where('agenda_item_id', args.agenda_item_id)
      .orderBy('branch_id', 'asc')
      .orderBy('order_index', 'asc')
  );

  if (stepRuns.length === 0) {
    const implementationTask = await tx.run(
      zql.process_task
        .where('agenda_item_id', args.agenda_item_id)
        .where('task_type', 'implementation_evaluation')
        .one()
    );
    if (!implementationTask) {
      return { handled: false as const };
    }

    const agendaItem = await tx.run(zql.agenda_item.where('id', args.agenda_item_id).one());
    const processRun = await tx.run(
      zql.amendment_process_run.where('id', implementationTask.process_run_id).one()
    );
    const amendmentId = agendaItem?.amendment_id ?? processRun?.amendment_id ?? null;
    const voteRecord = await tx.run(zql.vote.where('agenda_item_id', args.agenda_item_id).one());
    const vote = voteRecord ? await fetchVoteWithDetails(tx, voteRecord.id) : null;

    if (!agendaItem || !processRun || !amendmentId || !vote) {
      return { handled: false as const };
    }

    const now = Date.now();
    const voteOutcome = resolveDecisionVoteOutcome(vote);

    await tx.mutate.agenda_item.update({
      id: agendaItem.id,
      forwarding_status: voteOutcome.result === 'passed' ? 'approved' : voteOutcome.result,
      completed_at: now,
      updated_at: now,
    });
    await tx.mutate.amendment_process_run.update({
      id: processRun.id,
      implementation_status:
        voteOutcome.result === 'passed' ? 'implemented' : 'implementation_failed',
      updated_at: now,
    });

    return {
      handled: true as const,
      amendmentId,
      processRunId: processRun.id,
      voteResult: voteOutcome.result,
      runStatus: processRun.status,
      terminalDecision: null,
    };
  }

  const agendaItem = await tx.run(zql.agenda_item.where('id', args.agenda_item_id).one());
  const processRun = await tx.run(
    zql.amendment_process_run.where('id', stepRuns[0].process_run_id).one()
  );
  const amendmentId = agendaItem?.amendment_id ?? processRun?.amendment_id ?? null;
  const amendment = amendmentId ? await tx.run(zql.amendment.where('id', amendmentId).one()) : null;
  const voteId = stepRuns[0].vote_id ?? null;
  const vote = voteId ? await fetchVoteWithDetails(tx, voteId) : null;

  if (!agendaItem || !processRun || !amendmentId || !vote) {
    return { handled: false as const };
  }

  const now = Date.now();

  if (stepRuns[0].step_kind === 'merge_vote') {
    const mergeOutcome = resolveMergeRoundOneOutcome({
      vote,
      candidateStepRuns: stepRuns.map(stepRun => ({
        branch_id: stepRun.branch_id,
        created_at: stepRun.created_at,
      })),
    });

    if (mergeOutcome.result === 'tie') {
      await tx.mutate.agenda_item.update({
        id: agendaItem.id,
        forwarding_status: 'tie',
        updated_at: now,
      });

      for (const stepRun of stepRuns) {
        await tx.mutate.amendment_process_step_run.update({
          id: stepRun.id,
          decision_status: 'tie',
          updated_at: now,
        });
        await updatePathSegmentStatus(tx, stepRun.id, 'tie');
        await syncBranchSchedulingState(tx, stepRun.branch_id);
      }

      const runSync = await recomputeProcessRunState(tx, processRun.id);
      return {
        handled: true as const,
        amendmentId,
        processRunId: processRun.id,
        voteResult: 'tie' as const,
        runStatus: runSync.status,
        terminalDecision: null,
      };
    }

    const winnerStepRun = stepRuns.find(
      stepRun => stepRun.branch_id === mergeOutcome.winnerBranchId
    );
    if (!winnerStepRun) {
      return { handled: false as const };
    }

    await tx.mutate.agenda_item.update({
      id: agendaItem.id,
      forwarding_status: 'merged',
      completed_at: now,
      updated_at: now,
    });

    for (const loserStepRun of stepRuns.filter(
      stepRun => stepRun.branch_id !== mergeOutcome.winnerBranchId
    )) {
      await tx.mutate.amendment_process_step_run.update({
        id: loserStepRun.id,
        status: 'rejected',
        decision_status: 'rejected',
        ends_at: now,
        updated_at: now,
      });
      await updatePathSegmentStatus(tx, loserStepRun.id, 'rejected');
      await tx.mutate.amendment_process_branch.update({
        id: loserStepRun.branch_id,
        status: 'rejected',
        resolution: 'merge_loser',
        merged_into_branch_id: mergeOutcome.winnerBranchId,
        updated_at: now,
      });

      const loserChangeRequests = await tx.run(
        zql.change_request.where('process_branch_id', loserStepRun.branch_id)
      );
      for (const changeRequest of loserChangeRequests) {
        if (changeRequest.obsolete_at) {
          continue;
        }

        await tx.mutate.change_request.update({
          id: changeRequest.id,
          obsolete_reason: 'merge_loser',
          obsolete_at: now,
          obsolete_by_vote_id: voteId,
          updated_at: now,
        });
      }

      const loserTimelineItems = await tx.run(
        zql.agenda_item_change_request.where('process_branch_id', loserStepRun.branch_id)
      );
      for (const timelineItem of loserTimelineItems) {
        await tx.mutate.agenda_item_change_request.update({
          id: timelineItem.id,
          status: timelineItem.status === 'completed' ? timelineItem.status : 'obsolete',
          obsolete_reason: 'merge_loser',
          updated_at: now,
        });
      }
    }

    await tx.mutate.amendment_process_step_run.update({
      id: winnerStepRun.id,
      status: 'merged',
      decision_status: 'merged',
      ends_at: now,
      updated_at: now,
    });
    await updatePathSegmentStatus(tx, winnerStepRun.id, 'merged');

    const winnerAmendmentId = await getBranchAmendmentId(tx, winnerStepRun.branch_id, amendmentId);
    const winnerAmendment =
      winnerAmendmentId === amendment?.id
        ? amendment
        : await tx.run(zql.amendment.where('id', winnerAmendmentId).one());

    const roundTwoStepRunId = await createRoundTwoMergeApprovalStep(tx, {
      winnerStepRunId: winnerStepRun.id,
      amendmentId: winnerAmendmentId,
      amendmentTitle: winnerAmendment?.title ?? agendaItem.title ?? 'Amendment',
      amendmentReason: winnerAmendment?.reason ?? null,
      creatorId: processRun.created_by_id,
    });

    await syncBranchSchedulingState(tx, winnerStepRun.branch_id);
    const runSync = await recomputeProcessRunState(tx, processRun.id);

    return {
      handled: true as const,
      amendmentId,
      processRunId: processRun.id,
      branchId: winnerStepRun.branch_id,
      stepRunId: winnerStepRun.id,
      nextStepRunId: roundTwoStepRunId,
      voteResult: 'passed' as const,
      runStatus: runSync.status,
      terminalDecision: null,
    };
  }

  const stepRun = stepRuns[0];
  const branch = await tx.run(zql.amendment_process_branch.where('id', stepRun.branch_id).one());
  if (!branch) {
    return { handled: false as const };
  }

  const voteOutcome = resolveDecisionVoteOutcome(vote);

  await tx.mutate.agenda_item.update({
    id: agendaItem.id,
    forwarding_status: voteOutcome.result === 'passed' ? 'approved' : voteOutcome.result,
    completed_at: now,
    updated_at: now,
  });

  if (voteOutcome.result === 'tie') {
    await tx.mutate.amendment_process_step_run.update({
      id: stepRun.id,
      decision_status: 'tie',
      updated_at: now,
    });
    await updatePathSegmentStatus(tx, stepRun.id, 'tie');
    await syncBranchSchedulingState(tx, branch.id);
    const runSync = await recomputeProcessRunState(tx, processRun.id);
    return {
      handled: true as const,
      amendmentId,
      processRunId: processRun.id,
      branchId: branch.id,
      stepRunId: stepRun.id,
      voteResult: 'tie' as const,
      runStatus: runSync.status,
      terminalDecision: null,
    };
  }

  if (voteOutcome.result === 'rejected') {
    await tx.mutate.amendment_process_step_run.update({
      id: stepRun.id,
      status: 'rejected',
      decision_status: 'rejected',
      ends_at: now,
      updated_at: now,
    });
    await updatePathSegmentStatus(tx, stepRun.id, 'rejected');

    if (stepRun.target_group_id) {
      await upsertGroupDecision(tx, {
        amendmentId,
        groupId: stepRun.target_group_id,
        processRunId: processRun.id,
        processBranchId: branch.id,
        processStepRunId: stepRun.id,
        status: 'rejected',
      });
    }

    await rejectFutureStepsOnBranch(tx, {
      branchId: branch.id,
      fromOrderIndex: stepRun.order_index,
      now,
    });

    await tx.mutate.amendment_process_branch.update({
      id: branch.id,
      status: 'rejected',
      resolution: 'rejected',
      updated_at: now,
    });

    const runSync = await recomputeProcessRunState(tx, processRun.id);
    await tx.mutate.amendment_process_run.update({
      id: processRun.id,
      terminal_step_run_id: stepRun.id,
      updated_at: now,
    });
    await syncBranchEditingMode(tx, branch.id, amendmentId, 'rejected');

    return {
      handled: true as const,
      amendmentId,
      processRunId: processRun.id,
      branchId: branch.id,
      stepRunId: stepRun.id,
      voteResult: 'rejected' as const,
      runStatus: runSync.status,
      terminalDecision: 'rejected' as const,
    };
  }

  await tx.mutate.amendment_process_step_run.update({
    id: stepRun.id,
    status: 'approved',
    decision_status: 'approved',
    ends_at: now,
    updated_at: now,
  });
  await updatePathSegmentStatus(tx, stepRun.id, 'approved');

  if (stepRun.target_group_id) {
    await upsertGroupDecision(tx, {
      amendmentId,
      groupId: stepRun.target_group_id,
      processRunId: processRun.id,
      processBranchId: branch.id,
      processStepRunId: stepRun.id,
      status: 'supported',
    });
  }

  if (stepRun.step_kind === 'workflow_handoff') {
    await materializeWorkflowHandoff(tx, {
      stepRunId: stepRun.id,
      amendmentId,
      amendmentTitle: amendment?.title ?? agendaItem.title ?? 'Amendment',
      amendmentReason: amendment?.reason ?? null,
      creatorId: processRun.created_by_id,
    });
  }

  const remainingSteps = await tx.run(
    zql.amendment_process_step_run
      .where('branch_id', branch.id)
      .where('order_index', '>', stepRun.order_index)
      .orderBy('order_index', 'asc')
  );
  const nextStep = remainingSteps.find(step => !isTerminalStepStatus(step.status));

  if (!nextStep) {
    if (stepRun.target_group_id) {
      await upsertGroupDecision(tx, {
        amendmentId,
        groupId: stepRun.target_group_id,
        processRunId: processRun.id,
        processBranchId: branch.id,
        processStepRunId: stepRun.id,
        status: 'accepted',
      });
    }

    await tx.mutate.amendment_process_branch.update({
      id: branch.id,
      status: 'completed',
      resolution: 'accepted',
      updated_at: now,
    });

    const evaluationMode =
      processRun.evaluation_mode === 'fixed_date' ||
      processRun.evaluation_mode === 'relative_to_vote'
        ? processRun.evaluation_mode
        : null;
    const concreteEvaluationDate =
      evaluationMode && (evaluationMode === 'fixed_date' || evaluationMode === 'relative_to_vote')
        ? resolveConcreteEvaluationDate({
            evaluationMode,
            evaluationDate: processRun.evaluation_date ?? null,
            evaluationOffsetMonths: processRun.evaluation_offset_months ?? null,
            evaluationOffsetYears: processRun.evaluation_offset_years ?? null,
            decisionTimestamp: now,
          })
        : null;
    let implementationStatus = processRun.implementation_status ?? null;

    if (evaluationMode && concreteEvaluationDate != null) {
      const targetGroupId = processRun.selected_target_group_id ?? stepRun.target_group_id ?? null;

      if (concreteEvaluationDate < now || !targetGroupId) {
        implementationStatus = 'implementation_failed';
      } else {
        const targetGroup = await tx.run(zql.group.where('id', targetGroupId).one());
        await createImplementationEvaluationTask(tx, {
          processRunId: processRun.id,
          amendmentId,
          amendmentTitle: amendment?.title ?? agendaItem.title ?? 'Amendment',
          targetGroupId,
          targetGroupName: targetGroup?.name ?? 'die zuständige Gruppe',
          dueAt: concreteEvaluationDate,
          requiredAfter: now,
          evaluationMode,
          senderId: actorUserId ?? processRun.created_by_id,
        });
        implementationStatus = 'awaiting_evaluation';
      }
    }

    const runSync = await recomputeProcessRunState(tx, processRun.id);
    await tx.mutate.amendment_process_run.update({
      id: processRun.id,
      terminal_step_run_id: stepRun.id,
      evaluation_date: concreteEvaluationDate ?? processRun.evaluation_date ?? null,
      implementation_status: implementationStatus,
      updated_at: now,
    });
    await syncBranchEditingMode(tx, branch.id, amendmentId, 'passed');

    return {
      handled: true as const,
      amendmentId,
      processRunId: processRun.id,
      branchId: branch.id,
      stepRunId: stepRun.id,
      nextStepRunId: null,
      voteResult: 'passed' as const,
      runStatus: runSync.status,
      terminalDecision: 'accepted' as const,
      supportedGroupId: stepRun.target_group_id ?? null,
    };
  }

  if (nextStep.step_kind === 'merge_vote') {
    await maybeScheduleMergeRoundOne(tx, {
      processRunId: processRun.id,
      stepRunId: nextStep.id,
      amendmentId,
      amendmentTitle: amendment?.title ?? agendaItem.title ?? 'Amendment',
      amendmentReason: amendment?.reason ?? null,
      creatorId: processRun.created_by_id,
    });
  } else if (nextStep.event_id && (!nextStep.agenda_item_id || !nextStep.vote_id)) {
    const agendaItemId = nextStep.agenda_item_id ?? crypto.randomUUID();
    const voteId = nextStep.vote_id ?? crypto.randomUUID();
    await createAgendaItemAndVote(tx, {
      agendaItemId,
      voteId,
      eventId: nextStep.event_id,
      amendmentId,
      amendmentTitle: amendment?.title ?? agendaItem.title ?? 'Amendment',
      amendmentReason: amendment?.reason ?? null,
      forwardingStatus: 'forward_confirmed',
      creatorId: processRun.created_by_id,
      votePurpose: VOTE_PURPOSE.closing,
    });
    await tx.mutate.amendment_process_step_run.update({
      id: nextStep.id,
      agenda_item_id: agendaItemId,
      vote_id: voteId,
      status: 'scheduled',
      updated_at: now,
    });
    await closeOpenScheduleTasksForStepRun(tx, nextStep.id);
  }

  if (nextStep.event_id && nextStep.agenda_item_id) {
    await appendAgendaItemToConfirmedAgenda(tx, {
      agendaItemId: nextStep.agenda_item_id,
      eventId: nextStep.event_id,
    });
  } else if (nextStep.event_id) {
    const refreshedNextStep = await tx.run(
      zql.amendment_process_step_run.where('id', nextStep.id).one()
    );
    if (refreshedNextStep?.agenda_item_id) {
      await appendAgendaItemToConfirmedAgenda(tx, {
        agendaItemId: refreshedNextStep.agenda_item_id,
        eventId: nextStep.event_id,
      });
    }
  }

  await maybeScheduleAutomaticMergeAtCrossing(tx, {
    processRunId: processRun.id,
    amendmentId: processRun.amendment_id,
    amendmentTitle: amendment?.title ?? agendaItem.title ?? 'Amendment',
    amendmentReason: amendment?.reason ?? null,
    creatorId: processRun.created_by_id,
  });

  const branchSync = await syncBranchSchedulingState(tx, branch.id);
  const runSync = await recomputeProcessRunState(tx, processRun.id);
  await syncBranchEditingMode(
    tx,
    branch.id,
    amendmentId,
    await getForwardedEventEditingMode(tx, nextStep.event_id, now),
    processRun.created_by_id
  );

  return {
    handled: true as const,
    amendmentId,
    processRunId: processRun.id,
    branchId: branch.id,
    stepRunId: stepRun.id,
    nextStepRunId: nextStep.id,
    voteResult: 'passed' as const,
    runStatus: runSync.status,
    branchStatus: branchSync.branchStatus,
    terminalDecision: null,
    supportedGroupId: stepRun.target_group_id ?? null,
  };
}
