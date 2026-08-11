import React from 'react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface ClickableBaseEdgeProps {
  id: string;
  path: string;
  style?: React.CSSProperties;
  markerEnd?: string;
  markerStart?: string;
  interactionWidth?: number;
  onClick?: (event: React.MouseEvent) => void;
  onDoubleClick?: (event: React.MouseEvent) => void;
}

const ClickableBaseEdge = ({
  id,
  path,
  style,
  markerEnd,
  markerStart,
  interactionWidth = 20,
  onClick,
  onDoubleClick,
}: ClickableBaseEdgeProps) => {
  return (
    <>
      <path
        id={id}
        style={style}
        d={path}
        fill="none"
        className="react-flow__edge-path"
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
      {interactionWidth && (
        <path
          data-action-id="flow-editor.edge-path.insert-bend"
          d={path}
          fill="none"
          strokeOpacity={0}
          strokeWidth={interactionWidth}
          className="react-flow__edge-interaction"
          role="button"
          tabIndex={0}
          aria-label={translateText('common.accessibility.insertEdgeBendPoint')}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          onKeyDown={event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;

            event.preventDefault();
            if (onDoubleClick) {
              onDoubleClick(event as unknown as React.MouseEvent);
            } else {
              onClick?.(event as unknown as React.MouseEvent);
            }
          }}
        />
      )}
    </>
  );
};

ClickableBaseEdge.displayName = 'BaseEdge';

export default ClickableBaseEdge;
