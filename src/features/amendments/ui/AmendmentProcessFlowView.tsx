'use client';
import {
  BadgeControl,
  getAmendmentProcessInfoBadgeClassName as getInfoBadgeClassName,
  getAmendmentProcessStatusBadgeClassName as getStatusBadgeClassName,
} from '@/features/shared/ui/status';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import {
  ActionSubmissionOverlay,
  type ActionSubmissionController,
} from '@/features/shared/ui/action-submission';
import { Link } from '@tanstack/react-router';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import { Tabs, TabsContent, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { ScrollableTabsList } from '@/features/shared/ui/navigation/ScrollableTabs';
import {
  TargetGroupEventDisplay,
  TargetGroupEventSelector,
} from '@/features/amendments/ui/TargetGroupEventSelector';
import { AmendmentBranchSelectorSection } from '@/features/amendments/ui/AmendmentBranchSelectorSection';
import { AmendmentPathVisualization } from '@/features/network/ui/AmendmentPathVisualization';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { cn } from '@/features/shared/utils/utils';
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  GitBranch,
  Pencil,
  Target,
  Workflow,
  X,
} from 'lucide-react';
import { AmendmentProcessDetailsPanel } from '@/features/amendments/ui/AmendmentProcessDetailsPanel';
import { normalizeGroupAmendmentDisplayStatus } from '@/features/groups/logic/groupAmendmentStatus';
function formatDateTime(timestamp?: number | null) {
  if (!timestamp) {
    return 'Not scheduled';
  }

  return new Date(timestamp).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
function getBadgeVariant(
  status?: string | null
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'approved':
    case 'accepted':
    case 'completed':
    case 'merged':
      return 'default';
    case 'rejected':
      return 'destructive';
    case 'pending_event':
    case 'scheduled':
    case 'in_vote':
    case 'supported':
      return 'secondary';
    default:
      return 'outline';
  }
}
function GroupReference({
  group,
  label,
  badgeClassName,
  textClassName,
}: {
  group?: { id?: string | null; name?: string | null } | null;
  label?: string;
  badgeClassName?: string;
  textClassName?: string;
}) {
  if (!group?.name) {
    return null;
  }

  const content = (
    <>
      <Building2 className="h-3 w-3" />
      {label ? <span className="font-medium">{label}:</span> : null}
      <span>{group.name}</span>
      {group.id ? <ExternalLink className="h-3 w-3 opacity-60" /> : null}
    </>
  );

  return (
    <BadgeControl variant="outline" className={cn('gap-1.5', badgeClassName)}>
      {group.id ? (
        <Link
          to="/group/$id"
          params={{ id: group.id }}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-sm hover:underline',
            textClassName
          )}
        >
          {content}
        </Link>
      ) : (
        <span className={cn('inline-flex items-center gap-1.5', textClassName)}>{content}</span>
      )}
    </BadgeControl>
  );
}
function EventReference({
  event,
  className,
}: {
  event?: { id?: string | null; title?: string | null } | null;
  className?: string;
}) {
  if (!event?.title) {
    return null;
  }

  if (!event.id) {
    return <span className={className}>{event.title}</span>;
  }

  return (
    <Link
      to="/event/$id/agenda"
      params={{ id: event.id }}
      className={cn('text-primary inline-flex items-center gap-1 hover:underline', className)}
    >
      <span>{event.title}</span>
      <ExternalLink className="h-3 w-3 opacity-60" />
    </Link>
  );
}

function AmendmentProcessFlowSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="space-y-6"
      data-slot="amendment-process-flow-skeleton"
    >
      <span className="sr-only">{label}</span>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-4 w-full max-w-2xl" />
            </div>
            <Skeleton className="h-10 w-40 rounded-md" />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64 max-w-full" />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Skeleton className="h-24 rounded-md" />
                <Skeleton className="h-24 rounded-md" />
                <Skeleton className="h-24 rounded-md" />
              </div>
              <Skeleton className="h-40 rounded-md" />
            </div>
            <div className="space-y-3 rounded-lg border p-4">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-16 rounded-md" />
              <Skeleton className="h-16 rounded-md" />
              <Skeleton className="h-16 rounded-md" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export interface AmendmentProcessFlowViewProps {
  amendmentId: any;
  t: any;
  navigate: any;
  user: any;
  canManageProcess?: boolean;
  selectorOpen: any;
  setSelectorOpen: any;
  pendingSelection: any;
  setPendingSelection: any;
  isSaving: any;
  setIsSaving: any;
  processSubmission: ActionSubmissionController;
  createAmendmentPath: any;
  updateAmendment: any;
  amendment: any;
  collaborators: any;
  isLoading: any;
  currentRun: any;
  allRuns: any[];
  historicalRuns: any[];
  branches: any[];
  currentRunStepRuns: any[];
  displayPath: any;
  displayPathSegments: any[];
  displayPathSegmentByStepRunId: any;
  displayPathSegmentByOrder: any;
  currentRunDisplayStepRuns: any[];
  derivedActiveStepRun: any;
  resolvedActiveBranchId: any;
  selectedBranchId: string | null;
  activeBranch: any;
  activeBranchStepRuns: any[];
  firstUnresolvedStepId: any;
  openTasks: any[];
  groupDecisions: any[];
  groupTypeById: any;
  pathVisualizationData: any;
  branchDiffCandidates: any[];
  defaultBranchDiffRightCandidateId: string | null;
  onBranchChange?: (branchId: string | null, options?: { replace?: boolean }) => void;
  selectorCollaborators: any;
  existingBranchStartGroupIds: string[];
  currentRunPathMode: 'hierarchy' | 'workflow';
  eventEditorBranch: any;
  branchEventEditorRows: any[];
  eventDraftsByStepRunId: Record<string, string | null>;
  isReplanningBranchEvents: boolean;
  openBranchEventEditor: (branch: any) => void;
  closeBranchEventEditor: () => void;
  updateBranchEventDraft: (stepRunId: string, eventId: string | null) => void;
  saveBranchEventReplan: () => void;
  handleConfirmSelection: any;
}

