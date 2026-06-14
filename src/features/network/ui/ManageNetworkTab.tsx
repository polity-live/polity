import type { ReactNode } from 'react';

import {
  useManageNetworkTabController,
  type ManageNetworkTabProps,
} from '../hooks/useManageNetworkTabController';

export type { ManageNetworkTabProps };

export interface ManageNetworkTabViewProps {
  content: ReactNode;
  className?: string;
}

export function ManageNetworkTab(props: ManageNetworkTabProps) {
  const content = useManageNetworkTabController(props);

  return <ManageNetworkTabView content={content} />;
}

export function ManageNetworkTabView({ content, className }: ManageNetworkTabViewProps) {
  return className ? <div className={className}>{content}</div> : <>{content}</>;
}
