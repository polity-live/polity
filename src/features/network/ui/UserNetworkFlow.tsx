'use client';

import type { ReactNode } from 'react';

import {
  useUserNetworkFlowController,
  type UserNetworkFlowProps,
} from '../hooks/useUserNetworkFlowController';

export type { UserNetworkFlowProps };

export interface UserNetworkFlowViewProps {
  content: ReactNode;
  className?: string;
}

export function UserNetworkFlow(props: UserNetworkFlowProps) {
  const content = useUserNetworkFlowController(props);

  return <UserNetworkFlowView content={content} />;
}

export function UserNetworkFlowView({ content, className }: UserNetworkFlowViewProps) {
  return className ? <div className={className}>{content}</div> : <>{content}</>;
}
