'use client';

import { useCallback, useMemo, useState, type MouseEvent } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { RIGHT_TYPES } from '@/features/shared/ui/status';
import { buildNetworkRelationshipDialogData } from '@/features/network/logic/networkEdgeHelpers';
import {
  filterEdgesByConnectionDirections,
  filterEdgesByRights,
  filterNodesByEdges,
} from '@/features/network/logic/networkFilterHelpers';
import type { NetworkDialogEntity } from '@/features/network/ui/NetworkEntityDialog';
import type { NetworkUserConnectionDirection } from '@/features/network/types/networkEdge.types';
import type { LandingNetworkNodeData } from '@/features/public-landing/logic/landingNetworkPreview';

interface UseLandingNetworkPreviewStateArgs<TNode extends Node<LandingNetworkNodeData>> {
  nodes: TNode[];
  edges: Edge[];
  alwaysVisibleNodeIds: string[];
  translateRelationship: (key: string, fallback?: string) => string;
}

export function useLandingNetworkPreviewState<TNode extends Node<LandingNetworkNodeData>>({
  nodes,
  edges,
  alwaysVisibleNodeIds,
  translateRelationship,
}: UseLandingNetworkPreviewStateArgs<TNode>) {
  const [selectedRights, setSelectedRights] = useState<Set<string>>(() => new Set(RIGHT_TYPES));
  const [selectedConnectionDirections, setSelectedConnectionDirections] = useState<
    Set<NetworkUserConnectionDirection>
  >(() => new Set(['incoming', 'outgoing']));
  const [panelCollapsed, setPanelCollapsed] = useState(true);
  const [legendCollapsed, setLegendCollapsed] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<NetworkDialogEntity | null>(null);

  const toggleRight = useCallback((right: string) => {
    setSelectedRights(previousRights => {
      const nextRights = new Set(previousRights);
      if (nextRights.has(right)) {
        nextRights.delete(right);
      } else {
        nextRights.add(right);
      }
      return nextRights;
    });
  }, []);

  const toggleConnectionDirection = useCallback((direction: NetworkUserConnectionDirection) => {
    setSelectedConnectionDirections(previousDirections => {
      const nextDirections = new Set(previousDirections);
      if (nextDirections.has(direction)) {
        if (nextDirections.size === 1) {
          return new Set(['incoming', 'outgoing']);
        }
        nextDirections.delete(direction);
        return nextDirections;
      }

      nextDirections.add(direction);
      return nextDirections;
    });
  }, []);

  const visibleEdges = useMemo(() => {
    const rightsFilteredEdges = filterEdgesByRights(edges, selectedRights);
    return filterEdgesByConnectionDirections(rightsFilteredEdges, selectedConnectionDirections);
  }, [edges, selectedConnectionDirections, selectedRights]);

  const visibleNodes = useMemo(
    () => filterNodesByEdges(nodes, visibleEdges, alwaysVisibleNodeIds) as TNode[],
    [alwaysVisibleNodeIds, nodes, visibleEdges]
  );

  const onNodeClick = useCallback((_event: MouseEvent, node: Node) => {
    const nodeData = node.data as LandingNetworkNodeData | undefined;
    if (nodeData?.kind !== 'event' || !nodeData.event) {
      return;
    }

    setSelectedEntity({
      type: 'event',
      data: nodeData.event,
    });
    setDialogOpen(true);
  }, []);

  const onEdgeClick = useCallback(
    (_event: MouseEvent, edge: Edge) => {
      setSelectedEntity({
        type: 'relationship',
        data: buildNetworkRelationshipDialogData(edge, translateRelationship),
      });
      setDialogOpen(true);
    },
    [translateRelationship]
  );

  return {
    visibleNodes,
    visibleEdges,
    selectedRights,
    selectedConnectionDirections,
    panelCollapsed,
    setPanelCollapsed,
    legendCollapsed,
    setLegendCollapsed,
    dialogOpen,
    setDialogOpen,
    selectedEntity,
    toggleRight,
    toggleConnectionDirection,
    onNodeClick,
    onEdgeClick,
  };
}
