/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkflowEditorContentView } from '../WorkflowEditorContentView';

const state = vi.hoisted(() => ({
  active: false,
  dialogProps: [] as any[],
  groupFlowProps: [] as any[],
  overlayProps: [] as any[],
  sections: [] as any[],
  typeaheadProps: [] as any[],
}));

vi.mock('@/features/shared/ui/ui/accordion', () => ({
  Accordion: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionTrigger: ({ children, ...props }: { children: ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/features/shared/ui/ui/tabs', async () => {
  const React = await import('react');
  const TabsContext = React.createContext<(value: string) => void>(() => undefined);
  return {
    Tabs: ({
      children,
      onValueChange,
    }: {
      children: ReactNode;
      onValueChange: (value: string) => void;
    }) => (
      <TabsContext.Provider value={onValueChange}>
        <div>{children}</div>
      </TabsContext.Provider>
    ),
    TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    TabsTrigger: ({ children, value, ...props }: { children: ReactNode; value: string }) => {
      const onValueChange = React.useContext(TabsContext);
      return (
        <button type="button" onClick={() => onValueChange(value)} {...props}>
          {children}
        </button>
      );
    },
  };
});

vi.mock('@/features/shared/ui/form', async () => {
  const React = await import('react');
  const SelectContext = React.createContext<(value: string) => void>(() => undefined);
  return {
    FormControlInput: (props: React.ComponentProps<'input'>) => <input {...props} />,
    FormControlLabel: ({ children }: { children: ReactNode }) => <label>{children}</label>,
    FormControlTextarea: (props: React.ComponentProps<'textarea'>) => <textarea {...props} />,
    FormControlSelect: ({
      children,
      onValueChange,
      ...props
    }: {
      children: ReactNode;
      onValueChange: (value: string) => void;
    }) => (
      <SelectContext.Provider value={onValueChange}>
        <div {...props}>{children}</div>
      </SelectContext.Provider>
    ),
    FormControlSelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    FormControlSelectItem: ({
      children,
      value,
      ...props
    }: {
      children: ReactNode;
      value: string;
    }) => {
      const onValueChange = React.useContext(SelectContext);
      return (
        <button type="button" onClick={() => onValueChange(value)} {...props}>
          {children}
        </button>
      );
    },
    FormControlSelectTrigger: ({ children, ...props }: { children: ReactNode }) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    FormControlSelectValue: () => null,
    FormControlSwitch: ({
      checked,
      onCheckedChange,
      ...props
    }: {
      checked: boolean;
      onCheckedChange: (checked: boolean) => void;
    }) => (
      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onCheckedChange(!checked)}
        {...props}
      />
    ),
  };
});

vi.mock('@/features/shared/ui/dialog', () => ({
  ManagementDialogBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ManagementDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ManagementDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ManagementDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ManagementDialogSection: (props: any) => {
    state.sections.push(props);
    return <div>{props.children}</div>;
  },
}));

vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: (props: any) => {
    state.dialogProps.push(props);
    return <div>{props.children}</div>;
  },
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/features/shared/ui/typeahead/TypeaheadSearch', () => ({
  TypeaheadSearch: (props: any) => {
    state.typeaheadProps.push(props);
    return <div />;
  },
}));

vi.mock('@/features/shared/ui/action-submission', () => ({
  ActionSubmissionOverlay: (props: any) => {
    state.overlayProps.push(props);
    return null;
  },
  useActionSubmission: () => ({
    error: null,
    isActive: state.active,
    progressSteps: [],
    reset: vi.fn(),
    retry: vi.fn(),
    runActionWithSubmission: async (
      action: (context: object) => unknown,
      options?: { onSuccess?: () => void }
    ) => {
      await action({});
      options?.onSuccess?.();
    },
    status: 'idle',
  }),
}));

vi.mock('../GroupNetworkFlow', () => ({
  GroupNetworkFlow: (props: any) => {
    state.groupFlowProps.push(props);
    return <div />;
  },
}));
vi.mock('../WorkflowFlowVisualization', () => ({ WorkflowFlowVisualization: () => <div /> }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.active = false;
  state.dialogProps = [];
  state.groupFlowProps = [];
  state.overlayProps = [];
  state.sections = [];
  state.typeaheadProps = [];
});

