'use client';

import { useSubscriptionStatusController } from '../hooks/useSubscriptionStatusController';
import { SubscriptionStatusView } from './SubscriptionStatusView';

interface SubscriptionStatusProps {
  userId: string;
}

export function SubscriptionStatus({ userId }: SubscriptionStatusProps) {
  return <SubscriptionStatusView {...useSubscriptionStatusController({ userId })} />;
}
