import { useState } from 'react';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import { CalendarClock, ChevronDown, ChevronRight, Clock3, ScrollText } from 'lucide-react';
import { Panel, NetworkFlowBase } from '@/features/network/ui/NetworkFlowBase';
import { getGroupDisplayLabel } from '@/features/network/ui/networkVisualHelpers';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import { cn } from '@/features/shared/utils/utils';

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

interface AmendmentPathVisualizationProps {
  enrichedPathData: AmendmentPathVisualizationSegment[];
  groupTypeById?: Map<string, string | null>;
  onGroupClick?: (groupId: string) => void;
  onNodeClick?: (eventId: string) => void;
}

const GROUP_X_SPACING = 320;
const GROUP_NODE_Y = 80;
const EVENT_NODE_Y = 270;

function getNodeStatePalette(state: ProcessNodeState) {
  switch (state) {
    case 'approved':
      return {
        borderColor: '#22c55e',
        backgroundColor: '#f0fdf4',
        textColor: '#14532d',
        shadowColor: 'rgba(34, 197, 94, 0.2)',
      };
    case 'active-next':
      return {
        borderColor: '#ec4899',
        backgroundColor: '#fdf2f8',
        textColor: '#831843',
        shadowColor: 'rgba(236, 72, 153, 0.22)',
      };
    case 'rejected':
      return {
        borderColor: '#ef4444',
        backgroundColor: '#fff1f2',
        textColor: '#7f1d1d',
        shadowColor: 'rgba(239, 68, 68, 0.22)',
      };
    case 'pending':
    default:
      return {
        borderColor: '#94a3b8',
        backgroundColor: '#f8fafc',
        textColor: '#334155',
        shadowColor: 'rgba(148, 163, 184, 0.18)',
      };
  }
}

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

