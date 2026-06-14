'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import {
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';
import React from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { NetworkFlowBase } from '@/features/network/ui/NetworkFlowBase';
import { createGroupNodeLegendItem } from '@/features/network/ui/networkVisualHelpers';
import { NetworkControlPanel } from '@/features/network/ui/NetworkControlPanel';
import { NetworkEntityDialog } from '@/features/network/ui/NetworkEntityDialog';
import { WorkflowFlowVisualization } from '@/features/network/ui/WorkflowFlowVisualization';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import type { NetworkGroupEntity } from '@/features/network/types/network.types';
export interface GroupNetworkFlowProps {
  groupId: string;
  onGroupClick?: (groupId: string, groupData: NetworkGroupEntity) => void;
  filterRight?: string;
  title?: string;
  description?: string;
  showGroupDialogOnClick?: boolean;
  showWorkflowView?: boolean;
  layoutScopeKey?: string;
  highlightGroupIds?: string[];
  highlightEdgePairs?: {
    sourceGroupId: string;
    targetGroupId: string;
  }[];
}
export interface GroupNetworkFlowContentViewProps {
  connectionDirectionFilters: any;
  depthFilters: any;
  description: any;
  dialogOpen: any;
  edges: any;
  filterRight: any;
  group: any;
  groupWorkflows: any;
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
  renderedEdges: any;
  renderedNodes: any;
  selectedEntity: any;
  selectedRights: any;
  selectedWorkflowId: any;
  selectedWorkflowVisualization: any;
  setDialogOpen: any;
  setLegendCollapsed: any;
  setPanelCollapsed: any;
  setSelectedWorkflowId: any;
  setViewMode: any;
  showWorkflowView: any;
  sortedGroupWorkflows: any;
  t: any;
  title: any;
  toggleRight: any;
  viewMode: any;
}

