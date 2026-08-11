'use client';

import React from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { CivicNetworkFlow } from '@/features/network/ui/CivicNetworkFlow';
import { NetworkEntityDialog } from '@/features/network/ui/NetworkEntityDialog';
import {
  createEntityNodeLegendItem,
  createGroupNodeLegendItem,
  getNetworkSelectionStyle,
} from '@/features/network/ui/networkVisualHelpers';
import { featureThemeClassName } from '@/features/shared/theme';
import { Button } from '@/features/shared/ui/ui/button';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
export interface EventNetworkFlowProps {
  eventId: string;
}
export interface EventNetworkFlowViewProps {
  canManageEvent: any;
  connectionDirectionFilters: any;
  depthFilters: any;
  dialogOpen: any;
  edges: any;
  event: any;
  eventId: any;
  filteredEdges: any;
  filteredNodes: any;
  group: any;
  handleInteractiveChange: any;
  handleNodesChange: any;
  handleResetLayout: any;
  handleSaveLayout: any;
  hasLayoutChanges: any;
  hasSavedLayout: any;
  isInteractive: any;
  isLayoutLoading: any;
  legendCollapsed: any;
  navigate: any;
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
  toggleRight: any;
}

export function EventNetworkFlowView({
  canManageEvent,
  connectionDirectionFilters,
  depthFilters,
  dialogOpen,
  event,
  eventId,
  filteredEdges,
  filteredNodes,
  group,
  handleInteractiveChange,
  handleNodesChange,
  handleResetLayout,
  handleSaveLayout,
  hasLayoutChanges,
  hasSavedLayout,
  isInteractive,
  isLayoutLoading,
  legendCollapsed,
  navigate,
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
  toggleRight,
}: EventNetworkFlowViewProps) {
  if (!event) {
    return (
      <div className="bg-background flex h-full min-h-0 items-center justify-center rounded-lg border">
        <p className="text-muted-foreground">
          {translateText('generated.inline.0474_event_not_found_231b810d')}
        </p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="bg-background flex h-full min-h-0 items-center justify-center rounded-lg border px-4">
        <div className="text-center">
          <p className="text-muted-foreground">
            {translateText(
              'generated.inline.0765_this_event_is_not_associated_with_a_group_f78c85d7'
            )}
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            {translateText(
              'generated.inline.0766_network_visualization_is_only_available_for_e_b07d6969'
            )}
          </p>
          <div className="mt-4 flex justify-center gap-3">
            {canManageEvent ? (
              <Button
                onClick={() => navigate({ to: `/event/${eventId}/settings` })}
                data-action-id="network.event.settings.open"
              >
                {translateText('generated.inline.0767_zur_event_einstellungen_d28673fc')}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => navigate({ to: `/event/${eventId}` })}
                data-action-id="network.event.open"
              >
                {translateText('generated.inline.0768_zur_ck_zur_veranstaltung_163f275f')}
              </Button>
            )}
          </div>
        </div>
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
        title: t('common.network.eventNetwork'),
        description: t('common.network.eventNetworkDescription', {
          eventName: event.title ?? '',
          groupName: group.name ?? '',
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
        showRightsFilter: true,
        selectedRights,
        onToggleRight: toggleRight,
        connectionDirectionFilters,
        relationshipStatusFilters,
        showConnectionDirectionLegend: true,
        connectionDirectionLegendTitle: t('common.network.connectionDirections'),
        bidirectionalConnectionLabel: t('common.network.bidirectional'),
        incomingConnectionLabel: t('common.network.incomingConnections'),
        outgoingConnectionLabel: t('common.network.outgoingConnections'),
        relationshipStatusFiltersLabel: t('common.network.relationshipStatuses'),
        showRightsLegend: true,
      }}
      legendItems={[
        createEntityNodeLegendItem({
          id: 'event-center',
          label: t('common.network.eventCenter'),
          entityType: 'event',
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
            data-action-id="network.event-layout.save"
            disabled={isLayoutLoading || !hasLayoutChanges}
          >
            {t('common.network.saveLayout')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleResetLayout}
            data-action-id="network.event-layout.reset"
            disabled={isLayoutLoading || (!hasSavedLayout && !hasLayoutChanges)}
          >
            {t('common.network.resetLayout')}
          </Button>
        </>
      }
      legendExtraContent={
        <>
          <hr className={featureThemeClassName('networkUseGroupNetworkFlowNeutralBorder')} />
          <div className="space-y-2">
            <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t('common.network.requestBadgeLegend')}
            </div>
            <div className="flex items-center gap-2">
              <div className={featureThemeClassName('networkUseGroupNetworkFlowNeutralSurface')} />
              <span>{t('common.network.activeNoBadge')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={featureThemeClassName('networkUseGroupNetworkFlowNeutralSurface')}>
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
              <div className={featureThemeClassName('networkUseGroupNetworkFlowNeutralSurface')}>
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
    >
      <NetworkEntityDialog open={dialogOpen} onOpenChange={setDialogOpen} entity={selectedEntity} />
    </CivicNetworkFlow>
  );
}
