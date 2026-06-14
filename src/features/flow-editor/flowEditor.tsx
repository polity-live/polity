import { useCallback, useState } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from 'reactflow';
import type { NodeTypes } from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Input } from '@/features/shared/ui/ui/input.tsx';
import { Label } from '@/features/shared/ui/ui/label.tsx';
import PositionableEdge from './PositionableEdge.tsx';
import './PositionableEdge.css';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

// Define missing types since they're not exported
interface Connection {
  source: string | null;
  target: string | null;
  sourceHandle: string | null;
  targetHandle: string | null;
}

interface Node {
  id: string;
  position: { x: number; y: number };

  data: { label: string };
  type?: string;
  style?: React.CSSProperties;
  parentId?: string;
  extent?: 'parent';
}

interface Edge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  type?: string;
  style?: React.CSSProperties;
  data?: {
    label?: string;
    type?: string;
    positionHandlers?: { x: number; y: number; active: boolean }[];
  };
}

// Custom Group Node component
//ts-expect-warn-next-line
const GroupNode = ({ data }: { data: { label: string }; selected: boolean }) => {
  return (
    <>
      <div
        className="group-node-label"
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          padding: '2px 5px',
          background: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '3px',
          fontSize: '12px',
          fontWeight: 'bold',
          zIndex: 1,
        }}
      >
        {data.label}
      </div>
      {/* This is a wrapper that contains the child nodes */}
      <div style={{ width: '100%', height: '100%', position: 'relative' }} />
    </>
  );
};

// Node types configuration
const nodeTypes: NodeTypes = {
  group: GroupNode,
};

const edgeTypes = {
  positionableedge: PositionableEdge,
};

// Initial nodes representing a city council workflow
const initialNodes: Node[] = [
  {
    id: '1',
    data: {
      label: translateText('generated.inline.0118_proposal_submission_386e2a6a'),
    },
    style: { background: '#bbdefb', padding: 10, borderRadius: 5, width: 180 },
    position: { x: 250, y: 0 },
  },
  {
    id: '2',
    data: {
      label: translateText('generated.inline.0119_initial_review_cec95fcf'),
    },
    style: { background: '#bbdefb', padding: 10, borderRadius: 5, width: 180 },
    position: { x: 250, y: 100 },
  },
  {
    id: '3',
    data: {
      label: translateText('generated.inline.0120_committee_assignment_8bc00fbc'),
    },
    style: { background: '#ffe0b2', padding: 10, borderRadius: 5, width: 180 },
    position: { x: 250, y: 200 },
  },
  {
    id: '4',
    data: {
      label: translateText('generated.inline.0121_committee_review_2fc4ec57'),
    },
    style: { background: '#bbdefb', padding: 10, borderRadius: 5, width: 180 },
    position: { x: 100, y: 300 },
  },
  {
    id: '5',
    data: {
      label: translateText('generated.inline.0122_budget_analysis_6db26dd5'),
    },
    style: { background: '#bbdefb', padding: 10, borderRadius: 5, width: 180 },
    position: { x: 400, y: 300 },
  },
  {
    id: '6',
    data: {
      label: translateText('generated.inline.0123_committee_vote_ea9e0ee3'),
    },
    style: { background: '#ffe0b2', padding: 10, borderRadius: 5, width: 180 },
    position: { x: 250, y: 400 },
  },
  {
    id: '7',
    data: {
      label: translateText('generated.inline.0124_council_agenda_c7d1ce55'),
    },
    style: { background: '#bbdefb', padding: 10, borderRadius: 5, width: 180 },
    position: { x: 250, y: 500 },
  },
  {
    id: '8',
    data: {
      label: translateText('generated.inline.0125_public_hearing_6f510605'),
    },
    style: { background: '#bbdefb', padding: 10, borderRadius: 5, width: 180 },
    position: { x: 250, y: 600 },
  },
  {
    id: '9',
    data: {
      label: translateText('generated.inline.0126_council_vote_3947dff9'),
    },
    style: { background: '#ffe0b2', padding: 10, borderRadius: 5, width: 180 },
    position: { x: 250, y: 700 },
  },
  {
    id: '10',
    data: {
      label: translateText('generated.inline.0127_mayor_signature_c164c480'),
    },
    style: { background: '#c8e6c9', padding: 10, borderRadius: 5, width: 180 },
    position: { x: 250, y: 800 },
  },
  {
    id: '11',
    data: {
      label: translateText('generated.inline.0128_implementation_8781d615'),
    },
    style: { background: '#bbdefb', padding: 10, borderRadius: 5, width: 180 },
    position: { x: 250, y: 900 },
  },
];

