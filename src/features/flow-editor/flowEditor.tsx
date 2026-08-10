import { featureThemeClassName, featureThemeValue } from '@/features/shared/theme';
import { FormControlInput, FormControlLabel } from '@/features/shared/ui/form';
import { Background, Controls, MiniMap, Panel, ReactFlow } from '@xyflow/react';
import type { EdgeTypes, NodeProps, NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';

import {
  useFlowEditorController,
  type FlowEditorController,
} from './hooks/useFlowEditorController';
import PositionableEdge from './PositionableEdge.tsx';
import type { FlowEditorEdge, FlowEditorNode } from './types';

const GroupNode = ({ data }: NodeProps<FlowEditorNode>) => {
  return (
    <>
      <div
        className="group-node-label"
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          padding: '2px 5px',
          background: featureThemeValue('floweditorFlowEditorOverlayColor'),
          borderRadius: '3px',
          fontSize: '12px',
          fontWeight: 'bold',
          zIndex: 1,
        }}
      >
        {data.label}
      </div>
      <div style={{ width: '100%', height: '100%', position: 'relative' }} />
    </>
  );
};

const nodeTypes: NodeTypes = {
  group: GroupNode,
};

const edgeTypes: EdgeTypes = {
  positionableedge: PositionableEdge,
};

export function FlowEditor() {
  const controller = useFlowEditorController();

  return <FlowEditorView controller={controller} />;
}

