import { useState, useCallback } from 'react';
import { RIGHT_TYPES } from '@/features/network/ui/RightFilters';
import type { NetworkDialogEntity } from '@/features/network/ui/NetworkEntityDialog';
import type { NetworkRelationshipKind } from '@/features/network/logic/networkRelationshipHelpers';

export function useNetworkFlowControls() {
  const [showIndirect, setShowIndirect] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [isInteractive, setIsInteractive] = useState(true);
  const [selectedRights, setSelectedRights] = useState<Set<string>>(new Set(RIGHT_TYPES));
  const [selectedRelationshipKinds, setSelectedRelationshipKinds] = useState<
    Set<NetworkRelationshipKind>
  >(new Set<NetworkRelationshipKind>(['active']));
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<NetworkDialogEntity | null>(null);

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
    setSelectedRelationshipKinds(prev => {
      const next = new Set(prev);
      if (next.has(relationshipKind)) {
        next.delete(relationshipKind);
      } else {
        next.add(relationshipKind);
      }
      return next;
    });
  }, []);

  const handleInteractiveChange = useCallback((interactiveState: boolean) => {
    setIsInteractive(interactiveState);
    if (!interactiveState) {
      setSelectedNodes([]);
    }
  }, []);

  return {
    showIndirect,
    setShowIndirect,
    selectedNodes,
    setSelectedNodes,
    isInteractive,
    setIsInteractive,
    selectedRights,
    setSelectedRights,
    selectedRelationshipKinds,
    setSelectedRelationshipKinds,
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
    handleInteractiveChange,
  };
}
