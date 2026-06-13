'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { Label } from '@/features/shared/ui/ui/label';
import { Input } from '@/features/shared/ui/ui/input';
import { Textarea } from '@/features/shared/ui/ui/textarea';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Switch } from '@/features/shared/ui/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/shared/ui/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/features/shared/ui/ui/accordion';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { DraftWorkflowStep } from '../hooks/useWorkflowEditor';
import type { WorkflowWithStepsRow } from '@/zero/network/queries';
import type { NormalizedGroupRelationship, NetworkGroupEntity } from '../types/network.types';
import {
  type AmendmentNetworkGroup,
  type AmendmentNetworkRelationship,
  getDirectReachableTargetGroupsFromSource,
} from '@/features/amendments/logic/amendmentPathHelpers';
import { isActiveGroupRelationshipStatus } from '../logic/networkRelationshipHelpers';
import { GroupNetworkFlow } from './GroupNetworkFlow';
import {
  WorkflowFlowVisualization,
  type WorkflowFlowVisualizationWorkflow,
} from './WorkflowFlowVisualization';
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

interface WorkflowEditorProps {
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
  onSave: () => void;
}

interface WorkflowTransition {
  index: number;
  sourceGroupId: string;
  targetGroupId: string;
  step: DraftWorkflowStep;
}

function createBlankStepDraft(): DraftWorkflowStep {
  return {
    group_id: '',
    label: null,
    step_kind: 'group_vote',
    selection_mode: 'default_target_workflow',
    merge_strategy: null,
    event_rule: null,
    auto_task_on_missing_event: true,
    target_workflow_id: null,
  };
}

function sortGroupsByName(groups: AvailableGroup[]) {
  return [...groups].sort((left, right) => (left.name ?? '').localeCompare(right.name ?? ''));
}

function getGroupName(groupId: string, availableGroups: AvailableGroup[]) {
  return availableGroups.find(group => group.id === groupId)?.name ?? groupId;
}

function getTypeaheadItems(groups: AvailableGroup[]) {
  return toTypeaheadItems(
    groups,
    'group',
    group => group.name ?? group.id,
    group => {
      const description = richTextToPlainText(group.description);
      return description ? description.substring(0, 80) : undefined;
    },
    undefined,
    group => `/group/${group.id}`
  );
}