export function FlowEditorView({ controller }: { controller: FlowEditorController }) {
  const {
    nodes,
    edges,
    selectedNodes,
    selectedEdge,
    edgeLabel,
    setEdgeLabel,
    multiSelectMode,
    nodeLabel,
    setNodeLabel,
    isEditingNode,
    isInteractive,
    setIsInteractive,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onEdgeClick,
    handleInteractiveChange,
    updateEdgeLabel,
    toggleMultiSelectMode,
    createGroup,
    ungroupNodes,
    addProposalNode,
    resetWorkflow,
    startEditingNode,
    cancelEditNode,
    updateNodeProperties,
    deleteSelectedNodes,
    deleteSelectedEdge,
    resetEdgeState,
    clearSelectedEdge,
  } = controller;

  return (
    <div className="h-screen w-full">
      <ReactFlow<FlowEditorNode, FlowEditorEdge>
        nodes={nodes}
        edges={edges}
        nodesDraggable={isInteractive}
        nodesFocusable={isInteractive}
        nodesConnectable={isInteractive}
        edgesFocusable={isInteractive}
        edgesReconnectable={isInteractive}
        edgeTypes={edgeTypes}
        nodeTypes={nodeTypes}
        onNodesChange={isInteractive ? onNodesChange : undefined}
        onEdgesChange={isInteractive ? onEdgesChange : undefined}
        onConnect={isInteractive ? onConnect : undefined}
        onNodeClick={onNodeClick as never}
        onEdgeClick={onEdgeClick as never}
        fitView
      >
        <Panel
          position="top-left"
          className={featureThemeClassName('floweditorFlowEditorContrastPanel')}
        >
          <h2 className="mb-2 text-lg font-bold">
            {translateText('generated.inline.0528_city_council_workflow_b72c9f88')}
          </h2>
          <p className={featureThemeClassName('floweditorFlowEditorNeutralText')}>
            {translateText(
              'generated.inline.0529_interactive_diagram_showing_the_proposal_life_2110afd8'
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {isInteractive ? (
              <>
                <Button
                  size="sm"
                  data-action-id="flow-editor.toolbar.add-proposal"
                  onClick={addProposalNode}
                >
                  {translateText('generated.inline.0530_add_proposal_250e96f5')}
                </Button>
                <Button
                  size="sm"
                  data-action-id="flow-editor.toolbar.multi-select.toggle"
                  variant={multiSelectMode ? 'default' : 'outline'}
                  aria-pressed={multiSelectMode}
                  onClick={toggleMultiSelectMode}
                >
                  {multiSelectMode
                    ? translateText('generated.inline.0076_multi_select_on_ded38fcd')
                    : translateText('generated.inline.0077_multi_select_off_8e759b57')}
                </Button>
                {selectedNodes.length >= 2 ? (
                  <Button
                    size="sm"
                    data-action-id="flow-editor.toolbar.group-selected"
                    variant="secondary"
                    onClick={createGroup}
                  >
                    {translateText('generated.inline.0531_group_selected_dc201db7')}
                    {selectedNodes.length})
                  </Button>
                ) : null}
                {selectedNodes.length === 1 && selectedNodes[0].type === 'group' ? (
                  <Button
                    size="sm"
                    data-action-id="flow-editor.toolbar.ungroup"
                    variant="secondary"
                    onClick={ungroupNodes}
                  >
                    {translateText('generated.inline.0532_ungroup_2b31e968')}
                  </Button>
                ) : null}
                {selectedNodes.length > 0 ? (
                  <Button
                    size="sm"
                    data-action-id="flow-editor.toolbar.delete-selected"
                    variant="destructive"
                    onClick={deleteSelectedNodes}
                  >
                    {translateText('generated.inline.0533_delete_selected_76bf56ab')}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  data-action-id="flow-editor.toolbar.reset"
                  variant="outline"
                  onClick={resetWorkflow}
                >
                  {translateText('generated.inline.0343_reset_44c57abd')}
                </Button>
              </>
            ) : null}
            <Button
              size="sm"
              data-action-id="flow-editor.toolbar.interactivity.toggle"
              variant={isInteractive ? 'outline' : 'default'}
              aria-pressed={!isInteractive}
              onClick={() => setIsInteractive(!isInteractive)}
            >
              {isInteractive
                ? translateText('generated.inline.0078_lock_editor_357aaa55')
                : translateText('generated.inline.0079_unlock_editor_b60d9fb1')}
            </Button>
          </div>
        </Panel>

        {isInteractive && selectedNodes.length === 1 ? (
          <Panel
            position="top-right"
            className={featureThemeClassName('floweditorFlowEditorContrastPanelAlpha')}
          >
            {isEditingNode ? (
              <div className="space-y-2">
                <h3 className="text-md mb-2 font-bold">
                  {translateText('generated.inline.0534_edit_node_1519442f')}
                </h3>
                <FormControlLabel htmlFor="nodeLabel">
                  {translateText('generated.inline.0535_label_74341e3c')}
                </FormControlLabel>
                <FormControlInput
                  id="nodeLabel"
                  value={nodeLabel}
                  onChange={event => setNodeLabel(event.target.value)}
                  placeholder={translateText('generated.inline.0536_enter_node_label_4bb64c3c')}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    data-action-id="flow-editor.node.save"
                    onClick={updateNodeProperties}
                  >
                    {translateText('generated.inline.0269_save_efc007a3')}
                  </Button>
                  <Button
                    size="sm"
                    data-action-id="flow-editor.node.edit.cancel"
                    variant="outline"
                    onClick={cancelEditNode}
                  >
                    {translateText('generated.inline.0065_cancel_77dfd213')}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-md font-bold">{selectedNodes[0].data.label}</h3>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    data-action-id="flow-editor.node.edit.open"
                    onClick={startEditingNode}
                  >
                    {translateText('generated.inline.0534_edit_node_1519442f')}
                  </Button>
                  <Button
                    size="sm"
                    data-action-id="flow-editor.node.delete"
                    variant="destructive"
                    onClick={deleteSelectedNodes}
                  >
                    {translateText('generated.inline.0537_delete_f6fdbe48')}
                  </Button>
                </div>
              </div>
            )}
          </Panel>
        ) : null}

        {isInteractive && selectedEdge ? (
          <Panel
            position="top-right"
            className={featureThemeClassName('floweditorFlowEditorContrastPanelAlpha')}
          >
            <h3 className="text-md mb-2 font-bold">
              {translateText('generated.inline.0538_edit_edge_label_e8252be9')}
            </h3>
            <p>
              {translateText(
                'generated.inline.0539_double_click_an_edge_to_edit_edge_path_caff8e84'
              )}
            </p>
            <div className="space-y-2">
              <FormControlLabel htmlFor="edgeLabel">
                {translateText('generated.inline.0535_label_74341e3c')}
              </FormControlLabel>
              <FormControlInput
                id="edgeLabel"
                value={edgeLabel}
                onChange={event => setEdgeLabel(event.target.value)}
                placeholder={translateText('generated.inline.0540_enter_edge_label_ec3a6029')}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  data-action-id="flow-editor.edge.label.save"
                  onClick={updateEdgeLabel}
                >
                  {translateText('generated.inline.0541_update_label_b571fe01')}
                </Button>
                <Button
                  size="sm"
                  data-action-id="flow-editor.edge.edit.cancel"
                  variant="outline"
                  onClick={clearSelectedEdge}
                >
                  {translateText('generated.inline.0065_cancel_77dfd213')}
                </Button>
                <Button
                  size="sm"
                  data-action-id="flow-editor.edge.delete"
                  variant="destructive"
                  onClick={deleteSelectedEdge}
                >
                  {translateText('generated.inline.0542_delete_edge_6351bded')}
                </Button>
                <Button
                  size="sm"
                  data-action-id="flow-editor.edge.path.reset"
                  variant="outline"
                  onClick={resetEdgeState}
                >
                  {translateText('generated.inline.0543_reset_edge_path_e7f03a62')}
                </Button>
              </div>
            </div>
          </Panel>
        ) : null}

        <Controls onInteractiveChange={handleInteractiveChange} />
        <MiniMap zoomable pannable />
        <Background color={featureThemeValue('floweditorFlowEditorNeutralColor')} gap={16} />
      </ReactFlow>
    </div>
  );
}
