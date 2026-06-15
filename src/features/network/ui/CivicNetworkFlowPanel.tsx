'use client';

import {
  NetworkControlPanel,
  type NetworkControlPanelProps,
} from '@/features/network/ui/NetworkControlPanel';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export function CivicNetworkFlowPanel({
  legendTitle = translateText('common.network.legend'),
  ...props
}: NetworkControlPanelProps) {
  return <NetworkControlPanel {...props} legendTitle={legendTitle} />;
}