export function GroupNetworkFlowContentView({
  connectionDirectionFilters,
  depthFilters,
  description,
  dialogOpen,
  filterRight,
  group,
  groupWorkflows,
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
  renderedEdges,
  renderedNodes,
  selectedEntity,
  selectedRights,
  selectedWorkflowId,
  selectedWorkflowVisualization,
  setDialogOpen,
  setLegendCollapsed,
  setPanelCollapsed,
  setSelectedWorkflowId,
  setViewMode,
  showWorkflowView,
  sortedGroupWorkflows,
  t,
  title,
  toggleRight,
  viewMode,
}: GroupNetworkFlowContentViewProps) {
  if (!group) {
    return (
      <div className="bg-background flex h-[32rem] min-h-[24rem] w-full items-center justify-center rounded-lg border">
        <p className="text-muted-foreground">{t('common.network.loadingGroupNetwork')}</p>
      </div>
    );
  }

  // View mode toggle + workflow visualization
  if (showWorkflowView && viewMode === 'workflow') {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewMode('hierarchy')}>
            {t('common.network.hierarchyView')}
          </Button>
          <Button variant="default" size="sm" onClick={() => setViewMode('workflow')}>
            {t('common.network.workflowView')}
          </Button>
          <FormControlSelect value={selectedWorkflowId} onValueChange={setSelectedWorkflowId}>
            <FormControlSelectTrigger className="w-[240px]">
              <FormControlSelectValue
                placeholder={t('features.network.workflows.selectWorkflow')}
              />
            </FormControlSelectTrigger>
            <FormControlSelectContent>
              {sortedGroupWorkflows.map((w: any) => (
                <FormControlSelectItem key={w.id} value={w.id}>
                  {w.name ?? translateText('generated.inline.0093_untitled_621521f9')}
                </FormControlSelectItem>
              ))}
            </FormControlSelectContent>
          </FormControlSelect>
        </div>
        {sortedGroupWorkflows.length === 0 ? (
          <div className="bg-background flex min-h-[24rem] flex-1 items-center justify-center rounded-lg border">
            <p className="text-muted-foreground text-sm">{t('features.network.workflows.empty')}</p>
          </div>
        ) : selectedWorkflowVisualization ? (
          <div className="min-h-[24rem] flex-1">
            <WorkflowFlowVisualization workflow={selectedWorkflowVisualization} />
          </div>
        ) : (
          <div className="bg-background flex min-h-[24rem] flex-1 items-center justify-center rounded-lg border">
            <p className="text-muted-foreground text-sm">
              {t('features.network.workflows.selectWorkflow')}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant={viewMode === 'hierarchy' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('hierarchy')}
        >
          {t('common.network.hierarchyView')}
        </Button>
        {showWorkflowView && groupWorkflows.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setViewMode('workflow')}>
            {t('common.network.workflowView')}
          </Button>
        )}
      </div>
      <NetworkFlowBase
        nodes={renderedNodes}
        edges={renderedEdges}
        nodesDraggable={isInteractive}
        nodesFocusable={isInteractive}
        nodesConnectable={isInteractive}
        edgesFocusable={isInteractive}
        onNodesChange={isInteractive ? handleNodesChange : undefined}
        onEdgesChange={isInteractive ? onEdgesChange : undefined}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onInteractiveChange={handleInteractiveChange}
        containerClassName="min-h-[24rem] flex-1"
        panel={
          <NetworkControlPanel
            title={title ?? t('common.network.groupNetwork')}
            description={
              description ?? t('common.network.groupNetworkDescription', { groupName: group.name })
            }
            panelCollapsed={panelCollapsed}
            onPanelCollapsedChange={setPanelCollapsed}
            legendCollapsed={legendCollapsed}
            onLegendCollapsedChange={setLegendCollapsed}
            legendTitle={t('common.network.legend')}
            legendItems={[
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
            showRightsFilter
            selectedRights={selectedRights}
            onToggleRight={toggleRight}
            connectionDirectionFilters={connectionDirectionFilters}
            showRightsLegend
            showConnectionDirectionLegend
            connectionDirectionLegendTitle={t('common.network.connectionDirections')}
            bidirectionalConnectionLabel={t('common.network.bidirectional')}
            incomingConnectionLabel={t('common.network.incomingConnections')}
            outgoingConnectionLabel={t('common.network.outgoingConnections')}
            relationshipStatusFilters={relationshipStatusFilters}
            relationshipStatusFiltersLabel={t('common.network.relationshipStatuses')}
            filterRight={filterRight}
            filteredByPrefix={t('common.network.filteredBy')}
            legendExtraContent={
              <>
                <hr className={featureThemeClassName('networkUseGroupNetworkFlowNeutralBorder')} />
                <div className="space-y-2">
                  <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {t('common.network.requestBadgeLegend')}
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={featureThemeClassName('networkUseGroupNetworkFlowNeutralSurface')}
                    ></div>
                    <span>{t('common.network.activeNoBadge')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={featureThemeClassName('networkUseGroupNetworkFlowNeutralSurface')}
                    >
                      <span
                        className={featureThemeClassName(
                          'networkUseGroupNetworkFlowInfoContrastRoundIcon'
                        )}
                      >
                        <ArrowDownLeft className="h-2 w-2" />
                      </span>
                    </div>
                    <span>{t('common.network.incomingRequest')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={featureThemeClassName('networkUseGroupNetworkFlowNeutralSurface')}
                    >
                      <span
                        className={featureThemeClassName(
                          'networkUseGroupNetworkFlowWarningContrastRoundIcon'
                        )}
                      >
                        <ArrowUpRight className="h-2 w-2" />
                      </span>
                    </div>
                    <span>{t('common.network.outgoingRequest')}</span>
                  </div>
                </div>
              </>
            }
          />
        }
      >
        <NetworkEntityDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          entity={selectedEntity}
        />
      </NetworkFlowBase>
    </div>
  );
}