// Initial edges connecting the nodes
const initialEdges: Edge[] = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    animated: true,
    style: { strokeDasharray: '5 5' },
    type: 'positionableedge',
    data: { type: 'smoothstep', positionHandlers: [] },
  },
  {
    id: 'e2-3',
    source: '2',
    target: '3',
    animated: true,
    style: { strokeDasharray: '5 5' },
    type: 'positionableedge',
    data: { type: 'smoothstep', positionHandlers: [] },
  },
  {
    id: 'e3-4',
    source: '3',
    target: '4',
    label: translateText('generated.inline.0129_policy_review_674319c2'),
    animated: true,
    style: { strokeDasharray: '5 5' },
    type: 'positionableedge',
    data: { type: 'smoothstep', positionHandlers: [] },
  },
  {
    id: 'e3-5',
    source: '3',
    target: '5',
    label: translateText('generated.inline.0130_budget_impact_d1e9449e'),
    animated: true,
    style: { strokeDasharray: '5 5' },
    type: 'positionableedge',
    data: { type: 'smoothstep', positionHandlers: [] },
  },
  {
    id: 'e4-6',
    source: '4',
    target: '6',
    animated: true,
    style: { strokeDasharray: '5 5' },
    type: 'positionableedge',
    data: { type: 'smoothstep', positionHandlers: [] },
  },
  {
    id: 'e5-6',
    source: '5',
    target: '6',
    animated: true,
    style: { strokeDasharray: '5 5' },
    type: 'positionableedge',
    data: { type: 'smoothstep', positionHandlers: [] },
  },
  {
    id: 'e6-7',
    source: '6',
    target: '7',
    label: translateText('generated.inline.0131_approved_by_committee_bd1a81e8'),
    animated: true,
    style: { strokeDasharray: '5 5' },
    type: 'positionableedge',
    data: { type: 'smoothstep', positionHandlers: [] },
  },
  {
    id: 'e7-8',
    source: '7',
    target: '8',
    animated: true,
    style: { strokeDasharray: '5 5' },
    type: 'positionableedge',
    data: { type: 'smoothstep', positionHandlers: [] },
  },
  {
    id: 'e8-9',
    source: '8',
    target: '9',
    animated: true,
    style: { strokeDasharray: '5 5' },
    type: 'positionableedge',
    data: { type: 'smoothstep', positionHandlers: [] },
  },
  {
    id: 'e9-10',
    source: '9',
    target: '10',
    label: translateText('generated.inline.0078_passed_271d60f4'),
    animated: true,
    style: { strokeDasharray: '5 5' },
    type: 'positionableedge',
    data: { type: 'smoothstep', positionHandlers: [] },
  },
  {
    id: 'e10-11',
    source: '10',
    target: '11',
    label: translateText('generated.inline.0132_signed_6e3665d8'),
    animated: true,
    style: { strokeDasharray: '5 5' },
    type: 'positionableedge',
    data: { type: 'smoothstep', positionHandlers: [] },
  },
];