export function WorkflowEditor({
  currentGroupId,
  currentGroupName,
  allRelationships,
  isOpen,
  editingWorkflow,
  draftStartGroupId,
  setDraftStartGroupId,
  draftName,
  setDraftName,
  draftDescription,
  setDraftDescription,
  draftIsDefaultEntry,
  setDraftIsDefaultEntry,
  draftSteps,
  availableGroups,
  onClose,
  onAddStep,
  onUpdateStep,
  onRemoveStep,
  onMoveStep,
  onSave,
}: WorkflowEditorProps) {
  const { t } = useTranslation();
  const [builderTab, setBuilderTab] = useState<'type' | 'graph'>('type');
  const [visualizationTab, setVisualizationTab] = useState<'graph' | 'list'>('graph');
  const [graphSelectionMode, setGraphSelectionMode] = useState<'start' | 'target'>('start');
  const [pendingTargetGroupId, setPendingTargetGroupId] = useState('');
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);

  const networkGroups = useMemo(
    () =>
      availableGroups.map(group => ({
        ...group,
        name: group.name ?? group.id,
      })) as AmendmentNetworkGroup[],
    [availableGroups]
  );
  const amendmentRelationships = useMemo(
    () =>
      allRelationships.filter(
        relationship =>
          relationship.with_right === 'amendmentRight' &&
          isActiveGroupRelationshipStatus(relationship.status)
      ) as AmendmentNetworkRelationship[],
    [allRelationships]
  );
  const allGroupOptions = useMemo(() => sortGroupsByName(availableGroups), [availableGroups]);
  const allGroupItems = useMemo(() => getTypeaheadItems(allGroupOptions), [allGroupOptions]);

  const transitions = useMemo<WorkflowTransition[]>(
    () =>
      draftSteps.map((step, index) => ({
        index,
        sourceGroupId: index === 0 ? draftStartGroupId : (draftSteps[index - 1]?.group_id ?? ''),
        targetGroupId: step.group_id,
        step,
      })),
    [draftStartGroupId, draftSteps]
  );

  const pendingSourceGroupId = useMemo(() => {
    if (draftSteps.length === 0) {
      return draftStartGroupId;
    }

    return draftSteps[draftSteps.length - 1]?.group_id ?? '';
  }, [draftStartGroupId, draftSteps]);

  const getDirectTargetGroups = useCallback(
    (sourceGroupId: string) => {
      if (!sourceGroupId) {
        return [];
      }

      return sortGroupsByName(
        getDirectReachableTargetGroupsFromSource({
          sourceGroupId,
          groups: networkGroups,
          relationships: amendmentRelationships,
        }) as AvailableGroup[]
      );
    },
    [amendmentRelationships, networkGroups]
  );

  const pendingTargetOptions = useMemo(
    () => getDirectTargetGroups(pendingSourceGroupId),
    [getDirectTargetGroups, pendingSourceGroupId]
  );
  const pendingTargetItems = useMemo(
    () => getTypeaheadItems(pendingTargetOptions),
    [pendingTargetOptions]
  );

  const pendingHighlightGroupIds = useMemo(() => {
    const highlights = pendingSourceGroupId ? [pendingSourceGroupId] : [];
    if (pendingTargetGroupId) {
      highlights.push(pendingTargetGroupId);
    }

    return highlights;
  }, [pendingSourceGroupId, pendingTargetGroupId]);

  const graphRootGroupId = useMemo(() => {
    if (draftSteps.length > 0) {
      return pendingSourceGroupId || currentGroupId;
    }

    if (graphSelectionMode === 'target' && draftStartGroupId) {
      return draftStartGroupId;
    }

    return currentGroupId;
  }, [
    currentGroupId,
    draftStartGroupId,
    draftSteps.length,
    graphSelectionMode,
    pendingSourceGroupId,
  ]);

  const participantGroupIds = useMemo(
    () =>
      new Set(
        [draftStartGroupId, ...draftSteps.map(step => step.group_id)].filter(
          (groupId): groupId is string => Boolean(groupId)
        )
      ),
    [draftStartGroupId, draftSteps]
  );

  const invalidTransitionIndexes = useMemo(() => {
    const invalidIndexes: number[] = [];

    for (const transition of transitions) {
      if (!transition.sourceGroupId || !transition.targetGroupId) {
        invalidIndexes.push(transition.index);
        continue;
      }

      const directTargetIds = new Set(
        getDirectTargetGroups(transition.sourceGroupId).map(group => group.id)
      );
      if (!directTargetIds.has(transition.targetGroupId)) {
        invalidIndexes.push(transition.index);
      }
    }

    return invalidIndexes;
  }, [getDirectTargetGroups, transitions]);

  const validationMessages = useMemo(() => {
    const messages: string[] = [];

    if (!draftName.trim()) {
      messages.push(
        t('features.network.workflows.validationMissingTitle', 'A workflow title is required.')
      );
    }

    if (!draftStartGroupId) {
      messages.push(
        t(
          'features.network.workflows.validationMissingStart',
          'Choose the start group for the first transition.'
        )
      );
    }

    if (draftSteps.length === 0) {
      messages.push(
        t('features.network.workflows.validationMissingSteps', 'Add at least one workflow step.')
      );
    }

    if (!participantGroupIds.has(currentGroupId)) {
      messages.push(
        t(
          'features.network.workflows.validationCurrentGroupRequired',
          'The current group page must participate somewhere in the workflow.'
        )
      );
    }

    if (invalidTransitionIndexes.length > 0) {
      messages.push(
        t(
          'features.network.workflows.validationDirectTransitions',
          'Every transition must be a direct one-hop amendment-right step.'
        )
      );
    }

    return messages;
  }, [
    currentGroupId,
    draftName,
    draftStartGroupId,
    draftSteps.length,
    invalidTransitionIndexes.length,
    participantGroupIds,
    t,
  ]);

  const isPendingStepValid = Boolean(pendingSourceGroupId) && Boolean(pendingTargetGroupId);
  const canSave = validationMessages.length === 0;
  const finalTargetGroupId = draftSteps[draftSteps.length - 1]?.group_id ?? '';

  const previewWorkflow = useMemo<WorkflowFlowVisualizationWorkflow | null>(() => {
    if (draftSteps.length === 0) {
      return null;
    }

    return {
      name:
        draftName.trim() ||
        editingWorkflow?.name ||
        t('features.network.workflows.previewTitle', 'Draft workflow'),
      description: draftDescription.trim() || null,
      startGroup: draftStartGroupId
        ? {
            id: draftStartGroupId,
            name: getGroupName(draftStartGroupId, availableGroups),
          }
        : null,
      approvalState: editingWorkflow?.status === 'active' ? 'accepted' : 'pending',
      steps: draftSteps.map((step, index) => ({
        id: step.id ?? `draft-step-${index}`,
        group_id: step.group_id,
        order_index: index,
        label: step.label,
        group: step.group_id
          ? {
              name: getGroupName(step.group_id, availableGroups),
            }
          : null,
      })),
    };
  }, [
    availableGroups,
    draftDescription,
    draftName,
    draftStartGroupId,
    draftSteps,
    editingWorkflow?.name,
    t,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setBuilderTab('type');
    setVisualizationTab('graph');
    setGraphSelectionMode(draftSteps.length === 0 && !draftStartGroupId ? 'start' : 'target');
    setPendingTargetGroupId('');
    setDraggedStepIndex(null);
  }, [draftStartGroupId, draftSteps.length, editingWorkflow?.id, isOpen]);

  useEffect(() => {
    if (draftSteps.length > 0) {
      setGraphSelectionMode('target');
    }
  }, [draftSteps.length]);

  const handleAddPendingStep = useCallback(() => {
    if (!pendingTargetGroupId || !isPendingStepValid) {
      return;
    }

    onAddStep({
      ...createBlankStepDraft(),
      group_id: pendingTargetGroupId,
    });

    setPendingTargetGroupId('');
    setGraphSelectionMode('target');
  }, [isPendingStepValid, onAddStep, pendingTargetGroupId]);

  const handleGraphGroupClick = useCallback(
    (groupId: string) => {
      if (draftSteps.length === 0 && graphSelectionMode === 'start') {
        setDraftStartGroupId(groupId);
        setPendingTargetGroupId('');
        setGraphSelectionMode('target');
        return;
      }

      const nextTargetIds = new Set(pendingTargetOptions.map(group => group.id));
      if (nextTargetIds.has(groupId)) {
        setPendingTargetGroupId(groupId);
      }
    },
    [draftSteps.length, graphSelectionMode, pendingTargetOptions, setDraftStartGroupId]
  );

  const handleRowDrop = useCallback(
    (targetIndex: number) => {
      if (draggedStepIndex == null || draggedStepIndex === targetIndex) {
        setDraggedStepIndex(null);
        return;
      }

      onMoveStep(draggedStepIndex, targetIndex);
      setDraggedStepIndex(null);
    },
    [draggedStepIndex, onMoveStep]
  );

  const handleRowTargetChange = useCallback(
    (index: number, value: string) => {
      onUpdateStep(index, {
        group_id: value,
      });
    },
    [onUpdateStep]
  );

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="flex h-screen w-screen max-w-none flex-col rounded-none border-0 p-0 sm:h-screen sm:max-w-none">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle>
            {editingWorkflow
              ? t('features.network.workflows.edit', 'Edit Workflow')
              : t('features.network.workflows.create', 'New Workflow')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'features.network.workflows.editorDescription',
              'Build the workflow as a chain of direct amendment-right transitions. The first source becomes the workflow start and the last target becomes the final goal.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>{t('common.name', 'Name')}</Label>
              <Input
                value={draftName}
                onChange={event => setDraftName(event.target.value)}
                placeholder={t(
                  'features.network.workflows.namePlaceholder',
                  'e.g. Parliamentary Reading Process'
                )}
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
                  {t('features.network.workflows.stepConfig', 'Configure next step')}
                </AccordionTrigger>
                <AccordionContent className="space-y-4 px-4 pb-4">
                  <Tabs
                    value={builderTab}
                    onValueChange={value => setBuilderTab(value as 'type' | 'graph')}
                  >
                    <TabsList className="w-full">
                      <TabsTrigger value="type" className="flex-1">
                        {t('features.network.workflows.byType', 'By type')}
                      </TabsTrigger>
                      <TabsTrigger value="graph" className="flex-1">
                        {t('features.network.workflows.byGraph', 'By graph')}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="type" className="space-y-4">
                      {draftSteps.length === 0 ? (
                        <div className="space-y-2">
                          <Label>{t('features.network.workflows.startGroup', 'Start group')}</Label>
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
                            placeholder={t(
                              'features.network.workflows.selectStartGroup',
                              'Select the first start group...'
                            )}
                            showAllOnFocus
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label>
                            {t('features.network.workflows.currentStart', 'Current start')}
                          </Label>
                          <div className="bg-muted/40 rounded-md border px-3 py-2 text-sm font-medium">
                            {getGroupName(pendingSourceGroupId, availableGroups)}
                          </div>
                          <p className="text-muted-foreground text-xs">
                            {t(
                              'features.network.workflows.currentStartHint',
                              'The previous target automatically becomes the next start.'
                            )}
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <p className="text-muted-foreground text-xs font-medium">
                          {t(
                            'features.network.workflows.byTypeGroupPicker',
                            'Choose the next connected group'
                          )}
                        </p>
                        <TypeaheadSearch
                          items={pendingTargetItems}
                          value={pendingTargetGroupId}
                          onChange={(item: TypeaheadItem | null) =>
                            setPendingTargetGroupId(item?.id ?? '')
                          }
                          placeholder={t(
                            'features.network.workflows.searchConnectedGroup',
                            'Search connected group...'
                          )}
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
                            {t('features.network.workflows.pickStart', 'Pick start')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={graphSelectionMode === 'target' ? 'default' : 'outline'}
                            disabled={!draftStartGroupId}
                            onClick={() => setGraphSelectionMode('target')}
                          >
                            <ArrowRight className="mr-2 h-4 w-4" />
                            {t('features.network.workflows.pickTarget', 'Pick target')}
                          </Button>
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-md border px-3 py-2">
                            <p className="text-muted-foreground text-xs font-medium">
                              {t('features.network.workflows.currentStart', 'Current start')}
                            </p>
                            <p className="text-sm font-medium">
                              {draftSteps.length === 0 && graphSelectionMode === 'start'
                                ? t(
                                    'features.network.workflows.clickToChooseStart',
                                    'Choose a start group from the graph'
                                  )
                                : pendingSourceGroupId
                                  ? getGroupName(pendingSourceGroupId, availableGroups)
                                  : t('features.network.workflows.notSelected', 'Not selected')}
                            </p>
                          </div>
                          <div className="rounded-md border px-3 py-2">
                            <p className="text-muted-foreground text-xs font-medium">
                              {t('features.network.workflows.selectedTarget', 'Selected target')}
                            </p>
                            <p className="text-sm font-medium">
                              {pendingTargetGroupId
                                ? getGroupName(pendingTargetGroupId, availableGroups)
                                : t(
                                    'features.network.workflows.clickToChooseTarget',
                                    'Click a connected group'
                                  )}
                            </p>
                          </div>
                        </div>
                        <div className="h-[20rem] min-h-[20rem] overflow-hidden rounded-md border">
                          <GroupNetworkFlow
                            groupId={graphRootGroupId}
                            filterRight="amendmentRight"
                            title={t(
                              'features.network.workflows.graphPickerTitle',
                              'Workflow graph picker'
                            )}
                            description={
                              draftSteps.length === 0 && graphSelectionMode === 'start'
                                ? t(
                                    'features.network.workflows.graphPickerStartDescription',
                                    'Pick the first start group from the visible amendment-right graph.'
                                  )
                                : t(
                                    'features.network.workflows.graphPickerTargetDescription',
                                    'Pick the next direct amendment-right neighbor from the current start.'
                                  )
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
                          : t(
                              'features.network.workflows.selectStartFirst',
                              'Choose the start group first'
                            )}
                        {pendingTargetGroupId ? (
                          <>
                            <ArrowRight className="text-muted-foreground mx-2 inline h-3.5 w-3.5" />
                            {getGroupName(pendingTargetGroupId, availableGroups)}
                          </>
                        ) : null}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {t(
                          'features.network.workflows.addStepHint',
                          'After adding, the previous target becomes the next start automatically.'
                        )}
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddPendingStep}
                      disabled={!isPendingStepValid}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t('features.network.workflows.addStep', 'Schritt hinzufügen')}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Accordion type="single" collapsible className="rounded-lg border">
              <AccordionItem value="workflow-settings" className="border-b-0">
                <AccordionTrigger className="px-4">
                  {t('features.network.workflows.workflowSettings', 'Workflow settings')}
                </AccordionTrigger>
                <AccordionContent className="space-y-4 px-4 pb-4">
                  <div className="space-y-2">
                    <Label>{t('common.description', 'Description')}</Label>
                    <Textarea
                      value={draftDescription}
                      onChange={event => setDraftDescription(event.target.value)}
                      placeholder={t(
                        'features.network.workflows.descriptionPlaceholder',
                        'Describe the process this custom workflow should model...'
                      )}
                      className="min-h-[96px]"
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                    <div className="space-y-1">
                      <Label htmlFor="workflow-default-entry">
                        {t(
                          'features.network.workflows.defaultEntryLabel',
                          'Default entry workflow'
                        )}
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        {finalTargetGroupId
                          ? t(
                              'features.network.workflows.defaultEntryHintDynamic',
                              `Applies when another workflow hands off into ${getGroupName(finalTargetGroupId, availableGroups)} without naming a specific workflow.`
                            )
                          : t(
                              'features.network.workflows.defaultEntryHint',
                              'Applies to the final target group once a final target exists.'
                            )}
                      </p>
                    </div>
                    <Switch
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
                      {t('features.network.workflows.currentFlow', 'Current workflow flow')}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {finalTargetGroupId
                        ? t(
                            'features.network.workflows.currentFlowSummary',
                            `Start ${draftStartGroupId ? getGroupName(draftStartGroupId, availableGroups) : ''}, final target ${getGroupName(finalTargetGroupId, availableGroups)}.`
                          )
                        : t(
                            'features.network.workflows.currentFlowPending',
                            'Add at least one step to define the final target.'
                          )}
                    </p>
                  </div>

                  <Card>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-center gap-2 font-medium">
                        <Workflow className="h-4 w-4" />
                        {t('features.network.workflows.summary', 'Workflow summary')}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="secondary">
                          {draftStartGroupId
                            ? getGroupName(draftStartGroupId, availableGroups)
                            : t('features.network.workflows.noStartSelected', 'No start selected')}
                        </Badge>
                        {draftSteps.map((step, index) => (
                          <span
                            key={`${step.id ?? step.group_id}-${index}`}
                            className="flex items-center gap-2"
                          >
                            <ArrowRight className="text-muted-foreground h-3.5 w-3.5" />
                            <Badge
                              variant={index === draftSteps.length - 1 ? 'default' : 'outline'}
                            >
                              {step.label
                                ? `${getGroupName(step.group_id, availableGroups)} (${step.label})`
                                : getGroupName(step.group_id, availableGroups)}
                            </Badge>
                          </span>
                        ))}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {t(
                          'features.network.workflows.summaryHint',
                          `The current page group is ${currentGroupName || currentGroupId} and must stay part of this chain.`
                        )}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <TabsList className="self-start">
                  <TabsTrigger value="graph">
                    <Network className="mr-2 h-4 w-4" />
                    {t('features.network.workflows.networkGraph', 'Network graph')}
                  </TabsTrigger>
                  <TabsTrigger value="list">
                    <List className="mr-2 h-4 w-4" />
                    {t('features.network.workflows.list', 'List')}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="graph" className="mt-4">
                {previewWorkflow === null ? (
                  <div className="bg-muted/10 flex h-[32rem] min-h-[32rem] items-center justify-center rounded-xl border border-dashed p-6 text-center">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        {t('features.network.workflows.emptyPreviewTitle', 'No drafted flow yet')}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {t(
                          'features.network.workflows.emptyPreviewDescription',
                          'The graph starts empty and grows with each added step.'
                        )}
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
                    {t(
                      'features.network.workflows.emptyDraft',
                      'No workflow steps have been added yet.'
                    )}
                  </div>
                ) : (
                  draftSteps.map((step, index) => {
                    const sourceGroupId =
                      index === 0 ? draftStartGroupId : (draftSteps[index - 1]?.group_id ?? '');
                    const targetOptions = getDirectTargetGroups(sourceGroupId);
                    const isInvalidTransition = invalidTransitionIndexes.includes(index);

                    return (
                      <Card
                        key={step.id ?? `${step.group_id}-${index}`}
                        draggable
                        onDragStart={() => setDraggedStepIndex(index)}
                        onDragOver={event => event.preventDefault()}
                        onDrop={() => handleRowDrop(index)}
                      >
                        <CardContent className="space-y-4 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <GripVertical className="text-muted-foreground h-4 w-4 cursor-grab active:cursor-grabbing" />
                              <Badge variant="outline">
                                {t('features.network.workflows.stepNumber', `Step ${index + 1}`)}
                              </Badge>
                              {isInvalidTransition ? (
                                <Badge variant="destructive">
                                  {t('features.network.workflows.invalidStep', 'Invalid hop')}
                                </Badge>
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
                                variant="ghost"
                                size="icon"
                                onClick={() => onRemoveStep(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>
                                {t('features.network.workflows.sourceGroup', 'Source group')}
                              </Label>
                              {index === 0 ? (
                                <TypeaheadSearch
                                  items={allGroupItems}
                                  value={draftStartGroupId}
                                  onChange={(item: TypeaheadItem | null) =>
                                    setDraftStartGroupId(item?.id ?? '')
                                  }
                                  placeholder={t(
                                    'features.network.workflows.selectStartGroup',
                                    'Select the first start group...'
                                  )}
                                  showAllOnFocus
                                />
                              ) : (
                                <div className="bg-muted/40 rounded-md border px-3 py-2 text-sm font-medium">
                                  {sourceGroupId
                                    ? getGroupName(sourceGroupId, availableGroups)
                                    : t('features.network.workflows.notSelected', 'Not selected')}
                                </div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label>
                                {t('features.network.workflows.targetGroup', 'Target group')}
                              </Label>
                              <Select
                                value={step.group_id}
                                onValueChange={value => handleRowTargetChange(index, value)}
                              >
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t(
                                      'features.network.workflows.listTargetPlaceholder',
                                      'Choose target group...'
                                    )}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {targetOptions.map(group => (
                                    <SelectItem key={group.id} value={group.id}>
                                      {group.name ?? group.id}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="rounded-lg border border-dashed px-4 py-3 text-sm">
                            <p className="font-medium">
                              {sourceGroupId
                                ? `${getGroupName(sourceGroupId, availableGroups)} -> ${getGroupName(step.group_id, availableGroups)}`
                                : getGroupName(step.group_id, availableGroups)}
                            </p>
                            <p className="text-muted-foreground mt-1 text-xs">
                              {t(
                                'features.network.workflows.listStepHint',
                                'Reorder or delete steps here. The graph preview updates immediately.'
                              )}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </TabsContent>
            </Tabs>

            {validationMessages.length > 0 ? (
              <div className="border-destructive/20 bg-destructive/5 space-y-2 rounded-lg border p-4">
                <p className="text-destructive text-sm font-medium">
                  {t(
                    'features.network.workflows.validationTitle',
                    'This workflow still needs attention before it can be saved:'
                  )}
                </p>
                <ul className="text-destructive list-disc space-y-1 pl-5 text-sm">
                  {validationMessages.map(message => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={onSave} disabled={!canSave}>
            {editingWorkflow
              ? t('common.save', 'Save')
              : t('features.network.workflows.create', 'New Workflow')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
