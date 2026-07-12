import type { CSSProperties } from 'react';
import type { Connection, Edge, Node } from '@xyflow/react';

export type FlowEditorConnection = Connection;

export interface FlowEditorNodeData extends Record<string, unknown> {
  label: string;
}

export interface FlowEditorEdgeData extends Record<string, unknown> {
  label?: string;
  type?: string;
  positionHandlers?: { x: number; y: number; active: boolean }[];
}

export type FlowEditorNode = Node<FlowEditorNodeData>;
export type FlowEditorEdge = Edge<FlowEditorEdgeData>;

export type FlowEditorNodeStyle = CSSProperties;
