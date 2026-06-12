import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Button } from '@/features/shared/ui/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/features/shared/ui/ui/alert-dialog';
import { WorkflowEditor } from './WorkflowEditor';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { DraftWorkflowStep } from '../hooks/useWorkflowEditor';
import type { NormalizedGroupRelationship, NetworkGroupEntity } from '../types/network.types';
import type { WorkflowWithStepsRow } from '@/zero/network/queries';
import { GroupRelationshipNameTag } from './GroupRelationshipFields';
import { RightBadge } from './RightBadge';
import { ArrowRight, Clock, Pencil, Plus, Send, Trash2, Workflow } from 'lucide-react';

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

interface ManageWorkflowsTabProps {
  canManageWorkflows: boolean;
  groupId: string;
  groupName: string;
  allRelationships: NormalizedGroupRelationship[];
  incomingRequests: WorkflowWithStepsRow[];
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
  onSaveWorkflow: () => void;
  onDeleteWorkflow: (workflowId: string) => void;
  onApproveWorkflowApproval: (approvalId: string) => void;
  onRejectWorkflowApproval: (approvalId: string) => void;
}

function getWorkflowStatusClasses(status?: string | null) {
  switch (status) {
    case 'active':
      return 'border-0 bg-gradient-to-r from-emerald-500 to-teal-500 text-white';
    case 'rejected':
      return 'border-0 bg-gradient-to-r from-rose-500 to-red-500 text-white';
    default:
      return 'border-0 bg-gradient-to-r from-amber-400 to-orange-500 text-white';
  }
}

function getApprovalStatusClasses(status?: string | null) {
  switch (status) {
    case 'accepted':
      return 'border-0 bg-gradient-to-r from-emerald-500 to-teal-500 text-white';
    case 'rejected':
      return 'border-0 bg-gradient-to-r from-rose-500 to-red-500 text-white';
    default:
      return 'border-0 bg-gradient-to-r from-sky-500 to-indigo-500 text-white';
  }
}

function getWorkflowRoleClasses(role: 'final' | 'start' | 'co-owner') {
  switch (role) {
    case 'final':
      return 'border-0 bg-gradient-to-r from-emerald-500 to-teal-500 text-white';
    case 'start':
      return 'border-0 bg-gradient-to-r from-sky-500 to-violet-500 text-white';
    default:
      return 'border-0 bg-gradient-to-r from-fuchsia-500 to-amber-500 text-white';
  }
}

function getSectionCardClasses(section: 'incoming' | 'outgoing' | 'active') {
  switch (section) {
    case 'incoming':
      return 'border-primary/20 bg-primary/5';
    case 'outgoing':
      return 'border-amber-500/20 bg-amber-500/5';
    default:
      return 'border-emerald-500/20 bg-emerald-500/5';
  }
}

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
    <Badge className={getApprovalStatusClasses(args.approval.status)}>
      {approvalGroupName}: {args.approval.status}
    </Badge>
  );

  if (!approvalGroupId) {
    return badge;
  }

  return (
    <Link
      to="/group/$id"
      params={{ id: approvalGroupId }}
      className="focus-visible:ring-ring inline-flex rounded-full transition-transform duration-150 ease-out hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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
            <Badge variant="outline" className="bg-background/70 text-xs">
              {step.label}
            </Badge>
          ) : null}
        </span>
      ))}
    </div>
  );
}

