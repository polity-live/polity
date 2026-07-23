'use client';

import { useSubscriptionStatusController } from '../hooks/useSubscriptionStatusController';
import { SubscriptionStatusView } from './SubscriptionStatusView';

interface SubscriptionStatusProps {
  userId: string;
  refreshKey?: number;
}

export function SubscriptionStatus({ userId, refreshKey }: SubscriptionStatusProps) {
  return <SubscriptionStatusView {...useSubscriptionStatusController({ userId, refreshKey })} />;
}
