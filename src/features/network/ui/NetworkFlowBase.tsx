'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
} from 'react';
import {
  ReactFlow,
  Controls,
  ControlButton,
  Background,
  MiniMap,
  Panel,
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
} from '@xyflow/react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { RightsLabelEdge } from '@/features/network/ui/RightsLabelEdge';
import { cn } from '@/features/shared/utils/utils';

// Context to allow custom edge components to trigger onEdgeClick
const EdgeClickContext = createContext<((edgeId: string) => void) | null>(null);
export const useEdgeClickContext = () => useContext(EdgeClickContext);

const edgeTypes = { rightsLabel: RightsLabelEdge };

interface NetworkFlowBaseProps<T extends Node = Node> {
  nodes: T[];
  edges: Edge[];
  onNodesChange?: OnNodesChange<T>;
  onEdgesChange?: OnEdgesChange;
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  onEdgeClick?: (event: React.MouseEvent, edge: Edge) => void;
  nodesDraggable?: boolean;
  nodesFocusable?: boolean;
  nodesConnectable?: boolean;
  edgesFocusable?: boolean;
  panel: ReactNode;
  onInteractiveChange?: (interactive: boolean) => void;
  children?: ReactNode;
  containerClassName?: string;
  miniMapProps?: ComponentProps<typeof MiniMap>;
  showMiniMap?: boolean;
}

export function NetworkFlowBase<T extends Node = Node>({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onEdgeClick,
  nodesDraggable = true,
  nodesFocusable = true,
  nodesConnectable = true,
  edgesFocusable = true,
  panel,
  onInteractiveChange,
  children,
  containerClassName = 'h-[32rem] min-h-[24rem]',
  miniMapProps,
  showMiniMap = true,
}: NetworkFlowBaseProps<T>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleEdgeLabelClick = useCallback(
    (edgeId: string) => {
      if (!onEdgeClick) return;
      const edge = edges.find(e => e.id === edgeId);
      if (edge) {
        const syntheticEvent = new MouseEvent('click') as unknown as React.MouseEvent;
        onEdgeClick(syntheticEvent, edge);
      }
    },
    [onEdgeClick, edges]
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

  return (
    <EdgeClickContext.Provider value={handleEdgeLabelClick}>
      <div
        className={cn(
          'bg-background w-full border',
          isFullscreen
            ? 'fixed inset-0 z-50 h-dvh min-h-0 rounded-none border-0'
            : ['rounded-lg', containerClassName]
        )}
      >
        <style>{`
        /* Dark mode styles for ReactFlow controls */
        .dark .react-flow__controls {
          button {
            background-color: hsl(var(--background));
            border-color: hsl(var(--border));
            color: hsl(var(--foreground));
          }

          button:hover {
            background-color: hsl(var(--accent));
          }

          button path {
            fill: currentColor;
          }
        }

        /* Dark mode styles for MiniMap */
        .dark .react-flow__minimap {
          background-color: hsl(var(--background));
          border-color: hsl(var(--border));
        }

        .dark .react-flow__minimap-mask {
          fill: hsl(var(--muted) / 0.3);
        }

        /* Dark mode styles for Panel */
        .dark .react-flow__panel {
          background-color: hsl(var(--background));
          border-color: hsl(var(--border));
          color: hsl(var(--foreground));
        }
      `}</style>
        <ReactFlow
          className="h-full w-full"
          nodes={nodes}
          edges={edges}
          edgeTypes={edgeTypes}
          nodesDraggable={nodesDraggable}
          nodesFocusable={nodesFocusable}
          nodesConnectable={nodesConnectable}
          edgesFocusable={edgesFocusable}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          fitView
        >
          {panel}
          <Controls onInteractiveChange={onInteractiveChange}>
            <ControlButton
              onClick={() => setIsFullscreen(currentValue => !currentValue)}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </ControlButton>
          </Controls>
          {showMiniMap && <MiniMap zoomable pannable {...miniMapProps} />}
          <Background color="#aaa" gap={16} />
        </ReactFlow>
        {children}
      </div>
    </EdgeClickContext.Provider>
  );
}

export { Panel };