function workflowProps(overrides: Record<string, unknown> = {}) {
  return {
    allGroupItems: [],
    availableGroups: [
      { id: 'group-1', name: 'Council' },
      { id: 'group-2', name: 'Chapter' },
      { id: 'group-null', name: null },
    ],
    builderTab: 'graph',
    canSave: true,
    currentGroupId: 'group-1',
    currentGroupName: 'Council',
    draftDescription: '',
    draftIsDefaultEntry: false,
    draftName: '',
    draftStartGroupId: '',
    draftSteps: [],
    editingWorkflow: null,
    finalTargetGroupId: null,
    getDirectTargetGroups: vi.fn(() => [{ id: 'group-null', name: null }]),
    graphRootGroupId: 'group-1',
    graphSelectionMode: 'start',
    handleAddPendingStep: vi.fn(),
    handleGraphGroupClick: vi.fn(),
    handleRowDrop: vi.fn(),
    handleRowTargetChange: vi.fn(),
    invalidTransitionIndexes: [],
    isOpen: true,
    isPendingStepValid: false,
    onClose: vi.fn(),
    onMoveStep: vi.fn(),
    onRemoveStep: vi.fn(),
    onSave: vi.fn(),
    pendingHighlightGroupIds: [],
    pendingSourceGroupId: '',
    pendingTargetGroupId: '',
    pendingTargetItems: [],
    previewWorkflow: null,
    setBuilderTab: vi.fn(),
    setDraftDescription: vi.fn(),
    setDraftIsDefaultEntry: vi.fn(),
    setDraftName: vi.fn(),
    setDraftStartGroupId: vi.fn(),
    setDraggedStepIndex: vi.fn(),
    setGraphSelectionMode: vi.fn(),
    setPendingTargetGroupId: vi.fn(),
    setVisualizationTab: vi.fn(),
    t: (key: string, fallback?: string) => fallback ?? key,
    validationMessages: ['Invalid'],
    visualizationTab: 'graph',
    ...overrides,
  } as Parameters<typeof WorkflowEditorContentView>[0];
}

