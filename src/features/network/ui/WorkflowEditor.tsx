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
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Plus, Trash2, ArrowRight, Pencil, ChevronRight, GripVertical } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { isWorkflowCircular, sortWorkflowSteps } from '../logic/workflowHelpers';
import type { WorkflowWithStepsRow } from '@/zero/network/queries';
import { Badge } from '@/features/shared/ui/ui/badge';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import { GroupSearchCard } from '@/features/search/ui/GroupSearchCard';
import { CreateInputField, CreateTextareaField } from '@/features/create/ui/CreateFields';
import { cn } from '@/features/shared/utils/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface AvailableGroup {
  id: string;
  name: string | null;
  description?: unknown;
  member_count?: number | null;
  event_count?: number | null;
  amendment_count?: number | null;
}

interface DraftStep {
  group_id: string;
  label: string | null;
}

interface WorkflowEditorProps {
  workflows: WorkflowWithStepsRow[];
  isLoading: boolean;
  isEditorOpen: boolean;
  editingWorkflow: WorkflowWithStepsRow | null;
  draftName: string;
  setDraftName: (name: string) => void;
  draftDescription: string;
  setDraftDescription: (description: string) => void;
  draftSteps: DraftStep[];
  availableGroups: AvailableGroup[];
  onOpenNew: () => void;
  onOpenEdit: (workflow: WorkflowWithStepsRow) => void;
  onClose: () => void;
  onAddStep: (groupId: string, label: string | null) => void;
  onRemoveStep: (index: number) => void;
  onMoveStep: (fromIndex: number, toIndex: number) => void;
  onSave: () => void;
  onDelete: (workflowId: string) => void;
}

