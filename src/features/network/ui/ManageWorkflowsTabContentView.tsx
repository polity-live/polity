import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/features/shared/ui/ui/button';
import {
  ActionSubmissionOverlay,
  useActionSubmission,
  type ActionSubmissionContext,
} from '@/features/shared/ui/action-submission';
import { DataTable, type ColumnDef } from '@/features/shared/ui/data-table';
import { DangerConfirmDialog } from '@/features/shared/ui/dialog';
import { ManagementSection, ManagementToolbar, SearchField } from '@/features/shared/ui/form';
import { StatusBadge } from '@/features/shared/ui/status';
import { FilterToggleGroupItem } from '@/features/shared/ui/filter-controls';
import { ToggleGroup } from '@/features/shared/ui/ui/toggle-group';
import { WorkflowEditor } from '../ui/WorkflowEditor';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import type { DraftWorkflowStep } from '../hooks/useWorkflowEditor';
import type { NormalizedGroupRelationship, NetworkGroupEntity } from '../types/network.types';
import type { WorkflowWithStepsRow } from '@/zero/network/queries';
import { GroupRelationshipNameTag } from '../ui/GroupRelationshipFields';
import { RightBadge } from '@/features/shared/ui/status';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Pencil,
  Plus,
  Send,
  Trash2,
  Workflow,
} from 'lucide-react';

interface AvailableGroup {
  id: string;
  name: string | null;
  description?: unknown;
  group_type?: NetworkGroupEntity['group_type'] | null;
  member_count?: number | null;
  event_count?: number | null;
  amendment_count?: number | null;
}

interface AvailableWorkflow {
  id: string;
  group_id: string;
  name: string | null;
}

export interface ManageWorkflowsTabProps {
  canManageWorkflows: boolean;
  groupId: string;
  groupName: string;
  allRelationships: NormalizedGroupRelationship[];
  incomingRequests: WorkflowWithStepsRow[];
  acceptedPendingRequests: WorkflowWithStepsRow[];
  outgoingRequests: WorkflowWithStepsRow[];
  activeRelevantWorkflows: WorkflowWithStepsRow[];
  isWorkflowEditorOpen: boolean;
  editingWorkflow: WorkflowWithStepsRow | null;
  workflowDraftStartGroupId: string;
  onWorkflowDraftStartGroupIdChange: (groupId: string) => void;
  workflowDraftName: string;
  onWorkflowDraftNameChange: (name: string) => void;
  workflowDraftDescription: string;
  onWorkflowDraftDescriptionChange: (description: string) => void;
  workflowDraftIsDefaultEntry: boolean;
  onWorkflowDraftIsDefaultEntryChange: (value: boolean) => void;
  workflowDraftSteps: DraftWorkflowStep[];
  availableGroups: AvailableGroup[];
  availableWorkflows: AvailableWorkflow[];
  onOpenNewWorkflow: () => void;
  onOpenEditWorkflow: (workflow: WorkflowWithStepsRow) => void;
  onCloseWorkflowEditor: () => void;
  onAddWorkflowStep: (step: DraftWorkflowStep) => void;
  onUpdateWorkflowStep: (index: number, patch: Partial<DraftWorkflowStep>) => void;
  onRemoveWorkflowStep: (index: number) => void;
  onMoveWorkflowStep: (fromIndex: number, toIndex: number) => void;
  onSaveWorkflow: (submissionContext?: ActionSubmissionContext) => void;
  onDeleteWorkflow: (workflowId: string) => void;
  onApproveWorkflowApproval: (
    approvalId: string,
    submissionContext?: ActionSubmissionContext
  ) => void;
  onRejectWorkflowApproval: (
    approvalId: string,
    submissionContext?: ActionSubmissionContext
  ) => void;
}

type WorkflowStatusFilter = 'all' | 'pending_approval' | 'active' | 'rejected' | 'archived';

const WORKFLOW_STATUS_FILTERS: WorkflowStatusFilter[] = [
  'all',
  'pending_approval',
  'active',
  'rejected',
  'archived',
];

