'use client';

import { useState, useCallback, useMemo } from 'react';
import { MarkerType } from '@xyflow/react';
import { CalendarIcon } from 'lucide-react';
import { NetworkFlowBase } from '@/features/network/ui/NetworkFlowBase';
import {
  NetworkControlPanel,
  NETWORK_FILTER_ACTIVE_CLASS_NAMES,
} from '@/features/network/ui/NetworkControlPanel';
import {
  filterEdgesByRelationshipStatus,
  filterEdgesByConnectionDirections,
  filterNodesByEdges,
} from '@/features/network/logic/networkFilterHelpers';
import {
  buildRelationshipEdgeMarkers,
  buildSingleDirectionRightEdgeDirections,
  createNetworkRelationshipEdgeData,
  getRelationshipStrokeColor,
} from '@/features/network/logic/networkEdgeHelpers';
import { getGroupDisplayLabel } from '@/features/network/ui/networkVisualHelpers';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type {
  NetworkConnectionDirection,
  NetworkUserConnectionDirection,
} from '@/features/network/types/networkEdge.types';
import type { EnrichedPathSegment } from '@/features/network/types/network.types';

interface AmendmentPathVisualizationProps {
  enrichedPathData: EnrichedPathSegment[];
  groupTypeById: Map<string, string | null>;
  onNodeClick?: (eventId: string) => void;
}

