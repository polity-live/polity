import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { CalendarClock, Clock3, ScrollText } from 'lucide-react';
import { CivicNetworkFlow } from '@/features/network/ui/CivicNetworkFlow';
import { getCivicNetworkEdgeStyle } from '@/features/network/logic/networkEdgeHelpers';
import {
  createEntityNodeLegendItem,
  createGroupNodeLegendItem,
  createProcessStatusLegendItem,
  getEntityNetworkNodeStyle,
  getGroupDisplayLabel,
  getGroupNodeStyle,
  getGroupNodeVisualVariant,
  getProcessStatusNodeAccent,
  getProcessStatusVisualTokens,
  type GroupNodeVisualVariant,
} from '@/features/network/ui/networkVisualHelpers';
import { useTranslation, translate } from '@/features/shared/hooks/use-translation';
import { useLanguageStore } from '@/features/shared/global-state/language.store';

type ProcessNodeState = 'approved' | 'active-next' | 'rejected' | 'pending';

export interface AmendmentPathVisualizationSegment {
  groupId: string | null;
  groupName: string;
  eventId: string | null;
  eventTitle: string;
  eventStartDate: number | null;
  agendaItemId: string | null;
  amendmentVoteId: string | null;
  forwardingStatus: string | null;
  rawStatus?: string | null;
  rawDecisionStatus?: string | null;
  order: number | null;
  isActiveStep?: boolean;
  eventRequestPending?: boolean;
}

export interface AmendmentPathVisualizationViewProps {
  enrichedPathData: AmendmentPathVisualizationSegment[];
  groupTypeById?: Map<string, string | null>;
  onGroupClick?: (groupId: string) => void;
  onNodeClick?: (eventId: string) => void;
  legendOpen: boolean;
  onLegendOpenChange: (open: boolean) => void;
}

const GROUP_X_SPACING = 320;
const GROUP_NODE_Y = 80;
const EVENT_NODE_Y = 270;

function mapForwardingStatusToNodeState(status?: string | null): ProcessNodeState {
  switch (status) {
    case 'approved':
    case 'accepted':
    case 'supported':
    case 'merged':
    case 'completed':
      return 'approved';
    case 'forward_confirmed':
    case 'scheduled':
    case 'in_vote':
      return 'active-next';
    case 'rejected':
    case 'withdrawn':
      return 'rejected';
    case 'previous_decision_outstanding':
    case 'pending_event':
    case 'tie':
    default:
      return 'pending';
  }
}

function buildSegmentsWithVisualStates(segments: AmendmentPathVisualizationSegment[]) {
  let rejectionReached = false;

  return segments.map(segment => {
    const mappedState = segment.isActiveStep
      ? 'active-next'
      : mapForwardingStatusToNodeState(segment.forwardingStatus);
    if (rejectionReached || mappedState === 'rejected') {
      rejectionReached = true;
      return { ...segment, visualState: 'rejected' as const };
    }

    return { ...segment, visualState: mappedState };
  });
}

function formatNodeDate(value: number | null) {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleString(
    useLanguageStore.getState().language === 'de' ? 'de-DE' : 'en-US',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  );
}

function getEventCaption(segment: AmendmentPathVisualizationSegment) {
  if (segment.eventId) {
    return (
      formatNodeDate(segment.eventStartDate) ??
      translate('features.network.amendmentPath.eventScheduled')
    );
  }

  return segment.eventRequestPending
    ? translate('features.network.amendmentPath.eventRequestedPending')
    : translate('features.network.amendmentPath.eventPending');
}

function getGroupVisualVariantForSegment({
  index,
  totalSegments,
  groupType,
}: {
  index: number;
  totalSegments: number;
  groupType?: string | null;
}): GroupNodeVisualVariant {
  const role = index === 0 ? 'current' : index === totalSegments - 1 ? 'child' : 'parent';

  return getGroupNodeVisualVariant({
    role,
    siblingMembershipMode: groupType,
  });
}

