'use client';

import {
  useEventNetworkFlowController,
  type EventNetworkFlowProps,
} from '@/features/network/hooks/useEventNetworkFlowController';
import { EventNetworkFlowView } from './EventNetworkFlowView';

export type { EventNetworkFlowProps };

export function EventNetworkFlow(props: EventNetworkFlowProps) {
  const viewModel = useEventNetworkFlowController(props);

  return <EventNetworkFlowView {...viewModel} />;
}
