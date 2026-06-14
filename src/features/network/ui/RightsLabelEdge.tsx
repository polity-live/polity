import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow } from '@xyflow/react';
import type { Edge, EdgeProps, XYPosition } from '@xyflow/react';
import { X } from 'lucide-react';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { resolveInnerAutoEdgeAnchors } from '@/features/network/logic/networkEdgeHelpers';
import { RightBadge } from '@/features/network/ui/RightBadge';
import { useEdgeClickContext } from '@/features/network/ui/NetworkFlowBase';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { EditableRightsLabelEdgeData } from '@/features/network/types/networkEdge.types';
import './RightsLabelEdge.css';

type RightsLabelEdgeType = Edge<EditableRightsLabelEdgeData, 'rightsLabel'>;

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
  source,
  target,
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
}: EdgeProps<RightsLabelEdgeType>) {
  const { t } = useTranslation();
  const reactFlowInstance = useReactFlow();
  const onEdgeClick = useEdgeClickContext();
  const suppressLabelClickRef = useRef(false);
  const [dragState, setDragState] = useState<EdgeDragState | null>(null);
  const bendPoints = Array.isArray(data?.bendPoints) ? data.bendPoints : [];
  const edgeEditingEnabled = data?.edgeEditingEnabled === true;
  const onBendPointsChange = data?.onBendPointsChange;

  const resolvedEdgeEndpoints = useMemo(() => {
    const shouldResolveInnerAnchors =
      data?.anchorStrategy === 'inner-auto' || data?.useInnerVerticalAnchors === true;

    if (!shouldResolveInnerAnchors) {
      return {
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
      };
    }

    const sourceNode = reactFlowInstance.getInternalNode(source);
    const targetNode = reactFlowInstance.getInternalNode(target);

    const sourceWidth = sourceNode?.measured.width ?? sourceNode?.width;
    const sourceHeight = sourceNode?.measured.height ?? sourceNode?.height;
    const targetWidth = targetNode?.measured.width ?? targetNode?.width;
    const targetHeight = targetNode?.measured.height ?? targetNode?.height;

    if (
      !sourceNode?.internals.positionAbsolute ||
      !targetNode?.internals.positionAbsolute ||
      !sourceWidth ||
      !sourceHeight ||
      !targetWidth ||
      !targetHeight
    ) {
      return {
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
      };
    }

    return resolveInnerAutoEdgeAnchors({
      sourceRect: {
        x: sourceNode.internals.positionAbsolute.x,
        y: sourceNode.internals.positionAbsolute.y,
        width: sourceWidth,
        height: sourceHeight,
      },
      targetRect: {
        x: targetNode.internals.positionAbsolute.x,
        y: targetNode.internals.positionAbsolute.y,
        width: targetWidth,
        height: targetHeight,
      },
    });
  }, [
    data?.anchorStrategy,
    data?.useInnerVerticalAnchors,
    reactFlowInstance,
    source,
    sourcePosition,
    sourceX,
    sourceY,
    target,
    targetPosition,
    targetX,
    targetY,
  ]);

  const edgeSegments = useMemo(() => {
    const segmentPoints: XYPosition[] = [
      { x: resolvedEdgeEndpoints.sourceX, y: resolvedEdgeEndpoints.sourceY },
      ...bendPoints,
      { x: resolvedEdgeEndpoints.targetX, y: resolvedEdgeEndpoints.targetY },
    ];

    return segmentPoints.slice(0, -1).map((segmentSource, index) => {
      const segmentTarget = segmentPoints[index + 1];
      const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX: segmentSource.x,
        sourceY: segmentSource.y,
        targetX: segmentTarget.x,
        targetY: segmentTarget.y,
        sourcePosition: resolvedEdgeEndpoints.sourcePosition,
        targetPosition: resolvedEdgeEndpoints.targetPosition,
      });

      return {
        edgePath,
        labelX,
        labelY,
      };
    });
  }, [bendPoints, resolvedEdgeEndpoints]);

  const middleSegment = edgeSegments[Math.floor(edgeSegments.length / 2)] ?? null;
  const openRelationshipDetailsLabel = t(
    'common.network.openRelationshipDetails',
    'Open relationship details'
  );
  const moveBendPointLabel = t('common.network.moveEdgeBendPoint', 'Move edge bend point');
  const removeBendPointLabel = t('common.network.removeEdgeBendPoint', 'Remove edge bend point');

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

  const nudgeBendPoint = (bendPointIndex: number, deltaX: number, deltaY: number) => {
    if (!onBendPointsChange) {
      return;
    }

    const activeBendPoint = bendPoints[bendPointIndex];
    if (!activeBendPoint) {
      return;
    }

    onBendPointsChange(
      id,
      bendPoints.map((bendPoint, index) =>
        index === bendPointIndex
          ? {
              x: bendPoint.x + deltaX,
              y: bendPoint.y + deltaY,
            }
          : bendPoint
      )
    );
  };

  const handleBendPointKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    bendPointIndex: number
  ) => {
    const step = event.shiftKey ? 20 : 8;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        event.stopPropagation();
        nudgeBendPoint(bendPointIndex, -step, 0);
        break;
      case 'ArrowRight':
        event.preventDefault();
        event.stopPropagation();
        nudgeBendPoint(bendPointIndex, step, 0);
        break;
      case 'ArrowUp':
        event.preventDefault();
        event.stopPropagation();
        nudgeBendPoint(bendPointIndex, 0, -step);
        break;
      case 'ArrowDown':
        event.preventDefault();
        event.stopPropagation();
        nudgeBendPoint(bendPointIndex, 0, step);
        break;
      case 'Backspace':
      case 'Delete':
        event.preventDefault();
        event.stopPropagation();
        removeBendPoint(bendPointIndex);
        break;
      default:
        break;
    }
  };

  const handleLabelClick = (e: ReactMouseEvent) => {
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
    event: ReactMouseEvent,
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
            aria-label={openRelationshipDetailsLabel}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${middleSegment.labelX}px,${middleSegment.labelY}px)`,
              pointerEvents: 'all',
            }}
            className={`networkEdgeLabelButton ${edgeEditingEnabled ? 'nodrag nopan cursor-grab' : 'nodrag nopan cursor-pointer'}`}
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
                aria-label={moveBendPointLabel}
                aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Delete Backspace"
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
                onKeyDown={event => handleBendPointKeyDown(event, bendPointIndex)}
              />
              <button
                type="button"
                aria-label={removeBendPointLabel}
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