function buildGroupProcessNodeStyle({
  state,
  visualVariant,
  isClickable,
}: {
  state: ProcessNodeState;
  visualVariant: GroupNodeVisualVariant;
  isClickable: boolean;
}): CSSProperties {
  const status = getProcessStatusNodeAccent(state);
  const baseStyle = getGroupNodeStyle(visualVariant, {
    width: 240,
    textAlign: 'left',
    padding: '12px',
    borderRadius: '10px',
    cursor: isClickable ? 'pointer' : undefined,
  });

  if (state === 'pending') {
    return baseStyle;
  }

  return {
    ...baseStyle,
    outline: `2px solid ${status.borderColor}`,
    outlineOffset: 3,
    boxShadow:
      state === 'active-next'
        ? `0 0 0 5px color-mix(in oklab, ${status.borderColor} 18%, transparent), ${baseStyle.boxShadow}`
        : baseStyle.boxShadow,
  };
}

function buildEventProcessNodeStyle({
  state,
  isClickable,
}: {
  state: ProcessNodeState;
  isClickable: boolean;
}): CSSProperties {
  const status = getProcessStatusNodeAccent(state);
  const baseStyle = getEntityNetworkNodeStyle('event', {
    width: 216,
    padding: '12px',
    textAlign: 'left',
    cursor: isClickable ? 'pointer' : undefined,
  });

  return {
    ...baseStyle,
    border: `2px solid ${
      state === 'active-next' ? status.borderColor : 'var(--entity-event-border)'
    }`,
    boxShadow:
      state === 'active-next'
        ? `0 0 0 5px color-mix(in oklab, ${status.borderColor} 18%, transparent), var(--shadow-panel)`
        : baseStyle.boxShadow,
  };
}

function ProcessStatusBadge({ state, label }: { state: ProcessNodeState; label: string }) {
  const status = getProcessStatusVisualTokens(state);

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium"
      style={{
        backgroundColor: `color-mix(in oklab, ${status.borderColor} 12%, var(--card))`,
        borderColor: status.borderColor,
        color: status.textColor,
      }}
    >
      <span
        aria-hidden="true"
        className="flex h-4 w-4 items-center justify-center rounded-sm text-[10px] font-bold"
        style={{
          backgroundColor: 'var(--card)',
          color: status.textColor,
        }}
      >
        {status.symbol}
      </span>
      {label}
    </div>
  );
}

