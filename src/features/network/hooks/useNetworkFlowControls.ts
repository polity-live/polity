import { useState, useCallback, useMemo } from 'react';
import { RIGHT_TYPES } from '@/features/shared/ui/status';
import type { NetworkDialogEntity } from '@/features/network/ui/NetworkEntityDialog';
import type { NetworkRelationshipKind } from '@/features/network/logic/networkRelationshipHelpers';
import type {
  NetworkConnectionDirectionFilter,
  NetworkDepthFilter,
  NetworkUserConnectionDirection,
} from '@/features/network/types/networkEdge.types';

export function useNetworkFlowControls() {
  const [relationshipDepthFilter, setRelationshipDepthFilter] = useState<NetworkDepthFilter>('all');
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [isInteractive, setIsInteractive] = useState(true);
  const [selectedRights, setSelectedRights] = useState<Set<string>>(new Set(RIGHT_TYPES));
  const [relationshipStatusFilter, setRelationshipStatusFilter] =
    useState<NetworkRelationshipKind>('active');
  const [connectionDirectionFilter, setConnectionDirectionFilter] =
    useState<NetworkConnectionDirectionFilter>('all');
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<NetworkDialogEntity | null>(null);

  // Temporary compatibility layer while flows move from bool/set filters to row-based filters.
  const showIndirect = relationshipDepthFilter !== 'direct';

  const setShowIndirect = useCallback((nextShowIndirect: boolean) => {
    setRelationshipDepthFilter(nextShowIndirect ? 'all' : 'direct');
  }, []);

  const selectedRelationshipKinds = useMemo(
    () => new Set<NetworkRelationshipKind>([relationshipStatusFilter]),
    [relationshipStatusFilter]
  );

  const setSelectedRelationshipKinds = useCallback((nextKinds: Set<NetworkRelationshipKind>) => {
    if (nextKinds.has('active')) {
      setRelationshipStatusFilter('active');
      return;
    }

    if (nextKinds.has('incoming')) {
      setRelationshipStatusFilter('incoming');
      return;
    }

    if (nextKinds.has('outgoing')) {
      setRelationshipStatusFilter('outgoing');
      return;
    }

    setRelationshipStatusFilter('active');
  }, []);

  const selectedConnectionDirections = useMemo(() => {
    if (connectionDirectionFilter === 'all') {
      return new Set<NetworkUserConnectionDirection>(['incoming', 'outgoing']);
    }

    return new Set<NetworkUserConnectionDirection>([connectionDirectionFilter]);
  }, [connectionDirectionFilter]);

  const setSelectedConnectionDirections = useCallback(
    (nextDirections: Set<NetworkUserConnectionDirection>) => {
      if (nextDirections.has('incoming') && nextDirections.has('outgoing')) {
        setConnectionDirectionFilter('all');
        return;
      }

      if (nextDirections.has('incoming')) {
        setConnectionDirectionFilter('incoming');
        return;
      }

      if (nextDirections.has('outgoing')) {
        setConnectionDirectionFilter('outgoing');
        return;
      }

      setConnectionDirectionFilter('all');
    },
    []
  );

  const toggleRight = useCallback((right: string) => {
    setSelectedRights(prev => {
      const newSet = new Set(prev);
      if (newSet.has(right)) {
        newSet.delete(right);
      } else {
        newSet.add(right);
      }
      return newSet;
    });
  }, []);

  const toggleRelationshipKind = useCallback((relationshipKind: NetworkRelationshipKind) => {
    setRelationshipStatusFilter(currentFilter =>
      currentFilter === relationshipKind ? 'active' : relationshipKind
    );
  }, []);

  const toggleConnectionDirection = useCallback(
    (connectionDirection: NetworkUserConnectionDirection) => {
      setConnectionDirectionFilter(currentFilter =>
        currentFilter === connectionDirection ? 'all' : connectionDirection
      );
    },
    []
  );

  const handleInteractiveChange = useCallback((interactiveState: boolean) => {
    setIsInteractive(interactiveState);
    if (!interactiveState) {
      setSelectedNodes([]);
    }
  }, []);

  return {
    relationshipDepthFilter,
    setRelationshipDepthFilter,
    showIndirect,
    setShowIndirect,
    selectedNodes,
    setSelectedNodes,
    isInteractive,
    setIsInteractive,
    selectedRights,
    setSelectedRights,
    relationshipStatusFilter,
    setRelationshipStatusFilter,
    selectedRelationshipKinds,
    setSelectedRelationshipKinds,
    connectionDirectionFilter,
    setConnectionDirectionFilter,
    selectedConnectionDirections,
    setSelectedConnectionDirections,
    panelCollapsed,
    setPanelCollapsed,
    legendCollapsed,
    setLegendCollapsed,
    dialogOpen,
    setDialogOpen,
    selectedEntity,
    setSelectedEntity,
    toggleRight,
    toggleRelationshipKind,
    toggleConnectionDirection,
    handleInteractiveChange,
  };
}
