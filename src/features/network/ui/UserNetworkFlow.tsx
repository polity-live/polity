'use client';

import {
  useUserNetworkFlowController,
  type UserNetworkFlowProps,
} from '../hooks/useUserNetworkFlowController';
import { UserNetworkFlowContentView } from './UserNetworkFlowContentView';

export type { UserNetworkFlowProps };

export function UserNetworkFlow(props: UserNetworkFlowProps) {
  const viewModel = useUserNetworkFlowController(props);

  return <UserNetworkFlowContentView {...viewModel} />;
}
