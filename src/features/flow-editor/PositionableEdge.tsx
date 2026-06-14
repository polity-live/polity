import {
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useReactFlow,
} from 'reactflow';

import type { EdgeProps } from 'reactflow';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

import ClickableBaseEdge from './ClickableBaseEdge.tsx';
import './PositionableEdge.css';

interface PositionHandler {
  x: number;
  y: number;
  active: boolean;
}

interface PositionableEdgeData {
  type?: 'straight' | 'smoothstep' | 'default';
  positionHandlers?: PositionHandler[];
}

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
}: EdgeProps<PositionableEdgeData>) {
  const reactFlowInstance = useReactFlow();
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
    <>
      {edgeSegmentsArray.map(({ edgePath }, index) => (
        <ClickableBaseEdge
          onDoubleClick={event => {
            const position = reactFlowInstance.screenToFlowPosition({
              x: event.clientX,
              y: event.clientY,
            });

            insertPositionHandler(index, {
              x: position.x,
              y: position.y,
              active: false,
            });
          }}
          key={`edge${id}_segment${index}`}
          id={`edge${id}_segment${index}`}
          path={edgePath}
          markerEnd={index === edgeSegmentsArray.length - 1 ? markerEnd : undefined}
          style={style}
        />
      ))}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: 'white',
              padding: '2px 5px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 700,
              pointerEvents: 'all',
              border: '1px solid #ddd',
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
      {positionHandlers.map(({ x, y, active }, handlerIndex) => (
        <EdgeLabelRenderer key={`edge${id}_handler${handlerIndex}`}>
          <div
            className="nopan positionHandlerContainer"
            style={{
              transform: `translate(-50%, -50%) translate(${x}px,${y}px)`,
            }}
          >
            <div
              className={`positionHandlerEventContainer ${active ? 'active' : ''}`}
              onMouseMove={event => {
                if (!active) {
                  return;
                }
                const position = reactFlowInstance.screenToFlowPosition({
                  x: event.clientX,
                  y: event.clientY,
                });
                movePositionHandlerTo(handlerIndex, position.x, position.y);
              }}
              onMouseUp={clearActivePositionHandlers}
            >
              <button
                type="button"
                aria-label="Move edge bend point"
                aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Delete Backspace"
                className="positionHandler"
                onMouseDown={() => setPositionHandlerActive(handlerIndex, true)}
                onContextMenu={event => {
                  event.preventDefault();
                  removePositionHandler(handlerIndex);
                }}
                onKeyDown={event => handlePositionHandlerKeyDown(event, handlerIndex)}
              ></button>
            </div>
          </div>
        </EdgeLabelRenderer>
      ))}
    </>
  );
}