export function AmendmentPathVisualization({
  enrichedPathData,
  groupTypeById,
  onNodeClick,
}: AmendmentPathVisualizationProps) {
  const { t } = useTranslation();
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [relationshipDepthFilter, setRelationshipDepthFilter] = useState<
    'all' | 'direct' | 'indirect'
  >('all');
  const [relationshipStatusFilter, setRelationshipStatusFilter] = useState<
    'active' | 'incoming' | 'outgoing'
  >('active');
  const [connectionDirectionFilter, setConnectionDirectionFilter] = useState<
    'all' | NetworkUserConnectionDirection
  >('all');
  const handleInteractiveChange = useCallback(() => undefined, []);
  const selectedConnectionDirections = useMemo(
    () =>
      connectionDirectionFilter === 'all'
        ? new Set<NetworkUserConnectionDirection>(['incoming', 'outgoing'])
        : new Set<NetworkUserConnectionDirection>([connectionDirectionFilter]),
    [connectionDirectionFilter]
  );

  const allLabel = t('common.labels.all', 'All');

  const depthFilters = useMemo(
    () => [
      {
        id: 'all',
        label: allLabel,
        active: relationshipDepthFilter === 'all',
        onToggle: () => setRelationshipDepthFilter('all'),
        activeClassName: NETWORK_FILTER_ACTIVE_CLASS_NAMES.neutral,
      },
      {
        id: 'direct',
        label: t('common.network.direct'),
        active: relationshipDepthFilter === 'direct',
        onToggle: () => setRelationshipDepthFilter('direct'),
        activeClassName: NETWORK_FILTER_ACTIVE_CLASS_NAMES.neutral,
      },
    ],
    [allLabel, relationshipDepthFilter, t]
  );

  const relationshipStatusFilters = useMemo(
    () => [
      {
        id: 'active',
        label: t('common.network.active'),
        active: relationshipStatusFilter === 'active',
        onToggle: () => setRelationshipStatusFilter('active'),
        activeClassName: NETWORK_FILTER_ACTIVE_CLASS_NAMES.green,
      },
      {
        id: 'incoming',
        label: t('common.network.incomingRequest'),
        active: relationshipStatusFilter === 'incoming',
        onToggle: () => setRelationshipStatusFilter('incoming'),
        disabled: true,
        activeClassName: NETWORK_FILTER_ACTIVE_CLASS_NAMES.blue,
      },
      {
        id: 'outgoing',
        label: t('common.network.outgoingRequest'),
        active: relationshipStatusFilter === 'outgoing',
        onToggle: () => setRelationshipStatusFilter('outgoing'),
        disabled: true,
        activeClassName: NETWORK_FILTER_ACTIVE_CLASS_NAMES.orange,
      },
    ],
    [relationshipStatusFilter, t]
  );

  const connectionDirectionFilters = useMemo(
    () => [
      {
        id: 'all',
        label: allLabel,
        active: connectionDirectionFilter === 'all',
        onToggle: () => setConnectionDirectionFilter('all'),
        activeClassName: NETWORK_FILTER_ACTIVE_CLASS_NAMES.purple,
      },
      {
        id: 'incoming',
        label: t('common.network.incomingConnections', 'Eingehend'),
        active: connectionDirectionFilter === 'incoming',
        onToggle: () => setConnectionDirectionFilter('incoming'),
        activeClassName: NETWORK_FILTER_ACTIVE_CLASS_NAMES.blue,
      },
      {
        id: 'outgoing',
        label: t('common.network.outgoingConnections', 'Ausgehend'),
        active: connectionDirectionFilter === 'outgoing',
        onToggle: () => setConnectionDirectionFilter('outgoing'),
        activeClassName: NETWORK_FILTER_ACTIVE_CLASS_NAMES.orange,
      },
    ],
    [allLabel, connectionDirectionFilter, t]
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: { data: { eventId?: string } }) => {
      if (typeof node.data.eventId === 'string' && onNodeClick) {
        onNodeClick(node.data.eventId);
      }
    },
    [onNodeClick]
  );

  if (!enrichedPathData || enrichedPathData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">{t('features.amendments.process.noPathAvailable')}</p>
      </div>
    );
  }

  const pathData = enrichedPathData;

  // Build nodes
  const nodes = [
    // User node (start)
    {
      id: 'path-user-node',
      type: 'default',
      position: { x: 100, y: 200 },
      data: {
        label: 'You',
        description: 'Starting point',
        type: 'user',
      },
      style: {
        background: '#e3f2fd',
        color: '#333',
        border: '3px solid #2196f3',
        borderRadius: '50%',
        padding: '20px',
        fontSize: '14px',
        fontWeight: 'bold',
        width: 180,
        height: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center' as const,
      },
    },
    // Path nodes (groups with events)
    ...pathData.map((segment, index: number) => {
      const isTargetNode = index === pathData.length - 1;
      const isForwardConfirmed = segment.forwardingStatus === 'forward_confirmed';

      let backgroundColor = '#c8e6c9';
      let borderColor = '#a5d6a7';

      if (isTargetNode) {
        backgroundColor = '#ffcdd2';
        borderColor = '#ef9a9a';
      } else if (isForwardConfirmed) {
        backgroundColor = '#b3e5fc';
        borderColor = '#81d4fa';
      }

      return {
        id: `path-node-${index}`,
        type: 'default',
        position: { x: 350 + index * 280, y: 200 },
        data: {
          label: (
            <div>
              <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '13px' }}>
                {getGroupDisplayLabel(
                  segment.groupName,
                  groupTypeById.get(segment.groupId ?? '') ?? null
                )}
              </div>

              {segment.eventId ? (
                <div
                  style={{
                    fontSize: '11px',
                    marginTop: '8px',
                    padding: '8px',
                    background: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '6px',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  className="hover:border-blue-200 hover:bg-white hover:shadow-md"
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginBottom: '4px',
                    }}
                  >
                    <CalendarIcon style={{ width: '12px', height: '12px', color: '#1976d2' }} />
                    <span style={{ fontWeight: '600', color: '#555' }}>
                      {isTargetNode ? 'Target Event' : 'Event'}
                    </span>
                  </div>
                  <div
                    style={{
                      color: '#1976d2',
                      fontWeight: '500',
                      textDecoration: 'underline',
                      lineHeight: '1.3',
                    }}
                  >
                    {segment.eventTitle}
                  </div>
                  {segment.eventStartDate && (
                    <div style={{ marginTop: '4px', fontSize: '10px', color: '#666' }}>
                      {new Date(segment.eventStartDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    fontSize: '10px',
                    marginTop: '8px',
                    padding: '6px',
                    background: 'rgba(255, 255, 255, 0.7)',
                    borderRadius: '4px',
                    color: '#999',
                    fontStyle: 'italic',
                  }}
                >
                  No upcoming event
                </div>
              )}

              {isForwardConfirmed && (
                <div
                  style={{
                    marginTop: '6px',
                    padding: '3px 6px',
                    background: '#4caf50',
                    color: 'white',
                    borderRadius: '3px',
                    fontSize: '9px',
                    fontWeight: '600',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                  }}
                >
                  ✓ Ready
                </div>
              )}
            </div>
          ),
          event: segment.eventTitle,
          type: 'group',
          eventId: segment.eventId,
        },
        style: {
          background: backgroundColor,
          color: '#333',
          border: `2px solid ${borderColor}`,
          borderRadius: '8px',
          padding: '12px',
          fontSize: '12px',
          fontWeight: '500',
          width: 220,
          minHeight: '120px',
          textAlign: 'center' as const,
          cursor: segment.eventId ? 'pointer' : 'default',
          boxShadow: isForwardConfirmed ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none',
        },
      };
    }),
  ];

  // Build edges
  const allEdges = [
    // Edge from user to first group
    {
      id: 'path-edge-user',
      source: 'path-user-node',
      target: 'path-node-0',
      type: 'smoothstep',
      animated: true,
      label: 'Member',
      data: createNetworkRelationshipEdgeData({
        rights: [],
        relationshipKinds: ['active'],
        relationshipType: 'membership',
        userConnectionDirections: ['outgoing'],
        sourceName: t('common.network.user', 'User'),
        targetName: pathData[0]?.groupName ?? null,
        relationshipDepth: 'direct',
      }),
      style: { stroke: '#2196f3', strokeWidth: 2 },
      labelStyle: {
        fill: '#1976d2',
        fontWeight: 600,
        fontSize: '11px',
      },
      labelBgStyle: {
        fill: 'white',
        fillOpacity: 0.9,
      },
      labelBgPadding: [8, 4] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#2196f3',
      },
    },
    // Edges between groups
    ...pathData.slice(0, -1).map((_, index: number) => ({
      ...(() => {
        const rightEdgeDirections = buildSingleDirectionRightEdgeDirections(['amendmentRight']);
        const strokeColor = getRelationshipStrokeColor('#66bb6a', rightEdgeDirections);

        return {
          id: `path-edge-${index}`,
          source: `path-node-${index}`,
          target: `path-node-${index + 1}`,
          type: 'rightsLabel',
          animated: true,
          data: createNetworkRelationshipEdgeData({
            rights: ['amendmentRight'],
            relationshipKinds: ['active'],
            rightRelationshipKinds: { amendmentRight: 'active' },
            relationshipType: 'child',
            rightEdgeDirections,
            rightConnectionDirections: { amendmentRight: 'outgoing' as NetworkConnectionDirection },
            userConnectionDirections: ['outgoing'],
            sourceName: pathData[index]?.groupName ?? null,
            targetName: pathData[index + 1]?.groupName ?? null,
            relationshipDepth: index === 0 ? 'direct' : 'indirect',
          }),
          style: { stroke: strokeColor, strokeWidth: 2 },
          ...buildRelationshipEdgeMarkers(strokeColor, rightEdgeDirections),
        };
      })(),
    })),
  ];

  const depthFilteredEdges =
    relationshipDepthFilter === 'all'
      ? allEdges
      : allEdges.filter(edge => edge.data?.relationshipDepth === relationshipDepthFilter);
  const statusFilteredEdges = filterEdgesByRelationshipStatus(
    depthFilteredEdges,
    relationshipStatusFilter
  );
  const filteredEdges = filterEdgesByConnectionDirections(
    statusFilteredEdges,
    selectedConnectionDirections
  );
  const filteredNodes = filterNodesByEdges(nodes, filteredEdges, ['path-user-node']);

  return (
    <NetworkFlowBase
      nodes={filteredNodes}
      edges={filteredEdges}
      panel={
        <NetworkControlPanel
          title={t('features.amendments.process.pathVisualization', 'Path Visualization')}
          description={t(
            'features.amendments.process.pathNetworkDescription',
            'Amendment forwarding path through connected groups and agenda events.'
          )}
          panelCollapsed={panelCollapsed}
          onPanelCollapsedChange={setPanelCollapsed}
          legendCollapsed={legendCollapsed}
          onLegendCollapsedChange={setLegendCollapsed}
          legendTitle={t('common.network.legend')}
          legendItems={[
            {
              id: 'path-user',
              label: t('common.network.user', 'User'),
              swatchClassName: 'h-4 w-4 rounded-full border-2 border-[#2196f3] bg-[#e3f2fd]',
            },
            {
              id: 'path-current-group',
              label: t('features.amendments.process.currentTargetGroup', 'Current Target Group'),
              swatchClassName: 'h-4 w-4 rounded border border-[#66bb6a] bg-[#c8e6c9]',
            },
            {
              id: 'path-forwarded-group',
              label: t('features.amendments.process.forwardedGroups', 'Forwarded Groups'),
              swatchClassName: 'h-4 w-4 rounded border border-[#ffa726] bg-[#ffecb3]',
            },
          ]}
          depthFilters={depthFilters}
          showGroupTypeLegend
          baseGroupLabel={`◉ ${t('common.network.baseGroup', 'Base group')}`}
          hierarchicalGroupLabel={`🏛 ${t('common.network.hierarchicalGroup', 'Hierarchical group')}`}
          siblingGroupLabel={`◎ ${t('common.network.sibling', 'Sibling group')}`}
          showDisplayControls={false}
          showInteractiveToggle={false}
          isInteractive={true}
          onInteractiveChange={handleInteractiveChange}
          connectionDirectionFilters={connectionDirectionFilters}
          relationshipStatusFilters={relationshipStatusFilters}
          relationshipStatusFiltersLabel={t('common.network.relationshipStatuses')}
          showConnectionDirectionLegend
          connectionDirectionLegendTitle={t(
            'common.network.connectionDirections',
            'Verbindungsrichtungen'
          )}
          bidirectionalConnectionLabel={t('common.network.bidirectional', 'Beidseitig')}
          incomingConnectionLabel={t('common.network.incomingConnections', 'Eingehend')}
          outgoingConnectionLabel={t('common.network.outgoingConnections', 'Ausgehend')}
          showRightsLegend
        />
      }
      onNodeClick={handleNodeClick}
    />
  );
}
