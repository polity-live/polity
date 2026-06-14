import type { CSSProperties } from 'react';

export interface FlowEditorConnection {
  source: string | null;
  target: string | null;
  sourceHandle: string | null;
  targetHandle: string | null;
}

export interface FlowEditorNode {
  id: string;
  position: { x: number; y: number };
  data: { label: string };
  type?: string;
  style?: CSSProperties;
  parentId?: string;
  extent?: 'parent';
}

export interface FlowEditorEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  type?: string;
  style?: CSSProperties;
  data?: {
    label?: string;
    type?: string;
    positionHandlers?: { x: number; y: number; active: boolean }[];
  };
}