describe('workflow editor stable actions', () => {
  it('covers empty, nullable, drag, typeahead, dialog, validation, and submission states', async () => {
    const empty = workflowProps();
    const { rerender } = render(<WorkflowEditorContentView {...empty} />);
    state.dialogProps.at(-1).onOpenChange(true);
    state.dialogProps.at(-1).onOpenChange(false);
    expect(empty.onClose).toHaveBeenCalledOnce();

    for (const typeahead of state.typeaheadProps) {
      typeahead.onChange?.({ id: 'group-2' });
      typeahead.onChange?.(null);
    }
    expect(empty.setDraftStartGroupId).toHaveBeenCalledWith('group-2');
    expect(empty.setDraftStartGroupId).toHaveBeenCalledWith('');
    expect(empty.setGraphSelectionMode).toHaveBeenCalledWith('target');

    const populated = workflowProps({
      currentGroupName: '',
      draftStartGroupId: 'missing-group',
      draftSteps: [
        { id: null, group_id: 'group-null', label: null },
        { id: 'step-2', group_id: 'group-2', label: 'Decision' },
      ],
      editingWorkflow: { id: 'workflow-1', name: 'Existing workflow' },
      finalTargetGroupId: 'group-2',
      graphSelectionMode: 'target',
      invalidTransitionIndexes: [0],
      isPendingStepValid: true,
      pendingSourceGroupId: 'missing-group',
      pendingTargetGroupId: 'group-2',
      previewWorkflow: { id: 'preview' },
      validationMessages: [],
      visualizationTab: 'list',
    });
    rerender(<WorkflowEditorContentView {...populated} />);
    fireEvent.change(document.querySelector('input')!, { target: { value: 'Renamed' } });
    fireEvent.change(document.querySelector('textarea')!, { target: { value: 'Changed' } });
    expect(populated.setDraftName).toHaveBeenCalledWith('Renamed');
    expect(populated.setDraftDescription).toHaveBeenCalledWith('Changed');
    state.groupFlowProps.at(-1).onGroupClick('group-2');
    expect(populated.handleGraphGroupClick).toHaveBeenCalledWith('group-2');
    for (const typeahead of state.typeaheadProps) {
      typeahead.onChange?.({ id: 'group-2' });
      typeahead.onChange?.(null);
    }
    for (const section of state.sections.filter(section => section.draggable)) {
      section.onDragStart();
      section.onDragOver({ preventDefault: vi.fn() });
      section.onDrop();
    }
    expect(populated.setDraggedStepIndex).toHaveBeenCalled();
    expect(populated.handleRowDrop).toHaveBeenCalled();

    rerender(
      <WorkflowEditorContentView
        {...workflowProps({
          draftStartGroupId: '',
          draftSteps: [{ id: 'step-empty-source', group_id: 'group-2', label: null }],
          finalTargetGroupId: 'group-2',
          graphSelectionMode: 'target',
          pendingSourceGroupId: '',
        })}
      />
    );
    rerender(
      <WorkflowEditorContentView
        {...workflowProps({
          draftSteps: [
            { id: 'step-without-group', group_id: '', label: null },
            { id: 'step-after-empty', group_id: 'group-2', label: null },
          ],
        })}
      />
    );

    state.active = true;
    rerender(
      <WorkflowEditorContentView
        {...workflowProps({
          draftName: '',
          editingWorkflow: { id: 'workflow-2', name: 'Existing title' },
        })}
      />
    );
    expect(state.overlayProps.at(-1).preview.title).toBe('Existing title');
    state.active = true;
    rerender(
      <WorkflowEditorContentView {...workflowProps({ draftName: '', editingWorkflow: null })} />
    );
    expect(state.overlayProps.at(-1).preview.title).toBe('features.network.workflows.previewTitle');
    state.overlayProps.at(-1).onRetry();

    state.active = false;
    const rejectedSave = workflowProps({ onSave: vi.fn().mockRejectedValue(new Error('failed')) });
    rerender(<WorkflowEditorContentView {...rejectedSave} />);
    fireEvent.click(document.querySelector('[data-action-id="network.workflow-editor.save"]')!);
    await waitFor(() => expect(rejectedSave.onSave).toHaveBeenCalled());
  });

  it('builds, reorders, configures, closes, and saves a workflow through stable intents', async () => {
    const setBuilderTab = vi.fn();
    const setGraphSelectionMode = vi.fn();
    const handleAddPendingStep = vi.fn();
    const setDraftIsDefaultEntry = vi.fn();
    const setVisualizationTab = vi.fn();
    const onMoveStep = vi.fn();
    const onRemoveStep = vi.fn();
    const handleRowTargetChange = vi.fn();
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(
      <WorkflowEditorContentView
        {...({
          allGroupItems: [],
          availableGroups: [
            { id: 'group-1', name: 'Council' },
            { id: 'group-2', name: 'Chapter' },
          ],
          builderTab: 'graph',
          canSave: true,
          currentGroupId: 'group-1',
          currentGroupName: 'Council',
          draftDescription: '',
          draftIsDefaultEntry: false,
          draftName: 'Motion path',
          draftStartGroupId: 'group-1',
          draftSteps: [
            { id: 'step-1', group_id: 'group-2', label: 'Review' },
            { id: 'step-2', group_id: 'group-1', label: 'Decision' },
          ],
          editingWorkflow: null,
          finalTargetGroupId: 'group-1',
          getDirectTargetGroups: () => [{ id: 'group-2', name: 'Chapter' }],
          graphRootGroupId: 'group-1',
          graphSelectionMode: 'start',
          handleAddPendingStep,
          handleGraphGroupClick: vi.fn(),
          handleRowDrop: vi.fn(),
          handleRowTargetChange,
          invalidTransitionIndexes: [],
          isOpen: true,
          isPendingStepValid: true,
          onClose,
          onMoveStep,
          onRemoveStep,
          onSave,
          pendingHighlightGroupIds: [],
          pendingSourceGroupId: 'group-1',
          pendingTargetGroupId: 'group-2',
          pendingTargetItems: [],
          previewWorkflow: { id: 'workflow-1' },
          setBuilderTab,
          setDraftDescription: vi.fn(),
          setDraftIsDefaultEntry,
          setDraftName: vi.fn(),
          setDraftStartGroupId: vi.fn(),
          setDraggedStepIndex: vi.fn(),
          setGraphSelectionMode,
          setPendingTargetGroupId: vi.fn(),
          setVisualizationTab,
          t: (key: string) => key,
          validationMessages: [],
          visualizationTab: 'list',
        } as Parameters<typeof WorkflowEditorContentView>[0])}
      />
    );

    const click = (actionId: string, index = 0) =>
      fireEvent.click(document.querySelectorAll(`[data-action-id="${actionId}"]`)[index]!);

    click('network.workflow-editor.step-config.toggle');
    click('network.workflow-editor.builder.type.select');
    click('network.workflow-editor.builder.graph.select');
    click('network.workflow-editor.step.add');
    click('network.workflow-editor.settings.toggle');
    click('network.workflow-editor.default-entry.toggle');
    click('network.workflow-editor.preview.graph.select');
    click('network.workflow-editor.preview.list.select');
    click('network.workflow-editor.step.move-up', 1);
    click('network.workflow-editor.step.move-down');
    click('network.workflow-editor.step.remove');
    click('network.workflow-editor.step.target.option');
    click('network.workflow-editor.close');
    click('network.workflow-editor.save');

    expect(setBuilderTab.mock.calls).toEqual([['type'], ['graph']]);
    expect(setGraphSelectionMode).not.toHaveBeenCalled();
    expect(handleAddPendingStep).toHaveBeenCalledOnce();
    expect(setDraftIsDefaultEntry).toHaveBeenCalledWith(true);
    expect(setVisualizationTab.mock.calls).toEqual([['graph'], ['list']]);
    expect(onMoveStep.mock.calls).toEqual([
      [1, 0],
      [0, 1],
    ]);
    expect(onRemoveStep).toHaveBeenCalledWith(0);
    expect(handleRowTargetChange).toHaveBeenCalledWith(0, 'group-2');
    expect(onClose).toHaveBeenCalled();
    await waitFor(() => expect(onSave).toHaveBeenCalled());
  });
});
