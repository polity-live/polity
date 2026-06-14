import type { ReactNode } from 'react';

import {
  useManageWorkflowsTabViewModel,
  type ManageWorkflowsTabProps,
} from '../hooks/useManageWorkflowsTabViewModel';

export type { ManageWorkflowsTabProps };

export interface ManageWorkflowsTabViewProps {
  content: ReactNode;
  className?: string;
}

export function ManageWorkflowsTab(props: ManageWorkflowsTabProps) {
  const content = useManageWorkflowsTabViewModel(props);

  return <ManageWorkflowsTabView content={content} />;
}

export function ManageWorkflowsTabView({ content, className }: ManageWorkflowsTabViewProps) {
  return className ? <div className={className}>{content}</div> : <>{content}</>;
}
