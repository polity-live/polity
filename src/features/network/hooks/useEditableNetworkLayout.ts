import { useCallback, useEffect, useMemo, useRef, type SetStateAction } from 'react';
import { applyNodeChanges, type Edge, type Node, type NodeChange } from '@xyflow/react';
import type { GroupNetworkLayout } from '@/zero/preferences';
import {
  areGroupNetworkLayoutsEqual,
  normalizeGroupNetworkLayout,
} from '@/features/network/logic/networkLayoutHelpers';
import type {
  EditableRightsLabelEdgeData,
  NetworkEdgeBendPoint,
} from '@/features/network/types/networkEdge.types';

interface UseEditableNetworkLayoutArgs<
  TNode extends Node,
  TEdge extends Edge<EditableRightsLabelEdgeData>,
> {
  nodes: readonly TNode[];
  edges: readonly TEdge[];
  setNodes: (value: SetStateAction<TNode[]>) => void;
  setEdges: (value: SetStateAction<TEdge[]>) => void;
  savedLayout: GroupNetworkLayout | null;
  isInteractive: boolean;
}

export function useEditableNetworkLayout<
  TNode extends Node,
  TEdge extends Edge<EditableRightsLabelEdgeData>,
>({
  nodes,
  edges,
  setNodes,
  setEdges,
  savedLayout,
  isInteractive,
}: UseEditableNetworkLayoutArgs<TNode, TEdge>) {
  const edgeBendPointsRef = useRef<Record<string, NetworkEdgeBendPoint[]>>({});
  const nodePositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const isInteractiveRef = useRef(isInteractive);

  const currentLayout = useMemo<GroupNetworkLayout>(
    () =>
      normalizeGroupNetworkLayout({
        node_positions: Object.fromEntries(
          nodes.map(node => [node.id, { x: node.position.x, y: node.position.y }])
        ),
        edge_bend_points: Object.fromEntries(
          edges
            .map(edge => {
              const bendPoints = Array.isArray(edge.data?.bendPoints) ? edge.data.bendPoints : [];

              return [
                edge.id,
                bendPoints.map(bendPoint => ({ x: bendPoint.x, y: bendPoint.y })),
              ] as const;
            })
            .filter(([, bendPoints]) => bendPoints.length > 0)
        ),
      }),
    [edges, nodes]
  );

  const hasLayoutChanges = useMemo(() => {
    return !areGroupNetworkLayoutsEqual(currentLayout, savedLayout);
  }, [currentLayout, savedLayout]);

  useEffect(() => {
    isInteractiveRef.current = isInteractive;
  }, [isInteractive]);

  useEffect(() => {
    nodePositionsRef.current = savedLayout?.node_positions ?? {};
    edgeBendPointsRef.current = savedLayout?.edge_bend_points ?? {};
  }, [savedLayout]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<TNode>[]) => {
      setNodes(currentNodes => {
        const nextNodes = applyNodeChanges(changes, currentNodes);
        nodePositionsRef.current = Object.fromEntries(
          nextNodes.map(node => [node.id, { x: node.position.x, y: node.position.y }])
        );
        return nextNodes;
      });
    },
    [setNodes]
  );

  const handleEdgeBendPointsChange = useCallback(
    (edgeId: string, bendPoints: NetworkEdgeBendPoint[]) => {
      if (bendPoints.length === 0) {
        edgeBendPointsRef.current = Object.fromEntries(
          Object.entries(edgeBendPointsRef.current).filter(
            ([currentEdgeId]) => currentEdgeId !== edgeId
          )
        );
      } else {
        edgeBendPointsRef.current[edgeId] = bendPoints;
      }

      setEdges(currentEdges =>
        currentEdges.map(edge => {
          if (edge.id !== edgeId) {
            return edge;
          }

          return {
            ...edge,
            data: {
              ...(edge.data ?? {}),
              bendPoints,
            },
          };
        })
      );
    },
    [setEdges]
  );

  const decorateEdgeData = useCallback(
    (edgeId: string, data: EditableRightsLabelEdgeData): EditableRightsLabelEdgeData => ({
      ...data,
      bendPoints: edgeBendPointsRef.current[edgeId] ?? [],
      edgeEditingEnabled: isInteractiveRef.current,
      onBendPointsChange: handleEdgeBendPointsChange,
    }),
    [handleEdgeBendPointsChange]
  );

  const syncGeneratedLayoutState = useCallback(
    (nextNodes: readonly TNode[], nextEdges: readonly TEdge[]) => {
      nodePositionsRef.current = Object.fromEntries(
        nextNodes.map(node => [node.id, { x: node.position.x, y: node.position.y }])
      );
      edgeBendPointsRef.current = Object.fromEntries(
        nextEdges
          .map(edge => {
            const bendPoints = Array.isArray(edge.data?.bendPoints) ? edge.data.bendPoints : [];
            return [edge.id, bendPoints] as const;
          })
          .filter(([, bendPoints]) => bendPoints.length > 0)
      );
    },
    []
  );

  const clearPersistedLayoutState = useCallback(() => {
    nodePositionsRef.current = {};
    edgeBendPointsRef.current = {};
  }, []);

  useEffect(() => {
    setEdges(currentEdges =>
      currentEdges.map(edge => ({
        ...edge,
        data: decorateEdgeData(edge.id, { ...(edge.data ?? {}) }),
      }))
    );
  }, [decorateEdgeData, isInteractive, setEdges]);

  return {
    currentLayout,
    hasLayoutChanges,
    nodePositionsRef,
    edgeBendPointsRef,
    isInteractiveRef,
    handleNodesChange,
    handleEdgeBendPointsChange,
    decorateEdgeData,
    syncGeneratedLayoutState,
    clearPersistedLayoutState,
  };
}