export function AmendmentProcessFlowView({
  amendmentId,
  t,
  navigate,
  user,
  canManageProcess = Boolean(user),
  selectorOpen,
  setSelectorOpen,
  pendingSelection,
  setPendingSelection,
  isSaving,
  processSubmission,
  amendment,
  isLoading,
  currentRun,
  historicalRuns,
  branches,
  selectedBranchId,
  activeBranch,
  activeBranchStepRuns,
  firstUnresolvedStepId,
  openTasks,
  groupDecisions,
  groupTypeById,
  pathVisualizationData,
  branchDiffCandidates,
  defaultBranchDiffRightCandidateId,
  onBranchChange,
  selectorCollaborators,
  existingBranchStartGroupIds,
  currentRunPathMode,
  eventEditorBranch,
  branchEventEditorRows,
  isReplanningBranchEvents,
  openBranchEventEditor,
  closeBranchEventEditor,
  updateBranchEventDraft,
  saveBranchEventReplan,
  handleConfirmSelection,
}: AmendmentProcessFlowViewProps) {
  const processSubmissionActive = processSubmission.isActive;

  if (isLoading) {
    return <AmendmentProcessFlowSkeleton label={t('common.loading.pageSkeleton.entity')} />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                {t('features.amendments.process.title')}
              </CardTitle>
              <CardDescription>
                {currentRun
                  ? t('features.amendments.process.activeRunDescription')
                  : t('features.amendments.process.noRunDescription')}
              </CardDescription>
            </div>

            {canManageProcess ? (
              <Button
                onClick={() => {
                  setPendingSelection(null);
                  setSelectorOpen(true);
                }}
              >
                {currentRun
                  ? t('features.amendments.process.addAdditionalPath', 'Add additional path')
                  : t('features.amendments.process.createPath', 'Create path')}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentRun ? (
            <>
              <div className="flex flex-wrap gap-2">
                <BadgeControl
                  variant={getBadgeVariant(currentRun.status)}
                  className={getStatusBadgeClassName(currentRun.status)}
                >
                  {currentRun.status}
                </BadgeControl>
                <GroupReference
                  group={currentRun.selected_target_group}
                  label={t('features.amendments.process.targetGroup')}
                  badgeClassName={getInfoBadgeClassName('group')}
                />
                {currentRun.selected_target_workflow?.name ? (
                  <BadgeControl
                    variant="secondary"
                    className={cn('gap-1.5', getInfoBadgeClassName('workflow'))}
                  >
                    <Workflow className="mr-1 h-3 w-3" />
                    {currentRun.selected_target_workflow.name}
                  </BadgeControl>
                ) : null}
                <BadgeControl
                  variant="secondary"
                  className={cn('gap-1.5', getInfoBadgeClassName('count'))}
                >
                  <GitBranch className="mr-1 h-3 w-3" />
                  {t('features.amendments.process.branchCount', { count: branches.length })}
                </BadgeControl>
                <BadgeControl
                  variant={openTasks.length > 0 ? 'secondary' : 'outline'}
                  className={cn(
                    'gap-1.5',
                    openTasks.length > 0
                      ? getInfoBadgeClassName('task')
                      : getInfoBadgeClassName('step')
                  )}
                >
                  <Clock3 className="mr-1 h-3 w-3" />
                  {t('features.amendments.process.openTasks', { count: openTasks.length })}
                </BadgeControl>
              </div>

              {currentRun.implementation_status ? (
                <div className="rounded-lg border px-4 py-3 text-sm">
                  <p className="font-medium">
                    {t('features.amendments.process.implementationStatus')}
                  </p>
                  <p className="text-muted-foreground mt-1">{currentRun.implementation_status}</p>
                </div>
              ) : null}
            </>
          ) : (
            <div className="border-border bg-muted/30 rounded-lg border border-dashed p-4 text-sm">
              {t('features.amendments.process.noCurrentRun')}
            </div>
          )}
        </CardContent>
      </Card>

      {branches.length > 0 && onBranchChange ? (
        <AmendmentBranchSelectorSection
          branches={branches}
          selectedBranchId={selectedBranchId}
          branchDiffCandidates={branchDiffCandidates}
          defaultDiffRightCandidateId={defaultBranchDiffRightCandidateId}
          onBranchChange={onBranchChange}
        />
      ) : null}

      {amendment && currentRun && activeBranch ? (
        <>
          <Tabs defaultValue="flow" className="space-y-4">
            <ScrollableTabsList className="w-full sm:w-auto">
              <TabsTrigger value="flow">{t('features.amendments.process.flowTab')}</TabsTrigger>
              <TabsTrigger value="steps">{t('features.amendments.process.stepsTab')}</TabsTrigger>
            </ScrollableTabsList>

            <TabsContent value="flow" className="mt-0" data-testid="amendment-process-flow-tab">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t('features.amendments.process.pathVisualization')}
                  </CardTitle>
                  <CardDescription>
                    {activeBranch.title ?? t('features.amendments.process.activeBranchDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[480px] rounded-lg border">
                    <AmendmentPathVisualization
                      enrichedPathData={pathVisualizationData}
                      groupTypeById={groupTypeById}
                      onGroupClick={groupId =>
                        navigate({ to: '/group/$id', params: { id: groupId } })
                      }
                      onNodeClick={eventId =>
                        navigate({ to: '/event/$id/agenda', params: { id: eventId } })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="steps" className="mt-0" data-testid="amendment-process-steps-tab">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t('features.amendments.process.activeBranch')}
                  </CardTitle>
                  <CardDescription>
                    {activeBranch.title ?? t('features.amendments.process.activeBranchDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-3">
                    {activeBranchStepRuns.map((step: any) => {
                      const isCurrentStep = step.id === firstUnresolvedStepId;
                      const relatedTasks = openTasks.filter(
                        (task: any) => task.step_run_id === step.id
                      );
                      const hasPendingScheduleEventTask = relatedTasks.some(
                        (task: any) => task.task_type === 'schedule_event' && task.status === 'open'
                      );

                      return (
                        <div key={step.id} className="rounded-lg border p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <BadgeControl
                                  variant="outline"
                                  className={cn('gap-1.5', getInfoBadgeClassName('step'))}
                                >
                                  {t('features.amendments.process.step')} {step.order_index + 1}
                                </BadgeControl>
                                <BadgeControl
                                  variant={getBadgeVariant(step.status)}
                                  className={getStatusBadgeClassName(step.status)}
                                >
                                  {step.status}
                                </BadgeControl>
                                {step.decision_status ? (
                                  <BadgeControl
                                    variant={getBadgeVariant(step.decision_status)}
                                    className={getStatusBadgeClassName(step.decision_status)}
                                  >
                                    {step.decision_status}
                                  </BadgeControl>
                                ) : null}
                                {isCurrentStep ? (
                                  <BadgeControl
                                    variant="secondary"
                                    className={cn('gap-1.5', getInfoBadgeClassName('current'))}
                                  >
                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                    {t('features.amendments.process.currentStep')}
                                  </BadgeControl>
                                ) : null}
                                {!step.event?.title && hasPendingScheduleEventTask ? (
                                  <BadgeControl
                                    variant="secondary"
                                    className={cn('gap-1.5', getInfoBadgeClassName('task'))}
                                  >
                                    <Clock3 className="mr-1 h-3 w-3" />
                                    {t('features.amendments.process.eventRequestedPending')}
                                  </BadgeControl>
                                ) : null}
                              </div>

                              <div>
                                {step.target_group?.name ? (
                                  step.target_group.id ? (
                                    <Link
                                      to="/group/$id"
                                      params={{ id: step.target_group.id }}
                                      className="inline-flex items-center gap-1 font-medium hover:underline"
                                    >
                                      <span>{step.target_group.name}</span>
                                      <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                                    </Link>
                                  ) : (
                                    <p className="font-medium">{step.target_group.name}</p>
                                  )
                                ) : (
                                  <p className="font-medium">
                                    {step.workflow_step?.label ??
                                      t('features.amendments.process.unknownGroup')}
                                  </p>
                                )}
                                <p className="text-muted-foreground text-sm">
                                  {step.step_kind}
                                  {step.workflow?.name ? ` - ${step.workflow.name}` : ''}
                                </p>
                              </div>

                              <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
                                <span className="inline-flex items-center gap-1">
                                  <CalendarClock className="h-3 w-3" />
                                  {formatDateTime(step.starts_at)}
                                </span>
                                {step.event?.title ? (
                                  <EventReference event={step.event} />
                                ) : (
                                  <span>
                                    {hasPendingScheduleEventTask
                                      ? t('features.amendments.process.eventRequestedPending')
                                      : t('features.amendments.process.pendingEvent')}
                                  </span>
                                )}
                              </div>
                            </div>

                            {relatedTasks.length > 0 ? (
                              <div className="min-w-[16rem] space-y-2 rounded-lg border border-dashed p-3">
                                <p className="text-sm font-medium">
                                  {t('features.amendments.process.relatedTasks')}
                                </p>
                                {relatedTasks.map((task: any) => (
                                  <div key={task.id} className="space-y-1 text-xs">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <BadgeControl
                                        variant={getBadgeVariant(task.status)}
                                        className={getStatusBadgeClassName(task.status)}
                                      >
                                        {task.status}
                                      </BadgeControl>
                                      <BadgeControl
                                        variant="outline"
                                        className={getInfoBadgeClassName('task')}
                                      >
                                        {task.task_type}
                                      </BadgeControl>
                                    </div>
                                    <p className="text-muted-foreground">
                                      {task.title ?? task.description}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <AmendmentProcessDetailsPanel
            amendment={{
              id: amendment.id,
              title: amendment.title,
              reason: amendment.reason,
              preamble: amendment.preamble,
              current_process_run: amendment.current_process_run ?? null,
              group: amendment.group ?? null,
            }}
            defaultOpen={false}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('features.amendments.process.branches')}
              </CardTitle>
              <CardDescription>
                {t('features.amendments.process.branchesDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {branches.map((branch: any) => {
                const branchStepRuns = [...(branch.step_runs ?? [])].sort(
                  (left, right) => left.order_index - right.order_index
                );
                const branchTasks = [...(branch.tasks ?? [])].filter(
                  (task: any) => task.status === 'open' || task.status === 'scheduled'
                );
                const openChangeRequestCount = (branch.change_requests ?? []).filter(
                  (changeRequest: any) =>
                    changeRequest.voting_status !== 'completed' &&
                    !['accepted', 'approved', 'rejected', 'declined'].includes(
                      changeRequest.status ?? ''
                    )
                ).length;
                const branchEventIds = new Set(
                  branchStepRuns.map((step: any) => step.event_id).filter(Boolean)
                );
                const sharesEventWithOtherBranch =
                  branchEventIds.size > 0 &&
                  branches.some(
                    (otherBranch: any) =>
                      otherBranch.id !== branch.id &&
                      (otherBranch.step_runs ?? []).some((step: any) =>
                        branchEventIds.has(step.event_id)
                      )
                  );

                return (
                  <div key={branch.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <BadgeControl
                            variant={
                              branch.id === currentRun.active_branch_id ? 'default' : 'outline'
                            }
                            className={
                              branch.id === currentRun.active_branch_id
                                ? getInfoBadgeClassName('current')
                                : getInfoBadgeClassName('step')
                            }
                          >
                            {branch.id === currentRun.active_branch_id
                              ? t('features.amendments.process.activeBranchBadge')
                              : t('features.amendments.process.branchBadge')}
                          </BadgeControl>
                          <BadgeControl
                            variant={getBadgeVariant(branch.status)}
                            className={getStatusBadgeClassName(branch.status)}
                          >
                            {branch.status}
                          </BadgeControl>
                          {branch.resolution ? (
                            <BadgeControl
                              variant={getBadgeVariant(branch.resolution)}
                              className={getStatusBadgeClassName(branch.resolution)}
                            >
                              {branch.resolution}
                            </BadgeControl>
                          ) : null}
                          <BadgeControl
                            variant={branch.document_id ? 'secondary' : 'outline'}
                            className={cn('gap-1.5', getInfoBadgeClassName('step'))}
                          >
                            <FileText className="mr-1 h-3 w-3" />
                            {branch.document_id
                              ? t(
                                  'features.amendments.process.branchDocumentReady',
                                  'Text variant ready'
                                )
                              : t(
                                  'features.amendments.process.branchDocumentMissing',
                                  'No text variant'
                                )}
                          </BadgeControl>
                          <BadgeControl
                            variant={openChangeRequestCount > 0 ? 'secondary' : 'outline'}
                            className={getInfoBadgeClassName('count')}
                          >
                            {t(
                              'features.amendments.process.openChangeRequests',
                              { count: openChangeRequestCount },
                              'open change requests'
                            )}
                          </BadgeControl>
                          {sharesEventWithOtherBranch ? (
                            <BadgeControl
                              variant="secondary"
                              className={cn('gap-1.5', getInfoBadgeClassName('task'))}
                            >
                              <CalendarClock className="mr-1 h-3 w-3" />
                              {t('features.amendments.process.sharedEvent', 'shared event')}
                            </BadgeControl>
                          ) : null}
                        </div>
                        <p className="font-medium">
                          {branch.title ?? t('features.amendments.process.untitledBranch')}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {branchStepRuns.map((step: any, index: number) => (
                            <div key={step.id} className="flex items-center gap-2">
                              <BadgeControl
                                variant={getBadgeVariant(step.status)}
                                className={cn('gap-1.5', getStatusBadgeClassName(step.status))}
                              >
                                {step.target_group?.id && step.target_group?.name ? (
                                  <Link
                                    to="/group/$id"
                                    params={{ id: step.target_group.id }}
                                    className="inline-flex items-center gap-1 hover:underline"
                                  >
                                    <span>{step.target_group.name}</span>
                                    <ExternalLink className="h-3 w-3 opacity-60" />
                                  </Link>
                                ) : (
                                  <span>
                                    {step.target_group?.name ??
                                      step.workflow_step?.label ??
                                      `Step ${step.order_index + 1}`}
                                  </span>
                                )}
                              </BadgeControl>
                              {index < branchStepRuns.length - 1 ? (
                                <ArrowRight className="text-muted-foreground h-3 w-3" />
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex min-w-[12rem] flex-col gap-2">
                        {branchTasks.length > 0 ? (
                          <div className="rounded-lg border border-dashed p-3 text-xs">
                            <p className="font-medium">
                              {t('features.amendments.process.openTasks', {
                                count: branchTasks.length,
                              })}
                            </p>
                            <p className="text-muted-foreground mt-1">
                              {t('features.amendments.process.tasksNeedAttention', {
                                count: branchTasks.length,
                              })}
                            </p>
                          </div>
                        ) : null}
                        <Button
                          asChild
                          type="button"
                          variant="outline"
                          size="sm"
                          className="justify-start gap-2"
                        >
                          <Link
                            to="/amendment/$id/text"
                            params={{ id: amendmentId }}
                            search={{ branch: branch.id }}
                          >
                            <FileText className="h-4 w-4" />
                            {t('features.amendments.process.openTextVariant')}
                          </Link>
                        </Button>
                        {canManageProcess ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="justify-start gap-2"
                            onClick={() => openBranchEventEditor(branch)}
                          >
                            <Pencil className="h-4 w-4" />
                            {t('features.amendments.process.editEvents', 'Edit events')}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('features.amendments.process.groupDecisions')}
          </CardTitle>
          <CardDescription>
            {t('features.amendments.process.groupDecisionsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groupDecisions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t('features.amendments.process.noGroupDecisions')}
            </p>
          ) : (
            <div className="space-y-3">
              {groupDecisions.map((decision: any) => (
                <div key={decision.id} className="rounded-lg border p-4">
                  {(() => {
                    const visibleStatus =
                      normalizeGroupAmendmentDisplayStatus(decision.status) ?? decision.status;

                    return (
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          {decision.group?.id && decision.group?.name ? (
                            <Link
                              to="/group/$id"
                              params={{ id: decision.group.id }}
                              className="inline-flex items-center gap-1 font-medium hover:underline"
                            >
                              <span>{decision.group.name}</span>
                              <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                            </Link>
                          ) : (
                            <p className="font-medium">
                              {decision.group?.name ??
                                t('features.amendments.process.unknownGroup')}
                            </p>
                          )}
                          <p className="text-muted-foreground text-xs">
                            {formatDateTime(decision.decided_at ?? decision.updated_at)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <BadgeControl
                            variant={getBadgeVariant(visibleStatus)}
                            className={getStatusBadgeClassName(visibleStatus)}
                          >
                            {visibleStatus}
                          </BadgeControl>
                          {decision.process_run_id ? (
                            <BadgeControl
                              variant="outline"
                              className={getInfoBadgeClassName('step')}
                            >
                              {translateText('generated.inline.0018_run_df6ad190')}
                              {decision.process_run_id.slice(0, 8)}
                            </BadgeControl>
                          ) : null}
                          {decision.process_branch_id ? (
                            <BadgeControl
                              variant="outline"
                              className={getInfoBadgeClassName('step')}
                            >
                              {translateText('generated.inline.0019_branch_10d735e5')}
                              {decision.process_branch_id.slice(0, 8)}
                            </BadgeControl>
                          ) : null}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {historicalRuns.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('features.amendments.process.runHistory')}
            </CardTitle>
            <CardDescription>
              {t('features.amendments.process.runHistoryDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {historicalRuns.map((run: any) => (
              <div key={run.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <BadgeControl
                        variant={getBadgeVariant(run.status)}
                        className={getStatusBadgeClassName(run.status)}
                      >
                        {run.status}
                      </BadgeControl>
                      {run.selected_target_workflow?.name ? (
                        <BadgeControl
                          variant="secondary"
                          className={getInfoBadgeClassName('workflow')}
                        >
                          {run.selected_target_workflow.name}
                        </BadgeControl>
                      ) : null}
                    </div>
                    {run.selected_target_group?.id && run.selected_target_group?.name ? (
                      <Link
                        to="/group/$id"
                        params={{ id: run.selected_target_group.id }}
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                      >
                        <span>{run.selected_target_group.name}</span>
                        <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                      </Link>
                    ) : (
                      <p className="font-medium">
                        {run.selected_target_group?.name ??
                          t('features.amendments.process.unknownTarget')}
                      </p>
                    )}
                    <p className="text-muted-foreground text-xs">
                      {formatDateTime(run.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <BadgeControl variant="outline" className={getInfoBadgeClassName('count')}>
                      {t('features.amendments.process.branchCount', {
                        count: run.branches?.length ?? 0,
                      })}
                    </BadgeControl>
                    <BadgeControl
                      variant={
                        run.tasks?.some((task: any) => task.status !== 'completed')
                          ? 'secondary'
                          : 'outline'
                      }
                      className={
                        run.tasks?.some((task: any) => task.status !== 'completed')
                          ? getInfoBadgeClassName('task')
                          : getInfoBadgeClassName('step')
                      }
                    >
                      {t('features.amendments.process.openTasks', {
                        count:
                          run.tasks?.filter((task: any) => task.status !== 'completed').length ?? 0,
                      })}
                    </BadgeControl>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {canManageProcess ? (
        <Dialog
          open={Boolean(eventEditorBranch)}
          onOpenChange={open => {
            if (!open && !isReplanningBranchEvents) {
              closeBranchEventEditor();
            }
          }}
        >
          <ScrollableDialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {t('features.amendments.process.editBranchEventsTitle', 'Edit branch events')}
              </DialogTitle>
              <DialogDescription>
                {t(
                  'features.amendments.process.editBranchEventsDescription',
                  'Events can be changed after the last decided group in this branch.'
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {branchEventEditorRows.map(row => {
                const step = row.step;
                const currentEvent =
                  row.selectedEventId && step.event?.id === row.selectedEventId ? step.event : null;

                return (
                  <div key={step.id} className="rounded-lg border p-4">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <BadgeControl
                            variant="outline"
                            className={cn('gap-1.5', getInfoBadgeClassName('step'))}
                          >
                            {t('features.amendments.process.step')} {step.order_index + 1}
                          </BadgeControl>
                          <BadgeControl
                            variant={getBadgeVariant(step.status)}
                            className={getStatusBadgeClassName(step.status)}
                          >
                            {step.status}
                          </BadgeControl>
                          {row.isDecided ? (
                            <BadgeControl
                              variant="secondary"
                              className={cn('gap-1.5', getInfoBadgeClassName('current'))}
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              {t('features.amendments.process.decidedStep', 'Decided')}
                            </BadgeControl>
                          ) : null}
                        </div>
                        <p className="font-medium">
                          {step.target_group?.name ??
                            step.source_group?.name ??
                            step.workflow_step?.label ??
                            t('features.amendments.process.unknownGroup')}
                        </p>
                        {row.segment?.requiredAfter || row.segment?.requiredBefore ? (
                          <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
                            {row.segment?.requiredAfter ? (
                              <span>
                                {t('features.amendments.process.notBefore', 'Not before')}{' '}
                                {formatDateTime(row.segment.requiredAfter)}
                              </span>
                            ) : null}
                            {row.segment?.requiredBefore ? (
                              <span>
                                {t('features.amendments.process.notAfter', 'Not after')}{' '}
                                {formatDateTime(row.segment.requiredBefore)}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {row.editable ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          {row.eligibleEvents.length > 0 ? (
                            <TypeaheadSearch
                              items={toTypeaheadItems(
                                row.eligibleEvents,
                                'event',
                                (event: any) => event.title || 'Event',
                                (event: any) => formatDateTime(event.start_date),
                                undefined,
                                (event: any) => `/event/${event.id}`
                              )}
                              value={row.selectedEventId ?? undefined}
                              onChange={(item: TypeaheadItem | null) =>
                                updateBranchEventDraft(step.id, item?.id ?? null)
                              }
                              placeholder={t(
                                'features.amendments.process.selectEventForStep',
                                'Select event for this step'
                              )}
                              disablePortal
                            />
                          ) : (
                            <div className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
                              {t(
                                'features.amendments.process.noEligibleEventForStep',
                                'No eligible event found for this step.'
                              )}
                            </div>
                          )}
                        </div>
                        {row.selectedEventId ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => updateBranchEventDraft(step.id, null)}
                            aria-label={t('features.amendments.process.clearEvent', 'Clear event')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
                        {currentEvent?.title ??
                          step.event?.title ??
                          t('features.amendments.process.noEventSelected', 'No event selected')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <DialogFooter separator>
              <Button
                type="button"
                variant="outline"
                onClick={closeBranchEventEditor}
                disabled={isReplanningBranchEvents}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                onClick={saveBranchEventReplan}
                disabled={
                  isReplanningBranchEvents || !branchEventEditorRows.some(row => row.editable)
                }
              >
                {isReplanningBranchEvents
                  ? t('features.amendments.process.processing')
                  : t('features.amendments.process.saveEventChanges', 'Save event changes')}
              </Button>
            </DialogFooter>
          </ScrollableDialogContent>
        </Dialog>
      ) : null}

      {canManageProcess && user ? (
        <Dialog
          open={selectorOpen}
          onOpenChange={open => {
            if (processSubmissionActive) {
              return;
            }
            setSelectorOpen(open);
            if (!open) {
              setPendingSelection(null);
            }
          }}
        >
          <ScrollableDialogContent
            showCloseButton={!processSubmissionActive}
            className="flex h-screen w-screen max-w-none flex-col overflow-hidden rounded-none border-0 p-0 sm:h-screen sm:max-w-none"
          >
            {!processSubmissionActive ? (
              <>
                <DialogHeader>
                  <DialogTitle className="px-6 pt-6">
                    {currentRun
                      ? t(
                          'features.amendments.process.addAdditionalPathDialogTitle',
                          'Add additional path'
                        )
                      : t('features.amendments.process.startDialogTitle')}
                  </DialogTitle>
                  <DialogDescription className="px-6">
                    {currentRun
                      ? t(
                          'features.amendments.process.additionalPathSelectorDescription',
                          'Choose an unused start group and schedule the path to the current target.'
                        )
                      : t('features.amendments.process.selectorDescription')}
                  </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
                  <div className="space-y-6">
                    <TargetGroupEventSelector
                      userId={user.id}
                      collaborators={selectorCollaborators}
                      disablePortal
                      allowGroupWithoutEvent
                      allowSourceGroupAsTarget
                      excludedSourceGroupIds={currentRun ? existingBranchStartGroupIds : []}
                      fixedTargetGroupId={currentRun?.selected_target_group_id ?? null}
                      fixedWorkflowId={currentRun?.selected_target_workflow_id ?? null}
                      lockTargetSelection={Boolean(currentRun)}
                      layoutScope={
                        currentRun ? 'amendment-process-additional-path' : 'amendment-process-start'
                      }
                      selectedGroupId={currentRun?.selected_target_group_id ?? undefined}
                      selectedPathMode={currentRun ? currentRunPathMode : undefined}
                      selectedWorkflowId={currentRun?.selected_target_workflow_id ?? undefined}
                      onSelect={setPendingSelection}
                    />

                    {pendingSelection ? (
                      <TargetGroupEventDisplay
                        groupData={{
                          id: pendingSelection.groupData.id,
                          name: pendingSelection.groupData.name ?? null,
                          description: richTextToPlainText(pendingSelection.groupData.description),
                          member_count: pendingSelection.groupData.member_count ?? null,
                          event_count: pendingSelection.groupData.event_count ?? null,
                          amendment_count: pendingSelection.groupData.amendment_count ?? null,
                        }}
                        eventData={
                          pendingSelection.eventData
                            ? {
                                id: pendingSelection.eventData.id,
                                title: pendingSelection.eventData.title ?? null,
                                start_date: pendingSelection.eventData.start_date ?? null,
                                location_name: pendingSelection.eventData.location_name ?? null,
                                description: richTextToPlainText(
                                  pendingSelection.eventData.description
                                ),
                                participant_count:
                                  pendingSelection.eventData.participant_count ?? null,
                              }
                            : null
                        }
                        pathWithEvents={pendingSelection.pathWithEvents}
                      />
                    ) : (
                      <div className="border-border bg-muted/30 rounded-lg border border-dashed p-4 text-sm">
                        {t('features.amendments.process.selectorHint')}
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter separator className="px-6 py-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectorOpen(false);
                      setPendingSelection(null);
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button onClick={handleConfirmSelection} disabled={!pendingSelection || isSaving}>
                    {isSaving
                      ? t('features.amendments.process.processing')
                      : currentRun
                        ? t(
                            'features.amendments.process.confirmAdditionalPath',
                            'Add additional path'
                          )
                        : t('features.amendments.process.confirmStart')}
                  </Button>
                </DialogFooter>
              </>
            ) : null}
            <ActionSubmissionOverlay
              kind="process"
              status={processSubmission.status}
              steps={processSubmission.progressSteps}
              error={processSubmission.error}
              preview={{
                entityLabel: currentRun
                  ? t('features.amendments.process.addAdditionalPath', 'Add additional path')
                  : t('features.amendments.process.createPath', 'Create path'),
                title:
                  amendment?.title ??
                  (currentRun
                    ? t(
                        'features.amendments.process.addAdditionalPathDialogTitle',
                        'Add additional path'
                      )
                    : t('features.amendments.process.startDialogTitle')),
                description: pendingSelection?.eventData?.title
                  ? `${pendingSelection.groupData.name ?? pendingSelection.groupId} · ${
                      pendingSelection.eventData.title
                    }`
                  : (pendingSelection?.groupData.name ?? pendingSelection?.groupId),
                path:
                  pendingSelection?.pathWithEvents
                    ?.map(
                      (segment: any) => segment.group?.name ?? segment.groupName ?? segment.group_id
                    )
                    .filter(Boolean) ?? [],
                badges: [
                  pendingSelection?.pathMode === 'workflow' ? 'Workflow-Pfad' : 'Hierarchie-Pfad',
                ],
              }}
              target={{
                label: t('common.done', 'Fertig'),
                onClick: () => {
                  processSubmission.reset();
                  setSelectorOpen(false);
                  setPendingSelection(null);
                },
              }}
              onBack={processSubmission.reset}
              onRetry={() => void processSubmission.retry()}
            />
          </ScrollableDialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
