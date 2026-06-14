'use client';

import { featureThemeMarkup, featureThemeValue } from '@/features/shared/theme';
import { createContext, ReactNode, useContext, type ComponentProps } from 'react';
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
import { useNetworkFlowBaseController } from '@/features/network/hooks/useNetworkFlowBaseController';
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

interface NetworkFlowBaseViewProps<T extends Node = Node> extends NetworkFlowBaseProps<T> {
  isFullscreen: boolean;
  edgeTypes?: ComponentProps<typeof ReactFlow>['edgeTypes'];
  onFullscreenChange: (isFullscreen: boolean) => void;
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
  const { isFullscreen, setIsFullscreen, handleEdgeLabelClick } = useNetworkFlowBaseController({
    edges,
    onEdgeClick,
  });

  return (
    <NetworkFlowBaseProviderView
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      nodesDraggable={nodesDraggable}
      nodesFocusable={nodesFocusable}
      nodesConnectable={nodesConnectable}
      edgesFocusable={edgesFocusable}
      panel={panel}
      onInteractiveChange={onInteractiveChange}
      containerClassName={containerClassName}
      miniMapProps={miniMapProps}
      showMiniMap={showMiniMap}
      edgeTypes={edgeTypes}
      isFullscreen={isFullscreen}
      onFullscreenChange={setIsFullscreen}
      handleEdgeLabelClick={handleEdgeLabelClick}
    >
      {children}
    </NetworkFlowBaseProviderView>
  );
}

interface NetworkFlowBaseProviderViewProps<
  T extends Node = Node,
> extends NetworkFlowBaseViewProps<T> {
  handleEdgeLabelClick: (edgeId: string) => void;
}

function NetworkFlowBaseProviderView<T extends Node = Node>({
  handleEdgeLabelClick,
  children,
  ...viewProps
}: NetworkFlowBaseProviderViewProps<T>) {
  return (
    <EdgeClickContext.Provider value={handleEdgeLabelClick}>
      <NetworkFlowBaseView {...viewProps}>{children}</NetworkFlowBaseView>
    </EdgeClickContext.Provider>
  );
}

export function NetworkFlowBaseView<T extends Node = Node>({
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
  isFullscreen,
  edgeTypes,
  onFullscreenChange,
}: NetworkFlowBaseViewProps<T>) {
  return (
    <div
      className={cn(
        'bg-background w-full border',
        isFullscreen
          ? 'fixed inset-0 z-50 h-dvh min-h-0 rounded-none border-0'
          : ['rounded-lg', containerClassName]
      )}
    >
      <style>{featureThemeMarkup('networkNetworkFlowBaseReactFlowDarkModeStyles')}</style>
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
            onClick={() => onFullscreenChange(!isFullscreen)}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </ControlButton>
        </Controls>
        {showMiniMap && <MiniMap zoomable pannable {...miniMapProps} />}
        <Background color={featureThemeValue('floweditorFlowEditorNeutralColor')} gap={16} />
      </ReactFlow>
      {children}
    </div>
  );
}

export { Panel };
