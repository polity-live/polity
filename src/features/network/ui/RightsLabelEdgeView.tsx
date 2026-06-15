import { BaseEdge, EdgeLabelRenderer } from '@xyflow/react';
import { RightBadge } from '@/features/shared/ui/status';
import {
  GraphBendPointButton,
  GraphBendPointContainer,
  GraphBendPointDeleteButton,
  GraphEdgeLabelButton,
  GraphEdgeLabelSurface,
  getGraphEdgeDragPathClassName,
} from '@/features/shared/ui/graph';
export interface RightsLabelEdgeViewProps {
  id: any;
  source: any;
  target: any;
  sourceX: any;
  sourceY: any;
  targetX: any;
  targetY: any;
  sourcePosition: any;
  targetPosition: any;
  style: any;
  markerStart: any;
  markerEnd: any;
  data: any;
  t: any;
  reactFlowInstance: any;
  onEdgeClick: any;
  suppressLabelClickRef: any;
  dragState: any;
  setDragState: any;
  bendPoints: any[];
  edgeEditingEnabled: any;
  onBendPointsChange: any;
  resolvedEdgeEndpoints: any;
  edgeSegments: any[];
  middleSegment: any;
  openRelationshipDetailsLabel: any;
  moveBendPointLabel: any;
  removeBendPointLabel: any;
  displayRights: any[];
  rightRelationshipKinds: any;
  removeBendPoint: any;
  nudgeBendPoint: any;
  handleBendPointKeyDown: any;
  handleLabelClick: any;
  isDragging: any;
  middleSegmentIndex: any;
  startSegmentDrag: any;
}

export function RightsLabelEdgeView({
  id,
  style,
  markerStart,
  markerEnd,
  data,
  dragState,
  setDragState,
  bendPoints,
  edgeEditingEnabled,
  edgeSegments,
  middleSegment,
  openRelationshipDetailsLabel,
  moveBendPointLabel,
  removeBendPointLabel,
  displayRights,
  rightRelationshipKinds,
  removeBendPoint,
  handleBendPointKeyDown,
  handleLabelClick,
  isDragging,
  middleSegmentIndex,
  startSegmentDrag,
}: RightsLabelEdgeViewProps) {
  const contextLabel = typeof data?.contextLabel === 'string' ? data.contextLabel : null;
  const showLabel = (displayRights.length > 0 || contextLabel) && middleSegment;

  return (
    <>
      {edgeSegments.map(({ edgePath }: any, segmentIndex: number) => (
        <g key={`${id}-segment-${segmentIndex}`}>
          <BaseEdge
            id={`${id}-segment-${segmentIndex}`}
            path={edgePath}
            style={style}
            markerStart={segmentIndex === 0 ? markerStart : undefined}
            markerEnd={segmentIndex === edgeSegments.length - 1 ? markerEnd : undefined}
          />
          <path
            d={edgePath}
            fill="none"
            strokeOpacity={0}
            strokeWidth={20}
            className={getGraphEdgeDragPathClassName(edgeEditingEnabled, isDragging)}
            onMouseDown={event => startSegmentDrag(event, segmentIndex, true)}
          />
        </g>
      ))}
      {showLabel && (
        <EdgeLabelRenderer>
          <GraphEdgeLabelButton
            aria-label={openRelationshipDetailsLabel}
            x={middleSegment.labelX}
            y={middleSegment.labelY}
            interaction={edgeEditingEnabled ? 'drag' : 'click'}
            onMouseDown={event => startSegmentDrag(event, middleSegmentIndex)}
            onClick={handleLabelClick}
          >
            <GraphEdgeLabelSurface>
              {displayRights.length > 0
                ? displayRights.map((right: any) => (
                    <RightBadge
                      key={right}
                      right={right}
                      requestKind={
                        rightRelationshipKinds[right] === 'incoming' ||
                        rightRelationshipKinds[right] === 'outgoing'
                          ? rightRelationshipKinds[right]
                          : null
                      }
                      size="compact"
                    />
                  ))
                : contextLabel}
            </GraphEdgeLabelSurface>
          </GraphEdgeLabelButton>
        </EdgeLabelRenderer>
      )}
      {edgeEditingEnabled &&
        bendPoints.map((bendPoint: any, bendPointIndex: number) => (
          <EdgeLabelRenderer key={`${id}-bend-point-${bendPointIndex}`}>
            <GraphBendPointContainer x={bendPoint.x} y={bendPoint.y}>
              <GraphBendPointButton
                aria-label={moveBendPointLabel}
                aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Delete Backspace"
                dragging={
                  dragState?.kind === 'bend-point' &&
                  dragState.bendPointIndex === bendPointIndex &&
                  dragState.isActive
                }
                onMouseDown={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDragState({
                    kind: 'bend-point',
                    bendPointIndex,
                    startClientX: event.clientX,
                    startClientY: event.clientY,
                    isActive: false,
                  });
                }}
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onKeyDown={event => handleBendPointKeyDown(event, bendPointIndex)}
              />
              <GraphBendPointDeleteButton
                aria-label={removeBendPointLabel}
                onMouseDown={event => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  removeBendPoint(bendPointIndex);
                }}
              />
            </GraphBendPointContainer>
          </EdgeLabelRenderer>
        ))}
    </>
  );
}
