'use client';

import {
  useGroupNetworkFlowController,
  type GroupNetworkFlowProps,
} from '../hooks/useGroupNetworkFlowController';
import { GroupNetworkFlowContentView } from './GroupNetworkFlowContentView';

export type { GroupNetworkFlowProps };

export function GroupNetworkFlow(props: GroupNetworkFlowProps) {
  const viewModel = useGroupNetworkFlowController(props);

  return <GroupNetworkFlowContentView {...viewModel} />;
}
