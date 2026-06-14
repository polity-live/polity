'use client';

import type { ReactNode } from 'react';

import {
  useWorkflowEditorViewModel,
  type WorkflowEditorProps,
} from '../hooks/useWorkflowEditorViewModel';

export type { WorkflowEditorProps };

export interface WorkflowEditorViewProps {
  content: ReactNode;
  className?: string;
}

export function WorkflowEditor(props: WorkflowEditorProps) {
  const content = useWorkflowEditorViewModel(props);

  return <WorkflowEditorView content={content} />;
}

export function WorkflowEditorView({ content, className }: WorkflowEditorViewProps) {
  return className ? <div className={className}>{content}</div> : <>{content}</>;
}
