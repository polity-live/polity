'use client';

import { useCallback, useMemo, useState } from 'react';
import { addEdge, useEdgesState, useNodesState } from 'reactflow';

import { translate as translateText } from '@/features/shared/hooks/use-translation';

import {
  createInitialFlowEditorEdges,
  createInitialFlowEditorNodes,
} from '../logic/flowEditorDefaults';
import type {
  FlowEditorConnection,
  FlowEditorEdge,
  FlowEditorEdgeData,
  FlowEditorNode,
  FlowEditorNodeData,
} from '../types';

export function useFlowEditorController() {
  const initialNodes = useMemo(() => createInitialFlowEditorNodes(), []);
  const initialEdges = useMemo(() => createInitialFlowEditorEdges(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowEditorNodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEditorEdgeData>(initialEdges);
  const [selectedNodes, setSelectedNodes] = useState<FlowEditorNode[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<FlowEditorEdge | null>(null);
  const [edgeLabel, setEdgeLabel] = useState('');
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [nodeLabel, setNodeLabel] = useState('');
  const [isEditingNode, setIsEditingNode] = useState(false);
  const [isInteractive, setIsInteractive] = useState(true);

  const renderedNodes = useMemo(
    () =>
      nodes.map(node => ({
        ...node,
        style: {
          ...node.style,
          boxShadow: selectedNodes.some(selectedNode => selectedNode.id === node.id)
            ? '0 0 0 2px #ff0072'
            : undefined,
        },
      })),
    [nodes, selectedNodes]
  );

  const renderedEdges = useMemo(
    () =>
      edges.map(edge => ({
        ...edge,
        style: {
          ...edge.style,
          stroke: selectedEdge?.id === edge.id ? '#ff0072' : undefined,
          strokeWidth: selectedEdge?.id === edge.id ? 3 : undefined,
        },
      })),
    [edges, selectedEdge?.id]
  );

  const handleInteractiveChange = useCallback((interactiveState: boolean) => {
    setIsInteractive(interactiveState);

    if (!interactiveState) {
      setSelectedNodes([]);
      setSelectedEdge(null);
      setIsEditingNode(false);
    }
  }, []);

  const onConnect = useCallback(
    (params: FlowEditorConnection | FlowEditorEdge) =>
      setEdges(currentEdges =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { strokeDasharray: '5 5' },
            type: 'positionableedge',
            data: { type: 'smoothstep', positionHandlers: [] },
          } as FlowEditorEdge,
          currentEdges
        )
      ),
    [setEdges]
  );

  const onNodeClick = useCallback(
    (_event: unknown, node: FlowEditorNode) => {
      if (!isInteractive) return;

      setSelectedEdge(null);

      if (multiSelectMode) {
        setSelectedNodes(prev => {
          const isSelected = prev.some(selectedNode => selectedNode.id === node.id);
          return isSelected
            ? prev.filter(selectedNode => selectedNode.id !== node.id)
            : [...prev, node];
        });
      } else {
        setSelectedNodes([node]);
        setNodeLabel(node.data.label || '');
        setIsEditingNode(false);
      }
    },
    [isInteractive, multiSelectMode]
  );

  const onEdgeClick = useCallback(
    (_event: unknown, edge: FlowEditorEdge) => {
      if (!isInteractive) return;

      setSelectedNodes([]);
      setSelectedEdge(edge);
      setEdgeLabel(typeof edge.label === 'string' ? edge.label : '');
    },
    [isInteractive]
  );

  const updateEdgeLabel = useCallback(() => {
    if (!selectedEdge) return;

    setEdges(currentEdges =>
      currentEdges.map(edge => (edge.id === selectedEdge.id ? { ...edge, label: edgeLabel } : edge))
    );
  }, [edgeLabel, selectedEdge, setEdges]);

  const toggleMultiSelectMode = useCallback(() => {
    setMultiSelectMode(prev => !prev);
    if (!multiSelectMode) {
      setSelectedNodes([]);
    }
  }, [multiSelectMode]);

  const createGroup = useCallback(() => {
    if (selectedNodes.length < 2) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    selectedNodes.forEach(node => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + ((node.style?.width as number) || 180));
      maxY = Math.max(maxY, node.position.y + 50);
    });

    const padding = 30;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const groupId = `group-${Date.now()}`;
    const groupNode: FlowEditorNode = {
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

    const updatedNodes = nodes.map(node => {
      if (!selectedNodes.some(selectedNode => selectedNode.id === node.id)) {
        return node;
      }

      return {
        ...node,
        parentId: groupId,
        extent: 'parent' as const,
        position: {
          x: node.position.x - minX,
          y: node.position.y - minY,
        },
        style: { ...node.style },
      };
    });

    setNodes([groupNode, ...updatedNodes]);
    setSelectedNodes([]);
    setMultiSelectMode(false);
  }, [nodes, selectedNodes, setNodes]);

  const ungroupNodes = useCallback(() => {
    if (selectedNodes.length !== 1 || selectedNodes[0].type !== 'group') return;

    const groupNode = selectedNodes[0];
    const groupId = groupNode.id;
    const groupPosition = groupNode.position;

    const updatedNodes = nodes
      .filter(node => node.id !== groupId)
      .map(node => {
        if (node.parentId !== groupId) {
          return node;
        }

        return {
          ...node,
          parentId: undefined,
          extent: undefined,
          position: {
            x: node.position.x + groupPosition.x,
            y: node.position.y + groupPosition.y,
          },
        };
      });

    setNodes(updatedNodes);
    setSelectedNodes([]);
  }, [nodes, selectedNodes, setNodes]);

  const addProposalNode = useCallback(() => {
    const newId = (nodes.length + 1).toString();
    const newNode: FlowEditorNode = {
      id: newId,
      data: {
        label: translateText('generated.inline.0134_new_proposal_newid_77d2f0cc', { newId }),
      },
      style: { background: '#bbdefb', padding: 10, borderRadius: 5, width: 180 },
      position: { x: 100, y: 100 },
    };
    setNodes(currentNodes => currentNodes.concat(newNode));
  }, [nodes.length, setNodes]);

  const resetWorkflow = useCallback(() => {
    setNodes(createInitialFlowEditorNodes());
    setEdges(createInitialFlowEditorEdges());
    setSelectedNodes([]);
    setSelectedEdge(null);
  }, [setEdges, setNodes]);

  const startEditingNode = useCallback(() => {
    if (selectedNodes.length !== 1) return;
    setIsEditingNode(true);
  }, [selectedNodes.length]);

  const cancelEditNode = useCallback(() => {
    if (selectedNodes.length !== 1) return;
    setIsEditingNode(false);
    setNodeLabel(selectedNodes[0].data.label || '');
  }, [selectedNodes]);

  const updateNodeProperties = useCallback(() => {
    if (selectedNodes.length !== 1 || !isEditingNode) return;

    const selectedNode = selectedNodes[0];

    setNodes(currentNodes =>
      currentNodes.map(node =>
        node.id === selectedNode.id ? { ...node, data: { ...node.data, label: nodeLabel } } : node
      )
    );

    setIsEditingNode(false);
  }, [isEditingNode, nodeLabel, selectedNodes, setNodes]);

  const deleteSelectedNodes = useCallback(() => {
    if (selectedNodes.length === 0) return;

    let nodeIdsToDelete = selectedNodes.map(node => node.id);
    selectedNodes.forEach(node => {
      if (node.type === 'group') {
        const childNodeIds = nodes
          .filter(child => child.parentId === node.id)
          .map(child => child.id);
        nodeIdsToDelete = [...nodeIdsToDelete, ...childNodeIds];
      }
    });

    setNodes(nodes.filter(node => !nodeIdsToDelete.includes(node.id)));
    setEdges(
      edges.filter(
        edge => !nodeIdsToDelete.includes(edge.source) && !nodeIdsToDelete.includes(edge.target)
      )
    );
    setSelectedNodes([]);
  }, [edges, nodes, selectedNodes, setEdges, setNodes]);

  const deleteSelectedEdge = useCallback(() => {
    if (!selectedEdge) return;

    setEdges(edges.filter(edge => edge.id !== selectedEdge.id));
    setSelectedEdge(null);
  }, [edges, selectedEdge, setEdges]);

  const resetEdgeState = useCallback(() => {
    if (!selectedEdge) return;

    setEdges(currentEdges =>
      currentEdges.map(edge =>
        edge.id === selectedEdge.id
          ? { ...edge, data: { ...edge.data, positionHandlers: [] } }
          : edge
      )
    );
  }, [selectedEdge, setEdges]);

  return {
    nodes: renderedNodes,
    edges: renderedEdges,
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
    clearSelectedEdge: () => setSelectedEdge(null),
  };
}

export type FlowEditorController = ReturnType<typeof useFlowEditorController>;