export function ManageWorkflowsTab({
  canManageWorkflows,
  groupId,
  groupName,
  allRelationships,
  incomingRequests,
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

  const incomingRows = useMemo(
    () =>
      incomingRequests
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
    [groupId, incomingRequests]
  );
  const hasVisibleTables =
    incomingRows.length > 0 || outgoingRequests.length > 0 || activeRelevantWorkflows.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {t('features.network.workflows.title', 'Workflows')}
          </h3>
          <p className="text-muted-foreground text-sm">
            {t(
              'features.network.workflows.managementDescription',
              'Manage approvals, monitor outgoing requests, and maintain approved workflow definitions.'
            )}
          </p>
        </div>
        {canManageWorkflows ? (
          <Button onClick={onOpenNewWorkflow}>
            <Plus className="mr-2 h-4 w-4" />
            {t('features.network.workflows.create', 'New Workflow')}
          </Button>
        ) : null}
      </div>

      {!hasVisibleTables ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Workflow className="text-muted-foreground h-8 w-8" />
            <div className="space-y-1">
              <p className="font-medium">
                {t('features.network.workflows.emptyTitle', 'No workflow activity yet')}
              </p>
              <p className="text-muted-foreground text-sm">
                {t(
                  'features.network.workflows.emptyDescription',
                  'Create a workflow or wait for approval requests to see workflow tables here.'
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {incomingRows.length > 0 ? (
        <Card className={getSectionCardClasses('incoming')}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              {t('features.network.workflows.incomingRequests', 'Incoming requests')} (
              {incomingRows.length})
            </CardTitle>
            <CardDescription>
              {t(
                'features.network.workflows.incomingRequestsDescription',
                'Approve or reject workflow requests that involve this group.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name', 'Name')}</TableHead>
                    <TableHead>{t('common.group', 'Group')}</TableHead>
                    <TableHead>{t('features.network.workflows.startGroup', 'Start')}</TableHead>
                    <TableHead>{t('features.network.workflows.path', 'Path')}</TableHead>
                    <TableHead className="text-right">{t('common.actions.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomingRows.map(({ workflow, approval }) => (
                    <TableRow key={workflow.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">
                            {workflow.name ?? t('common.untitled', 'Untitled')}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Badge className={getWorkflowStatusClasses(workflow.status)}>
                              {workflow.status ?? 'pending_approval'}
                            </Badge>
                            <RightBadge right="amendmentRight" variant="outline" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {renderWorkflowGroupTag({
                          groupId: workflow.group?.id ?? workflow.group_id,
                          groupName: workflow.group?.name ?? workflow.group_id,
                          currentGroupId: groupId,
                        })}
                      </TableCell>
                      <TableCell>
                        {renderWorkflowGroupTag({
                          groupId: getWorkflowStartGroup(workflow).id,
                          groupName: getWorkflowStartGroup(workflow).name,
                          currentGroupId: groupId,
                        })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {renderWorkflowPath(workflow, groupId)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" onClick={() => onApproveWorkflowApproval(approval.id)}>
                            {t('common.actions.confirm', 'Confirm')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onRejectWorkflowApproval(approval.id)}
                          >
                            {t('common.actions.reject', 'Reject')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {outgoingRequests.length > 0 ? (
        <Card className={getSectionCardClasses('outgoing')}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4" />
              {t('features.network.workflows.outgoingRequests', 'Outgoing requests')} (
              {outgoingRequests.length})
            </CardTitle>
            <CardDescription>
              {t(
                'features.network.workflows.outgoingRequestsDescription',
                'Track workflow revisions submitted by this group that still need confirmations from others.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name', 'Name')}</TableHead>
                    <TableHead>{t('features.network.workflows.startGroup', 'Start')}</TableHead>
                    <TableHead>
                      {t('features.network.workflows.finalGroup', 'Final group')}
                    </TableHead>
                    <TableHead>{t('features.network.workflows.approvals', 'Approvals')}</TableHead>
                    <TableHead className="text-right">{t('common.actions.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outgoingRequests.map(workflow => (
                    <TableRow key={workflow.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">
                            {workflow.name ?? t('common.untitled', 'Untitled')}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Badge className={getWorkflowStatusClasses(workflow.status)}>
                              {workflow.status ?? 'pending_approval'}
                            </Badge>
                            <RightBadge right="amendmentRight" variant="outline" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {renderWorkflowGroupTag({
                          groupId: getWorkflowStartGroup(workflow).id,
                          groupName: getWorkflowStartGroup(workflow).name,
                          currentGroupId: groupId,
                        })}
                      </TableCell>
                      <TableCell>
                        {renderWorkflowGroupTag({
                          groupId: getWorkflowFinalGroup(workflow).id,
                          groupName: getWorkflowFinalGroup(workflow).name,
                          currentGroupId: groupId,
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {(workflow.approvals ?? [])
                            .filter(approval => approval.group_id !== groupId)
                            .map(approval => (
                              <div key={approval.id}>
                                {renderWorkflowApprovalTag({ approval, currentGroupId: groupId })}
                              </div>
                            ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {canManageWorkflows ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onOpenEditWorkflow(workflow)}
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">
                                {t('features.network.workflows.edit', 'Edit Workflow')}
                              </span>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">
                                    {t('common.actions.delete', 'Delete')}
                                  </span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {t(
                                      'features.network.workflows.deleteConfirm',
                                      'Delete workflow?'
                                    )}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t(
                                      'features.network.workflows.deleteDescription',
                                      'This will permanently delete this workflow and all approval requests.'
                                    )}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>
                                    {t('common.cancel', 'Cancel')}
                                  </AlertDialogCancel>
                                  <AlertDialogAction onClick={() => onDeleteWorkflow(workflow.id)}>
                                    {t('common.delete', 'Delete')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeRelevantWorkflows.length > 0 ? (
        <Card className={getSectionCardClasses('active')}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Workflow className="h-4 w-4" />
              {t('features.network.workflows.activeRelevant', 'Active workflows')} (
              {activeRelevantWorkflows.length})
            </CardTitle>
            <CardDescription>
              {t(
                'features.network.workflows.activeRelevantDescription',
                'Accepted participants co-own active workflows and can edit them from their own group page.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name', 'Name')}</TableHead>
                    <TableHead>{t('features.network.workflows.role', 'Role')}</TableHead>
                    <TableHead>{t('features.network.workflows.startGroup', 'Start')}</TableHead>
                    <TableHead>{t('features.network.workflows.path', 'Path')}</TableHead>
                    <TableHead className="text-right">{t('common.actions.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeRelevantWorkflows.map(workflow => {
                    const isFinalGroup = workflow.group_id === groupId;
                    const isStartGroup = workflow.start_group_id === groupId;
                    const role: 'final' | 'start' | 'co-owner' = isFinalGroup
                      ? 'final'
                      : isStartGroup
                        ? 'start'
                        : 'co-owner';

                    return (
                      <TableRow key={workflow.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">
                              {workflow.name ?? t('common.untitled', 'Untitled')}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Badge className={getWorkflowStatusClasses(workflow.status)}>
                                {workflow.status ?? 'active'}
                              </Badge>
                              <RightBadge right="amendmentRight" variant="outline" />
                              {workflow.is_default_entry ? (
                                <Badge variant="outline">
                                  {t(
                                    'features.network.workflows.defaultEntryBadge',
                                    'Default entry'
                                  )}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getWorkflowRoleClasses(role)}>
                            {isFinalGroup
                              ? t('features.network.workflows.roleFinalGroup', 'Final group')
                              : isStartGroup
                                ? t('features.network.workflows.roleStartGroup', 'Start group')
                                : t('features.network.workflows.roleCoOwner', 'Co-owner')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {renderWorkflowGroupTag({
                            groupId: getWorkflowStartGroup(workflow).id,
                            groupName: getWorkflowStartGroup(workflow).name,
                            currentGroupId: groupId,
                          })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {renderWorkflowPath(workflow, groupId)}
                        </TableCell>
                        <TableCell className="text-right">
                          {canManageWorkflows ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onOpenEditWorkflow(workflow)}
                              >
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">
                                  {t('features.network.workflows.edit', 'Edit Workflow')}
                                </span>
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">
                                      {t('common.actions.delete', 'Delete')}
                                    </span>
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      {t(
                                        'features.network.workflows.deleteConfirm',
                                        'Delete workflow?'
                                      )}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {t(
                                        'features.network.workflows.deleteDescription',
                                        'This will permanently delete this workflow and all approval requests.'
                                      )}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      {t('common.cancel', 'Cancel')}
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => onDeleteWorkflow(workflow.id)}
                                    >
                                      {t('common.delete', 'Delete')}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              {t(
                                'features.network.workflows.readOnlyNoPermission',
                                'Read-only without manage rights'
                              )}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
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
    </div>
  );
}
