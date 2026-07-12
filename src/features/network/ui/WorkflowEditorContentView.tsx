'use client';

import { BadgeControl } from '@/features/shared/ui/status';
import {
  FormControlInput,
  FormControlTextarea,
  FormControlLabel,
  FormControlSelect,
  FormControlSwitch,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';
import {
  ManagementDialogBody,
  ManagementDialogContent,
  ManagementDialogFooter,
  ManagementDialogHeader,
  ManagementDialogSection,
} from '@/features/shared/ui/dialog';
import { Dialog, DialogDescription, DialogTitle } from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/features/shared/ui/ui/accordion';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  ActionSubmissionOverlay,
  useActionSubmission,
  type ActionSubmissionContext,
} from '@/features/shared/ui/action-submission';
import type { DraftWorkflowStep } from '../hooks/useWorkflowEditor';
import type { WorkflowWithStepsRow } from '@/zero/network/queries';
import type { NormalizedGroupRelationship, NetworkGroupEntity } from '../types/network.types';
import { GroupNetworkFlow } from '../ui/GroupNetworkFlow';
import { WorkflowFlowVisualization } from '../ui/WorkflowFlowVisualization';
import {
  ArrowRight,
  GripVertical,
  List,
  MapPinned,
  Network,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
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
  status?: string | null;
}

export interface WorkflowEditorProps {
  currentGroupId: string;
  currentGroupName: string;
  allRelationships: NormalizedGroupRelationship[];
  isOpen: boolean;
  editingWorkflow: WorkflowWithStepsRow | null;
  draftStartGroupId: string;
  setDraftStartGroupId: (groupId: string) => void;
  draftName: string;
  setDraftName: (name: string) => void;
  draftDescription: string;
  setDraftDescription: (description: string) => void;
  draftIsDefaultEntry: boolean;
  setDraftIsDefaultEntry: (value: boolean) => void;
  draftSteps: DraftWorkflowStep[];
  availableGroups: AvailableGroup[];
  availableWorkflows: AvailableWorkflow[];
  onClose: () => void;
  onAddStep: (step: DraftWorkflowStep) => void;
  onUpdateStep: (index: number, patch: Partial<DraftWorkflowStep>) => void;
  onRemoveStep: (index: number) => void;
  onMoveStep: (fromIndex: number, toIndex: number) => void;
  onSave: (submissionContext?: ActionSubmissionContext) => void;
}
function getGroupName(groupId: string, availableGroups: AvailableGroup[]) {
  return availableGroups.find(group => group.id === groupId)?.name ?? groupId;
}
export interface WorkflowEditorContentViewProps {
  allGroupItems: any;
  availableGroups: any;
  builderTab: any;
  canSave: any;
  currentGroupId: any;
  currentGroupName: any;
  draftDescription: any;
  draftIsDefaultEntry: any;
  draftName: any;
  draftStartGroupId: any;
  draftSteps: any;
  editingWorkflow: any;
  finalTargetGroupId: any;
  getDirectTargetGroups: any;
  graphRootGroupId: any;
  graphSelectionMode: any;
  handleAddPendingStep: any;
  handleGraphGroupClick: any;
  handleRowDrop: any;
  handleRowTargetChange: any;
  invalidTransitionIndexes: any;
  isOpen: any;
  isPendingStepValid: any;
  onClose: any;
  onMoveStep: any;
  onRemoveStep: any;
  onSave: any;
  pendingHighlightGroupIds: any;
  pendingSourceGroupId: any;
  pendingTargetGroupId: any;
  pendingTargetItems: any;
  previewWorkflow: any;
  setBuilderTab: any;
  setDraftDescription: any;
  setDraftIsDefaultEntry: any;
  setDraftName: any;
  setDraftStartGroupId: any;
  setDraggedStepIndex: any;
  setGraphSelectionMode: any;
  setPendingTargetGroupId: any;
  setVisualizationTab: any;
  t: any;
  validationMessages: any;
  visualizationTab: any;
}

