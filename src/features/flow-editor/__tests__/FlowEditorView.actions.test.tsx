/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const xyflow = vi.hoisted(() => ({ props: null as any }));
const controllerHook = vi.hoisted(() => ({ value: null as any }));

vi.mock('@xyflow/react', () => ({
  Background: () => null,
  Controls: ({ onInteractiveChange }: any) => (
    <button onClick={() => onInteractiveChange(false)}>controls-interactive</button>
  ),
  MiniMap: () => null,
  Panel: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  ReactFlow: (props: any) => {
    xyflow.props = props;
    const Group = props.nodeTypes?.group;
    return (
      <main>
        {Group ? <Group data={{ label: 'Group node' }} /> : null}
        {props.children}
      </main>
    );
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('../PositionableEdge', () => ({ default: () => null }));
vi.mock('../hooks/useFlowEditorController', () => ({
  useFlowEditorController: () => controllerHook.value,
}));

import { FlowEditor, FlowEditorView } from '../flowEditor';
import type { FlowEditorController } from '../hooks/useFlowEditorController';

afterEach(cleanup);

const action = (container: HTMLElement, id: string) => {
  const element = container.querySelector<HTMLElement>(`[data-action-id="${id}"]`);
  expect(element, id).not.toBeNull();
  return element!;
};

const createController = (overrides: Partial<FlowEditorController> = {}) => {
  const handlers = {
    setEdgeLabel: vi.fn(),
    setNodeLabel: vi.fn(),
    setIsInteractive: vi.fn(),
    onNodesChange: vi.fn(),
    onEdgesChange: vi.fn(),
    onConnect: vi.fn(),
    onNodeClick: vi.fn(),
    onEdgeClick: vi.fn(),
    handleInteractiveChange: vi.fn(),
    updateEdgeLabel: vi.fn(),
    toggleMultiSelectMode: vi.fn(),
    createGroup: vi.fn(),
    ungroupNodes: vi.fn(),
    addProposalNode: vi.fn(),
    resetWorkflow: vi.fn(),
    startEditingNode: vi.fn(),
    cancelEditNode: vi.fn(),
    updateNodeProperties: vi.fn(),
    deleteSelectedNodes: vi.fn(),
    deleteSelectedEdge: vi.fn(),
    resetEdgeState: vi.fn(),
    clearSelectedEdge: vi.fn(),
  };
  const controller = {
    nodes: [],
    edges: [],
    selectedNodes: [],
    selectedEdge: null,
    edgeLabel: '',
    multiSelectMode: false,
    nodeLabel: '',
    isEditingNode: false,
    isInteractive: true,
    ...handlers,
    ...overrides,
  } as unknown as FlowEditorController;

  return { controller, handlers };
};

describe('FlowEditorView action contract', () => {
  it('composes the live controller and custom group node into React Flow', () => {
    controllerHook.value = createController({
      nodes: Array.from({ length: 11 }, (_, index) => ({ id: String(index + 1) })) as any,
      edges: Array.from({ length: 11 }, (_, index) => ({ id: `edge-${index + 1}` })) as any,
    }).controller;
    const { getByText } = render(<FlowEditor />);
    expect(getByText('Group node')).toBeTruthy();
    expect(xyflow.props.nodes).toHaveLength(11);
    expect(xyflow.props.edges).toHaveLength(11);
  });

  it('dispatches every available toolbar action through a stable semantic action', () => {
    const selectedNodes = [
      { id: 'a', type: 'proposal', data: { label: 'A' } },
      { id: 'b', type: 'proposal', data: { label: 'B' } },
    ] as FlowEditorController['selectedNodes'];
    const { controller, handlers } = createController({ selectedNodes });
    const { container } = render(<FlowEditorView controller={controller} />);

    const cases = [
      ['flow-editor.toolbar.add-proposal', handlers.addProposalNode],
      ['flow-editor.toolbar.multi-select.toggle', handlers.toggleMultiSelectMode],
      ['flow-editor.toolbar.group-selected', handlers.createGroup],
      ['flow-editor.toolbar.delete-selected', handlers.deleteSelectedNodes],
      ['flow-editor.toolbar.reset', handlers.resetWorkflow],
      ['flow-editor.toolbar.interactivity.toggle', handlers.setIsInteractive],
    ] as const;
    for (const [id, handler] of cases) {
      const button = action(container, id);
      button.focus();
      expect(document.activeElement).toBe(button);
      fireEvent.click(button);
      expect(handler, id).toHaveBeenCalledTimes(1);
    }
    expect(handlers.setIsInteractive).toHaveBeenCalledWith(false);
  });

  it('dispatches ungroup and node inspector actions in their applicable states', () => {
    const group = [
      { id: 'group', type: 'group', data: { label: 'Group' } },
    ] as FlowEditorController['selectedNodes'];
    const base = createController({ selectedNodes: group });
    const { container, rerender } = render(<FlowEditorView controller={base.controller} />);

    fireEvent.click(action(container, 'flow-editor.toolbar.ungroup'));
    fireEvent.click(action(container, 'flow-editor.node.edit.open'));
    fireEvent.click(action(container, 'flow-editor.node.delete'));
    expect(base.handlers.ungroupNodes).toHaveBeenCalledTimes(1);
    expect(base.handlers.startEditingNode).toHaveBeenCalledTimes(1);
    expect(base.handlers.deleteSelectedNodes).toHaveBeenCalledTimes(1);

    rerender(<FlowEditorView controller={{ ...base.controller, isEditingNode: true }} />);
    fireEvent.click(action(container, 'flow-editor.node.save'));
    fireEvent.click(action(container, 'flow-editor.node.edit.cancel'));
    expect(base.handlers.updateNodeProperties).toHaveBeenCalledTimes(1);
    expect(base.handlers.cancelEditNode).toHaveBeenCalledTimes(1);
  });

  it('wires editable labels, non-group selection, multi-select copy, and graph callbacks', () => {
    const selectedNodes = [
      { id: 'node', type: 'proposal', data: { label: 'Node' } },
    ] as FlowEditorController['selectedNodes'];
    const base = createController({ selectedNodes, multiSelectMode: true, isEditingNode: true });
    const { container, rerender } = render(<FlowEditorView controller={base.controller} />);
    expect(container.textContent).toContain('generated.inline.0076_multi_select_on_ded38fcd');
    expect(container.querySelector('[data-action-id="flow-editor.toolbar.ungroup"]')).toBeNull();
    fireEvent.change(container.querySelector('#nodeLabel')!, { target: { value: 'Changed' } });
    expect(base.handlers.setNodeLabel).toHaveBeenCalledWith('Changed');
    xyflow.props.onNodesChange([]);
    xyflow.props.onEdgesChange([]);
    xyflow.props.onConnect({ source: 'a', target: 'b' });
    expect(base.handlers.onNodesChange).toHaveBeenCalled();
    expect(base.handlers.onEdgesChange).toHaveBeenCalled();
    expect(base.handlers.onConnect).toHaveBeenCalled();
    const edge = { id: 'edge', source: 'a', target: 'b' } as any;
    rerender(
      <FlowEditorView controller={{ ...base.controller, selectedNodes: [], selectedEdge: edge }} />
    );
    fireEvent.change(container.querySelector('#edgeLabel')!, { target: { value: 'Edge label' } });
    expect(base.handlers.setEdgeLabel).toHaveBeenCalledWith('Edge label');
  });

  it('removes mutation callbacks and unlocks from the locked state', () => {
    const base = createController({ isInteractive: false });
    const { container } = render(<FlowEditorView controller={base.controller} />);
    expect(xyflow.props.onNodesChange).toBeUndefined();
    expect(xyflow.props.onEdgesChange).toBeUndefined();
    expect(xyflow.props.onConnect).toBeUndefined();
    expect(container.querySelector('[data-action-id="flow-editor.toolbar.reset"]')).toBeNull();
    fireEvent.click(action(container, 'flow-editor.toolbar.interactivity.toggle'));
    expect(base.handlers.setIsInteractive).toHaveBeenCalledWith(true);
    fireEvent.click(
      [...container.querySelectorAll('button')].find(
        button => button.textContent === 'controls-interactive'
      )!
    );
    expect(base.handlers.handleInteractiveChange).toHaveBeenCalledWith(false);
  });

  it('dispatches all edge inspector actions with stable identities', () => {
    const selectedEdge = {
      id: 'edge',
      source: 'a',
      target: 'b',
    } as FlowEditorController['selectedEdge'];
    const { controller, handlers } = createController({ selectedEdge });
    const { container } = render(<FlowEditorView controller={controller} />);

    const cases = [
      ['flow-editor.edge.label.save', handlers.updateEdgeLabel],
      ['flow-editor.edge.edit.cancel', handlers.clearSelectedEdge],
      ['flow-editor.edge.delete', handlers.deleteSelectedEdge],
      ['flow-editor.edge.path.reset', handlers.resetEdgeState],
    ] as const;
    for (const [id, handler] of cases) {
      fireEvent.click(action(container, id));
      expect(handler, id).toHaveBeenCalledTimes(1);
    }
  });
});
