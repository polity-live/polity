import { useCallback, useEffect, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { Edge } from '@xyflow/react';

interface UseNetworkFlowBaseControllerOptions {
  edges: Edge[];
  onEdgeClick?: (event: ReactMouseEvent, edge: Edge) => void;
}

export function useNetworkFlowBaseController({
  edges,
  onEdgeClick,
}: UseNetworkFlowBaseControllerOptions) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleEdgeLabelClick = useCallback(
    (edgeId: string) => {
      if (!onEdgeClick) return;
      const edge = edges.find(item => item.id === edgeId);
      if (edge) {
        const syntheticEvent = new MouseEvent('click') as unknown as ReactMouseEvent;
        onEdgeClick(syntheticEvent, edge);
      }
    },
    [edges, onEdgeClick]
  );

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  return {
    isFullscreen,
    setIsFullscreen,
    handleEdgeLabelClick,
  };
}
