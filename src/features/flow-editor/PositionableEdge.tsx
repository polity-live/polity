import { getBezierPath, getSmoothStepPath, getStraightPath, useReactFlow } from '@xyflow/react';

import type { EdgeProps } from '@xyflow/react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { FlowEditorEdge, FlowEditorNode } from './types';

interface PositionHandler {
  x: number;
  y: number;
  active: boolean;
}

import { PositionableEdgeView } from './PositionableEdgeView';
export default function PositionableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  label,
}: EdgeProps<FlowEditorEdge>) {
  const reactFlowInstance = useReactFlow<FlowEditorNode, FlowEditorEdge>();
  const positionHandlers = data?.positionHandlers ?? [];
  const type = data?.type ?? 'default';
  const edgeSegmentsCount = positionHandlers.length + 1;
  const edgeSegmentsArray: { edgePath: string; labelX: number; labelY: number }[] = [];

  let pathFunction;
  switch (type) {
    case 'straight':
      pathFunction = getStraightPath;
      break;
    case 'smoothstep':
      pathFunction = getSmoothStepPath;
      break;
    default:
      pathFunction = getBezierPath;
  }

  // calculate the origin and destination of all the segments
  for (let i = 0; i < edgeSegmentsCount; i++) {
    let segmentSourceX, segmentSourceY, segmentTargetX, segmentTargetY;

    if (i === 0) {
      segmentSourceX = sourceX;
      segmentSourceY = sourceY;
    } else {
      const handler = positionHandlers[i - 1];
      segmentSourceX = handler.x;
      segmentSourceY = handler.y;
    }

    if (i === edgeSegmentsCount - 1) {
      segmentTargetX = targetX;
      segmentTargetY = targetY;
    } else {
      const handler = positionHandlers[i];
      segmentTargetX = handler.x;
      segmentTargetY = handler.y;
    }

    const [edgePath, labelX, labelY] = pathFunction({
      sourceX: segmentSourceX,
      sourceY: segmentSourceY,
      sourcePosition,
      targetX: segmentTargetX,
      targetY: segmentTargetY,
      targetPosition,
    });
    edgeSegmentsArray.push({ edgePath, labelX, labelY });
  }

  const middleSegmentIndex = Math.floor(edgeSegmentsArray.length / 2);
  const { labelX, labelY } = edgeSegmentsArray[middleSegmentIndex];

  const updatePositionHandlers = (updater: (handlers: PositionHandler[]) => PositionHandler[]) => {
    reactFlowInstance.setEdges(edges =>
      edges.map(edge => {
        if (edge.id !== id) {
          return edge;
        }

        const nextPositionHandlers = updater([...(edge.data?.positionHandlers ?? [])]);

        return {
          ...edge,
          data: {
            ...edge.data,
            positionHandlers: nextPositionHandlers,
          },
        };
      })
    );
  };

  const insertPositionHandler = (handlerIndex: number, handler: PositionHandler) => {
    updatePositionHandlers(handlers => {
      handlers.splice(handlerIndex, 0, handler);
      return handlers;
    });
  };

  const setPositionHandlerActive = (handlerIndex: number, active: boolean) => {
    updatePositionHandlers(handlers =>
      handlers.map((handler, index) => (index === handlerIndex ? { ...handler, active } : handler))
    );
  };

  const movePositionHandlerTo = (handlerIndex: number, x: number, y: number) => {
    updatePositionHandlers(handlers =>
      handlers.map((handler, index) => (index === handlerIndex ? { ...handler, x, y } : handler))
    );
  };

  const movePositionHandlerBy = (handlerIndex: number, deltaX: number, deltaY: number) => {
    updatePositionHandlers(handlers =>
      handlers.map((handler, index) =>
        index === handlerIndex
          ? {
              ...handler,
              x: handler.x + deltaX,
              y: handler.y + deltaY,
            }
          : handler
      )
    );
  };

  const removePositionHandler = (handlerIndex: number) => {
    updatePositionHandlers(handlers => handlers.filter((_, index) => index !== handlerIndex));
  };

  const clearActivePositionHandlers = () => {
    reactFlowInstance.setEdges(edges =>
      edges.map(edge => {
        if (!edge.data?.positionHandlers) {
          return edge;
        }

        return {
          ...edge,
          data: {
            ...edge.data,
            positionHandlers: edge.data.positionHandlers.map((handler: PositionHandler) => ({
              ...handler,
              active: false,
            })),
          },
        };
      })
    );
  };

  const handlePositionHandlerKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    handlerIndex: number
  ) => {
    const step = event.shiftKey ? 20 : 8;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        event.stopPropagation();
        movePositionHandlerBy(handlerIndex, -step, 0);
        break;
      case 'ArrowRight':
        event.preventDefault();
        event.stopPropagation();
        movePositionHandlerBy(handlerIndex, step, 0);
        break;
      case 'ArrowUp':
        event.preventDefault();
        event.stopPropagation();
        movePositionHandlerBy(handlerIndex, 0, -step);
        break;
      case 'ArrowDown':
        event.preventDefault();
        event.stopPropagation();
        movePositionHandlerBy(handlerIndex, 0, step);
        break;
      case 'Backspace':
      case 'Delete':
        event.preventDefault();
        event.stopPropagation();
        removePositionHandler(handlerIndex);
        break;
      default:
        break;
    }
  };
  return (
    <PositionableEdgeView
      id={id}
      sourceX={sourceX}
      sourceY={sourceY}
      targetX={targetX}
      targetY={targetY}
      sourcePosition={sourcePosition}
      targetPosition={targetPosition}
      style={style}
      markerEnd={markerEnd}
      data={data}
      label={label}
      reactFlowInstance={reactFlowInstance}
      positionHandlers={positionHandlers}
      type={type}
      edgeSegmentsCount={edgeSegmentsCount}
      edgeSegmentsArray={edgeSegmentsArray}
      pathFunction={pathFunction}
      middleSegmentIndex={middleSegmentIndex}
      labelX={labelX}
      labelY={labelY}
      updatePositionHandlers={updatePositionHandlers}
      insertPositionHandler={insertPositionHandler}
      setPositionHandlerActive={setPositionHandlerActive}
      movePositionHandlerTo={movePositionHandlerTo}
      movePositionHandlerBy={movePositionHandlerBy}
      removePositionHandler={removePositionHandler}
      clearActivePositionHandlers={clearActivePositionHandlers}
      handlePositionHandlerKeyDown={handlePositionHandlerKeyDown}
    />
  );
}
