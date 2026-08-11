import { getSmoothStepPath, useReactFlow } from '@xyflow/react';
import type { Edge, EdgeProps, XYPosition } from '@xyflow/react';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { resolveInnerAutoEdgeAnchors } from '@/features/network/logic/networkEdgeHelpers';
import { useEdgeClickContext } from '@/features/network/ui/NetworkFlowBase';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { EditableRightsLabelEdgeData } from '@/features/network/types/networkEdge.types';
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

export function useRightsLabelEdgeController({
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

  const middleSegment = edgeSegments[Math.floor(edgeSegments.length / 2)];

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

  return {
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
    t,
    reactFlowInstance,
    onEdgeClick,
    suppressLabelClickRef,
    dragState,
    setDragState,
    bendPoints,
    edgeEditingEnabled,
    onBendPointsChange,
    resolvedEdgeEndpoints,
    edgeSegments,
    middleSegment,
    openRelationshipDetailsLabel,
    moveBendPointLabel,
    removeBendPointLabel,
    displayRights,
    rightRelationshipKinds,
    removeBendPoint,
    nudgeBendPoint,
    handleBendPointKeyDown,
    handleLabelClick,
    isDragging,
    middleSegmentIndex,
    startSegmentDrag,
  };
}