function buildProcessNodeStyle(state: ProcessNodeState, width: number) {
  const palette = getNodeStatePalette(state);

  return {
    width,
    border: `3px solid ${palette.borderColor}`,
    borderRadius: '16px',
    background: palette.backgroundColor,
    color: palette.textColor,
    padding: '14px',
    boxShadow: `0 14px 28px ${palette.shadowColor}`,
    textAlign: 'left' as const,
  };
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

  return new Date(value).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getEventCaption(segment: AmendmentPathVisualizationSegment) {
  if (segment.eventId) {
    return formatNodeDate(segment.eventStartDate) ?? 'Event scheduled';
  }

  return segment.eventRequestPending ? 'Event requested, pending' : 'Event pending';
}

export function AmendmentPathVisualization({
  enrichedPathData,
  groupTypeById = new Map<string, string | null>(),
  onGroupClick,
  onNodeClick,
}: AmendmentPathVisualizationProps) {
  const { t } = useTranslation();
  const [legendOpen, setLegendOpen] = useState(true);

  if (!enrichedPathData || enrichedPathData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">{t('features.amendments.process.noPathAvailable')}</p>
      </div>
    );
  }

  const segments = buildSegmentsWithVisualStates(enrichedPathData);
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  console.log('PROCESS LOG [amendment-path-visualization]', {
    segments: segments.map(segment => ({
      order: segment.order,
      groupName: segment.groupName,
      eventTitle: segment.eventTitle,
      forwardingStatus: segment.forwardingStatus,
      rawStatus: segment.rawStatus,
      rawDecisionStatus: segment.rawDecisionStatus,
      isActiveStep: segment.isActiveStep ?? false,
      visualState: segment.visualState,
    })),
  });

  segments.forEach((segment, index) => {
    const x = 80 + index * GROUP_X_SPACING;
    const groupNodeId = `process-group-${index}`;
    const eventNodeId = `process-event-${index}`;
    const nodeState = segment.visualState;
    const eventCaption = getEventCaption(segment);

    nodes.push({
      id: groupNodeId,
      position: { x, y: GROUP_NODE_Y },
      className: cn(
        segment.groupId && 'cursor-pointer',
        nodeState === 'active-next' ? 'animate-pulse' : undefined
      ),
      style: buildProcessNodeStyle(nodeState, 240),
      data: {
        groupId: segment.groupId,
        label: (
          <div className="space-y-3">
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase opacity-75">
              {t('features.amendments.process.groupNode', 'Group')}
            </div>
            <div className="text-sm font-semibold">
              {getGroupDisplayLabel(
                segment.groupName,
                groupTypeById.get(segment.groupId ?? '') ?? null
              )}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-current/15 bg-white/70 px-3 py-1 text-[11px] font-medium dark:bg-black/10">
              <ScrollText className="h-3.5 w-3.5" />
              {nodeState === 'approved'
                ? t('features.amendments.process.stepApproved', 'Approved')
                : nodeState === 'active-next'
                  ? t('features.amendments.process.stepActiveNext', 'Next active step')
                  : nodeState === 'rejected'
                    ? t('features.amendments.process.stepRejected', 'Rejected')
                    : t('features.amendments.process.stepPending', 'Pending')}
            </div>
          </div>
        ),
      },
    });

    nodes.push({
      id: eventNodeId,
      position: { x: x + 12, y: EVENT_NODE_Y },
      className: cn(
        segment.eventId && 'cursor-pointer',
        nodeState === 'active-next' ? 'animate-pulse' : undefined
      ),
      style: buildProcessNodeStyle(nodeState, 216),
      data: {
        eventId: segment.eventId,
        label: (
          <div className="space-y-3">
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase opacity-75">
              {t('features.amendments.process.eventNode', 'Event')}
            </div>
            <div className="text-sm font-semibold">
              {segment.eventId
                ? segment.eventTitle
                : t(
                    'features.amendments.process.eventRequestedPending',
                    'Event requested, pending'
                  )}
            </div>
            <div className="flex items-center gap-2 text-xs opacity-80">
              {segment.eventId ? (
                <CalendarClock className="h-3.5 w-3.5" />
              ) : (
                <Clock3 className="h-3.5 w-3.5" />
              )}
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
      style: {
        stroke: getNodeStatePalette(nodeState).borderColor,
        strokeWidth: 2,
        strokeDasharray: segment.eventId ? undefined : '5 5',
      },
      animated: nodeState === 'active-next',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: getNodeStatePalette(nodeState).borderColor,
      },
    });

    if (index < segments.length - 1) {
      const nextState = segments[index + 1]?.visualState ?? 'pending';
      edges.push({
        id: `process-event-group-${index}`,
        source: eventNodeId,
        target: `process-group-${index + 1}`,
        type: 'smoothstep',
        style: {
          stroke: getNodeStatePalette(nextState).borderColor,
          strokeWidth: 2.5,
        },
        animated: nextState === 'active-next',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: getNodeStatePalette(nextState).borderColor,
        },
      });
    }
  });

  return (
    <NetworkFlowBase
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
      panel={
        <Panel position="top-right">
          <div className="bg-background/95 w-72 rounded-xl border p-4 shadow-lg backdrop-blur">
            <Collapsible open={legendOpen} onOpenChange={setLegendOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 text-left"
                  aria-label={t('features.amendments.process.pathVisualization', 'Process flow')}
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {t('features.amendments.process.pathVisualization', 'Process flow')}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {legendOpen
                        ? t('features.amendments.process.pathLegendHideHint', 'Hide legend')
                        : t('features.amendments.process.pathLegendShowHint', 'Show legend')}
                    </p>
                  </div>
                  {legendOpen ? (
                    <ChevronDown className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="text-muted-foreground mt-3 text-xs">
                  {t(
                    'features.amendments.process.pathNetworkDescription',
                    'Groups and events share the same process-state border semantics across the amendment flow and agenda detail pages.'
                  )}
                </p>
                <div className="mt-4 space-y-2 text-xs">
                  {[
                    {
                      id: 'approved',
                      label: t('features.amendments.process.stepApproved', 'Approved'),
                      color: getNodeStatePalette('approved').borderColor,
                    },
                    {
                      id: 'active',
                      label: t('features.amendments.process.stepActiveNext', 'Next active step'),
                      color: getNodeStatePalette('active-next').borderColor,
                      pulse: true,
                    },
                    {
                      id: 'pending',
                      label: t('features.amendments.process.stepPending', 'Pending'),
                      color: getNodeStatePalette('pending').borderColor,
                    },
                    {
                      id: 'rejected',
                      label: t('features.amendments.process.stepRejected', 'Rejected'),
                      color: getNodeStatePalette('rejected').borderColor,
                    },
                  ].map(item => (
                    <div key={item.id} className="flex items-center gap-3">
                      <span
                        className={cn(
                          'inline-flex h-4 w-4 rounded-full border-2',
                          item.pulse ? 'animate-pulse' : undefined
                        )}
                        style={{ borderColor: item.color }}
                      />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </Panel>
      }
      containerClassName="h-full min-h-[22rem]"
    />
  );
}