export function WorkflowEditorContentView({
  allGroupItems,
  availableGroups,
  builderTab,
  canSave,
  currentGroupId,
  currentGroupName,
  draftDescription,
  draftIsDefaultEntry,
  draftName,
  draftStartGroupId,
  draftSteps,
  editingWorkflow,
  finalTargetGroupId,
  getDirectTargetGroups,
  graphRootGroupId,
  graphSelectionMode,
  handleAddPendingStep,
  handleGraphGroupClick,
  handleRowDrop,
  handleRowTargetChange,
  invalidTransitionIndexes,
  isOpen,
  isPendingStepValid,
  onClose,
  onMoveStep,
  onRemoveStep,
  onSave,
  pendingHighlightGroupIds,
  pendingSourceGroupId,
  pendingTargetGroupId,
  pendingTargetItems,
  previewWorkflow,
  setBuilderTab,
  setDraftDescription,
  setDraftIsDefaultEntry,
  setDraftName,
  setDraftStartGroupId,
  setDraggedStepIndex,
  setGraphSelectionMode,
  setPendingTargetGroupId,
  setVisualizationTab,
  validationMessages,
  visualizationTab,
}: WorkflowEditorContentViewProps) {
  const { t } = useTranslation();
  const actionSubmission = useActionSubmission('workflow');
  const submissionActive = actionSubmission.isActive;
  const workflowPath = [
    draftStartGroupId ? getGroupName(draftStartGroupId, availableGroups) : null,
    ...draftSteps.map((step: any) => getGroupName(step.group_id, availableGroups)),
  ].filter(Boolean);

  const handleSaveWithSubmission = () => {
    void actionSubmission
      .runActionWithSubmission(async context => onSave(context), {
        onSuccess: () => {
          actionSubmission.reset();
          onClose();
        },
      })
      .catch(() => undefined);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) {
          onClose();
        }
      }}
    >
      <ManagementDialogContent
        showCloseButton={!submissionActive}
        className={
          submissionActive
            ? 'h-dvh max-h-none w-screen max-w-none overflow-hidden rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-none'
            : 'h-[calc(100dvh-2rem)] sm:h-[min(90dvh,56rem)] sm:max-w-6xl'
        }
      >
        {!submissionActive ? (
          <>
            <ManagementDialogHeader>
              <DialogTitle>
                {editingWorkflow
                  ? t('features.network.workflows.edit')
                  : t('features.network.workflows.create')}
              </DialogTitle>
              <DialogDescription>
                {t('features.network.workflows.editorDescription')}
              </DialogDescription>
            </ManagementDialogHeader>

            <ManagementDialogBody>
              <div className="space-y-5">
                <div className="space-y-2">
                  <FormControlLabel>{t('common.name')}</FormControlLabel>
                  <FormControlInput
                    value={draftName}
                    onChange={event => setDraftName(event.target.value)}
                    placeholder={t('features.network.workflows.namePlaceholder')}
                  />
                </div>

                <Accordion
                  type="single"
                  collapsible
                  defaultValue="step-config"
                  className="rounded-lg border"
                >
                  <AccordionItem value="step-config" className="border-b-0">
                    <AccordionTrigger className="px-4">
                      {t('features.network.workflows.stepConfig')}
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 px-4 pb-4">
                      <Tabs
                        value={builderTab}
                        onValueChange={value => setBuilderTab(value as 'type' | 'graph')}
                      >
                        <TabsList className="w-full">
                          <TabsTrigger value="type" className="flex-1">
                            {t('features.network.workflows.byType')}
                          </TabsTrigger>
                          <TabsTrigger value="graph" className="flex-1">
                            {t('features.network.workflows.byGraph')}
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="type" className="space-y-4">
                          {draftSteps.length === 0 ? (
                            <div className="space-y-2">
                              <FormControlLabel>
                                {t('features.network.workflows.startGroup')}
                              </FormControlLabel>
                              <TypeaheadSearch
                                items={allGroupItems}
                                value={draftStartGroupId}
                                onChange={(item: TypeaheadItem | null) => {
                                  setDraftStartGroupId(item?.id ?? '');
                                  setPendingTargetGroupId('');
                                  if (item?.id) {
                                    setGraphSelectionMode('target');
                                  }
                                }}
                                placeholder={t('features.network.workflows.selectStartGroup')}
                                showAllOnFocus
                              />
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <FormControlLabel>
                                {t('features.network.workflows.currentStart')}
                              </FormControlLabel>
                              <div className="bg-muted/40 rounded-md border px-3 py-2 text-sm font-medium">
                                {getGroupName(pendingSourceGroupId, availableGroups)}
                              </div>
                              <p className="text-muted-foreground text-xs">
                                {t('features.network.workflows.currentStartHint')}
                              </p>
                            </div>
                          )}

                          <div className="space-y-2">
                            <p className="text-muted-foreground text-xs font-medium">
                              {t('features.network.workflows.byTypeGroupPicker')}
                            </p>
                            <TypeaheadSearch
                              items={pendingTargetItems}
                              value={pendingTargetGroupId}
                              onChange={(item: TypeaheadItem | null) =>
                                setPendingTargetGroupId(item?.id ?? '')
                              }
                              placeholder={t('features.network.workflows.searchConnectedGroup')}
                              showAllOnFocus
                            />
                          </div>
                        </TabsContent>

                        <TabsContent value="graph" className="space-y-4">
                          {draftSteps.length === 0 ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={graphSelectionMode === 'start' ? 'default' : 'outline'}
                                onClick={() => setGraphSelectionMode('start')}
                              >
                                <MapPinned className="mr-2 h-4 w-4" />
                                {t('features.network.workflows.pickStart')}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={graphSelectionMode === 'target' ? 'default' : 'outline'}
                                disabled={!draftStartGroupId}
                                onClick={() => setGraphSelectionMode('target')}
                              >
                                <ArrowRight className="mr-2 h-4 w-4" />
                                {t('features.network.workflows.pickTarget')}
                              </Button>
                            </div>
                          ) : null}

                          <div className="space-y-2">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="rounded-md border px-3 py-2">
                                <p className="text-muted-foreground text-xs font-medium">
                                  {t('features.network.workflows.currentStart')}
                                </p>
                                <p className="text-sm font-medium">
                                  {draftSteps.length === 0 && graphSelectionMode === 'start'
                                    ? t('features.network.workflows.clickToChooseStart')
                                    : pendingSourceGroupId
                                      ? getGroupName(pendingSourceGroupId, availableGroups)
                                      : t('features.network.workflows.notSelected')}
                                </p>
                              </div>
                              <div className="rounded-md border px-3 py-2">
                                <p className="text-muted-foreground text-xs font-medium">
                                  {t('features.network.workflows.selectedTarget')}
                                </p>
                                <p className="text-sm font-medium">
                                  {pendingTargetGroupId
                                    ? getGroupName(pendingTargetGroupId, availableGroups)
                                    : t('features.network.workflows.clickToChooseTarget')}
                                </p>
                              </div>
                            </div>
                            <div className="h-[20rem] min-h-[20rem] overflow-hidden rounded-md border">
                              <GroupNetworkFlow
                                groupId={graphRootGroupId}
                                filterRight="amendmentRight"
                                title={t('features.network.workflows.graphPickerTitle')}
                                description={
                                  draftSteps.length === 0 && graphSelectionMode === 'start'
                                    ? t('features.network.workflows.graphPickerStartDescription')
                                    : t('features.network.workflows.graphPickerTargetDescription')
                                }
                                onGroupClick={groupId => handleGraphGroupClick(groupId)}
                                showGroupDialogOnClick={false}
                                showWorkflowView={false}
                                highlightGroupIds={pendingHighlightGroupIds}
                                highlightEdgePairs={
                                  pendingSourceGroupId && pendingTargetGroupId
                                    ? [
                                        {
                                          sourceGroupId: pendingSourceGroupId,
                                          targetGroupId: pendingTargetGroupId,
                                        },
                                      ]
                                    : []
                                }
                                layoutScopeKey={`workflow-editor-picker:${graphRootGroupId}:${graphSelectionMode}`}
                              />
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>

                      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            {pendingSourceGroupId
                              ? `${getGroupName(pendingSourceGroupId, availableGroups)}`
                              : t('features.network.workflows.selectStartFirst')}
                            {pendingTargetGroupId ? (
                              <>
                                <ArrowRight className="text-muted-foreground mx-2 inline h-3.5 w-3.5" />
                                {getGroupName(pendingTargetGroupId, availableGroups)}
                              </>
                            ) : null}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {t('features.network.workflows.addStepHint')}
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={handleAddPendingStep}
                          disabled={!isPendingStepValid}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          {t('features.network.workflows.addStep')}
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <Accordion type="single" collapsible className="rounded-lg border">
                  <AccordionItem value="workflow-settings" className="border-b-0">
                    <AccordionTrigger className="px-4">
                      {t('features.network.workflows.workflowSettings')}
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 px-4 pb-4">
                      <div className="space-y-2">
                        <FormControlLabel>{t('common.description')}</FormControlLabel>
                        <FormControlTextarea
                          value={draftDescription}
                          onChange={event => setDraftDescription(event.target.value)}
                          placeholder={t('features.network.workflows.descriptionPlaceholder')}
                          className="min-h-[96px]"
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                        <div className="space-y-1">
                          <FormControlLabel htmlFor="workflow-default-entry">
                            {t('features.network.workflows.defaultEntryLabel')}
                          </FormControlLabel>
                          <p className="text-muted-foreground text-xs">
                            {finalTargetGroupId
                              ? t(
                                  'features.network.workflows.defaultEntryHintDynamic',
                                  `Applies when another workflow hands off into ${getGroupName(finalTargetGroupId, availableGroups)} without naming a specific workflow.`
                                )
                              : t('features.network.workflows.defaultEntryHint')}
                          </p>
                        </div>
                        <FormControlSwitch
                          id="workflow-default-entry"
                          checked={draftIsDefaultEntry}
                          onCheckedChange={setDraftIsDefaultEntry}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <Tabs
                  value={visualizationTab}
                  onValueChange={value => setVisualizationTab(value as 'graph' | 'list')}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {t('features.network.workflows.currentFlow')}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {finalTargetGroupId
                            ? t(
                                'features.network.workflows.currentFlowSummary',
                                `Start ${draftStartGroupId ? getGroupName(draftStartGroupId, availableGroups) : ''}, final target ${getGroupName(finalTargetGroupId, availableGroups)}.`
                              )
                            : t('features.network.workflows.currentFlowPending')}
                        </p>
                      </div>

                      <ManagementDialogSection className="space-y-3">
                        <div className="flex items-center gap-2 font-medium">
                          <Workflow className="h-4 w-4" />
                          {t('features.network.workflows.summary')}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <BadgeControl variant="secondary">
                            {draftStartGroupId
                              ? getGroupName(draftStartGroupId, availableGroups)
                              : t('features.network.workflows.noStartSelected')}
                          </BadgeControl>
                          {draftSteps.map((step: any, index: number) => (
                            <span
                              key={`${step.id ?? step.group_id}-${index}`}
                              className="flex items-center gap-2"
                            >
                              <ArrowRight className="text-muted-foreground h-3.5 w-3.5" />
                              <BadgeControl
                                variant={index === draftSteps.length - 1 ? 'default' : 'outline'}
                              >
                                {step.label
                                  ? `${getGroupName(step.group_id, availableGroups)} (${step.label})`
                                  : getGroupName(step.group_id, availableGroups)}
                              </BadgeControl>
                            </span>
                          ))}
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {t(
                            'features.network.workflows.summaryHint',
                            `The current page group is ${currentGroupName || currentGroupId} and must stay part of this chain.`
                          )}
                        </p>
                      </ManagementDialogSection>
                    </div>

                    <TabsList className="self-start">
                      <TabsTrigger value="graph">
                        <Network className="mr-2 h-4 w-4" />
                        {t('features.network.workflows.networkGraph')}
                      </TabsTrigger>
                      <TabsTrigger value="list">
                        <List className="mr-2 h-4 w-4" />
                        {t('features.network.workflows.list')}
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="graph" className="mt-4">
                    {previewWorkflow === null ? (
                      <div className="bg-muted/10 flex h-[32rem] min-h-[32rem] items-center justify-center rounded-xl border border-dashed p-6 text-center">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">
                            {t('features.network.workflows.emptyPreviewTitle')}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            {t('features.network.workflows.emptyPreviewDescription')}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="h-[32rem] min-h-[32rem]">
                        <WorkflowFlowVisualization workflow={previewWorkflow} />
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="list" className="mt-4 space-y-3">
                    {draftSteps.length === 0 ? (
                      <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
                        {t('features.network.workflows.emptyDraft')}
                      </div>
                    ) : (
                      draftSteps.map((step: any, index: number) => {
                        const sourceGroupId =
                          index === 0 ? draftStartGroupId : (draftSteps[index - 1]?.group_id ?? '');
                        const targetOptions = getDirectTargetGroups(sourceGroupId);
                        const isInvalidTransition = invalidTransitionIndexes.includes(index);

                        return (
                          <ManagementDialogSection
                            key={step.id ?? `${step.group_id}-${index}`}
                            draggable
                            className="space-y-4"
                            onDragStart={() => setDraggedStepIndex(index)}
                            onDragOver={event => event.preventDefault()}
                            onDrop={() => handleRowDrop(index)}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <GripVertical className="text-muted-foreground h-4 w-4 cursor-grab active:cursor-grabbing" />
                                <BadgeControl variant="outline">
                                  {t('features.network.workflows.stepNumber', `Step ${index + 1}`)}
                                </BadgeControl>
                                {isInvalidTransition ? (
                                  <BadgeControl variant="destructive">
                                    {t('features.network.workflows.invalidStep')}
                                  </BadgeControl>
                                ) : null}
                              </div>

                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={index === 0}
                                  onClick={() => onMoveStep(index, index - 1)}
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={index === draftSteps.length - 1}
                                  onClick={() => onMoveStep(index, index + 1)}
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => onRemoveStep(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <FormControlLabel>
                                  {t('features.network.workflows.sourceGroup')}
                                </FormControlLabel>
                                {index === 0 ? (
                                  <TypeaheadSearch
                                    items={allGroupItems}
                                    value={draftStartGroupId}
                                    onChange={(item: TypeaheadItem | null) =>
                                      setDraftStartGroupId(item?.id ?? '')
                                    }
                                    placeholder={t('features.network.workflows.selectStartGroup')}
                                    showAllOnFocus
                                  />
                                ) : (
                                  <div className="bg-muted/40 rounded-md border px-3 py-2 text-sm font-medium">
                                    {sourceGroupId
                                      ? getGroupName(sourceGroupId, availableGroups)
                                      : t('features.network.workflows.notSelected')}
                                  </div>
                                )}
                              </div>

                              <div className="space-y-2">
                                <FormControlLabel>
                                  {t('features.network.workflows.targetGroup')}
                                </FormControlLabel>
                                <FormControlSelect
                                  value={step.group_id}
                                  onValueChange={value => handleRowTargetChange(index, value)}
                                >
                                  <FormControlSelectTrigger>
                                    <FormControlSelectValue
                                      placeholder={t(
                                        'features.network.workflows.listTargetPlaceholder'
                                      )}
                                    />
                                  </FormControlSelectTrigger>
                                  <FormControlSelectContent>
                                    {targetOptions.map((group: any) => (
                                      <FormControlSelectItem key={group.id} value={group.id}>
                                        {group.name ?? group.id}
                                      </FormControlSelectItem>
                                    ))}
                                  </FormControlSelectContent>
                                </FormControlSelect>
                              </div>
                            </div>
                            <div className="rounded-lg border border-dashed px-4 py-3 text-sm">
                              <p className="font-medium">
                                {sourceGroupId
                                  ? `${getGroupName(sourceGroupId, availableGroups)} -> ${getGroupName(step.group_id, availableGroups)}`
                                  : getGroupName(step.group_id, availableGroups)}
                              </p>
                              <p className="text-muted-foreground mt-1 text-xs">
                                {t('features.network.workflows.listStepHint')}
                              </p>
                            </div>
                          </ManagementDialogSection>
                        );
                      })
                    )}
                  </TabsContent>
                </Tabs>

                {validationMessages.length > 0 ? (
                  <div className="border-destructive/20 bg-destructive/5 space-y-2 rounded-lg border p-4">
                    <p className="text-destructive text-sm font-medium">
                      {t('features.network.workflows.validationTitle')}
                    </p>
                    <ul className="text-destructive list-disc space-y-1 pl-5 text-sm">
                      {validationMessages.map((message: string) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </ManagementDialogBody>

            <ManagementDialogFooter>
              <Button variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSaveWithSubmission} disabled={!canSave}>
                {editingWorkflow ? t('common.save') : t('features.network.workflows.create')}
              </Button>
            </ManagementDialogFooter>
          </>
        ) : null}

        <ActionSubmissionOverlay
          kind="workflow"
          status={actionSubmission.status}
          steps={actionSubmission.progressSteps}
          error={actionSubmission.error}
          preview={{
            entityLabel: editingWorkflow
              ? t('features.network.workflows.edit')
              : t('features.network.workflows.create'),
            title:
              draftName || editingWorkflow?.name || t('features.network.workflows.previewTitle'),
            description: t('features.network.workflows.currentFlow'),
            path: workflowPath,
          }}
          target={{ label: t('common.done', 'Fertig'), onClick: actionSubmission.reset }}
          onBack={actionSubmission.reset}
          onRetry={() => void actionSubmission.retry()}
        />
      </ManagementDialogContent>
    </Dialog>
  );
}
