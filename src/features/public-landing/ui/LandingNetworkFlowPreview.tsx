'use client';

import { useCallback } from 'react';
import { featureThemeClassName, featureThemeValue } from '@/features/shared/theme';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { NetworkFlowBase } from '@/features/network/ui/NetworkFlowBase';
import { NetworkControlPanel } from '@/features/network/ui/NetworkControlPanel';
import { NetworkEntityDialog } from '@/features/network/ui/NetworkEntityDialog';
import { createGroupNodeLegendItem } from '@/features/network/ui/networkVisualHelpers';
import {
  landingNetworkAlwaysVisibleNodeIds,
  landingNetworkEdges,
  landingNetworkNodes,
} from '@/features/public-landing/logic/landingNetworkPreview';
import { useLandingNetworkPreviewState } from '@/features/public-landing/hooks/useLandingNetworkPreviewState';

export function LandingNetworkFlowPreview() {
  const { t } = useTranslation();
  const translateRelationship = useCallback(
    (key: string, fallback?: string) => t(key, fallback),
    [t]
  );
  const state = useLandingNetworkPreviewState({
    nodes: landingNetworkNodes,
    edges: landingNetworkEdges,
    alwaysVisibleNodeIds: landingNetworkAlwaysVisibleNodeIds,
    translateRelationship,
  });

  return (
    <div className="landing-network-preview bg-card overflow-hidden rounded-lg border shadow-sm">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">{t('pages.home.publicLanding.network.title')}</p>
        <p className="text-muted-foreground text-sm">
          {t('pages.home.publicLanding.network.description')}
        </p>
      </div>
      <NetworkFlowBase
        nodes={state.visibleNodes}
        edges={state.visibleEdges}
        nodesDraggable={false}
        nodesFocusable
        nodesConnectable={false}
        edgesFocusable
        onNodeClick={state.onNodeClick}
        onEdgeClick={state.onEdgeClick}
        containerClassName="h-[34rem] min-h-[30rem] rounded-none border-0"
        miniMapProps={{
          position: 'bottom-right',
          nodeBorderRadius: 8,
          nodeColor: node =>
            node.data?.kind === 'event'
              ? featureThemeValue('publiclandingLandingNetworkPreviewTealColor')
              : String(
                  (node.style as { background?: string } | undefined)?.background ??
                    featureThemeValue('publiclandingPublicLandingPageNeutralColor')
                ),
          nodeStrokeColor: node =>
            node.data?.kind === 'event'
              ? featureThemeValue('publiclandingPublicLandingPageTealColor')
              : featureThemeValue('networkAmendmentPathVisualizationNeutralColorBeta'),
          maskColor: featureThemeClassName('publiclandingPublicLandingPageThemedStyleAlpha'),
          style: { width: 170, height: 118 },
        }}
        panel={
          <NetworkControlPanel
            title={t('pages.home.publicLanding.network.panelTitle')}
            description={t('pages.home.publicLanding.network.description')}
            panelCollapsed={state.panelCollapsed}
            onPanelCollapsedChange={state.setPanelCollapsed}
            legendCollapsed={state.legendCollapsed}
            onLegendCollapsedChange={state.setLegendCollapsed}
            legendTitle={t('common.network.legend')}
            legendItems={[
              createGroupNodeLegendItem({
                id: 'state-party',
                label: t('common.network.parentGroup'),
                visualVariant: 'parent',
              }),
              createGroupNodeLegendItem({
                id: 'local-branch',
                label: t('common.network.currentGroup'),
                visualVariant: 'current',
              }),
              createGroupNodeLegendItem({
                id: 'policy-committee',
                label: t('common.network.childGroup'),
                visualVariant: 'child',
              }),
              createGroupNodeLegendItem({
                id: 'party-congress',
                label: t('common.network.siblingGroupElected'),
                visualVariant: 'sibling-elected',
              }),
              createGroupNodeLegendItem({
                id: 'parliamentary-group',
                label: t('common.network.siblingGroupParliament'),
                visualVariant: 'sibling-parliament',
              }),
              {
                id: 'events',
                label: t('common.labels.eventDetails'),
                swatchClassName: featureThemeClassName('publiclandingPublicLandingPageTealSurface'),
              },
            ]}
            showDisplayControls={false}
            showInteractiveToggle={false}
            isInteractive
            onInteractiveChange={() => undefined}
            showRightsFilter
            selectedRights={state.selectedRights}
            onToggleRight={state.toggleRight}
            connectionDirectionFilters={[
              {
                id: 'incoming',
                label: t('common.network.incomingConnections'),
                active: state.selectedConnectionDirections.has('incoming'),
                onToggle: () => state.toggleConnectionDirection('incoming'),
              },
              {
                id: 'outgoing',
                label: t('common.network.outgoingConnections'),
                active: state.selectedConnectionDirections.has('outgoing'),
                onToggle: () => state.toggleConnectionDirection('outgoing'),
              },
            ]}
            showConnectionDirectionLegend
            connectionDirectionLegendTitle={t('common.network.connectionDirections')}
            bidirectionalConnectionLabel={t('common.network.bidirectional')}
            incomingConnectionLabel={t('common.network.incomingConnections')}
            outgoingConnectionLabel={t('common.network.outgoingConnections')}
            showRightsLegend
          />
        }
      >
        <NetworkEntityDialog
          open={state.dialogOpen}
          onOpenChange={state.setDialogOpen}
          entity={state.selectedEntity}
        />
      </NetworkFlowBase>
    </div>
  );
}
