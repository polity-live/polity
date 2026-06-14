'use client';

import type { ReactNode } from 'react';

import {
  useGroupNetworkFlowController,
  type GroupNetworkFlowProps,
} from '../hooks/useGroupNetworkFlowController';

export type { GroupNetworkFlowProps };

export interface GroupNetworkFlowViewProps {
  content: ReactNode;
  className?: string;
}

export function GroupNetworkFlow(props: GroupNetworkFlowProps) {
  const content = useGroupNetworkFlowController(props);

  return <GroupNetworkFlowView content={content} />;
}

export function GroupNetworkFlowView({ content, className }: GroupNetworkFlowViewProps) {
  return className ? <div className={className}>{content}</div> : <>{content}</>;
}