export function WorkflowEditor({
  workflows,
  isLoading,
  isEditorOpen,
  editingWorkflow,
  draftName,
  setDraftName,
  draftDescription,
  setDraftDescription,
  draftSteps,
  availableGroups,
  onOpenNew,
  onOpenEdit,
  onClose,
  onAddStep,
  onRemoveStep,
  onMoveStep,
  onSave,
  onDelete,
}: WorkflowEditorProps) {
  const { t } = useTranslation();
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [dragOverStepIndex, setDragOverStepIndex] = useState<number | null>(null);
  const [dragInsertPosition, setDragInsertPosition] = useState<'above' | 'below' | null>(null);
  const [isDescriptionCollapsed, setIsDescriptionCollapsed] = useState(false);

  const groupTypeaheadItems = useMemo(
    () =>
      toTypeaheadItems(
        availableGroups,
        'group',
        group => group.name ?? group.id,
        group => {
          const description = richTextToPlainText(group.description);
          return description ? description.substring(0, 60) : undefined;
        },
        undefined,
        group => `/group/${group.id}`
      ),
    [availableGroups]
  );

  const getGroupName = (groupId: string) => {
    return availableGroups.find(g => g.id === groupId)?.name ?? groupId;
  };

  const getGroupData = (step: DraftStep): AvailableGroup => {
    return (
      availableGroups.find(group => group.id === step.group_id) ?? {
        id: step.group_id,
        name: step.label ?? step.group_id,
      }
    );
  };

  const isNameValid = draftName.trim().length > 0;
  const isDescriptionValid = draftDescription.trim().length > 0;

  const resetDragState = useCallback(() => {
    setDraggedStepIndex(null);
    setDragOverStepIndex(null);
    setDragInsertPosition(null);
  }, []);

  const handleStepDragStart = useCallback(
    (event: React.DragEvent<HTMLButtonElement>, index: number) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
      setDraggedStepIndex(index);
      setDragOverStepIndex(index);
    },
    []
  );

  const handleStepDrop = useCallback(
    (targetIndex: number, position: 'above' | 'below' = 'below') => {
      if (draggedStepIndex === null || draggedStepIndex === targetIndex) {
        resetDragState();
        return;
      }

      let insertionIndex = targetIndex;
      if (position === 'below') {
        insertionIndex += 1;
      }
      if (draggedStepIndex < targetIndex) {
        insertionIndex -= 1;
      }

      insertionIndex = Math.max(0, Math.min(insertionIndex, draftSteps.length - 1));
      onMoveStep(draggedStepIndex, insertionIndex);
      resetDragState();
    },
    [draggedStepIndex, draftSteps.length, onMoveStep, resetDragState]
  );

  const handleStepDragEnd = useCallback(() => {
    resetDragState();
  }, [resetDragState]);

  const collapseDescriptionForSteps = useCallback(() => {
    setIsDescriptionCollapsed(true);
  }, []);

  useEffect(() => {
    if (isEditorOpen) {
      setIsDescriptionCollapsed(false);
    }
  }, [isEditorOpen, editingWorkflow?.id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {t('features.network.workflows.title', 'Workflows')}
        </h3>
        <Button variant="outline" size="sm" onClick={onOpenNew}>
          <Plus className="mr-2 h-4 w-4" />
          {t('features.network.workflows.create', 'New Workflow')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{t('common.loading', 'Loading...')}</p>
      ) : workflows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t('features.network.workflows.empty', 'No workflows defined yet.')}
        </p>
      ) : (
        <div className="space-y-3">
          {workflows.map(workflow => {
            const sorted = sortWorkflowSteps(workflow.steps);
            return (
              <Card key={workflow.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{workflow.name ?? 'Untitled'}</span>
                        {isWorkflowCircular(workflow) ? (
                          <Badge variant="secondary">
                            {t('features.network.workflows.circular', 'Circular')}
                          </Badge>
                        ) : null}
                        <Badge variant="outline">{workflow.steps.length} steps</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => onOpenEdit(workflow)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t('features.network.workflows.deleteConfirm', 'Delete workflow?')}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t(
                                'features.network.workflows.deleteDescription',
                                'This will permanently delete this workflow and all its steps.'
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(workflow.id)}>
                              {t('common.delete', 'Delete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  {sorted.length > 0 ? (
                    <div className="mt-3 flex flex-wrap items-center gap-1">
                      {sorted.map((step, index) => (
                        <span key={step.id} className="flex items-center gap-1">
                          <span className="bg-card inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium shadow-sm">
                            <span className="text-muted-foreground mr-1.5 text-[10px]">
                              {index + 1}
                            </span>
                            {step.group?.name ?? step.label ?? 'Unknown'}
                          </span>
                          {index < sorted.length - 1 ? (
                            <ChevronRight className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0" />
                          ) : null}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={isEditorOpen}
        onOpenChange={open => {
          if (!open) onClose();
        }}
      >
        <DialogContent className="grid h-[min(90dvh,56rem)] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pr-12 pb-4">
            <DialogTitle>
              {editingWorkflow
                ? t('features.network.workflows.edit', 'Edit Workflow')
                : t('features.network.workflows.create', 'New Workflow')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'features.network.workflows.editorDescription',
                'Define the ordered sequence of groups in this workflow. Groups can repeat to model circular processes.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-4 overflow-hidden px-6 py-4">
            <CreateInputField
              label={t('common.name', 'Name')}
              required
              value={draftName}
              onValueChange={setDraftName}
              placeholder={t(
                'features.network.workflows.namePlaceholder',
                'e.g. Legislative Reading Process'
              )}
            />

            <Collapsible
              open={!isDescriptionCollapsed}
              onOpenChange={open => setIsDescriptionCollapsed(!open)}
              className="space-y-2"
            >
              <div className="flex items-center justify-between gap-3">
                <Label>{t('common.description', 'Description')}</Label>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" type="button" className="h-8 px-2">
                    {isDescriptionCollapsed ? (
                      <>
                        <ChevronDown className="mr-1 h-4 w-4" />
                        {t('common.actions.expand', 'Expand')}
                      </>
                    ) : (
                      <>
                        <ChevronUp className="mr-1 h-4 w-4" />
                        {t('common.actions.collapse', 'Collapse')}
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <CreateTextareaField
                  required
                  value={draftDescription}
                  onValueChange={setDraftDescription}
                  placeholder={t(
                    'features.network.workflows.descriptionPlaceholder',
                    'Describe what this workflow is for...'
                  )}
                  className="min-h-[96px]"
                />
              </CollapsibleContent>
            </Collapsible>

            <div className="flex min-h-0 flex-col space-y-2">
              <Label>{t('features.network.workflows.steps', 'Steps')}</Label>
              {draftSteps.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t(
                    'features.network.workflows.noSteps',
                    'Add groups to define the workflow sequence.'
                  )}
                </p>
              ) : (
                <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
                  {draftSteps.map((step, index) => (
                    <div
                      key={`${step.group_id}-${index}`}
                      className={cn(
                        'relative rounded-lg transition-colors',
                        draggedStepIndex === index ? 'opacity-50' : '',
                        dragOverStepIndex === index && draggedStepIndex !== index
                          ? 'bg-accent/40'
                          : ''
                      )}
                      onDragOver={event => {
                        collapseDescriptionForSteps();
                        event.preventDefault();
                        const rect = event.currentTarget.getBoundingClientRect();
                        const isAbove = event.clientY < rect.top + rect.height / 2;
                        setDragOverStepIndex(index);
                        setDragInsertPosition(isAbove ? 'above' : 'below');
                      }}
                      onDragEnter={event => {
                        collapseDescriptionForSteps();
                        const rect = event.currentTarget.getBoundingClientRect();
                        const isAbove = event.clientY < rect.top + rect.height / 2;
                        setDragOverStepIndex(index);
                        setDragInsertPosition(isAbove ? 'above' : 'below');
                      }}
                      onDragLeave={() => {
                        if (dragOverStepIndex === index) {
                          setDragOverStepIndex(null);
                          setDragInsertPosition(null);
                        }
                      }}
                      onDrop={event => {
                        event.preventDefault();
                        handleStepDrop(index, dragInsertPosition ?? 'below');
                      }}
                    >
                      {dragOverStepIndex === index && dragInsertPosition === 'above' ? (
                        <div className="bg-primary absolute -top-1 right-6 left-6 z-20 h-0.5 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.9)]" />
                      ) : null}

                      <div className="bg-muted/40 mb-2 flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {t('features.network.workflows.stepOrder', 'Step')} {index + 1}
                          </Badge>
                          <span className="text-muted-foreground text-sm">
                            {getGroupName(step.group_id)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 cursor-grab active:cursor-grabbing"
                            draggable
                            aria-label={t(
                              'features.network.workflows.dragToReorder',
                              'Drag to reorder'
                            )}
                            title={t('features.network.workflows.dragToReorder', 'Drag to reorder')}
                            onMouseDown={event => event.stopPropagation()}
                            onClick={event => {
                              collapseDescriptionForSteps();
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            onDragStart={event => {
                              collapseDescriptionForSteps();
                              handleStepDragStart(event, index);
                            }}
                            onDragEnd={handleStepDragEnd}
                          >
                            <GripVertical className="h-4 w-4" />
                          </Button>
                          {index > 0 ? (
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                collapseDescriptionForSteps();
                                onMoveStep(index, index - 1);
                              }}
                              aria-label={t(
                                'features.network.workflows.moveStepUp',
                                'Move step up'
                              )}
                            >
                              ↑
                            </Button>
                          ) : null}
                          {index < draftSteps.length - 1 ? (
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                collapseDescriptionForSteps();
                                onMoveStep(index, index + 1);
                              }}
                              aria-label={t(
                                'features.network.workflows.moveStepDown',
                                'Move step down'
                              )}
                            >
                              ↓
                            </Button>
                          ) : null}
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              collapseDescriptionForSteps();
                              onRemoveStep(index);
                            }}
                            aria-label={t('features.network.workflows.removeStep', 'Remove step')}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="pointer-events-none">
                        <GroupSearchCard group={getGroupData(step)} />
                      </div>

                      {dragOverStepIndex === index && dragInsertPosition === 'below' ? (
                        <div className="bg-primary absolute right-6 -bottom-1 left-6 z-20 h-0.5 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.9)]" />
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-start gap-2 pt-2">
                <TypeaheadSearch
                  items={groupTypeaheadItems}
                  value={selectedGroupId}
                  onChange={(item: TypeaheadItem | null) => setSelectedGroupId(item?.id ?? '')}
                  onInteract={collapseDescriptionForSteps}
                  placeholder={t('features.network.workflows.selectGroup', 'Select group...')}
                  disablePortal
                  showAllOnFocus
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-0.5"
                  disabled={!selectedGroupId}
                  onClick={() => {
                    collapseDescriptionForSteps();
                    if (selectedGroupId) {
                      onAddStep(selectedGroupId, null);
                      setSelectedGroupId('');
                    }
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  {t('common.add', 'Add')}
                </Button>
              </div>
            </div>

            {draftSteps.length >= 2 ? (
              <div className="bg-muted rounded-md p-3">
                <p className="text-muted-foreground mb-1 text-xs font-medium">
                  {t('features.network.workflows.preview', 'Preview')}
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  {draftSteps.map((step, index) => (
                    <span key={index} className="flex items-center gap-1">
                      <span className="text-sm font-medium">{getGroupName(step.group_id)}</span>
                      {index < draftSteps.length - 1 ? (
                        <ArrowRight className="text-muted-foreground h-3 w-3" />
                      ) : null}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="border-t px-6 py-4">
            <Button variant="outline" onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={onSave}
              disabled={draftSteps.length < 2 || !isNameValid || !isDescriptionValid}
            >
              {editingWorkflow
                ? t('common.save', 'Save')
                : t('features.network.workflows.create', 'New Workflow')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
