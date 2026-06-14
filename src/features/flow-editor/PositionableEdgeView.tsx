import { EdgeLabelRenderer } from 'reactflow';

import ClickableBaseEdge from './ClickableBaseEdge.tsx';
import {
  GraphEdgeLabel,
  GraphPositionHandle,
  GraphPositionHandleContainer,
} from '@/features/shared/ui/graph';
export interface PositionableEdgeViewProps {
  id: any;
  sourceX: any;
  sourceY: any;
  targetX: any;
  targetY: any;
  sourcePosition: any;
  targetPosition: any;
  style: any;
  markerEnd: any;
  data: any;
  label: any;
  reactFlowInstance: any;
  positionHandlers: any;
  type: any;
  edgeSegmentsCount: any;
  edgeSegmentsArray: any;
  pathFunction: any;
  middleSegmentIndex: any;
  labelX: any;
  labelY: any;
  updatePositionHandlers: any;
  insertPositionHandler: any;
  setPositionHandlerActive: any;
  movePositionHandlerTo: any;
  movePositionHandlerBy: any;
  removePositionHandler: any;
  clearActivePositionHandlers: any;
  handlePositionHandlerKeyDown: any;
}

export function PositionableEdgeView({
  id,
  style,
  markerEnd,
  label,
  reactFlowInstance,
  positionHandlers,
  edgeSegmentsArray,
  labelX,
  labelY,
  insertPositionHandler,
  setPositionHandlerActive,
  movePositionHandlerTo,
  removePositionHandler,
  clearActivePositionHandlers,
  handlePositionHandlerKeyDown,
}: PositionableEdgeViewProps) {
  return (
    <>
      {edgeSegmentsArray.map(({ edgePath }: any, index: number) => (
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
          <GraphEdgeLabel x={labelX} y={labelY}>
            {label}
          </GraphEdgeLabel>
        </EdgeLabelRenderer>
      )}
      {positionHandlers.map(({ x, y, active }: any, handlerIndex: number) => (
        <EdgeLabelRenderer key={`edge${id}_handler${handlerIndex}`}>
          <GraphPositionHandleContainer
            x={x}
            y={y}
            active={active}
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
            <GraphPositionHandle
              active={active}
              aria-label="Move edge bend point"
              aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Delete Backspace"
              onMouseDown={() => setPositionHandlerActive(handlerIndex, true)}
              onContextMenu={event => {
                event.preventDefault();
                removePositionHandler(handlerIndex);
              }}
              onKeyDown={event => handlePositionHandlerKeyDown(event, handlerIndex)}
            />
          </GraphPositionHandleContainer>
        </EdgeLabelRenderer>
      ))}
    </>
  );
}
