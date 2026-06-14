'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import React from 'react';
import { NetworkFlowBase } from '@/features/network/ui/NetworkFlowBase';
import { NetworkControlPanel } from '@/features/network/ui/NetworkControlPanel';
import { NetworkEntityDialog } from '@/features/network/ui/NetworkEntityDialog';
import { createGroupNodeLegendItem } from '@/features/network/ui/networkVisualHelpers';
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
    <NetworkFlowBase
      nodes={filteredNodes.map((node: any) => ({
        ...node,
        style: {
          ...node.style,
          boxShadow: selectedNodes.includes(node.id)
            ? featureThemeClassName('floweditorUseFlowEditorThemedStyle')
            : undefined,
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
      panel={
        <NetworkControlPanel
          title={title ?? t('common.network.userNetwork')}
          description={
            description ??
            t('common.network.userNetworkDescription', {
              userName: userProfile.name,
            })
          }
          panelCollapsed={panelCollapsed}
          onPanelCollapsedChange={setPanelCollapsed}
          legendCollapsed={legendCollapsed}
          onLegendCollapsedChange={setLegendCollapsed}
          legendTitle={t('common.network.legend')}
          legendItems={[
            {
              id: 'user',
              label: t('common.network.user'),
              swatchClassName: featureThemeClassName('networkUseUserNetworkFlowThemedRoundIcon'),
            },
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
          depthFilters={depthFilters}
          isInteractive={isInteractive}
          onInteractiveChange={handleInteractiveChange}
          directLabel={t('common.network.direct')}
          indirectLabel={t('common.network.indirect')}
          lockLabel={t('common.network.lockEditor')}
          unlockLabel={t('common.network.unlockEditor')}
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
          showRightsFilter={!filterRight}
          selectedRights={selectedRights}
          onToggleRight={toggleRight}
          connectionDirectionFilters={connectionDirectionFilters}
          relationshipStatusFilters={relationshipStatusFilters}
          showConnectionDirectionLegend
          connectionDirectionLegendTitle={t('common.network.connectionDirections')}
          bidirectionalConnectionLabel={t('common.network.bidirectional')}
          incomingConnectionLabel={t('common.network.incomingConnections')}
          outgoingConnectionLabel={t('common.network.outgoingConnections')}
          filterRight={filterRight}
          filteredByPrefix={t('common.network.filteredBy')}
          showRightsLegend
        />
      }
    >
      <NetworkEntityDialog open={dialogOpen} onOpenChange={setDialogOpen} entity={selectedEntity} />
    </NetworkFlowBase>
  );
}