export function FlowEditor() {
  // Initialize nodes and edges with our predefined city council workflow
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [edgeLabel, setEdgeLabel] = useState<string>('');
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [nodeLabel, setNodeLabel] = useState<string>('');
  const [isEditingNode, setIsEditingNode] = useState(false);
  // Add state for interactive mode
  const [isInteractive, setIsInteractive] = useState<boolean>(true);

  // Handle interactive mode changes
  const handleInteractiveChange = useCallback((interactiveState: boolean) => {
    setIsInteractive(interactiveState);

    // Clear selections when locking the editor
    if (!interactiveState) {
      setSelectedNodes([]);
      setSelectedEdge(null);
      setIsEditingNode(false);
    }
  }, []);

  // Handle new connections between nodes
  const onConnect = useCallback(
    (params: Connection | Edge) =>
      setEdges(eds =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { strokeDasharray: '5 5' },
            type: 'positionableedge',
            data: { type: 'smoothstep', positionHandlers: [] },
          },
          eds
        )
      ),
    [setEdges]
  );

  // Handle node selection
  const onNodeClick = useCallback(
    (event: NodeMouseHandler, node: Node) => {
      if (!isInteractive) return; // Prevent selection when not interactive

      // Clear selected edge when selecting a node
      setSelectedEdge(null);

      if (multiSelectMode) {
        // In multi-select mode, toggle the node selection
        setSelectedNodes(prev => {
          const isSelected = prev.some(n => n.id === node.id);
          if (isSelected) {
            return prev.filter(n => n.id !== node.id);
          } else {
            return [...prev, node];
          }
        });
      } else {
        // In single-select mode, just select this node
        setSelectedNodes([node]);
        setNodeLabel(node.data.label || '');
        setIsEditingNode(false);
      }
    },
    [multiSelectMode, isInteractive]
  );

  // Handle edge selection
  const onEdgeClick = useCallback(
    (event: EdgeMouseHandler, edge: Edge) => {
      if (!isInteractive) return; // Prevent selection when not interactive

      // Clear selected nodes when selecting an edge
      setSelectedNodes([]);
      setSelectedEdge(edge);
      setEdgeLabel(edge.label || '');
    },
    [isInteractive]
  );

  // Update edge label
  const updateEdgeLabel = useCallback(() => {
    if (!selectedEdge) return;

    setEdges(eds =>
      eds.map(e => {
        if (e.id === selectedEdge.id) {
          return { ...e, label: edgeLabel };
        }
        return e;
      })
    );
  }, [selectedEdge, edgeLabel, setEdges]);

  // Toggle multi-select mode
  const toggleMultiSelectMode = useCallback(() => {
    setMultiSelectMode(prev => !prev);
    if (!multiSelectMode) {
      // Clear selection when entering multi-select mode
      setSelectedNodes([]);
    }
  }, [multiSelectMode]);

  // Create a group from selected nodes
  const createGroup = useCallback(() => {
    if (selectedNodes.length < 2) return;

    // Find boundaries of selected nodes
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    selectedNodes.forEach(node => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + ((node.style?.width as number) || 180));
      maxY = Math.max(maxY, node.position.y + 50); // Assuming height of about 50px
    });

    // Add padding
    const padding = 30;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    // Create group node
    const groupId = `group-${Date.now()}`;
    const groupNode: Node = {
      id: groupId,
      type: 'group',
      position: { x: minX, y: minY },
      style: {
        width: maxX - minX,
        height: maxY - minY,
        backgroundColor: 'rgba(240, 240, 240, 0.7)',
        border: '1px dashed #aaa',
        borderRadius: 8,
        padding: 10,
        zIndex: -1,
      },
      data: {
        label: translateText('generated.inline.0133_group_value15d3_d33a7949', {
          value15d3: nodes.length + 1,
        }),
      },
    };

    // Update child nodes to reference the group
    const updatedNodes = nodes.map(node => {
      if (selectedNodes.some(n => n.id === node.id)) {
        // Create a new style object with the correct property name and type
        const newStyle = { ...node.style };
        // Don't attempt to set backgroundColor, keep using background property
        // This avoids the type conflict

        return {
          ...node,
          parentId: groupId,
          extent: 'parent' as const,
          position: {
            x: node.position.x - minX,
            y: node.position.y - minY,
          },
          // Keep the original style properties without modifying them
          style: newStyle,
        };
      }
      return node;
    });

    // Add the group node and update child nodes
    setNodes([groupNode, ...updatedNodes]);
    setSelectedNodes([]);
    setMultiSelectMode(false);
  }, [nodes, selectedNodes, setNodes]);

  // Ungroup nodes from a selected group
  const ungroupNodes = useCallback(() => {
    if (selectedNodes.length !== 1 || selectedNodes[0].type !== 'group') return;

    const groupNode = selectedNodes[0];
    const groupId = groupNode.id;
    const groupPosition = groupNode.position;

    // Find all child nodes of this group
    //const childNodes = nodes.filter(node => node.parentId === groupId);

    // Update nodes: remove the group and update child nodes
    const updatedNodes = nodes
      .filter(node => node.id !== groupId) // Remove the group node
      .map(node => {
        if (node.parentId === groupId) {
          // Reposition child nodes to absolute coordinates
          return {
            ...node,
            parentId: undefined,
            extent: undefined,
            position: {
              x: node.position.x + groupPosition.x,
              y: node.position.y + groupPosition.y,
            },
          };
        }
        return node;
      });

    setNodes(updatedNodes);
    setSelectedNodes([]);
  }, [nodes, selectedNodes, setNodes]);

  // Add a new proposal node
  const addProposalNode = useCallback(() => {
    const newId = (nodes.length + 1).toString();
    const newNode = {
      id: newId,
      data: {
        label: translateText('generated.inline.0134_new_proposal_newid_77d2f0cc', { newId: newId }),
      },
      style: { background: '#bbdefb', padding: 10, borderRadius: 5, width: 180 },
      position: { x: 100, y: 100 },
    };
    setNodes(nds => nds.concat(newNode));
  }, [nodes, setNodes]);

  // Reset workflow to initial state
  const resetWorkflow = useCallback(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setSelectedNodes([]);
  }, [setNodes, setEdges]);

  // Start editing node
  const startEditingNode = useCallback(() => {
    if (selectedNodes.length !== 1) return;
    setIsEditingNode(true);
  }, [selectedNodes]);

  // Cancel editing node
  const cancelEditNode = useCallback(() => {
    if (selectedNodes.length !== 1) return;
    setIsEditingNode(false);
    setNodeLabel(selectedNodes[0].data.label || '');
  }, [selectedNodes]);

  // Update node properties
  const updateNodeProperties = useCallback(() => {
    if (selectedNodes.length !== 1 || !isEditingNode) return;

    const selectedNode = selectedNodes[0];

    setNodes(nds =>
      nds.map(node => {
        if (node.id === selectedNode.id) {
          // Create a new data object with the updated label
          const newData = { ...node.data, label: nodeLabel };
          return { ...node, data: newData };
        }
        return node;
      })
    );

    setIsEditingNode(false);
  }, [selectedNodes, nodeLabel, isEditingNode, setNodes]);

  // Delete selected nodes
  const deleteSelectedNodes = useCallback(() => {
    if (selectedNodes.length === 0) return;

    // Get IDs of nodes to delete
    let nodeIdsToDelete = selectedNodes.map(node => node.id);

    // Also identify child nodes of each group that's being deleted
    selectedNodes.forEach(node => {
      if (node.type === 'group') {
        // Find all child nodes of this group
        const childNodeIds = nodes.filter(n => n.parentId === node.id).map(n => n.id);

        // Add child node IDs to the deletion list
        nodeIdsToDelete = [...nodeIdsToDelete, ...childNodeIds];
      }
    });

    // Filter out the selected nodes and their children
    const updatedNodes = nodes.filter(node => !nodeIdsToDelete.includes(node.id));

    // Also remove edges connected to deleted nodes
    const updatedEdges = edges.filter(
      edge => !nodeIdsToDelete.includes(edge.source) && !nodeIdsToDelete.includes(edge.target)
    );

    // Update state
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    setSelectedNodes([]);
  }, [nodes, edges, selectedNodes, setNodes, setEdges]);

  // Delete selected edge
  const deleteSelectedEdge = useCallback(() => {
    if (!selectedEdge) return;

    // Filter out the selected edge
    const updatedEdges = edges.filter(edge => edge.id !== selectedEdge.id);

    // Update state
    setEdges(updatedEdges);
    setSelectedEdge(null);
  }, [selectedEdge, edges, setEdges]);

  // Reset edge state
  const resetEdgeState = useCallback(() => {
    if (!selectedEdge) return;

    setEdges(eds =>
      eds.map(e => {
        if (e.id === selectedEdge.id) {
          // Reset position handlers
          const newData = { ...e.data, positionHandlers: [] };
          return { ...e, data: newData };
        }
        return e;
      })
    );
  }, [selectedEdge, setEdges]);

  return (
    <div className="h-screen w-full">
      {' '}
      <ReactFlow
        nodes={nodes.map(node => ({
          ...node,
          // Highlight selected nodes
          style: {
            ...node.style,
            boxShadow: selectedNodes.some(n => n.id === node.id) ? '0 0 0 2px #ff0072' : undefined,
          },
        }))}
        edges={edges.map(edge => ({
          ...edge,
          // Highlight selected edge
          style: {
            ...edge.style,
            stroke: selectedEdge?.id === edge.id ? '#ff0072' : undefined,
            strokeWidth: selectedEdge?.id === edge.id ? 3 : undefined,
          },
        }))}
        nodesDraggable={isInteractive}
        nodesFocusable={isInteractive}
        nodesConnectable={isInteractive}
        edgesFocusable={isInteractive}
        edgesUpdatable={isInteractive}
        edgeTypes={edgeTypes}
        nodeTypes={nodeTypes}
        onNodesChange={isInteractive ? onNodesChange : undefined}
        onEdgesChange={isInteractive ? onEdgesChange : undefined}
        onConnect={isInteractive ? onConnect : undefined}
        // @ts-expect-error ReactFlow's onNodeClick expects different parameter types than what we're providing with our custom handler implementation
        onNodeClick={onNodeClick}
        // @ts-expect-error ReactFlow's onEdgeClick expects different parameter types than what we're providing with our custom handler implementation
        onEdgeClick={onEdgeClick}
        fitView
      >
        {/* Control panels */}
        <Panel position="top-left" className="rounded bg-white p-4 shadow">
          <h2 className="mb-2 text-lg font-bold">
            {translateText('generated.inline.0528_city_council_workflow_b72c9f88')}
          </h2>
          <p className="mb-3 text-sm text-gray-600">
            {translateText(
              'generated.inline.0529_interactive_diagram_showing_the_proposal_life_2110afd8'
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {isInteractive && (
              <>
                <Button size="sm" onClick={addProposalNode}>
                  {translateText('generated.inline.0530_add_proposal_250e96f5')}
                </Button>
                <Button
                  size="sm"
                  variant={multiSelectMode ? 'default' : 'outline'}
                  onClick={toggleMultiSelectMode}
                >
                  {multiSelectMode
                    ? translateText('generated.inline.0076_multi_select_on_ded38fcd')
                    : translateText('generated.inline.0077_multi_select_off_8e759b57')}
                </Button>
                {selectedNodes.length >= 2 && (
                  <Button size="sm" variant="secondary" onClick={createGroup}>
                    {translateText('generated.inline.0531_group_selected_dc201db7')}
                    {selectedNodes.length})
                  </Button>
                )}
                {selectedNodes.length === 1 && selectedNodes[0].type === 'group' && (
                  <Button size="sm" variant="secondary" onClick={ungroupNodes}>
                    {translateText('generated.inline.0532_ungroup_2b31e968')}
                  </Button>
                )}
                {selectedNodes.length > 0 && (
                  <Button size="sm" variant="destructive" onClick={deleteSelectedNodes}>
                    {translateText('generated.inline.0533_delete_selected_76bf56ab')}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={resetWorkflow}>
                  {translateText('generated.inline.0343_reset_44c57abd')}
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant={isInteractive ? 'outline' : 'default'}
              onClick={() => setIsInteractive(!isInteractive)}
            >
              {isInteractive
                ? translateText('generated.inline.0078_lock_editor_357aaa55')
                : translateText('generated.inline.0079_unlock_editor_b60d9fb1')}
            </Button>
          </div>
        </Panel>

        {/* Information panel for selected node - only show when interactive */}
        {isInteractive && selectedNodes.length === 1 && (
          <Panel position="top-right" className="w-80 rounded bg-white p-4 shadow">
            {isEditingNode ? (
              <div className="space-y-2">
                <h3 className="text-md mb-2 font-bold">
                  {translateText('generated.inline.0534_edit_node_1519442f')}
                </h3>
                <Label htmlFor="nodeLabel">
                  {translateText('generated.inline.0535_label_74341e3c')}
                </Label>
                <Input
                  id="nodeLabel"
                  value={nodeLabel}
                  onChange={e => setNodeLabel(e.target.value)}
                  placeholder={translateText('generated.inline.0536_enter_node_label_4bb64c3c')}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={updateNodeProperties}>
                    {translateText('generated.inline.0269_save_efc007a3')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelEditNode}>
                    {translateText('generated.inline.0065_cancel_77dfd213')}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-md font-bold">{selectedNodes[0].data.label}</h3>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={startEditingNode}>
                    {translateText('generated.inline.0534_edit_node_1519442f')}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={deleteSelectedNodes}>
                    {translateText('generated.inline.0537_delete_f6fdbe48')}
                  </Button>
                </div>
              </div>
            )}
          </Panel>
        )}

        {/* Edge label editor panel - only show when interactive */}
        {isInteractive && selectedEdge && (
          <Panel position="top-right" className="w-80 rounded bg-white p-4 shadow">
            <h3 className="text-md mb-2 font-bold">
              {translateText('generated.inline.0538_edit_edge_label_e8252be9')}
            </h3>
            <p>
              {translateText(
                'generated.inline.0539_double_click_an_edge_to_edit_edge_path_caff8e84'
              )}
            </p>
            <div className="space-y-2">
              <Label htmlFor="edgeLabel">
                {translateText('generated.inline.0535_label_74341e3c')}
              </Label>
              <Input
                id="edgeLabel"
                value={edgeLabel}
                onChange={e => setEdgeLabel(e.target.value)}
                placeholder={translateText('generated.inline.0540_enter_edge_label_ec3a6029')}
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={updateEdgeLabel}>
                  {translateText('generated.inline.0541_update_label_b571fe01')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedEdge(null)}>
                  {translateText('generated.inline.0065_cancel_77dfd213')}
                </Button>
                <Button size="sm" variant="destructive" onClick={deleteSelectedEdge}>
                  {translateText('generated.inline.0542_delete_edge_6351bded')}
                </Button>
                <Button size="sm" variant="outline" onClick={resetEdgeState}>
                  {translateText('generated.inline.0543_reset_edge_path_e7f03a62')}
                </Button>
              </div>
            </div>
          </Panel>
        )}

        <Controls onInteractiveChange={handleInteractiveChange} />
        <MiniMap zoomable pannable />
        <Background color="#aaa" gap={16} />
      </ReactFlow>
    </div>
  );
}