function getSortedWorkflowSteps(workflow: WorkflowWithStepsRow) {
  return [...(workflow.steps ?? [])].sort(
    (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
  );
}

function getWorkflowStartGroup(workflow: WorkflowWithStepsRow) {
  return {
    id:
      workflow.start_group?.id ??
      workflow.start_group_id ??
      workflow.group?.id ??
      workflow.group_id,
    name:
      workflow.start_group?.name ??
      workflow.start_group_id ??
      workflow.group?.name ??
      workflow.group_id,
  };
}

function getWorkflowFinalGroup(workflow: WorkflowWithStepsRow) {
  const sortedSteps = getSortedWorkflowSteps(workflow);
  const lastStep = sortedSteps[sortedSteps.length - 1];
  return {
    id: lastStep?.group?.id ?? lastStep?.group_id ?? workflow.group?.id ?? workflow.group_id,
    name: lastStep?.group?.name ?? workflow.group?.name ?? workflow.group_id,
  };
}

function collectWorkflowGroupSearchValues(workflow: WorkflowWithStepsRow) {
  const startGroup = getWorkflowStartGroup(workflow);
  const finalGroup = getWorkflowFinalGroup(workflow);
  const values = [
    startGroup.id,
    startGroup.name,
    finalGroup.id,
    finalGroup.name,
    workflow.group?.id,
    workflow.group?.name,
    workflow.group_id,
    ...getSortedWorkflowSteps(workflow).flatMap(step => [
      step.group_id,
      step.group?.id,
      step.group?.name,
    ]),
    ...(workflow.approvals ?? []).flatMap(approval => [
      approval.group_id,
      approval.group?.id,
      approval.group?.name,
      approval.requested_by_group_id,
      approval.requested_by_group?.id,
      approval.requested_by_group?.name,
    ]),
  ];

  return values.filter((value): value is string => typeof value === 'string' && value.length > 0);
}

function matchesWorkflowFilters(
  workflow: WorkflowWithStepsRow,
  statusFilter: WorkflowStatusFilter,
  normalizedSearchQuery: string
) {
  const workflowStatus = workflow.status ?? 'pending_approval';
  if (statusFilter !== 'all' && workflowStatus !== statusFilter) {
    return false;
  }

  if (!normalizedSearchQuery) {
    return true;
  }

  return collectWorkflowGroupSearchValues(workflow).some(value =>
    value.toLowerCase().includes(normalizedSearchQuery)
  );
}

function renderWorkflowGroupTag(args: {
  groupId: string | null | undefined;
  groupName: string | null | undefined;
  currentGroupId: string;
}) {
  const resolvedGroupId = args.groupId ?? undefined;
  const resolvedName = args.groupName ?? args.groupId ?? 'Group';

  return (
    <div className="max-w-[14rem]">
      <GroupRelationshipNameTag
        name={resolvedName}
        kind={resolvedGroupId === args.currentGroupId ? 'current' : 'selected'}
        groupId={resolvedGroupId}
        displayMode="name-only"
      />
    </div>
  );
}

function renderWorkflowApprovalTag(args: {
  approval: WorkflowWithStepsRow['approvals'][number];
  currentGroupId: string;
}) {
  const approvalGroupId = args.approval.group?.id ?? args.approval.group_id ?? undefined;
  const approvalGroupName = (args.approval.group?.name ?? args.approval.group_id) || 'Group';

  const badge = (
    <StatusBadge status={args.approval.status}>
      {approvalGroupName}: {args.approval.status}
    </StatusBadge>
  );

  if (!approvalGroupId) {
    return badge;
  }

  return (
    <Link
      to="/group/$id"
      params={{ id: approvalGroupId }}
      className="focus-visible:ring-ring inline-flex rounded-md transition-transform duration-150 ease-out hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {badge}
    </Link>
  );
}

function renderWorkflowPath(workflow: WorkflowWithStepsRow, currentGroupId: string) {
  const startGroup = getWorkflowStartGroup(workflow);
  const sortedSteps = getSortedWorkflowSteps(workflow);

  return (
    <div className="flex max-w-[28rem] flex-wrap items-center gap-2">
      {renderWorkflowGroupTag({
        groupId: startGroup.id,
        groupName: startGroup.name,
        currentGroupId,
      })}
      {sortedSteps.map((step, index) => (
        <span
          key={step.id ?? `${step.group_id}-${index}`}
          className="flex flex-wrap items-center gap-2"
        >
          <ArrowRight className="text-muted-foreground h-3.5 w-3.5" />
          {renderWorkflowGroupTag({
            groupId: step.group?.id ?? step.group_id,
            groupName: step.group?.name ?? step.group_id,
            currentGroupId,
          })}
          {step.label ? (
            <StatusBadge status="workflow-step" tone="outline" className="bg-background/70 text-xs">
              {step.label}
            </StatusBadge>
          ) : null}
        </span>
      ))}
    </div>
  );
}

export function ManageWorkflowsTabContentView({
  canManageWorkflows,
  groupId,
  groupName,
  allRelationships,
  incomingRequests,
  acceptedPendingRequests,
  outgoingRequests,
  activeRelevantWorkflows,
  isWorkflowEditorOpen,
  editingWorkflow,
  workflowDraftStartGroupId,
  onWorkflowDraftStartGroupIdChange,
  workflowDraftName,
  onWorkflowDraftNameChange,
  workflowDraftDescription,
  onWorkflowDraftDescriptionChange,
  workflowDraftIsDefaultEntry,
  onWorkflowDraftIsDefaultEntryChange,
  workflowDraftSteps,
  availableGroups,
  availableWorkflows,
  onOpenNewWorkflow,
  onOpenEditWorkflow,
  onCloseWorkflowEditor,
  onAddWorkflowStep,
  onUpdateWorkflowStep,
  onRemoveWorkflowStep,
  onMoveWorkflowStep,
  onSaveWorkflow,
  onDeleteWorkflow,
  onApproveWorkflowApproval,
  onRejectWorkflowApproval,
}: ManageWorkflowsTabProps) {
  const { t } = useTranslation();
  const approvalSubmission = useActionSubmission('accept');
  const [workflowSearchQuery, setWorkflowSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkflowStatusFilter>('all');
  const [approvalPreview, setApprovalPreview] = useState<{
    title: string;
    path: string[];
  } | null>(null);
  const normalizedSearchQuery = workflowSearchQuery.trim().toLowerCase();

  const statusFilterLabels: Record<WorkflowStatusFilter, string> = {
    all: t('features.network.workflows.filters.allStatuses', 'All statuses'),
    pending_approval: t('features.network.workflows.filters.pendingApproval', 'Pending approval'),
    active: t('features.network.workflows.filters.active', 'Active'),
    rejected: t('features.network.workflows.filters.rejected', 'Rejected'),
    archived: t('features.network.workflows.filters.archived', 'Archived'),
  };

  const filteredIncomingRequests = useMemo(
    () =>
      incomingRequests.filter(workflow =>
        matchesWorkflowFilters(workflow, statusFilter, normalizedSearchQuery)
      ),
    [incomingRequests, normalizedSearchQuery, statusFilter]
  );

  const filteredAcceptedPendingRequests = useMemo(
    () =>
      acceptedPendingRequests.filter(workflow =>
        matchesWorkflowFilters(workflow, statusFilter, normalizedSearchQuery)
      ),
    [acceptedPendingRequests, normalizedSearchQuery, statusFilter]
  );

  const filteredOutgoingRequests = useMemo(
    () =>
      outgoingRequests.filter(workflow =>
        matchesWorkflowFilters(workflow, statusFilter, normalizedSearchQuery)
      ),
    [outgoingRequests, normalizedSearchQuery, statusFilter]
  );

  const filteredActiveRelevantWorkflows = useMemo(
    () =>
      activeRelevantWorkflows.filter(workflow =>
        matchesWorkflowFilters(workflow, statusFilter, normalizedSearchQuery)
      ),
    [activeRelevantWorkflows, normalizedSearchQuery, statusFilter]
  );

  const incomingRows = useMemo(
    () =>
      filteredIncomingRequests
        .map(workflow => ({
          workflow,
          approval:
            (workflow.approvals ?? []).find(approval => approval.group_id === groupId) ?? null,
        }))
        .filter(
          (
            entry
          ): entry is {
            workflow: WorkflowWithStepsRow;
            approval: NonNullable<typeof entry.approval>;
          } => Boolean(entry.approval)
        ),
    [filteredIncomingRequests, groupId]
  );
  const hasAnyTables =
    incomingRequests.length > 0 ||
    acceptedPendingRequests.length > 0 ||
    outgoingRequests.length > 0 ||
    activeRelevantWorkflows.length > 0;
  const hasVisibleTables =
    incomingRows.length > 0 ||
    filteredAcceptedPendingRequests.length > 0 ||
    filteredOutgoingRequests.length > 0 ||
    filteredActiveRelevantWorkflows.length > 0;

  type IncomingWorkflowRow = (typeof incomingRows)[number];

  const renderWorkflowTitleCell = (workflow: WorkflowWithStepsRow, fallbackStatus: string) => (
    <div className="space-y-1">
      <p className="font-medium">{workflow.name ?? t('common.untitled')}</p>
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={workflow.status ?? fallbackStatus}>
          {workflow.status ?? fallbackStatus}
        </StatusBadge>
        <RightBadge right="amendmentRight" variant="outline" />
        {workflow.is_default_entry ? (
          <StatusBadge status="default" tone="outline">
            {t('features.network.workflows.defaultEntryBadge')}
          </StatusBadge>
        ) : null}
      </div>
    </div>
  );

  const renderWorkflowDeleteAction = (workflow: WorkflowWithStepsRow) => (
    <DangerConfirmDialog
      trigger={
        <Button variant="ghost" size="icon">
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">{t('common.actions.delete')}</span>
        </Button>
      }
      title={t('features.network.workflows.deleteConfirm')}
      description={t('features.network.workflows.deleteDescription')}
      cancelLabel={t('common.cancel')}
      confirmLabel={t('common.delete')}
      onConfirm={() => onDeleteWorkflow(workflow.id)}
    />
  );

  const handleApproveWorkflow = (
    workflow: WorkflowWithStepsRow,
    approval: WorkflowWithStepsRow['approvals'][number]
  ) => {
    const startGroup = getWorkflowStartGroup(workflow);
    const path = [
      startGroup.name,
      ...getSortedWorkflowSteps(workflow).map(step => step.group?.name ?? step.group_id),
    ].filter(Boolean);

    setApprovalPreview({
      title: workflow.name ?? t('common.untitled'),
      path,
    });

    void approvalSubmission
      .runActionWithSubmission(async context => onApproveWorkflowApproval(approval.id, context), {
        onSuccess: approvalSubmission.reset,
      })
      .catch(() => undefined);
  };

  const handleRejectWorkflow = (
    workflow: WorkflowWithStepsRow,
    approval: WorkflowWithStepsRow['approvals'][number]
  ) => {
    const startGroup = getWorkflowStartGroup(workflow);
    const path = [
      startGroup.name,
      ...getSortedWorkflowSteps(workflow).map(step => step.group?.name ?? step.group_id),
    ].filter(Boolean);

    setApprovalPreview({
      title: workflow.name ?? t('common.untitled'),
      path,
    });

    void approvalSubmission
      .runActionWithSubmission(async context => onRejectWorkflowApproval(approval.id, context), {
        onSuccess: approvalSubmission.reset,
      })
      .catch(() => undefined);
  };

  const incomingColumns: ColumnDef<IncomingWorkflowRow>[] = [
    {
      id: 'name',
      header: t('common.name'),
      cell: ({ row }) => renderWorkflowTitleCell(row.original.workflow, 'pending_approval'),
    },
    {
      id: 'group',
      header: t('common.group'),
      cell: ({ row }) =>
        renderWorkflowGroupTag({
          groupId: row.original.workflow.group?.id ?? row.original.workflow.group_id,
          groupName: row.original.workflow.group?.name ?? row.original.workflow.group_id,
          currentGroupId: groupId,
        }),
    },
    {
      id: 'start-group',
      header: t('features.network.workflows.startGroup'),
      cell: ({ row }) =>
        renderWorkflowGroupTag({
          groupId: getWorkflowStartGroup(row.original.workflow).id,
          groupName: getWorkflowStartGroup(row.original.workflow).name,
          currentGroupId: groupId,
        }),
    },
    {
      id: 'path',
      header: t('features.network.workflows.path'),
      cell: ({ row }) => renderWorkflowPath(row.original.workflow, groupId),
    },
    {
      id: 'actions',
      header: t('common.actions.actions'),
      meta: {
        headerClassName: 'text-right',
        cellClassName: 'text-right',
      },
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            disabled={approvalSubmission.isActive}
            onClick={() => handleApproveWorkflow(row.original.workflow, row.original.approval)}
          >
            {t('common.actions.confirm')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={approvalSubmission.isActive}
            onClick={() => handleRejectWorkflow(row.original.workflow, row.original.approval)}
          >
            {t('common.actions.reject')}
          </Button>
        </div>
      ),
    },
  ];

  const outgoingColumns: ColumnDef<WorkflowWithStepsRow>[] = [
    {
      id: 'name',
      header: t('common.name'),
      cell: ({ row }) => renderWorkflowTitleCell(row.original, 'pending_approval'),
    },
    {
      id: 'start-group',
      header: t('features.network.workflows.startGroup'),
      cell: ({ row }) =>
        renderWorkflowGroupTag({
          groupId: getWorkflowStartGroup(row.original).id,
          groupName: getWorkflowStartGroup(row.original).name,
          currentGroupId: groupId,
        }),
    },
    {
      id: 'final-group',
      header: t('features.network.workflows.finalGroup'),
      cell: ({ row }) =>
        renderWorkflowGroupTag({
          groupId: getWorkflowFinalGroup(row.original).id,
          groupName: getWorkflowFinalGroup(row.original).name,
          currentGroupId: groupId,
        }),
    },
    {
      id: 'approvals',
      header: t('features.network.workflows.approvals'),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          {(row.original.approvals ?? [])
            .filter(approval => approval.group_id !== groupId)
            .map(approval => (
              <div key={approval.id}>
                {renderWorkflowApprovalTag({ approval, currentGroupId: groupId })}
              </div>
            ))}
        </div>
      ),
    },
    ...(canManageWorkflows
      ? [
          {
            id: 'actions',
            header: t('common.actions.actions'),
            meta: {
              headerClassName: 'text-right',
              cellClassName: 'text-right',
            },
            cell: ({ row }) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenEditWorkflow(row.original)}
                >
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">{t('features.network.workflows.edit')}</span>
                </Button>
                {renderWorkflowDeleteAction(row.original)}
              </div>
            ),
          } satisfies ColumnDef<WorkflowWithStepsRow>,
        ]
      : []),
  ];

  const acceptedPendingColumns: ColumnDef<WorkflowWithStepsRow>[] = [
    {
      id: 'name',
      header: t('common.name'),
      cell: ({ row }) => renderWorkflowTitleCell(row.original, 'pending_approval'),
    },
    {
      id: 'start-group',
      header: t('features.network.workflows.startGroup'),
      cell: ({ row }) =>
        renderWorkflowGroupTag({
          groupId: getWorkflowStartGroup(row.original).id,
          groupName: getWorkflowStartGroup(row.original).name,
          currentGroupId: groupId,
        }),
    },
    {
      id: 'final-group',
      header: t('features.network.workflows.finalGroup'),
      cell: ({ row }) =>
        renderWorkflowGroupTag({
          groupId: getWorkflowFinalGroup(row.original).id,
          groupName: getWorkflowFinalGroup(row.original).name,
          currentGroupId: groupId,
        }),
    },
    {
      id: 'approvals',
      header: t('features.network.workflows.approvals'),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          {(row.original.approvals ?? []).map(approval => (
            <div key={approval.id}>
              {renderWorkflowApprovalTag({ approval, currentGroupId: groupId })}
            </div>
          ))}
        </div>
      ),
    },
  ];

  const activeColumns: ColumnDef<WorkflowWithStepsRow>[] = [
    {
      id: 'name',
      header: t('common.name'),
      cell: ({ row }) =>
        renderWorkflowTitleCell(
          row.original,
          translateText('generated.inline.0045_active_2bb6b986')
        ),
    },
    {
      id: 'role',
      header: t('features.network.workflows.role'),
      cell: ({ row }) => {
        const isFinalGroup = row.original.group_id === groupId;
        const isStartGroup = row.original.start_group_id === groupId;
        const role: 'final' | 'start' | 'co-owner' = isFinalGroup
          ? 'final'
          : isStartGroup
            ? 'start'
            : 'co-owner';

        return (
          <StatusBadge
            status={role}
            tone={role === 'final' ? 'success' : role === 'start' ? 'info' : 'accent'}
          >
            {isFinalGroup
              ? t('features.network.workflows.roleFinalGroup')
              : isStartGroup
                ? t('features.network.workflows.roleStartGroup')
                : t('features.network.workflows.roleCoOwner')}
          </StatusBadge>
        );
      },
    },
    {
      id: 'start-group',
      header: t('features.network.workflows.startGroup'),
      cell: ({ row }) =>
        renderWorkflowGroupTag({
          groupId: getWorkflowStartGroup(row.original).id,
          groupName: getWorkflowStartGroup(row.original).name,
          currentGroupId: groupId,
        }),
    },
    {
      id: 'path',
      header: t('features.network.workflows.path'),
      cell: ({ row }) => renderWorkflowPath(row.original, groupId),
    },
    {
      id: 'actions',
      header: t('common.actions.actions'),
      meta: {
        headerClassName: 'text-right',
        cellClassName: 'text-right',
      },
      cell: ({ row }) =>
        canManageWorkflows ? (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={() => onOpenEditWorkflow(row.original)}>
              <Pencil className="h-4 w-4" />
              <span className="sr-only">{t('features.network.workflows.edit')}</span>
            </Button>
            {renderWorkflowDeleteAction(row.original)}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">
            {t('features.network.workflows.readOnlyNoPermission')}
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 px-3 sm:flex-row sm:items-start sm:justify-between sm:px-4">
        <div className="max-w-2xl space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">
            {t('features.network.workflows.title')}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t('features.network.workflows.managementDescription')}
          </p>
        </div>
        {canManageWorkflows ? (
          <Button onClick={onOpenNewWorkflow}>
            <Plus className="mr-2 h-4 w-4" />
            {t('features.network.workflows.create')}
          </Button>
        ) : null}
      </header>

      {hasAnyTables ? (
        <ManagementToolbar className="md:items-end">
          <SearchField
            fieldClassName="min-w-0 flex-1 md:max-w-md"
            placeholder={t(
              'features.network.workflows.filters.groupSearchPlaceholder',
              'Search involved groups...'
            )}
            value={workflowSearchQuery}
            onValueChange={setWorkflowSearchQuery}
            clearLabel={t('features.network.workflows.filters.clearSearch', 'Clear search')}
          />
          <ToggleGroup
            type="single"
            variant="outline"
            className="flex flex-wrap justify-start"
            value={statusFilter}
            onValueChange={value => {
              if (value) {
                setStatusFilter(value as WorkflowStatusFilter);
              }
            }}
          >
            {WORKFLOW_STATUS_FILTERS.map(filter => (
              <FilterToggleGroupItem
                key={filter}
                value={filter}
                aria-label={statusFilterLabels[filter]}
              >
                {statusFilterLabels[filter]}
              </FilterToggleGroupItem>
            ))}
          </ToggleGroup>
        </ManagementToolbar>
      ) : null}

      {!hasAnyTables ? (
        <div className="border-border/60 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
          <Workflow className="text-muted-foreground h-8 w-8" />
          <div className="space-y-1">
            <p className="font-medium">{t('features.network.workflows.emptyTitle')}</p>
            <p className="text-muted-foreground text-sm">
              {t('features.network.workflows.emptyDescription')}
            </p>
          </div>
        </div>
      ) : null}

      {hasAnyTables && !hasVisibleTables ? (
        <div className="border-border/60 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
          <Workflow className="text-muted-foreground h-8 w-8" />
          <div className="space-y-1">
            <p className="font-medium">
              {t('features.network.workflows.filters.emptyTitle', 'No matching workflows')}
            </p>
            <p className="text-muted-foreground text-sm">
              {t(
                'features.network.workflows.filters.emptyDescription',
                'No workflows match the selected status or group search.'
              )}
            </p>
          </div>
        </div>
      ) : null}

      {incomingRows.length > 0 ? (
        <ManagementSection
          title={
            <span className="flex flex-wrap items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{t('features.network.workflows.incomingRequests')}</span>
              <StatusBadge status="pending" tone="outline">
                {incomingRows.length}
              </StatusBadge>
            </span>
          }
          description={t('features.network.workflows.incomingRequestsDescription')}
        >
          <DataTable
            columns={incomingColumns}
            data={incomingRows}
            getRowId={row => row.workflow.id}
            enablePagination={false}
          />
        </ManagementSection>
      ) : null}

      {filteredAcceptedPendingRequests.length > 0 ? (
        <ManagementSection
          title={
            <span className="flex flex-wrap items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {t('features.network.workflows.acceptedPending', 'Accepted, waiting for others')}
              </span>
              <StatusBadge status="accepted" tone="outline">
                {filteredAcceptedPendingRequests.length}
              </StatusBadge>
            </span>
          }
          description={t(
            'features.network.workflows.acceptedPendingDescription',
            'Workflow requests this group accepted that still need confirmations from other groups.'
          )}
        >
          <DataTable
            columns={acceptedPendingColumns}
            data={filteredAcceptedPendingRequests}
            getRowId={workflow => workflow.id}
            enablePagination={false}
          />
        </ManagementSection>
      ) : null}

      {filteredOutgoingRequests.length > 0 ? (
        <ManagementSection
          title={
            <span className="flex flex-wrap items-center gap-2">
              <Send className="h-4 w-4" />
              <span>{t('features.network.workflows.outgoingRequests')}</span>
              <StatusBadge status="outgoing" tone="outline">
                {filteredOutgoingRequests.length}
              </StatusBadge>
            </span>
          }
          description={t('features.network.workflows.outgoingRequestsDescription')}
        >
          <DataTable
            columns={outgoingColumns}
            data={filteredOutgoingRequests}
            getRowId={workflow => workflow.id}
            enablePagination={false}
          />
        </ManagementSection>
      ) : null}

      {filteredActiveRelevantWorkflows.length > 0 ? (
        <ManagementSection
          title={
            <span className="flex flex-wrap items-center gap-2">
              <Workflow className="h-4 w-4" />
              <span>{t('features.network.workflows.activeRelevant')}</span>
              <StatusBadge status="active" tone="outline">
                {filteredActiveRelevantWorkflows.length}
              </StatusBadge>
            </span>
          }
          description={t('features.network.workflows.activeRelevantDescription')}
        >
          <DataTable
            columns={activeColumns}
            data={filteredActiveRelevantWorkflows}
            getRowId={workflow => workflow.id}
            enablePagination={false}
          />
        </ManagementSection>
      ) : null}

      <WorkflowEditor
        currentGroupId={groupId}
        currentGroupName={groupName}
        allRelationships={allRelationships}
        isOpen={isWorkflowEditorOpen}
        editingWorkflow={editingWorkflow}
        draftStartGroupId={workflowDraftStartGroupId}
        setDraftStartGroupId={onWorkflowDraftStartGroupIdChange}
        draftName={workflowDraftName}
        setDraftName={onWorkflowDraftNameChange}
        draftDescription={workflowDraftDescription}
        setDraftDescription={onWorkflowDraftDescriptionChange}
        draftIsDefaultEntry={workflowDraftIsDefaultEntry}
        setDraftIsDefaultEntry={onWorkflowDraftIsDefaultEntryChange}
        draftSteps={workflowDraftSteps}
        availableGroups={availableGroups}
        availableWorkflows={availableWorkflows}
        onClose={onCloseWorkflowEditor}
        onAddStep={onAddWorkflowStep}
        onUpdateStep={onUpdateWorkflowStep}
        onRemoveStep={onRemoveWorkflowStep}
        onMoveStep={onMoveWorkflowStep}
        onSave={onSaveWorkflow}
      />
      <ActionSubmissionOverlay
        kind="accept"
        status={approvalSubmission.status}
        steps={approvalSubmission.progressSteps}
        error={approvalSubmission.error}
        preview={{
          entityLabel: t('features.network.workflows.incomingRequests'),
          title: approvalPreview?.title ?? t('features.network.workflows.title'),
          description: t('features.network.workflows.incomingRequestsDescription'),
          path: approvalPreview?.path,
        }}
        target={{ label: t('common.done', 'Fertig'), onClick: approvalSubmission.reset }}
        onBack={approvalSubmission.reset}
        onRetry={() => void approvalSubmission.retry()}
      />
    </div>
  );
}