export function AmendmentPathVisualizationView({
  enrichedPathData,
  groupTypeById = new Map<string, string | null>(),
  onGroupClick,
  onNodeClick,
  legendOpen,
  onLegendOpenChange,
}: AmendmentPathVisualizationViewProps) {
  const { t } = useTranslation();
  const [panelCollapsed, setPanelCollapsed] = useState(true);

  const segments = buildSegmentsWithVisualStates(enrichedPathData);
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  segments.forEach((segment, index) => {
    const x = 80 + index * GROUP_X_SPACING;
    const groupNodeId = `process-group-${index}`;
    const eventNodeId = `process-event-${index}`;
    const nodeState = segment.visualState;
    const eventCaption = getEventCaption(segment);
    const groupType = groupTypeById.get(segment.groupId ?? '') ?? null;
    const groupVisualVariant = getGroupVisualVariantForSegment({
      index,
      totalSegments: segments.length,
      groupType,
    });
    const nodeStatusLabel =
      nodeState === 'approved'
        ? t('features.amendments.process.stepApproved')
        : nodeState === 'active-next'
          ? t('features.amendments.process.stepActiveNext')
          : nodeState === 'rejected'
            ? t('features.amendments.process.stepRejected')
            : t('features.amendments.process.stepPending');

    nodes.push({
      id: groupNodeId,
      position: { x, y: GROUP_NODE_Y },
      className: segment.groupId ? 'cursor-pointer' : undefined,
      style: buildGroupProcessNodeStyle({
        state: nodeState,
        visualVariant: groupVisualVariant,
        isClickable: Boolean(segment.groupId),
      }),
      data: {
        groupId: segment.groupId,
        label: (
          <div className="space-y-3">
            <div className="text-xs font-medium tracking-wide uppercase opacity-75">
              {t('features.amendments.process.groupNode')}
            </div>
            <div className="text-sm font-semibold">
              {getGroupDisplayLabel(segment.groupName, groupType)}
            </div>
            <ProcessStatusBadge state={nodeState} label={nodeStatusLabel} />
          </div>
        ),
      },
    });

    nodes.push({
      id: eventNodeId,
      position: { x: x + 12, y: EVENT_NODE_Y },
      className: segment.eventId ? 'cursor-pointer' : undefined,
      style: buildEventProcessNodeStyle({
        state: nodeState,
        isClickable: Boolean(segment.eventId),
      }),
      data: {
        eventId: segment.eventId,
        label: (
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium tracking-wide uppercase">
              {segment.eventId ? (
                <CalendarClock className="h-3.5 w-3.5" />
              ) : (
                <Clock3 className="h-3.5 w-3.5" />
              )}
              {t('features.amendments.process.eventNode')}
            </div>
            <div className="text-sm font-semibold">
              {segment.eventId
                ? segment.eventTitle
                : t('features.amendments.process.eventRequestedPending')}
            </div>
            <div className="flex items-center gap-2 text-xs opacity-80">
              <ScrollText className="h-3.5 w-3.5" />
              <span>{eventCaption}</span>
            </div>
          </div>
        ),
      },
    });

    edges.push({
      id: `process-group-event-${index}`,
      source: groupNodeId,
      target: eventNodeId,
      type: 'smoothstep',
      style: getCivicNetworkEdgeStyle({
        color: getProcessStatusNodeAccent(nodeState).borderColor,
        strokeDasharray: segment.eventId ? undefined : '5 5',
      }),
      animated: nodeState === 'active-next',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: getProcessStatusNodeAccent(nodeState).borderColor,
      },
    });

    if (index < segments.length - 1) {
      const nextState = segments[index + 1].visualState;
      edges.push({
        id: `process-event-group-${index}`,
        source: eventNodeId,
        target: `process-group-${index + 1}`,
        type: 'smoothstep',
        style: getCivicNetworkEdgeStyle({
          color: getProcessStatusNodeAccent(nextState).borderColor,
        }),
        animated: nextState === 'active-next',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: getProcessStatusNodeAccent(nextState).borderColor,
        },
      });
    }
  });

  return (
    <CivicNetworkFlow
      nodes={nodes}
      edges={edges}
      nodesDraggable={false}
      nodesFocusable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      onNodeClick={(_event, node) => {
        const groupId = typeof node.data?.groupId === 'string' ? node.data.groupId : null;
        const eventId = typeof node.data?.eventId === 'string' ? node.data.eventId : null;
        if (groupId && onGroupClick) {
          onGroupClick(groupId);
          return;
        }
        if (eventId && onNodeClick) {
          onNodeClick(eventId);
        }
      }}
      panelConfig={{
        title: t('features.amendments.process.pathVisualization'),
        description: t('features.amendments.process.pathNetworkDescription'),
        panelCollapsed,
        onPanelCollapsedChange: setPanelCollapsed,
        legendCollapsed: !legendOpen,
        onLegendCollapsedChange: collapsed => onLegendOpenChange(!collapsed),
        legendTitle: t('common.network.legend'),
        showDisplayControls: false,
        showInteractiveToggle: false,
        isInteractive: false,
        onInteractiveChange: () => undefined,
      }}
      legendSections={[
        {
          id: 'groups',
          title: t('features.amendments.process.groupNode'),
          items: [
            createGroupNodeLegendItem({
              id: 'process-start-group',
              label: t('common.network.currentGroup'),
              visualVariant: 'current',
            }),
            createGroupNodeLegendItem({
              id: 'process-intermediate-group',
              label: t('features.amendments.process.groupNode'),
              visualVariant: 'parent',
            }),
            createGroupNodeLegendItem({
              id: 'process-target-group',
              label: t('common.network.childGroup'),
              visualVariant: 'child',
            }),
          ],
        },
        {
          id: 'events',
          title: t('features.amendments.process.eventNode'),
          items: [
            createEntityNodeLegendItem({
              id: 'process-event-node',
              label: t('features.amendments.process.eventNode'),
              entityType: 'event',
            }),
          ],
        },
        {
          id: 'status',
          title: t('features.amendments.process.pathVisualization'),
          items: [
            createProcessStatusLegendItem({
              id: 'approved',
              label: t('features.amendments.process.stepApproved'),
              state: 'approved',
            }),
            createProcessStatusLegendItem({
              id: 'active',
              label: t('features.amendments.process.stepActiveNext'),
              state: 'active-next',
            }),
            createProcessStatusLegendItem({
              id: 'pending',
              label: t('features.amendments.process.stepPending'),
              state: 'pending',
            }),
            createProcessStatusLegendItem({
              id: 'rejected',
              label: t('features.amendments.process.stepRejected'),
              state: 'rejected',
            }),
          ],
        },
      ]}
      containerClassName="h-full min-h-[22rem]"
    />
  );
}
