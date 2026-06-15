'use client';

import React from 'react';
import { CivicNetworkFlow } from '@/features/network/ui/CivicNetworkFlow';
import { NetworkEntityDialog } from '@/features/network/ui/NetworkEntityDialog';
import {
  createEntityNodeLegendItem,
  createGroupNodeLegendItem,
  getNetworkSelectionStyle,
} from '@/features/network/ui/networkVisualHelpers';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import type { NetworkGroupEntity } from '../types/network.types';
import { Button } from '@/features/shared/ui/ui/button';
export interface UserNetworkFlowProps {
  userId: string;
  onGroupClick?: (groupId: string, groupData: NetworkGroupEntity) => void;
  filterRight?: string; // Optional filter by specific right type
  title?: string;
  description?: string;
  showGroupDialogOnClick?: boolean;
  layoutScopeKey?: string;
}
export interface UserNetworkFlowContentViewProps {
  connectionDirectionFilters: any;
  depthFilters: any;
  description: any;
  dialogOpen: any;
  edges: any;
  filteredEdges: any;
  filteredNodes: any;
  filterRight: any;
  handleInteractiveChange: any;
  handleNodesChange: any;
  handleResetLayout: any;
  handleSaveLayout: any;
  hasLayoutChanges: any;
  hasSavedLayout: any;
  isInteractive: any;
  isLayoutLoading: any;
  legendCollapsed: any;
  nodes: any;
  onEdgeClick: any;
  onEdgesChange: any;
  onNodeClick: any;
  panelCollapsed: any;
  relationshipStatusFilters: any;
  selectedEntity: any;
  selectedNodes: any;
  selectedRights: any;
  setDialogOpen: any;
  setLegendCollapsed: any;
  setPanelCollapsed: any;
  t: any;
  title: any;
  toggleRight: any;
  userProfile: any;
}

export function UserNetworkFlowContentView({
  connectionDirectionFilters,
  depthFilters,
  description,
  dialogOpen,
  filteredEdges,
  filteredNodes,
  filterRight,
  handleInteractiveChange,
  handleNodesChange,
  handleResetLayout,
  handleSaveLayout,
  hasLayoutChanges,
  hasSavedLayout,
  isInteractive,
  isLayoutLoading,
  legendCollapsed,
  onEdgeClick,
  onEdgesChange,
  onNodeClick,
  panelCollapsed,
  relationshipStatusFilters,
  selectedEntity,
  selectedNodes,
  selectedRights,
  setDialogOpen,
  setLegendCollapsed,
  setPanelCollapsed,
  t,
  title,
  toggleRight,
  userProfile,
}: UserNetworkFlowContentViewProps) {
  if (!userProfile) {
    return (
      <div className="bg-background flex h-full min-h-0 w-full items-center justify-center rounded-lg border">
        <p className="text-muted-foreground">
          {translateText('generated.inline.0803_loading_user_network_053d7b1c')}
        </p>
      </div>
    );
  }

  return (
    <CivicNetworkFlow
      nodes={filteredNodes.map((node: any) => ({
        ...node,
        style: {
          ...node.style,
          ...getNetworkSelectionStyle(selectedNodes.includes(node.id)),
        },
      }))}
      edges={filteredEdges}
      nodesDraggable={isInteractive}
      nodesFocusable={isInteractive}
      nodesConnectable={isInteractive}
      edgesFocusable={isInteractive}
      onNodesChange={isInteractive ? handleNodesChange : undefined}
      onEdgesChange={isInteractive ? onEdgesChange : undefined}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      onInteractiveChange={handleInteractiveChange}
      containerClassName="h-full min-h-0"
      panelConfig={{
        title: title ?? t('common.network.userNetwork'),
        description:
          description ??
          t('common.network.userNetworkDescription', {
            userName: userProfile.name,
          }),
        panelCollapsed,
        onPanelCollapsedChange: setPanelCollapsed,
        legendCollapsed,
        onLegendCollapsedChange: setLegendCollapsed,
        legendTitle: t('common.network.legend'),
        depthFilters,
        isInteractive,
        onInteractiveChange: handleInteractiveChange,
        directLabel: t('common.network.direct'),
        indirectLabel: t('common.network.indirect'),
        lockLabel: t('common.network.lockEditor'),
        unlockLabel: t('common.network.unlockEditor'),
        showRightsFilter: !filterRight,
        selectedRights,
        onToggleRight: toggleRight,
        connectionDirectionFilters,
        relationshipStatusFilters,
        showConnectionDirectionLegend: true,
        connectionDirectionLegendTitle: t('common.network.connectionDirections'),
        bidirectionalConnectionLabel: t('common.network.bidirectional'),
        incomingConnectionLabel: t('common.network.incomingConnections'),
        outgoingConnectionLabel: t('common.network.outgoingConnections'),
        filterRight,
        filteredByPrefix: t('common.network.filteredBy'),
        showRightsLegend: true,
      }}
      legendItems={[
        createEntityNodeLegendItem({
          id: 'user',
          label: t('common.network.user'),
          entityType: 'user',
        }),
        createGroupNodeLegendItem({
          id: 'current-group',
          label: t('common.network.currentGroup'),
          visualVariant: 'current',
        }),
        createGroupNodeLegendItem({
          id: 'parent-group',
          label: t('common.network.parentGroup'),
          visualVariant: 'parent',
        }),
        createGroupNodeLegendItem({
          id: 'child-group',
          label: t('common.network.childGroup'),
          visualVariant: 'child',
        }),
        createGroupNodeLegendItem({
          id: 'sibling-group-open',
          label: t('common.network.siblingGroupOpen'),
          visualVariant: 'sibling-open',
        }),
        createGroupNodeLegendItem({
          id: 'sibling-group-elected',
          label: t('common.network.siblingGroupElected'),
          visualVariant: 'sibling-elected',
        }),
        createGroupNodeLegendItem({
          id: 'sibling-group-parliament',
          label: t('common.network.siblingGroupParliament'),
          visualVariant: 'sibling-parliament',
        }),
      ]}
      controlsExtraContent={
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSaveLayout}
            disabled={isLayoutLoading || !hasLayoutChanges}
          >
            {t('common.network.saveLayout')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleResetLayout}
            disabled={isLayoutLoading || (!hasSavedLayout && !hasLayoutChanges)}
          >
            {t('common.network.resetLayout')}
          </Button>
        </>
      }
    >
      <NetworkEntityDialog open={dialogOpen} onOpenChange={setDialogOpen} entity={selectedEntity} />
    </CivicNetworkFlow>
  );
}
