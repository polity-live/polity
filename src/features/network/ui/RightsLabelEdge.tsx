import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow } from '@xyflow/react';
import type { EdgeProps, XYPosition } from '@xyflow/react';
import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RightBadge } from '@/features/network/ui/RightBadge';
import { useEdgeClickContext } from '@/features/network/ui/NetworkFlowBase';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { EditableRightsLabelEdgeData } from '@/features/network/types/networkEdge.types';
import './RightsLabelEdge.css';

type EdgeDragState =
  | {
      kind: 'bend-point';
      bendPointIndex: number;
      startClientX: number;
      startClientY: number;
      isActive: boolean;
    }
  | {
      kind: 'segment';
      segmentIndex: number;
      startClientX: number;
      startClientY: number;
      insertedBendPointIndex: number | null;
    };

const EDGE_DRAG_THRESHOLD = 4;

export function RightsLabelEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerStart,
  markerEnd,
  data,
}: EdgeProps<EditableRightsLabelEdgeData>) {
  const { t } = useTranslation();
  const reactFlowInstance = useReactFlow();
  const onEdgeClick = useEdgeClickContext();
  const suppressLabelClickRef = useRef(false);
  const [dragState, setDragState] = useState<EdgeDragState | null>(null);
  const bendPoints = Array.isArray(data?.bendPoints) ? data.bendPoints : [];
  const edgeEditingEnabled = data?.edgeEditingEnabled === true;
  const onBendPointsChange = data?.onBendPointsChange;

  const edgeSegments = useMemo(() => {
    const segmentPoints: XYPosition[] = [
      { x: sourceX, y: sourceY },
      ...bendPoints,
      { x: targetX, y: targetY },
    ];

    return segmentPoints.slice(0, -1).map((segmentSource, index) => {
      const segmentTarget = segmentPoints[index + 1];
      const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX: segmentSource.x,
        sourceY: segmentSource.y,
        targetX: segmentTarget.x,
        targetY: segmentTarget.y,
        sourcePosition,
        targetPosition,
      });

      return {
        edgePath,
        labelX,
        labelY,
      };
    });
  }, [bendPoints, sourcePosition, sourceX, sourceY, targetPosition, targetX, targetY]);

  const middleSegment = edgeSegments[Math.floor(edgeSegments.length / 2)] ?? null;

  // visibleRights reflects the current filter selection; rights is the full set
  const displayRights = Array.isArray(data?.visibleRights)
    ? (data.visibleRights as string[])
    : Array.isArray(data?.rights)
      ? (data.rights as string[])
      : [];
  const rightRelationshipKinds =
    data?.rightRelationshipKinds && typeof data.rightRelationshipKinds === 'object'
      ? data.rightRelationshipKinds
      : {};

  useEffect(() => {
    if (dragState === null) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!onBendPointsChange) {
        return;
      }

      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      if (dragState.kind === 'bend-point') {
        const movementDistance = Math.hypot(
          event.clientX - dragState.startClientX,
          event.clientY - dragState.startClientY
        );

        if (!dragState.isActive && movementDistance < EDGE_DRAG_THRESHOLD) {
          return;
        }

        if (!dragState.isActive) {
          setDragState({
            ...dragState,
            isActive: true,
          });
        }

        const nextBendPoints = bendPoints.map((bendPoint, index) =>
          index === dragState.bendPointIndex ? { x: flowPosition.x, y: flowPosition.y } : bendPoint
        );

        onBendPointsChange(id, nextBendPoints);
        return;
      }

      const movementDistance = Math.hypot(
        event.clientX - dragState.startClientX,
        event.clientY - dragState.startClientY
      );

      if (dragState.insertedBendPointIndex === null && movementDistance < EDGE_DRAG_THRESHOLD) {
        return;
      }

      if (dragState.insertedBendPointIndex === null) {
        const nextBendPoints = [...bendPoints];
        nextBendPoints.splice(dragState.segmentIndex, 0, {
          x: flowPosition.x,
          y: flowPosition.y,
        });
        onBendPointsChange(id, nextBendPoints);
        setDragState({
          ...dragState,
          insertedBendPointIndex: dragState.segmentIndex,
        });
        return;
      }

      const nextBendPoints = bendPoints.map((bendPoint, index) =>
        index === dragState.insertedBendPointIndex
          ? { x: flowPosition.x, y: flowPosition.y }
          : bendPoint
      );

      onBendPointsChange(id, nextBendPoints);
    };

    const handleMouseUp = () => {
      const activeDragState = dragState;
      setDragState(null);

      if (
        activeDragState.kind === 'segment' &&
        activeDragState.insertedBendPointIndex === null &&
        onEdgeClick
      ) {
        onEdgeClick(id);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [bendPoints, dragState, id, onBendPointsChange, onEdgeClick, reactFlowInstance]);

  const removeBendPoint = (bendPointIndex: number) => {
    if (!onBendPointsChange) {
      return;
    }

    onBendPointsChange(
      id,
      bendPoints.filter((_, index) => index !== bendPointIndex)
    );
  };

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (suppressLabelClickRef.current) {
      suppressLabelClickRef.current = false;
      return;
    }

    if (onEdgeClick) {
      onEdgeClick(id);
    }
  };

  const isDragging = dragState !== null;
  const middleSegmentIndex = Math.floor(edgeSegments.length / 2);

  const startSegmentDrag = (
    event: React.MouseEvent,
    segmentIndex: number,
    openOnClickWhenLocked = false
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (!edgeEditingEnabled) {
      if (openOnClickWhenLocked && onEdgeClick) {
        onEdgeClick(id);
      }
      return;
    }

    suppressLabelClickRef.current = true;

    setDragState({
      kind: 'segment',
      segmentIndex,
      startClientX: event.clientX,
      startClientY: event.clientY,
      insertedBendPointIndex: null,
    });
  };

  return (
    <>
      {edgeSegments.map(({ edgePath }, segmentIndex) => (
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
            className={`react-flow__edge-interaction${edgeEditingEnabled ? ` networkEdgeDragPath${isDragging ? 'is-dragging' : ''}` : ''}`}
            onMouseDown={event => startSegmentDrag(event, segmentIndex, true)}
          />
        </g>
      ))}
      {displayRights.length > 0 && middleSegment && (
        <EdgeLabelRenderer>
          <button
            type="button"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${middleSegment.labelX}px,${middleSegment.labelY}px)`,
              pointerEvents: 'all',
            }}
            className={
              edgeEditingEnabled ? 'nodrag nopan cursor-grab' : 'nodrag nopan cursor-pointer'
            }
            onMouseDown={event => startSegmentDrag(event, middleSegmentIndex)}
            onClick={handleLabelClick}
          >
            <div className="border-border/60 bg-background/95 flex flex-wrap gap-0.5 rounded-md border px-1.5 py-1 shadow-sm backdrop-blur-sm">
              {displayRights.map(right => (
                <RightBadge
                  key={right}
                  right={right}
                  requestKind={
                    rightRelationshipKinds[right] === 'incoming' ||
                    rightRelationshipKinds[right] === 'outgoing'
                      ? rightRelationshipKinds[right]
                      : null
                  }
                  className="px-1.5 py-0.5 text-[10px] leading-tight"
                />
              ))}
            </div>
          </button>
        </EdgeLabelRenderer>
      )}
      {edgeEditingEnabled &&
        bendPoints.map((bendPoint, bendPointIndex) => (
          <EdgeLabelRenderer key={`${id}-bend-point-${bendPointIndex}`}>
            <div
              className="networkEdgeBendPointContainer nodrag nopan"
              style={{
                transform: `translate(-50%, -50%) translate(${bendPoint.x}px,${bendPoint.y}px)`,
              }}
            >
              <button
                type="button"
                className={`networkEdgeBendPointButton${dragState?.kind === 'bend-point' && dragState.bendPointIndex === bendPointIndex && dragState.isActive ? 'is-dragging' : ''}`}
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
              />
              <button
                type="button"
                aria-label={t('common.network.removeEdgeBendPoint', 'Remove bend point')}
                className="networkEdgeBendPointDeleteButton"
                onMouseDown={event => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  removeBendPoint(bendPointIndex);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </EdgeLabelRenderer>
        ))}
    </>
  );
}
