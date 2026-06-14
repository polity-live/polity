'use client';

import {
  useWorkflowEditorViewModel,
  type WorkflowEditorProps,
} from '../hooks/useWorkflowEditorViewModel';
import { WorkflowEditorContentView } from './WorkflowEditorContentView';

export type { WorkflowEditorProps };

export function WorkflowEditor(props: WorkflowEditorProps) {
  const viewModel = useWorkflowEditorViewModel(props);

  return <WorkflowEditorContentView {...viewModel} />;
}
