import type { CSSProperties } from 'react';
import type { Connection, Edge, Node } from 'reactflow';

export type FlowEditorConnection = Connection;

export interface FlowEditorNodeData {
  label: string;
}

export interface FlowEditorEdgeData {
  label?: string;
  type?: string;
  positionHandlers?: { x: number; y: number; active: boolean }[];
}

export type FlowEditorNode = Node<FlowEditorNodeData>;
export type FlowEditorEdge = Edge<FlowEditorEdgeData>;

export type FlowEditorNodeStyle = CSSProperties;
